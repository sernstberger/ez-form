import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createTheme, ThemeProvider } from '@mui/material/styles'
import { z } from 'zod'
import { Form } from '../Form'
import { SubmitButton } from '../SubmitButton'
import { TextField } from './TextField'
import { Select } from './Select'
import { Checkbox } from './Checkbox'
import { RadioGroup } from './RadioGroup'
import { createEzFormTheme } from '../theme/ezFormTheme'
import { fieldLayoutClasses, type LabelPlacement } from './LabelPlacementContext'
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

  it('start lays the field out as a two-column grid', () => {
    const { container } = renderForm({ labelPlacement: 'start' })
    const style = getComputedStyle(box(container, 'start'))
    expect(style.display).toBe('grid')
    // Column one is the label's, column two takes the control *and* the helper
    // text — a flex row would have put the helper text in a third column.
    expect(style.gridTemplateColumns).toBe('12rem 1fr')
  })

  it('start takes the label column width from labelWidth', () => {
    const { container } = renderForm({ labelPlacement: 'start', labelWidth: '18ch' })
    expect(getComputedStyle(box(container, 'start')).gridTemplateColumns).toBe('18ch 1fr')
  })

  it('start collapses to stacked below labelPlacementBreakpoint', () => {
    // jsdom does not evaluate media queries, so the assertion is on the emitted
    // rule: the breakpoint has to come from the theme (`theme.breakpoints.down`),
    // not from a literal in `src/`, and it has to move when the prop does.
    const emitted = () =>
      [...document.querySelectorAll('style')].map((s) => s.textContent ?? '').join('\n')

    const { unmount } = renderForm({ labelPlacement: 'start' })
    // `sm` is 600px, so `down('sm')` is `max-width: 599.95px`.
    expect(emitted()).toContain('599.95px')
    unmount()

    renderForm({ labelPlacement: 'start', labelPlacementBreakpoint: 'md' })
    // `md` is 900px.
    expect(emitted()).toContain('899.95px')
  })

  it('start leaves Checkbox alone: its label is already beside its control', () => {
    // The checkbox's label lives inside the single `<label>` that *is* the click
    // target. Pulling it into a left column would either break that target or
    // duplicate the label, so the frame opts out of the grid.
    const { container } = renderForm({ labelPlacement: 'start' })
    const checkbox = box(container, 'start', 2)
    expect(checkbox.querySelector('.MuiFormControlLabel-root')).not.toBeNull()
    expect(getComputedStyle(checkbox).display).toBe('inline-flex')
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
