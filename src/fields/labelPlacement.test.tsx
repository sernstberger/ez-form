import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createTheme, ThemeProvider } from '@mui/material/styles'
import { formControlLabelClasses } from '@mui/material/FormControlLabel'
import { formHelperTextClasses } from '@mui/material/FormHelperText'
import { formLabelClasses } from '@mui/material/FormLabel'
import { z } from 'zod'
import { Form, formClasses } from '../Form'
import { SubmitButton } from '../SubmitButton'
import { TextField } from './TextField'
import { Select } from './Select'
import { Checkbox } from './Checkbox'
import { RadioGroup } from './RadioGroup'
import { NumberField } from './NumberField'
import { DatePicker } from './DatePicker'
import { FieldCellContext } from './FieldCellContext'
import { withPickers } from '../test/pickers'
import { FileField } from './FileField'
import { createEzFormTheme } from '../theme/ezFormTheme'
import {
  fieldLayoutClasses,
  fieldLayoutClassName,
  type LabelPlacement,
} from './LabelPlacementContext'
import { expectNoA11yViolations } from '../test/axe'

/**
 * The label-placement axis itself (#9, #66). The per-field guarantees — name,
 * description, required marker, axe — are asserted for every field by
 * `describeFieldContract`; what is left here is the axis's own behavior: what the
 * CSS resolves to, where the default comes from, and how the overrides compose.
 */

const schema = z.object({
  email: z.string().min(1),
  colour: z.string(),
  terms: z.boolean(),
  size: z.string(),
})

const defaultValues = { email: '', colour: '', terms: false, size: '' }

const fields = (
  <>
    <TextField name="email" label="Email" helperText="Work address" />
    <Select name="colour" label="Colour" options={[{ value: 'red', label: 'Red' }]} />
    <Checkbox name="terms" label="Accept the terms" />
    <RadioGroup name="size" label="Size" options={[{ value: 's', label: 'Small' }]} />
  </>
)

const renderForm = (props: Record<string, unknown> = {}, theme = createTheme()) =>
  render(
    <ThemeProvider theme={theme}>
      <Form schema={schema} defaultValues={defaultValues} onSubmit={() => {}} {...props}>
        {fields}
        <SubmitButton>Save</SubmitButton>
      </Form>
    </ThemeProvider>,
  )

/** The `FormControl` box for one field, found by the class the rules select. */
const box = (container: HTMLElement, placement: LabelPlacement, index = 0) =>
  [...container.querySelectorAll(`.${fieldLayoutClasses[placement]}`)][index] as HTMLElement

/** Everything emotion has put in the document, as one string. */
const emittedCss = () =>
  [...document.querySelectorAll('style')].map((s) => s.textContent ?? '').join('\n')

/**
 * Only the rules whose selector mentions the `start` placement class — the ones this
 * file emits.
 *
 * Needed because the document also carries every MUI component's own stylesheet, and
 * plenty of those legitimately declare the properties under test (`FormControlLabel`
 * is `align-items: center`). Asserting against the whole document would be asserting
 * about MUI, not about us.
 */
const startRules = (css: string): string =>
  [...css.matchAll(/([^{}]*)\{([^{}]*)\}/g)]
    .filter(([, selector]) => selector?.includes(fieldLayoutClasses.start))
    .map(([rule]) => rule)
    .join('\n')

/** Of some rules, only those whose selector mentions `needle`. */
const rulesMentioning = (css: string, needle: string): string =>
  [...css.matchAll(/([^{}]*)\{([^{}]*)\}/g)]
    .filter(([, selector]) => selector?.includes(needle))
    .map(([rule]) => rule)
    .join('\n')

/**
 * The `start` rules that apply *above* the breakpoint — the label-column layout.
 *
 * jsdom has no layout engine and evaluates no media queries, so `getComputedStyle`
 * on a box reports only the rules outside them: under this file's shape (#130) that
 * is the stacked fallback, and the two-column grid is invisible to it. Assertions
 * about the columns therefore read the emitted rule text, which is also the only
 * thing that can be checked about a media query at all.
 */
const startRulesAboveBreakpoint = (css: string): string => {
  // The complement of `cssOutsideMinWidth`: keep only what the min-width blocks
  // contain. Brace-counted for the same reason.
  let out = ''
  for (let i = 0; i < css.length;) {
    const at = css.indexOf('@media', i)
    if (at === -1) break
    const open = css.indexOf('{', at)
    if (open === -1) break
    let depth = 0
    let end = open
    for (; end < css.length; end++) {
      if (css[end] === '{') depth++
      else if (css[end] === '}' && --depth === 0) break
    }
    if (css.slice(at, open).includes('min-width')) out += css.slice(open + 1, end)
    i = end + 1
  }
  return startRules(out)
}

