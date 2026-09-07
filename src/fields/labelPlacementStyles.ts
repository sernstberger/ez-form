import type { CSSObject, Theme } from '@mui/material/styles'
import { formControlLabelClasses } from '@mui/material/FormControlLabel'
import { formHelperTextClasses } from '@mui/material/FormHelperText'
import { formLabelClasses } from '@mui/material/FormLabel'
import { outlinedInputClasses } from '@mui/material/OutlinedInput'
import { fieldLayoutClasses } from './LabelPlacementContext'
import { formClasses } from '../Form/formClasses'

/**
 * The label placement rules (#9, #66), as one style object for `<Form>`'s `EzForm`
 * Root slot.
 *
 * They live here, on the form, rather than on each field, because every ez-form
 * field's root is the *same* box: a `.MuiFormControl-root` whose children are, in
 * order, the label, the control and `FormHelperText`. MUI gives it
 * `display: inline-flex; flex-direction: column`, so `stacked` and `start` are a
 * layout change on that one box and nothing about the markup — and therefore
 * nothing about `<label for>`, `aria-labelledby` or `aria-describedby` — moves.
 * Registering them once on the form's own styled slot keeps `TextField`, `Select`
 * and `Autocomplete` the pure pass-throughs they are meant to be (PHILOSOPHY rule
 * 2's last row: a pass-through field registers no `Ez*` key), and leaves the whole
 * set reachable from `theme.components.EzForm.styleOverrides.root`.
 */

/**
 * Un-float the label: out of the absolute positioning MUI gives it, into normal
 * flow above the control, with no transform and no animation.
 *
 * This is the same end state `createEzFormTheme()` reaches through
 * `MuiInputLabel: { shrink: true, disableAnimation: true }` plus overrides
 * (`src/theme/ezFormTheme.ts`), expressed so it can be scoped to one placement
 * instead of the whole theme.
 *
 * `maxWidth: '100%'` because MUI's floating label is sized for the *shrunk* 75%
 * transform (`maxWidth: 'calc(133% - …)'`); with the transform gone that
 * over-wide value would let a long label run past its own box.
 */
const unfloatLabel: CSSObject = {
  position: 'relative',
  // Deliberately no `transformOrigin` reset alongside this. MUI's own is the
  // physical `top left`, which the RTL stylis plugin does not flip (it rewrites
  // property names, not values) — and with no transform there is nothing for an
  // origin to apply to, so the rule is both inert and the only physical value the
  // placement CSS would otherwise carry. Everything else here is direction-neutral,
  // which is why `start` mirrors correctly under an RTL theme.
  transform: 'none',
  maxWidth: '100%',
  padding: 0,
  // MUI truncates the floating label to one line; in flow it can wrap like any
  // other text, which is what a long label in a narrow column needs.
  whiteSpace: 'normal',
  // The floating label sits *over* the input, so MUI makes it click-through.
  // Back in flow it is a real `<label htmlFor>` again and must take its clicks.
  pointerEvents: 'auto',
  // The transition is the label's motion; with no transform there is nothing to
  // animate, and leaving it on would fade the colour change on focus.
  transition: 'none',
}

/**
 * Close the outline's notch.
 *
 * `OutlinedInput` opens the notch from the label's `shrink` state unless `notched`
 * is set, and its notched legend is `max-width: 100%` with a visible span; the
 * un-notched one is `max-width: 0.01px` with a hidden span. Reaching that state in
 * CSS rather than by threading `slotProps.input.notched` through every field keeps
 * the three pass-through fields free of binding-owned `slotProps` — and it is the
 * same precedence `theme.components.MuiOutlinedInput.defaultProps = { notched: false }`
 * already has in the preset.
 */
const closeNotch: CSSObject = {
  [`& .${outlinedInputClasses.notchedOutline} legend`]: {
    maxWidth: '0.01px',
    '& > span': { visibility: 'hidden' },
  },
}

