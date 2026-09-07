/**
 * UPSTREAM SHIM (#142) — the whole file. What MUI's `TextField` would do on its
 * own if mui/material-ui#37846 had landed: accept a `variant` outside its closed
 * `'outlined' | 'standard' | 'filled'` union, and render *something* for it
 * instead of throwing.
 *
 * The type side is MUI's own mechanism (`OverridableStringUnion` over an
 * augmentable `*PropsVariantOverrides` interface, exactly as `Button` /
 * `Chip` / `FormHelperText` already do); the interface itself is declared in
 * `src/theme/augmentation.ts` until `@mui/material` exports it.
 *
 * The runtime side is one line: MUI resolves the input as
 * `slots.input ?? variantComponent[variant]` (`TextField.js`), so a custom
 * variant only needs `slots.input` filled in. See `customVariantSlots`.
 *
 * Deletion plan: `grep -rn 'UPSTREAM SHIM (#142)' src` — when upstream ships,
 * `EzTextFieldVariants` becomes an alias of MUI's own `TextFieldVariants`,
 * `customVariantSlots` and its call sites go, and the casts at each
 * `<MuiTextField>` boundary go with them.
 */
import { forwardRef, type ElementType } from 'react'
import FilledInput from '@mui/material/FilledInput'
import { useFormControl } from '@mui/material/FormControl'
import Input from '@mui/material/Input'
import OutlinedInput from '@mui/material/OutlinedInput'
import {
  PickersFilledInput,
  PickersInput,
  PickersOutlinedInput,
} from '@mui/x-date-pickers/PickersTextField'
import type { OverridableStringUnion } from '@mui/types'
import type { TextFieldVariants, TextFieldPropsVariantOverrides } from '@mui/material/TextField'

/**
 * MUI's `TextFieldVariants`, reopened. Identical to it until something augments
 * `TextFieldPropsVariantOverrides`; ez-form itself adds `'stacked'`, and a
 * consumer adds their own with the same `declare module` line the MUI docs will
 * show once upstream ships:
 *
 * ```ts
 * declare module '@mui/material/TextField' {
 *   interface TextFieldPropsVariantOverrides { dashed: true }
 * }
 * ```
 */
export type EzTextFieldVariants = OverridableStringUnion<
  TextFieldVariants,
  TextFieldPropsVariantOverrides
>

/** The three MUI renders from its own `variantComponent` map. */
const BUILT_IN_TEXT_FIELD_VARIANTS = ['outlined', 'standard', 'filled'] as const

/**
 * Whether MUI's own `variantComponent[variant]` lookup will find an input for
 * this variant — i.e. whether it renders without help.
 */
export function isBuiltInTextFieldVariant(
  variant: EzTextFieldVariants | undefined,
): variant is TextFieldVariants {
  return (BUILT_IN_TEXT_FIELD_VARIANTS as readonly string[]).includes(variant as string)
}

/**
 * Fills in `slots.input` for a custom variant, and leaves `slots` untouched for
 * a built-in or absent one (MUI's own map answers those).
 *
 * The fallback mirrors the upstream patch's `variantComponent[variant] ??
 * OutlinedInput`: the outlined box is the structure the other two are variations
 * of, so a custom variant starts from a shape a theme can restyle rather than
 * from nothing. The notch never opens for it — `TextField` passes `label` to the
 * input only under `variant === 'outlined'` (`TextField.js`), so
 * `NotchedOutline` renders with `withLabel` false and the legend stays collapsed
 * whatever `notched` says.
 *
 * The consumer's own `slots.input` wins: it is spread *after* the fallback, so
 * `slots={{ input: MyInput }}` is how a custom variant chooses another input,
 * exactly as it would upstream.
 *
 * Deliberately `OutlinedInput` and not `VariantInput` below, even though both exist
 * for the same shim. They answer different questions, and using one for both would
 * make each worse:
 *
 * - This function already knows the variant — it is the argument — and it returns
 *   *nothing at all* for a built-in one, leaving MUI's own map to answer. So there is
 *   no variant left to switch on by the time a value is needed; `VariantInput` here
 *   would re-derive from context a variant this function was handed directly.
 * - `VariantInput` exists only because a *theme's* `defaultProps.slots` is a constant
 *   that cannot be keyed on the variant. That is a limitation of the theme channel,
 *   not of this one.
 *
 * Both fall back to the same `OutlinedInput` for a custom variant, which is the one
 * behaviour that has to agree, and both are deleted together.
 */
