import { createContext, useContext } from 'react'
import generateUtilityClasses from '@mui/material/generateUtilityClasses'
import type { Breakpoint } from '@mui/material/styles'

/**
 * Where a field's label sits relative to its control.
 *
 * Its own axis, deliberately *not* MUI's `variant` (#9, #66). `TextFieldVariants`
 * is a closed union — `'outlined' | 'standard' | 'filled'`, with no
 * `*PropsVariantOverrides` interface to augment, unlike `Button` — and the runtime
 * picks the input component out of a fixed `variantComponent` map, so a fourth
 * value neither typechecks nor renders. Placement is therefore orthogonal to the
 * box variant: `<TextField variant="filled">` under `labelPlacement="start"` is a
 * filled box with its label in a left column.
 *
 * - `floating` — MUI's own: the label is absolutely positioned over the input and
 *   translates up on focus/fill, notching the outline. The library default.
 * - `stacked` — the label sits above the control in normal flow, with no motion and
 *   no notch. `createEzFormTheme()` makes this the default (see `DESIGN.md`).
 * - `start` — the label sits in a column beside the control, falling back to
 *   `stacked` below `labelPlacementBreakpoint`.
 */
export type LabelPlacement = 'floating' | 'stacked' | 'start'

/**
 * The classes the placement rules are keyed by. Rendered onto each field's
 * `FormControl` root; the rules themselves live on `<Form>`'s own `EzForm` Root
 * slot, so `theme.components.EzForm.styleOverrides.root` reaches every one of them.
 *
 * `root` is on every bound field regardless of placement, so a theme (or a test)
 * can select "every ez-form field box" without knowing which placement is active.
 */
export const fieldLayoutClasses = generateUtilityClasses('EzFieldLayout', [
  'root',
  'floating',
  'stacked',
  'start',
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
 */
export interface LabelPlacementProps {
  /**
   * Where this field's label sits relative to its control, overriding the form's
   * `labelPlacement` (#9, #66).
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
   * The breakpoint below which `start` collapses to `stacked` — a settings-style
   * two-column form has no room for a label column on a phone. Applied as
   * `theme.breakpoints.down(breakpoint)`, so it names the *smallest* size that
   * still gets columns.
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
 * The default here is `floating` because a field rendered outside `<Form>` is a
 * guarded error anyway (every field throws "must be rendered inside <Form>" first),
 * and because the *library's* default is MUI's own look: the opinionated stacked
 * default is `createEzFormTheme()`'s, set through
 * `theme.components.EzForm.defaultProps` where a consumer opts into it (PHILOSOPHY
 * rule 2 — `src/` ships unstyled).
 */
export const LabelPlacementContext = createContext<LabelPlacementContextValue>({
  labelPlacement: 'floating',
  labelPlacementBreakpoint: 'sm',
  labelWidth: '12rem',
})

export function useLabelPlacement(): LabelPlacementContextValue {
  return useContext(LabelPlacementContext)
}

/**
 * The classes for one field, given its own `labelPlacement` prop (or `undefined`
 * to follow the form).
 *
 * Always includes `fieldLayoutClasses.root`, then exactly one placement class.
 * A field is never left without a placement class: the rules that un-float the
 * label and the rules that close the notch have to arrive together, and a box with
 * neither would show MUI's floating label over an un-notched outline.
 */
export function fieldLayoutClassName(placement: LabelPlacement, extra?: string): string {
  return `${fieldLayoutClasses.root} ${fieldLayoutClasses[placement]}${extra ? ` ${extra}` : ''}`
}