/**
 * The `stacked` box: label above the control, helper text under it, flush left.
 *
 * The helper text's `marginLeft` is MUI's inset for a *floating* label's 14px
 * origin; with the label in flow there is nothing to line up with.
 */
const stackedLabel = (theme: Theme): CSSObject => ({
  ...unfloatLabel,
  marginBottom: theme.spacing(0.5),
})

const stackedBox = (theme: Theme): CSSObject => ({
  [`& .${formLabelClasses.root}`]: stackedLabel(theme),
  ...closeNotch,
  [`& .${formHelperTextClasses.root}`]: { marginLeft: 0, marginRight: 0 },
})

/**
 * What makes a field box *self-labelled*: its label lives inside its control, so
 * there is no separate label element for `start`'s column 1 (#133).
 *
 * Two ways to say it, one meaning. `fieldLayoutClasses.selfLabelled` is the
 * contract — the field declares it on its root (`FileField` does: its picker
 * `Button component="label"` is the label text and the control in one element; a
 * consumer's own control with its label inside can too). The
 * `:has(> .MuiFormControlLabel-root)` form is the second arm of the same rule.
 * `BoundField`'s `labelAs="control"` frame (`Checkbox`, `Switch`) now carries the class
 * itself (#28), so that arm is no longer what recognises them — it still covers a
 * consumer's own `FormControlLabel` rendered inside a `BoundField` `render` prop, and is
 * deletable once nothing relies on it.
 *
 * `labelAs="none"` is deliberately **not** self-labelled: the shape it documents is a
 * plain direct-child `<label>` paired to the control by `htmlFor`/`controlId`, which the
 * column-1 selector below now matches — an ordinary two-part field that belongs in the
 * grid. A consumer whose custom control really is self-labelled adds the class.
 *
 * Deliberately *not* `:not(:has(.MuiFormLabel-root))`: a label-less `TextField`
 * named by `aria-label` has no label element either, and its control belongs in the
 * control column, aligned with its neighbours' — only the component knows which of
 * the two it is, so the component says.
 *
 * Kept as a list rather than one `:is(…)` so the two selectors built from it carry
 * no comma inside a pseudo-class: stylis splits selector lists on commas.
 */
const selfLabelledSelectors = [
  `.${fieldLayoutClasses.selfLabelled}`,
  `:has(> .${formControlLabelClasses.root})`,
]

/** `&:not(a):not(b)` — a box that is not self-labelled. */
const notSelfLabelled = selfLabelledSelectors.map((s) => `:not(${s})`).join('')

/**
 * The `start` box: a two-column grid, label in column 1, control and helper text
 * in column 2.
 *
 * A grid rather than `flex-direction: row`, because the box has *three* children
 * and a row would put the helper text in a third column beside the control. Naming
 * the label's cell explicitly and letting everything else flow into column 2 keeps
 * that right no matter how many extra children a field renders (`FileField`'s file
 * list, `AddressField`'s status region).
 *
 * `alignItems: 'start'` rather than `'baseline'` or the grid default `'stretch'`:
 * a multiline `TextareaField` or a wrapping `Autocomplete` grows down from the top
 * of its row, and the label must stay put at the top rather than being stretched
 * to the control's height or dragged down to a baseline that moves as the control
 * grows. The label's own `paddingTop` is what lines it up with the control's first
 * line of text.
 *
 * **Everything here is `start`-only and applies only above the breakpoint** — see
 * `labelPlacementStyles` for why that scoping is the whole shape of this file, and
 * what went wrong (#130) when it was not.
 */