export function customVariantSlots<S extends { input?: ElementType } | undefined>(
  variant: EzTextFieldVariants | undefined,
  slots: S,
  fallback: ElementType = OutlinedInput,
): S | (S & { input: ElementType }) {
  if (isBuiltInTextFieldVariant(variant) || variant === undefined) return slots
  return { input: fallback, ...slots }
}

/**
 * UPSTREAM SHIM (#142). The `slots.input` a *theme* sets, as opposed to the one
 * `customVariantSlots` sets per field.
 *
 * A theme's `defaultProps.slots` is a plain object that MUI's `resolveProps` merges
 * as `{ ...defaultProps.slots, ...consumerSlots }` — it cannot be keyed on the
 * resolved `variant`, and `theme.components.*.variants` only ever contributes
 * `style`, never `slots`. So a constant `OutlinedInput` there reaches *every* bare
 * `<MuiTextField>` under the preset, forcing the `filled` and `standard` variants onto
 * the outlined box as well. This component is the fix: one slot value that resolves
 * the input itself, at render, from the variant in scope.
 *
 * `builtInInputs` is a copy of MUI's own `variantComponent` map (`TextField.js`) —
 * the same map the upstream patch keeps and falls back from, which is why copying it
 * here is the shim mirroring upstream rather than a re-implementation. Anything not
 * in it is a custom variant and gets `OutlinedInput`, exactly as
 * `customVariantSlots` does.
 *
 * The variant is read from `FormControl` context rather than from props: MUI's
 * `useSlot` does **not** forward `variant` into the input slot's props (verified by
 * probe — the slot receives no `variant` key at all), while `TextField` does pass it
 * to the `FormControl` root, and every `InputBase`-derived input already reads it
 * from that context for its own styling.
 *
 * Deleted with the rest of the shim: once `TextField` renders `OutlinedInput` for an
 * unknown variant itself, the theme needs no `slots.input` at all.
 */
const builtInInputs: Record<string, ElementType> = {
  standard: Input,
  filled: FilledInput,
  outlined: OutlinedInput,
}

export const VariantInput = forwardRef<unknown, Record<string, unknown>>(
  function VariantInput(props, ref) {
    const variant = useFormControl()?.variant
    const Component = (variant && builtInInputs[variant]) ?? OutlinedInput
    return <Component ref={ref} {...props} />
  },
)
VariantInput.displayName = 'EzVariantInput'

/**
 * UPSTREAM SHIM (#142). The pickers' twin of `VariantInput`, over MUI X's own
 * `VARIANT_COMPONENT` map (`PickersTextField.js`).
 *
 * The same context read works here: `PickersTextFieldRoot` is a
 * `styled(FormControl)` — MUI's own `FormControl` — and `PickersTextField` passes the
 * resolved `variant` to it, so the input slot sees it on `useFormControl()` exactly
 * as it does under `TextField` (verified by probe under both the theme default and a
 * per-field `slotProps.textField.variant`).
 */
const builtInPickerInputs: Record<string, ElementType> = {
  standard: PickersInput,
  filled: PickersFilledInput,
  outlined: PickersOutlinedInput,
}

export const PickersVariantInput = forwardRef<unknown, Record<string, unknown>>(
  function PickersVariantInput(props, ref) {
    const variant = useFormControl()?.variant
    const Component = (variant && builtInPickerInputs[variant]) ?? PickersOutlinedInput
    return <Component ref={ref} {...props} />
  },
)
PickersVariantInput.displayName = 'EzPickersVariantInput'