/**
 * The same CSS with every `@media (min-width…)` block removed, so what is left is
 * exactly the rules that apply at *every* width — including below the placement
 * breakpoint.
 *
 * Brace-counted rather than regexed: emotion emits nested blocks (a media query
 * containing rules containing `&:has(…)` selectors), and a non-greedy `{...}` match
 * would stop at the first inner `}` and leave the rest of the block behind, which
 * would make this helper quietly pass anything.
 */
const cssOutsideMinWidth = (css: string): string => {
  let out = ''
  for (let i = 0; i < css.length;) {
    const at = css.indexOf('@media', i)
    if (at === -1) {
      out += css.slice(i)
      break
    }
    const open = css.indexOf('{', at)
    if (open === -1) {
      out += css.slice(i)
      break
    }
    const isMinWidth = css.slice(at, open).includes('min-width')
    // Walk to the brace that closes this block.
    let depth = 0
    let end = open
    for (; end < css.length; end++) {
      if (css[end] === '{') depth++
      else if (css[end] === '}' && --depth === 0) break
    }
    // A min-width block is dropped whole; any other at-rule keeps its contents,
    // since those do still apply below the breakpoint.
    out += css.slice(i, at) + (isMinWidth ? '' : css.slice(open + 1, end))
    i = end + 1
  }
  return out
}