const startBox = (theme: Theme, labelWidth: string | number): CSSObject => ({
  display: 'grid',
  gridTemplateColumns: `${typeof labelWidth === 'number' ? `${labelWidth}px` : labelWidth} 1fr`,
  columnGap: theme.spacing(2),
  alignItems: 'start',
  // Column 1 is the label. Selected as `.MuiFormLabel-root` for every ez-form field,
  // and additionally as a plain direct-child `<label>` for a consumer-built control
  // (a public `BoundField labelAs="none"` whose consumer renders `<label htmlFor>`
  // + `<input>` themselves, #28): without that a plain label fell through to the
  // column-2 rule below and sat beside an empty label column. An ez-form field's
  // `<label>` already carries `.MuiFormLabel-root`, so for it the second selector
  // changes nothing.
  //
  // The plain-`label` half is guarded by `notSelfLabelled`, because a self-labelled
  // box's direct-child `<label>` *is its control*: `FileField`'s picker Button and a
  // Checkbox's `FormControlLabel` are both `<label>`s, and this block would restyle
  // them (`padding: 0`, `transition: none`, a top padding) before the opt-out below
  // could undo the grid placement.
  [`& .${formLabelClasses.root}, &${notSelfLabelled} > label`]: {
    ...unfloatLabel,
    gridColumn: 1,
    gridRow: 1,
    marginBottom: 0,
    // The label reads against the control's first line rather than the top of its
    // border box; `theme.spacing(1)` is the outlined input's own vertical padding.
    paddingTop: theme.spacing(1),
  },
  // A `legend` label (`BoundField`'s `labelAs="legend"`: RadioGroup, CheckboxGroup,
  // Rating, Slider, ToggleButtonGroup) needs one rule more than the others (#131).
  //
  // Its box is a `<fieldset>`, and a `<fieldset>`'s `<legend>` is a *rendered
  // legend*: CSS takes it out of the fieldset's formatting context entirely and
  // paints it above the anonymous content box. `grid-column: 1` computes on it and
  // does nothing — the legend sat full-bleed at its own intrinsic width and the
  // control box began *below* it, so the label named a column it was not in.
  // Measured in Chrome: the legend's 31px pushed the group down, and the first
  // option's own 9px `SwitchBase` padding took the total to 40px.
  //
  // Floating it is what makes it an ordinary box again — a floated (or absolutely
  // positioned) legend is by definition no longer a rendered legend — at which
  // point it takes part in the grid like every other label. `inline-start` rather
  // than `left` so the rule stays direction-neutral like the rest of this file, and
  // an explicit column width because a float sizes to its content, not to the grid
  // track it nominally occupies.
  //
  // The existing `paddingTop` needs no adjustment for these: measured against a
  // RadioGroup's first option the residual is 1.5px, smaller than the offset the
  // plain text fields already ship with.
  '& > legend': {
    float: 'inline-start',
    width: typeof labelWidth === 'number' ? `${labelWidth}px` : labelWidth,
  },
  ...closeNotch,
  // Everything that is not the label goes in column 2, stacked in source order —
  // the control, the helper text, and whatever else a field renders.
  //
  // Selected by *not being* `.MuiFormLabel-root` rather than by tag alone, because
  // the label's element varies by field: a `TextField` renders `<label>`, a `Select`
  // renders a `<div>` (there is no `htmlFor` target — the combobox is named through
  // `aria-labelledby`), and `BoundField`'s legend frame renders `<legend>`. A
  // tag-only rule would put a `Select`'s label in column 2 with its own control.
  // `:not(label)` is the complement of the plain-`label` half above; it needs no
  // self-labelled guard, because on a self-labelled box the opt-out resets every
  // child's column anyway.
  [`& > *:not(.${formLabelClasses.root}):not(label)`]: { gridColumn: 2 },
  [`& .${formHelperTextClasses.root}`]: { marginLeft: 0, marginRight: 0 },
})

/**
 * A self-labelled field opts out of the grid.
 *
 * Its label is already inside its control — `Checkbox` and `Switch` (`BoundField`'s
 * `labelAs="control"`) inside the single `<label>` that *is* the click target,
 * `FileField` as the text of the picker `Button component="label"` — so there is no
 * separate label element to put in column 1. Pulling one out would either break the
 * click target or duplicate the label, and leaving the grid in place puts the control
 * in column 2 beside an *empty* label column, a permanent `labelWidth` gutter (#133).
 * They take the helper-text alignment and nothing else, so such a row in a `start`
 * form still lines up flush left with its neighbours' label column.
 *
 * Keyed on `selfLabelledSelectors` — see there for why it is a class the field
 * declares and not a heuristic on the missing label element.
 *
 * Only ever emitted inside the `up(breakpoint)` block, so it undoes `startBox` and
 * nothing else: below the breakpoint there is no grid for it to opt out of.
 */
