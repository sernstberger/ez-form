import type { CSSObject, Theme } from '@mui/material/styles'
import { formControlLabelClasses } from '@mui/material/FormControlLabel'
import { formHelperTextClasses } from '@mui/material/FormHelperText'
import { formLabelClasses } from '@mui/material/FormLabel'
import { outlinedInputClasses } from '@mui/material/OutlinedInput'
import { fieldLayoutClasses } from './LabelPlacementContext'

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
  [`& .${formLabelClasses.root}`]: {
    ...unfloatLabel,
    gridColumn: 1,
    gridRow: 1,
    marginBottom: 0,
    // The label reads against the control's first line rather than the top of its
    // border box; `theme.spacing(1)` is the outlined input's own vertical padding.
    paddingTop: theme.spacing(1),
  },
  ...closeNotch,
  // Everything that is not the label goes in column 2, stacked in source order —
  // the control, the helper text, and whatever else a field renders.
  //
  // Selected by *not being* `.MuiFormLabel-root` rather than by tag, because the
  // label's element varies by field: a `TextField` renders `<label>`, a `Select`
  // renders a `<div>` (there is no `htmlFor` target — the combobox is named through
  // `aria-labelledby`), and `FieldFrame`'s legend frame renders `<legend>`. A
  // tag-based rule would put a `Select`'s label in column 2 with its own control.
  '& > *:not(.MuiFormLabel-root)': { gridColumn: 2 },
  [`& .${formHelperTextClasses.root}`]: { marginLeft: 0, marginRight: 0 },
})

/**
 * `Checkbox` and `Switch` (`FieldFrame`'s `labelAs="control"`) opt out of the grid.
 *
 * Their label is already beside the control, inside the single `<label>` that *is*
 * the click target — pulling it into a left column would either break that target
 * or duplicate the label. They take the helper-text alignment and nothing else, so
 * a checkbox row in a `start` form still lines up flush left with its neighbours'
 * label column rather than being indented into column 2.
 *
 * Only ever emitted inside the `up(breakpoint)` block, so it undoes `startBox` and
 * nothing else: below the breakpoint there is no grid for it to opt out of.
 */
const controlLabelOptOut = (theme: Theme): CSSObject => ({
  [`&:has(> .${formControlLabelClasses.root})`]: {
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
    [`& .${fieldLayoutClasses.stacked}`]: stackedBox(theme),
    [`& .${fieldLayoutClasses.start}`]: {
      // The fallback, stated once as the base rule rather than as an override:
      // below the breakpoint a `start` field is a `stacked` field, exactly.
      ...stackedBox(theme),
      [theme.breakpoints.up(labelPlacementBreakpoint)]: {
        ...startBox(theme, labelWidth),
        ...controlLabelOptOut(theme),
      },
    },
  }
}
