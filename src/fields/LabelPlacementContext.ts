import { createContext, useContext } from 'react'
import generateUtilityClasses from '@mui/material/generateUtilityClasses'
import type { Breakpoint } from '@mui/material/styles'

/**
 * Where a field's label sits relative to its control — MUI's own vocabulary,
 * borrowed from `FormControlLabel.labelPlacement` (#9, #66, #139).
 *
 * The axis says *where*, and nothing else. Whether a `top` label **floats** over
 * the input or sits statically above it is `InputLabel`'s `shrink` /
 * `disableAnimation` (plus `OutlinedInput`'s `notched`) — a theme concern, exactly
 * as in vanilla MUI. `createTheme()` floats it; `createEzFormTheme()` pins it
 * static. Neither is a value of this union.
 *
 * Deliberately *not* MUI's `variant` either: `TextFieldVariants` is a closed union
 * — `'outlined' | 'standard' | 'filled'`, with no `*PropsVariantOverrides`
 * interface to augment, unlike `Button` — and the runtime picks the input
 * component out of a fixed `variantComponent` map, so a fourth value neither
 * typechecks nor renders. Placement is orthogonal to the box variant:
 * `<TextField variant="filled">` under `labelPlacement="start"` is a filled box
 * with its label in a left column.
 *
 * - `top` — the label is above the control, which is MUI's own arrangement. The
 *   default, and it emits no CSS at all: a field under `top` is byte-for-byte
 *   MUI's `FormControl` box.
 * - `start` — the label sits in a column beside the control. The only placement
 *   that emits CSS, and only above `labelPlacementBreakpoint`; below it the box is
 *   MUI's own, i.e. `top`.
 */
export type LabelPlacement = 'top' | 'start'

/**
 * The classes the placement rules are keyed by. Rendered onto each field's
 * `FormControl` root; the rules themselves live on `<Form>`'s own `EzForm` Root
 * slot, so `theme.components.EzForm.styleOverrides.root` reaches every one of them.
 *
 * `root` is on every bound field regardless of placement, so a theme (or a test)
 * can select "every ez-form field box" without knowing which placement is active.
 * `top` is a real class even though nothing styles it, so "every box under `top`"
 * stays selectable by a theme or a test.
 *
 * `selfLabelled` is orthogonal to the placements: a field whose label lives
 * *inside* its control — `FileField`, whose picker `Button component="label"` is
 * both the label text and the control — carries it alongside its placement class,
 * and `start` reads it as "there is no separate label element to put in column 1",
 * so the box stays MUI's own instead of a grid with an empty label column (#133).
 * It is a declaration, not a heuristic: a label-less `TextField` named by
 * `aria-label` has no label element either, but its control still belongs in the
 * control column, aligned with its neighbours', and only the component knows which
 * of the two it is. A consumer's own control with its label inside can carry the
 * class the same way.
 */
export const fieldLayoutClasses = generateUtilityClasses('EzFieldLayout', [
  'root',
  'top',
  'start',
  'selfLabelled',
  // The two below are *not* placements and `LabelPlacement` does not name them:
  // they mark a field rendered inside a `<FieldArray layout="table">` cell (#14),
  // where its own label is visually hidden and the row + column headers name the
  // control, and — under `cellErrors="summary"` — its helper text is hidden too.
  // Internal layout state, applied by `useEzField` from `FieldCellContext`, never
  // by a consumer prop; a placement class is always present alongside them.
  'cell',
  'cellHelperHidden',
])

/**
 * The one prop the axis adds to a field, as a shared fragment so every field's
 * props type states it identically — and so the doc comment lives in one place
 * rather than in twenty.
 *
 * Intersected into each field's props (`… & LabelPlacementProps`), the way
 * `FieldRules` already is.
 *
 * `Checkbox` and `Switch` deliberately do *not* take it: their `labelPlacement` is
 * MUI's own `FormControlLabel` prop (`'end' | 'start' | 'top' | 'bottom'`), which
 * this axis would otherwise shadow (#139).
 */
export interface LabelPlacementProps {
  /**
   * Where this field's label sits relative to its control, overriding the form's
   * `labelPlacement` (#9, #66, #139).
   *
   * Its own axis, orthogonal to MUI's `variant`: `variant="filled"` with
   * `labelPlacement="start"` is a filled box with its label in a left column.
   * Normally left unset — placement is a form-wide layout convention, set once on
   * `<Form>` or in `theme.components.EzForm.defaultProps`; this is the escape
   * hatch for the one row that has to differ.
   */
  labelPlacement?: LabelPlacement
}

export interface LabelPlacementContextValue {
  labelPlacement: LabelPlacement
  /**
   * The breakpoint below which `start` collapses to `top` — a settings-style
   * two-column form has no room for a label column on a phone. Applied as
   * `theme.breakpoints.up(breakpoint)` on the `start` rules, so it names the
   * *smallest* size that still gets columns.
   */
  labelPlacementBreakpoint: Breakpoint
  /**
   * The width of the label column under `start`. Any CSS length; a number is CSS
   * pixels, matching `grid-template-columns`.
   */
  labelWidth: string | number
}

/**
 * How `<Form>` wants its fields laid out. Provided by `Form`, read by `useEzField`
 * — the single hook every field in every family already calls, so the placement
 * reaches all of them without a new element in the tree.
 *
 * The default is `top`: MUI's own arrangement, and the one that emits no CSS. A
 * field rendered outside `<Form>` is a guarded error anyway (every field throws
 * "must be rendered inside <Form>" first). Whether that top label floats is the
 * theme's, not this context's.
 */
export const LabelPlacementContext = createContext<LabelPlacementContextValue>({
  labelPlacement: 'top',
  labelPlacementBreakpoint: 'sm',
  labelWidth: '12rem',
})

export function useLabelPlacement(): LabelPlacementContextValue {
  return useContext(LabelPlacementContext)
}

/**
 * The classes for one field, given its resolved placement.
 *
 * Always includes `fieldLayoutClasses.root`, then exactly one placement class —
 * `top` included, even though it carries no rules, so every field box is
 * selectable by the placement it is actually under.
 */
export function fieldLayoutClassName(placement: LabelPlacement, extra?: string): string {
  return `${fieldLayoutClasses.root} ${fieldLayoutClasses[placement]}${extra ? ` ${extra}` : ''}`
}