const selfLabelledOptOut = (theme: Theme): CSSObject => ({
  [selfLabelledSelectors.map((s) => `&${s}`).join(', ')]: {
    display: 'inline-flex',
    gridTemplateColumns: 'none',
    alignItems: 'normal',
    '& > *': { gridColumn: 'auto' },
    // The grid placement `startBox` set is on this same, more specific selector,
    // so it has to be undone here rather than by the `& > *` reset above.
    [`& .${formLabelClasses.root}`]: {
      ...stackedLabel(theme),
      gridColumn: 'auto',
      gridRow: 'auto',
      paddingTop: 0,
    },
  },
})

/**
 * Every placement rule, scoped to the field boxes inside this form.
 *
 * `floating` gets no rules at all: it *is* MUI's own layout, and a rule that
 * re-stated it would be a theme-unreachable copy of something upstream ships
 * (PHILOSOPHY rule 1).
 *
 * **`start` is `stacked` plus a label column above the breakpoint** — that is the
 * shape, and it is deliberate (#130). The first version instead applied the grid
 * unconditionally and undid it under `theme.breakpoints.down(…)`, which meant the
 * fallback carried a hand-written list of declarations to reset. A list you have to
 * remember to extend is a list you can forget from, and `alignItems` was forgotten:
 * in the grid it is row alignment and keeps a tall control's label at the top, but
 * the fallback re-declared the box as a flex column, where `align-items` is the
 * *cross* axis — so `start` shrank every control to its intrinsic width on a phone
 * (a Select measured 46px against `stacked`'s 349px at 380px). Scoping the
 * `start`-only rules under `up(…)` means the box below the breakpoint simply *is*
 * `stackedBox`, so there is nothing to reset and a declaration added to `startBox`
 * tomorrow cannot leak past the breakpoint either.
 */
export function labelPlacementStyles(
  theme: Theme,
  labelPlacementBreakpoint: Parameters<Theme['breakpoints']['up']>[0],
  labelWidth: string | number,
): CSSObject {
  return {
    // A gap between the form's description and the first field, for the two
    // placements whose label is in normal flow (#131).
    //
    // Under `floating` the first thing below the description is the *input box*, and
    // its label sits inside the outline, so MUI's own spacing already reads as a gap
    // (16px measured). Under `stacked` and `start` the first thing below it is a
    // line of label text flush against the description's own last line — measured at
    // 0px, text touching text.
    //
    // Keyed on the form carrying a non-floating field rather than on the description
    // being that field's sibling: `<Form>` renders its description above three
    // context providers, and a consumer's children are normally inside their own
    // `<Stack>`, so a `+` or `~` selector between the two almost never matches. This
    // is a form-level layout question anyway, which is why it sits in this file with
    // the rest of the placement CSS rather than on the description slot.
    //
    // `theme.spacing(2)` matches the `columnGap` `start` already uses; a theme
    // changes it through `EzForm.styleOverrides.root` like every other rule here.
    [`&:has(.${fieldLayoutClasses.stacked}) .${formClasses.description}, &:has(.${fieldLayoutClasses.start}) .${formClasses.description}`]:
      { marginBottom: theme.spacing(2) },
    [`& .${fieldLayoutClasses.stacked}`]: stackedBox(theme),
    [`& .${fieldLayoutClasses.start}`]: {
      // The fallback, stated once as the base rule rather than as an override:
      // below the breakpoint a `start` field is a `stacked` field, exactly.
      ...stackedBox(theme),
      [theme.breakpoints.up(labelPlacementBreakpoint)]: {
        ...startBox(theme, labelWidth),
        ...selfLabelledOptOut(theme),
      },
    },
  }
}
