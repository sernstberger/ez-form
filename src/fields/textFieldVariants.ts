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
import OutlinedInput from '@mui/material/OutlinedInput'
import type { ElementType } from 'react'
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
 */
export function customVariantSlots<S extends { input?: ElementType } | undefined>(
  variant: EzTextFieldVariants | undefined,
  slots: S,
  fallback: ElementType = OutlinedInput,
): S | (S & { input: ElementType }) {
  if (isBuiltInTextFieldVariant(variant) || variant === undefined) return slots
  return { input: fallback, ...slots }
}