describe('labelPlacement', () => {
  it('defaults to floating — MUI’s own layout, untouched', () => {
    // The library ships unstyled (PHILOSOPHY rule 2): a consumer on plain
    // `createTheme()` who never opted into ez-form's taste keeps MUI's floating
    // label. The stacked default is `createEzFormTheme()`'s, asserted below.
    const { container } = renderForm()
    expect(container.querySelectorAll(`.${fieldLayoutClasses.floating}`)).toHaveLength(4)
    const label = box(container, 'floating').querySelector('label') as HTMLElement
    expect(getComputedStyle(label).position).toBe('absolute')
  })

  it('stacked puts the label in normal flow above the control', () => {
    const { container } = renderForm({ labelPlacement: 'stacked' })
    const label = box(container, 'stacked').querySelector('label') as HTMLElement
    const style = getComputedStyle(label)
    expect(style.position).toBe('relative')
    expect(style.transform).toBe('none')
    // The box itself is still MUI's flex column: `stacked` moves the label out of
    // its absolute positioning, it does not re-lay-out the field.
    expect(getComputedStyle(box(container, 'stacked')).display).toBe('inline-flex')
  })

  it('stacked closes the outline notch the floating label opened', () => {
    // The notch exists only to make room for a label sitting *on* the border. With
    // the label above it there is nothing to make room for, and an open notch would
    // leave a visible gap in the box.
    const { container } = renderForm({ labelPlacement: 'stacked' })
    const legend = box(container, 'stacked').querySelector(
      '.MuiOutlinedInput-notchedOutline legend',
    )!
    expect(getComputedStyle(legend).maxWidth).toBe('0.01px')
  })

  it('start lays the field out as a two-column grid above the breakpoint', () => {
    renderForm({ labelPlacement: 'start' })
    const above = startRulesAboveBreakpoint(emittedCss())
    expect(above).toContain('display:grid')
    // Column one is the label's, column two takes the control *and* the helper
    // text — a flex row would have put the helper text in a third column.
    expect(above).toContain('grid-template-columns:12rem 1fr')
  })

  it('start takes the label column width from labelWidth', () => {
    renderForm({ labelPlacement: 'start', labelWidth: '18ch' })
    expect(startRulesAboveBreakpoint(emittedCss())).toContain('grid-template-columns:18ch 1fr')
  })

  it('start below the breakpoint is the stacked box, with nothing left to undo', () => {
    // #130's acceptance line: under the breakpoint a `start` field is *identical* to
    // a `stacked` one. jsdom reports exactly the outside-the-media-query rules, so
    // `getComputedStyle` here is the fallback — which is the thing being asserted.
    const startForm = renderForm({ labelPlacement: 'start' })
    const read = (el: HTMLElement) => {
      const s = getComputedStyle(el)
      const label = getComputedStyle(el.querySelector('label') as HTMLElement)
      return {
        // `align-items` is the one that broke it: in a flex column it is the cross
        // (horizontal) axis, so a leftover `start` shrank every control to its
        // intrinsic width — a Select measured 46px in Chrome where `stacked` gave 349.
        alignItems: s.alignItems,
        display: s.display,
        gridTemplateColumns: s.gridTemplateColumns,
        labelGridColumn: label.gridColumn,
        labelPaddingTop: label.paddingTop,
      }
    }
    const below = read(box(startForm.container, 'start'))
    startForm.unmount()
    const stacked = read(box(renderForm({ labelPlacement: 'stacked' }).container, 'stacked'))
    // Not "close enough": the same box, declaration for declaration.
    expect(below).toEqual(stacked)
    expect(below.alignItems).not.toBe('start')
  })

  it('start puts a Select’s label in column 1 even though it is a <div>', () => {
    // The label's element varies by field: `TextField` renders `<label>`, `Select`
    // renders a `<div>` (there is no `htmlFor` target — the combobox is named
    // through `aria-labelledby`), `BoundField`'s legend frame renders `<legend>`.
    // A tag-based column rule would leave a Select's label in column 2 stacked on
    // top of its own control, which looks like a broken row and nothing else fails.
    const { container } = renderForm({ labelPlacement: 'start' })
    const label = box(container, 'start', 1).querySelector('.MuiFormLabel-root')!
    expect(label.tagName).toBe('DIV')
    // The rule that places it is keyed on the class, which that `<div>` carries, and
    // the column-2 rule is keyed on *not* having it — so the Select's label lands in
    // column 1 with every other field's. jsdom cannot compute a media query, so the
    // claim is read off the emitted selector rather than the element.
    const above = startRulesAboveBreakpoint(emittedCss())
    // The column-1 rule: a selector list since #133 (`.MuiFormLabel-root` *or* a
    // guarded plain `<label>`), so match the class-keyed half followed by the rest of
    // the list and a block that places it — not `.MuiFormLabel-root{`, which the
    // opt-out's own label reset would also satisfy.
    expect(above).toMatch(
      new RegExp(
        `\\.${fieldLayoutClasses.start} \\.${formLabelClasses.root},[^{]*\\{[^}]*grid-column:1;`,
      ),
    )
    expect(above).toContain(`>*:not(.${formLabelClasses.root}):not(label){grid-column:2;}`)
  })

  it('start keeps the helper text in the control’s column, not a third one', () => {
    // The reason the box is a grid rather than `flex-direction: row`: it has three
    // children, and a row would have put the helper text beside the control. The
    // column-2 rule is the `:not(label)` one above, so what matters here is that the
    // helper text is not excluded from it by a rule of its own.
    renderForm({ labelPlacement: 'start' })
    const above = startRulesAboveBreakpoint(emittedCss())
    expect(above).toContain('grid-column:2')
    expect(above).not.toContain(`.${formHelperTextClasses.root}{grid-column`)
  })

  it('start floats a legend so it joins the grid instead of sitting above it', () => {
    // #131. A `legend` field (`BoundField`'s `labelAs="legend"` — RadioGroup,
    // CheckboxGroup, Rating, Slider, ToggleButtonGroup) renders its box as a
    // `<fieldset>`, and a `<fieldset>`'s `<legend>` is a *rendered legend*: CSS pulls
    // it out of the fieldset's formatting context and paints it above the content
    // box, so `grid-column: 1` computes on it and does nothing. Measured in Chrome
    // before the fix: the legend sat at its own intrinsic 94px width and the radios
    // began 31px below it, which with the first option's own 9px padding is the 40px
    // the issue reported.
    //
    // Floating it makes it an ordinary box again — a floated legend is by definition
    // no longer a rendered legend — so it takes the column like every other label.
    // After: legend and group both at the same top, legend the full 192px column.
    renderForm({ labelPlacement: 'start' })
    const above = startRulesAboveBreakpoint(emittedCss())
    expect(above).toContain('>legend{')
    // Logical, not `left`: the rest of this file is direction-neutral so `start`
    // mirrors under an RTL theme, and the RTL test below pins that.
    expect(above).toContain('float:inline-start')
    // A float sizes to its content, so the column width has to be restated on it.
    expect(above).toContain('width:12rem')
  })

  it('the legend float is start-only, so a stacked fallback legend is not floated', () => {
    // Below the breakpoint the box is stacked and the legend belongs above the
    // control at its natural width, which is what a float would break.
    renderForm({ labelPlacement: 'start' })
    expect(startRules(cssOutsideMinWidth(emittedCss()))).not.toContain('float')
  })

  it('spaces the form description away from the first field under stacked and start', () => {
    // #131's third observation. Under `floating` the first thing below the
    // description is the input box, whose label sits inside the outline, so MUI's
    // own spacing already reads as a gap — 16px measured in Chrome. Under the other
    // two the next thing is a line of label text flush against the description's
    // last line: measured at 0px, text touching text.
    // Asserted on the emitted rule rather than a computed margin because the
    // selector is `:has()`, which jsdom's CSS engine does not implement — it parses
    // the rule and then matches nothing, so `getComputedStyle` reports `0px` here
    // whatever the rule says. Measured in Chrome instead: 0px before, 16px after,
    // matching the 16px `floating` already had.
    renderForm({
      labelPlacement: 'stacked',
      title: 'Account',
      description: 'Tell us where to send receipts.',
    })
    const css = emittedCss()
    const rule = css
      .split('}')
      .find((r) => r.includes(formClasses.description) && r.includes('margin-bottom'))
    expect(rule).toBeDefined()
    expect(rule).toContain('margin-bottom:16px')
    // Keyed on the form containing a non-floating field. `floating` is left alone: it
    // does not have the problem, and a rule there would add a second gap on top of
    // the one MUI already provides — so the selector names the two classes and the
    // `floating` class appears in no description rule.
    expect(rule).toContain(fieldLayoutClasses.stacked)
    expect(rule).toContain(fieldLayoutClasses.start)
    expect(rule).not.toContain(fieldLayoutClasses.floating)
  })

  it('start keeps the label column only above labelPlacementBreakpoint', () => {
    // jsdom does not evaluate media queries, so the assertion is on the emitted
    // rule: the breakpoint has to come from the theme (`theme.breakpoints.up`),
    // not from a literal in `src/`, and it has to move when the prop does.
    const { unmount } = renderForm({ labelPlacement: 'start' })
    // `sm` is 600px, so `up('sm')` is `min-width: 600px`.
    expect(emittedCss()).toContain('min-width:600px')
    unmount()

    renderForm({ labelPlacement: 'start', labelPlacementBreakpoint: 'md' })
    // `md` is 900px.
    expect(emittedCss()).toContain('min-width:900px')
  })

  it.each([
    // The one that actually broke (#130). `startBox` sets `align-items: start` so a
    // multiline Textarea grows down from the top of its *grid row* instead of being
    // stretched. Below the breakpoint the box is a flex column, where `align-items`
    // is the **cross** axis — horizontal — so the same declaration means "shrink
    // every control to its intrinsic width". Measured in Chrome at 380px before the
    // fix: the TextField's input was 194px and the Select's 46px where `stacked` gave
    // both the full 349px, while the box itself was 349px in both. The box was never
    // the problem; the declaration leaking past the breakpoint was.
    'align-items',
    // The grid itself, and the label's placement in it. These were reset by hand
    // under `down()` before; now there is nothing to reset because they never apply.
    'display:grid',
    'grid-template-columns',
    'grid-column',
    'grid-row',
    // The label-column's top padding, which lines the label up with the control's
    // first line. In a stacked box there is no column for it to line up with.
    'padding-top',
  ])('start’s %s exists only above the breakpoint, so nothing has to undo it', (declaration) => {
    // The shape that makes #130 unrepeatable. A `down()` fallback that undoes a list
    // of declarations is a list you can forget from — `align-items` was forgotten,
    // and jsdom (no layout, no media queries) cannot catch that by measuring. Scoping
    // every `start`-only rule under `up(breakpoint)` means the box below the
    // breakpoint simply *is* the stacked box, so a declaration added to `startBox`
    // tomorrow cannot leak either.
    renderForm({ labelPlacement: 'start' })
    // Every `start` rule that carries this declaration must sit inside a
    // `@media (min-width…)` block. Anything left after those blocks are removed
    // applies at every width, including below the breakpoint.
    expect(startRules(cssOutsideMinWidth(emittedCss()))).not.toContain(declaration)
    // …and the declaration really is emitted somewhere, so a typo in the property
    // name cannot make this test vacuously pass.
    expect(startRules(emittedCss())).toContain(declaration)
  })

  it('start leaves Checkbox alone: its label is already beside its control', () => {
    // The checkbox's label lives inside the single `<label>` that *is* the click
    // target. Pulling it into a left column would either break that target or
    // duplicate the label, so the frame opts out of the grid.
    const { container } = renderForm({ labelPlacement: 'start' })
    const checkbox = box(container, 'start', 2)
    expect(checkbox.querySelector('.MuiFormControlLabel-root')).not.toBeNull()
    expect(getComputedStyle(checkbox).display).toBe('inline-flex')
    // And the grid placement is really undone, not merely overridden on the box:
    // `startBox` sets `grid-column` on `.MuiFormLabel-root` itself, which is more
    // specific than the `& > *` reset, so a leftover would survive into the flex
    // box. There is no `MuiFormLabel-root` inside a `FormControlLabel` frame, so
    // the check that matters is that nothing in it carries a column.
    checkbox.querySelectorAll('*').forEach((el) => {
      expect(getComputedStyle(el as HTMLElement).gridColumn).not.toBe('1')
    })
  })

  it('start leaves FileField alone: its picker button is its own label (#133)', () => {
    // FileField's picker is a `Button component="label"` — the field's label *text*
    // and its control in one element, with no `.MuiFormLabel-root` anywhere in the
    // box. `startBox` names column 1 by that class and sends everything else to
    // column 2, so without an opt-out the button landed in column 2 beside an empty
    // label column: a permanent `labelWidth` gutter. The field declares itself
    // self-labelled instead, and the block Checkbox gets applies to it.
    const { container } = render(
      <Form
        schema={z.object({ file: z.any() })}
        defaultValues={{ file: null }}
        onSubmit={() => {}}
        labelPlacement="start"
      >
        <FileField name="file" label="Attachment" />
      </Form>,
    )
    const file = box(container, 'start')
    expect(file.querySelector(`.${formLabelClasses.root}`)).toBeNull()
    expect(file).toHaveClass(fieldLayoutClasses.selfLabelled)

    // The opt-out is keyed on that class, on the *same element* as the placement
    // class (a compound selector, not a descendant heuristic), and it undoes the
    // grid: the box is the stacked inline-flex box again with no column template,
    // and its children carry no column.
    const compound = `.${fieldLayoutClasses.start}.${fieldLayoutClasses.selfLabelled}`
    const optOut = rulesMentioning(startRulesAboveBreakpoint(emittedCss()), compound)
    expect(optOut).toContain('display:inline-flex')
    expect(optOut).toContain('grid-template-columns:none')
    expect(optOut).toMatch(new RegExp(`${compound}>\\*[^{]*\\{grid-column:auto;\\}`))
    // `BoundField`'s `labelAs="control"` now puts the class on the root itself (#28),
    // so Checkbox and Switch are explicit. The `:has(> .MuiFormControlLabel-root)` half
    // stays as the second arm of the same rule — it still covers a consumer's own
    // `FormControlLabel` inside a `render` prop — and is deletable in a follow-up once
    // nothing relies on it.
    expect(optOut).toContain(`:has(> .${formControlLabelClasses.root})`)
    // And, like every other `start`-only rule, it exists only above the breakpoint:
    // below it there is no grid to opt out of.
    expect(rulesMentioning(cssOutsideMinWidth(emittedCss()), fieldLayoutClasses.selfLabelled)).toBe(
      '',
    )
  })

  it('selfLabelled is declared by the field, not inferred from a missing label', () => {
    // A TextField named by `aria-label` alone renders no `.MuiFormLabel-root` either
    // (MUI mounts `InputLabel` only when `label` is set) — yet its control belongs in
    // the control column, aligned with its neighbours'. That is why the opt-out is
    // keyed on a class the component sets rather than on `:not(:has(.MuiFormLabel-root))`,
    // and why this box must *not* carry it.
    const { container } = render(
      <Form
        schema={schema}
        defaultValues={defaultValues}
        onSubmit={() => {}}
        labelPlacement="start"
      >
        <TextField name="email" aria-label="Email" />
      </Form>,
    )
    const text = box(container, 'start')
    expect(text.querySelector(`.${formLabelClasses.root}`)).toBeNull()
    expect(text).not.toHaveClass(fieldLayoutClasses.selfLabelled)
    expect(startRules(emittedCss())).not.toContain(`:not(:has(.${formLabelClasses.root}))`)
  })

  it('start puts a plain direct-child <label> in column 1, unless the box is self-labelled', () => {
    // A consumer-built control (`BoundField labelAs="none"`, #28) renders its own
    // `<label htmlFor>` + `<input>` as direct children of the field box. Its label
    // has no `.MuiFormLabel-root`, so before this the column-1 rule missed it and the
    // column-2 catch-all took it — the same empty gutter FileField had (#133).
    render(
      <Form
        schema={schema}
        defaultValues={defaultValues}
        onSubmit={() => {}}
        labelPlacement="start"
      >
        <div className={fieldLayoutClassName('start')}>
          <label htmlFor="plain">Plain</label>
          <input id="plain" />
        </div>
      </Form>,
    )
    const above = startRulesAboveBreakpoint(emittedCss())
    const start = fieldLayoutClasses.start
    // Column 1: `.MuiFormLabel-root` as before, *or* a direct-child `label` — guarded
    // so that a self-labelled box's `<label>` (FileField's picker Button, a Checkbox's
    // FormControlLabel) is not pulled into a column it opted out of, nor given the
    // label block's `padding: 0` / `transition: none` / top padding.
    const guard = `:not(.${fieldLayoutClasses.selfLabelled}):not(:has(> .${formControlLabelClasses.root}))`
    const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    expect(above).toMatch(
      new RegExp(`\\.${start}${escape(guard)}>label[^{]*\\{[^}]*grid-column:1;grid-row:1;`),
    )
    // Column 2: everything that is neither, so the plain label is no longer caught.
    expect(above).toMatch(
      new RegExp(
        `\\.${start}>\\*:not\\(\\.${formLabelClasses.root}\\):not\\(label\\)\\{grid-column:2;\\}`,
      ),
    )
  })

  it('a field’s own labelPlacement beats the form’s', () => {
    const { container } = render(
      <Form
        schema={schema}
        defaultValues={defaultValues}
        onSubmit={() => {}}
        labelPlacement="start"
      >
        <TextField name="email" label="Email" labelPlacement="floating" />
      </Form>,
    )
    expect(container.querySelector(`.${fieldLayoutClasses.floating}`)).not.toBeNull()
    expect(container.querySelector(`.${fieldLayoutClasses.start}`)).toBeNull()
  })

  it('theme.components.EzForm.defaultProps flips every field in the app', () => {
    // #66's acceptance line: one theme line, no per-field props, no per-form props.
    const theme = createTheme({
      components: { EzForm: { defaultProps: { labelPlacement: 'start' } } },
    })
    const { container } = renderForm({}, theme)
    expect(container.querySelectorAll(`.${fieldLayoutClasses.start}`)).toHaveLength(4)
  })

  it('an explicit prop still beats the theme default', () => {
    const theme = createTheme({
      components: { EzForm: { defaultProps: { labelPlacement: 'start' } } },
    })
    const { container } = renderForm({ labelPlacement: 'stacked' }, theme)
    expect(container.querySelectorAll(`.${fieldLayoutClasses.stacked}`)).toHaveLength(4)
  })

  it('createEzFormTheme defaults to stacked — the preset is where the taste lives', () => {
    const { container } = renderForm({}, createEzFormTheme({ defaultColorScheme: 'light' }))
    expect(container.querySelectorAll(`.${fieldLayoutClasses.stacked}`)).toHaveLength(4)
  })

  it('theme.components.EzForm.styleOverrides.root reaches the placement rules', () => {
    // PHILOSOPHY rule 2: every default the library sets must be overridable. The
    // rules live on `<Form>`'s Root slot precisely so this works.
    const theme = createTheme({
      components: {
        EzForm: {
          styleOverrides: {
            root: { [`& .${fieldLayoutClasses.start}`]: { gridTemplateColumns: '5rem 1fr' } },
          },
        },
      },
    })
    const { container } = renderForm({ labelPlacement: 'start' }, theme)
    expect(getComputedStyle(box(container, 'start')).gridTemplateColumns).toBe('5rem 1fr')
  })

  it('keeps the grid order under an RTL theme', () => {
    // `direction: 'rtl'` plus the stylis plugin is how MUI mirrors a layout, and
    // grid *column order* follows the writing mode on its own — column 1 is the
    // start edge in either direction. The rule must therefore stay a plain
    // two-column template with no physical left/right in it, which is what this
    // pins: an RTL theme changes nothing about the emitted columns.
    const ltr = renderForm({ labelPlacement: 'start' }, createTheme({ direction: 'ltr' }))
    const ltrColumns = getComputedStyle(box(ltr.container, 'start')).gridTemplateColumns
    ltr.unmount()
    const rtl = renderForm({ labelPlacement: 'start' }, createTheme({ direction: 'rtl' }))
    expect(getComputedStyle(box(rtl.container, 'start')).gridTemplateColumns).toBe(ltrColumns)
  })

  it.each(['floating', 'stacked', 'start'] as const)(
    '%s: the label still labels the control, and the error still describes it',
    async (labelPlacement) => {
      const user = userEvent.setup()
      const { container } = renderForm({ labelPlacement })
      // The markup is identical under every placement, so this is the whole claim:
      // a placement is CSS, and `<label for>` never moves.
      const input = screen.getByLabelText('Email')
      expect(input).toHaveAccessibleDescription('Work address')
      await user.click(screen.getByRole('button', { name: 'Save' }))
      expect(await screen.findByRole('alert')).toBeInTheDocument()
      expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
      await expectNoA11yViolations(container)
    },
  )
})

