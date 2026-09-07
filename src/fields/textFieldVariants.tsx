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
 * The runtime side is one component. MUI resolves the input as
 * `slots.input ?? variantComponent[variant]` (`TextField.js`), so filling in
 * `slots.input` is the whole fix — and `VariantInput` below is a single slot
 * value that works for *every* variant, so there is one mechanism and not two:
 * every `<MuiTextField>` in `src/` passes `slots={{ input: VariantInput, ...slots }}`,
 * and the preset sets the same thing as `MuiTextField.defaultProps.slots` for a
 * consumer's own bare `<MuiTextField>`.
 *
 * Deletion plan: when upstream ships, `EzTextFieldVariants` becomes an alias of
 * MUI's own `TextFieldVariants`, this file's two components and the
 * `slots={{ input: … }}` lines go, and the casts at each `<MuiTextField>`
 * boundary go with them.
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

/**
 * A copy of MUI's own `variantComponent` map (`TextField.js`) — the same map the
 * upstream patch keeps and falls back from, which is why copying it here is the
 * shim mirroring upstream rather than a re-implementation.
 */
const builtInInputs: Record<string, ElementType> = {
  standard: Input,
  filled: FilledInput,
  outlined: OutlinedInput,
}

/**
 * The one `slots.input` every text field in `src/` passes, and the one the preset
 * sets as `MuiTextField.defaultProps.slots.input`. It resolves the input itself,
 * at render, from the variant in scope: MUI's own input for each of the three
 * built-ins, and `OutlinedInput` for anything else.
 *
 * A constant `OutlinedInput` cannot do this job. `defaultProps.slots` is a plain
 * object that MUI's `resolveProps` merges wholesale, and `theme.components.*.variants`
 * only ever contributes `style`, never `slots` — so a constant there would reach a
 * bare `<MuiTextField>` asking for the filled variant too, and force it onto the
 * outlined box. The
 * same is true of the per-field route, where the variant may be the theme's default
 * and not a prop this component can see. Resolving at render is what makes one slot
 * value correct for both.
 *
 * `OutlinedInput` is the fallback because it mirrors the upstream patch's
 * `variantComponent[variant] ?? OutlinedInput`: the outlined box is the structure the
 * other two are variations of, so a custom variant starts from a shape a theme can
 * restyle rather than from nothing. The notch never opens for it — `TextField` passes
 * `label` to the input only under `variant === 'outlined'` (`TextField.js`), so
 * `NotchedOutline` renders with `withLabel` false and the legend stays collapsed
 * whatever `notched` says.
 *
 * The variant is read from `FormControl` context rather than from props: MUI's
 * `useSlot` does **not** forward `variant` into the input slot's props (verified by
 * probe — the slot receives no `variant` key at all), while `TextField` does pass it
 * to the `FormControl` root, and every `InputBase`-derived input already reads it
 * from that context for its own styling.
 *
 * A consumer's own `slots.input` still wins everywhere, because every call site
 * spreads the consumer's `slots` *after* this one: `slots={{ input: MyInput }}` is
 * how a custom variant chooses another input, exactly as it would upstream.
 */
export const VariantInput = forwardRef<unknown, Record<string, unknown>>(
  function VariantInput(props, ref) {
    const variant = useFormControl()?.variant
    const Component = (variant && builtInInputs[variant]) ?? OutlinedInput
    return <Component ref={ref} {...props} />
  },
)
VariantInput.displayName = 'EzVariantInput'
/**
 * The marker MUI's own `Input` / `FilledInput` / `OutlinedInput` all carry
 * (`Input.muiName = 'Input'`). `FormControl` scans its *children* for it to derive
 * the initial `filled` state before any effect runs —
 * `if (!isMuiElement(child, ['Input', 'Select'])) return` (FormControl.js) — and it
 * is the element in the slot, not the component it renders, that the scan sees. So
 * without this a field with a value renders its label unshrunk on the server and on
 * the first client paint, which is exactly the SSR regression pinned by "shrinks the
 * label on the server render for a field that already has a value" in
 * `NumberField.test.tsx`. Standing in for a MUI input means carrying its marker.
 */
;(VariantInput as { muiName?: string }).muiName = 'Input'

/**
 * The pickers' twin of `VariantInput`, over MUI X's own `VARIANT_COMPONENT` map
 * (`PickersTextField.js`).
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
/** Same marker, same reason: MUI X's three picker inputs all set `muiName = 'Input'` too. */
;(PickersVariantInput as { muiName?: string }).muiName = 'Input'