/**
 * Cell mode (#14): what `useEzField` does for a field rendered inside a
 * `<FieldArray layout="table">` cell. Tested here against a bare `FieldCellContext`
 * rather than the table, because this is the hook's own contract — the table is one
 * provider of it and is tested in `FieldArray.test.tsx`.
 */
describe('labelPlacement inside a table cell (#14)', () => {
  const cellSchema = z.object({
    sku: z.string(),
    qty: z.number().nullable(),
    role: z.string(),
    start: z.date().nullable(),
  })
  const cellDefaults = { sku: '', qty: 1, role: '', start: null }

  /**
   * One cell: the column header element a real table would carry, and the context a
   * real `<FieldArray layout="table">` cell provides. The row header (`#row-2`) is
   * rendered once by `renderCell`, shared by every cell in the "row".
   */
  function Cell({
    children,
    helperTextHidden = true,
    header = 'Qty',
  }: {
    children: ReactNode
    helperTextHidden?: boolean
    header?: string
  }) {
    const headerId = `col-${header.toLowerCase()}`
    return (
      <>
        <span id={headerId}>{header}</span>
        <FieldCellContext.Provider
          value={{
            rowHeaderId: 'row-2',
            headerId,
            label: `Line item 2 ${header}`,
            helperTextHidden,
          }}
        >
          {children}
        </FieldCellContext.Provider>
      </>
    )
  }

  const renderCell = (children: ReactNode, placement: LabelPlacement = 'floating') =>
    render(
      withPickers(
        <Form
          schema={cellSchema}
          defaultValues={cellDefaults}
          onSubmit={() => {}}
          labelPlacement={placement}
        >
          <span id="row-2">Line item 2</span>
          {children}
          <SubmitButton>Save</SubmitButton>
        </Form>,
      ),
    )

  it('applies the cell classes only to the field inside the cell', () => {
    renderCell(
      <>
        <TextField name="sku" label="SKU" />
        <Cell>
          <TextField name="qty" label="Qty" />
        </Cell>
      </>,
    )
    const outside = screen.getByRole('textbox', { name: 'SKU' }).closest('.MuiFormControl-root')!
    const inside = screen
      .getByRole('textbox', { name: 'Line item 2 Qty' })
      .closest('.MuiFormControl-root')!
    expect(outside).not.toHaveClass(fieldLayoutClasses.cell)
    expect(inside).toHaveClass(fieldLayoutClasses.root, fieldLayoutClasses.floating)
    expect(inside).toHaveClass(fieldLayoutClasses.cell, fieldLayoutClasses.cellHelperHidden)
  })

  it('names the control by row header + column header and keeps its own label as <label for>', () => {
    renderCell(
      <Cell>
        <TextField name="qty" label="Quantity" />
      </Cell>,
    )
    // accname: `aria-labelledby` outranks the `<label for>`, so the name is the two headers.
    const input = screen.getByRole('textbox', { name: 'Line item 2 Qty' })
    expect(input).toHaveAttribute('aria-labelledby', 'row-2 col-qty')
    // The field's own label is still in the DOM and still points at the input — it is
    // hidden, not removed — so the field is unchanged for everything but its name.
    const label = input.closest('.MuiFormControl-root')!.querySelector('label')!
    expect(label).toHaveTextContent('Quantity')
    expect(label).toHaveAttribute('for', input.id)
    // jsdom computes `position` from the cascade but not `clip`, so the recipe is
    // pinned by its positioning here and by its full text in the CSS assertion below.
    expect(getComputedStyle(label).position).toBe('absolute')
    // Measured, not assumed: Testing Library follows accname too, so `getByLabelText`
    // resolves through the headers — by either header's text or both — and *not*
    // through the field's own hidden label text once `aria-labelledby` is set.
    expect(screen.getByLabelText('Qty')).toBe(input)
    expect(screen.getByLabelText('Line item 2 Qty')).toBe(input)
    expect(screen.queryByLabelText('Quantity')).toBeNull()
  })

  it("a consumer's aria-label or aria-labelledby beats the cell name (#99, #100)", () => {
    renderCell(
      <>
        <span id="mine">Mine</span>
        <Cell>
          <TextField name="sku" label="SKU" aria-label="Custom name" />
        </Cell>
        <Cell>
          <TextField name="qty" label="Qty" aria-labelledby="mine" />
        </Cell>
      </>,
    )
    expect(screen.getByRole('textbox', { name: 'Custom name' })).not.toHaveAttribute(
      'aria-labelledby',
    )
    expect(screen.getByRole('textbox', { name: 'Mine' })).toHaveAttribute('aria-labelledby', 'mine')
    expect(screen.queryByRole('textbox', { name: 'Line item 2 Qty' })).toBeNull()
  })

  it('keeps the helper text as the description; hidden under summary, shown under inline', async () => {
    const user = userEvent.setup()
    renderCell(
      <>
        <Cell>
          <TextField name="sku" label="SKU" helperText="Stock code" required />
        </Cell>
        <Cell helperTextHidden={false} header="Role">
          <TextField name="role" label="Role" helperText="Access level" />
        </Cell>
      </>,
    )
    const sku = screen.getByRole('textbox', { name: 'Line item 2 Qty' })
    expect(sku).toHaveAccessibleDescription('Stock code')
    const hiddenHelper = sku
      .closest('.MuiFormControl-root')!
      .querySelector(`.${formHelperTextClasses.root}`)!
    expect(getComputedStyle(hiddenHelper).position).toBe('absolute')
    const role = screen.getByRole('textbox', { name: 'Line item 2 Role' })
    expect(role).toHaveAccessibleDescription('Access level')
    const shownHelper = role
      .closest('.MuiFormControl-root')!
      .querySelector(`.${formHelperTextClasses.root}`)!
    expect(getComputedStyle(shownHelper).position).not.toBe('absolute')
    // An error replaces the helper text and is announced from the same node, hidden or not.
    await user.click(screen.getByRole('button', { name: 'Save' }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('SKU is required.')
    expect(sku).toHaveAttribute('aria-invalid', 'true')
    expect(sku).toHaveAccessibleDescription('SKU is required.')
  })

  it('reaches every family that routes nameA11y: Select, NumberField, DatePicker', () => {
    renderCell(
      <>
        <Cell header="Role">
          <Select name="role" label="Role" options={[{ value: 'a', label: 'A' }]} />
        </Cell>
        <Cell>
          <NumberField name="qty" label="Qty" />
        </Cell>
        <Cell header="Start">
          <DatePicker name="start" label="Start" />
        </Cell>
      </>,
    )
    expect(screen.getByRole('combobox', { name: 'Line item 2 Role' })).toBeInTheDocument()
    // Base UI's visible number input is a `textbox` (the hidden `type="number"` input is
    // the one carrying `name`).
    expect(screen.getByRole('textbox', { name: 'Line item 2 Qty' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Line item 2 Start' })).toBeInTheDocument()
  })

  it.each(['floating', 'stacked', 'start'] as const)(
    '%s: a cell closes the notch and fills its box regardless of the form placement',
    (placement) => {
      const { container } = renderCell(
        <Cell>
          <TextField name="qty" label="Qty" />
        </Cell>,
        placement,
      )
      const cellBox = container.querySelector<HTMLElement>(`.${fieldLayoutClasses.cell}`)!
      expect(cellBox).toHaveClass(fieldLayoutClasses[placement])
      const legend = cellBox.querySelector('.MuiOutlinedInput-notchedOutline legend')!
      expect(getComputedStyle(legend).maxWidth).toBe('0.01px')
      expect(getComputedStyle(cellBox).width).toBe('100%')
      // The rules are keyed by two classes so they outrank any single-class placement
      // rule, `start`'s min-width grid included.
      expect(emittedCss()).toMatch(
        new RegExp(
          `\\.${fieldLayoutClasses.root}\\.${fieldLayoutClasses.cell}\\{[^}]*display:inline-flex;width:100%;`,
        ),
      )
      expect(emittedCss()).toMatch(
        new RegExp(
          `\\.${fieldLayoutClasses.root}\\.${fieldLayoutClasses.cell} \\.${formLabelClasses.root}[^{]*\\{position:absolute;width:1px;height:1px;[^}]*clip:rect\\(0 0 0 0\\);`,
        ),
      )
    },
  )

  it('has no a11y violations with a cell field at rest and in error', async () => {
    const user = userEvent.setup()
    const { container } = renderCell(
      <Cell>
        <TextField name="sku" label="SKU" required />
      </Cell>,
    )
    await expectNoA11yViolations(container)
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByRole('alert')
    await expectNoA11yViolations(container)
  })
})
