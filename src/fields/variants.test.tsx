import { render, screen, within } from '@testing-library/react'
import { expectTypeOf } from 'vitest'
import Input from '@mui/material/Input'
import { createTheme, ThemeProvider } from '@mui/material/styles'
import type { TextFieldVariants } from '@mui/material/TextField'
import { z } from 'zod'
import { Form } from '../Form'
import { TextField, type TextFieldProps } from './TextField'
import { NumberField } from './NumberField'
import { MoneyField } from './MoneyField'
import { PercentField } from './PercentField'
import { Select } from './Select'
import { StateSelect } from './StateSelect'
import { Autocomplete } from './Autocomplete'
import { EmailField } from './EmailField'
import { EmailListField } from './EmailListField'
import { PhoneField } from './PhoneField'
import { SsnField } from './SsnField'
import { FeinField } from './FeinField'
import { ZipField } from './ZipField'
import { TextareaField } from './TextareaField'
import { PasswordField } from './PasswordField'
import { DateField } from './DateField'
import { DatePicker } from './DatePicker'
import { TimePicker } from './TimePicker'
import { DateTimePicker } from './DateTimePicker'
import { withPickers } from '../test/pickers'
import { expectNoA11yViolations } from '../test/axe'
import type { EzTextFieldVariants } from './textFieldVariants'

/**
 * The custom-variant shim (#142), across **every box input**. The claim is one prop:
 * `variant` is a top-level prop on each of them, it takes MUI's three plus ez-form's
 * `'stacked'`, and it reaches the MUI TextField (or `PickersTextField`) underneath.
 * The *look* under `createEzFormTheme()` is `src/theme/ezFormTheme.test.tsx`'s.
 *
 * Everything renders under a stock `createTheme()` on purpose: `'stacked'` is only a
 * variant MUI does not know, and the point is that it renders at all instead of
 * throwing. Unshimmed, MUI looks the variant up in `variantComponent`, finds
 * `undefined`, and React throws on an element with no type.
 */

const stock = createTheme()

/** One schema wide enough for every field below, so one `<Form>` serves them all. */
const schema = z.object({
  text: z.string(),
  num: z.number().nullable(),
  list: z.array(z.string()),
  date: z.date().nullable(),
})

const defaultValues = { text: '', num: null, list: [] as string[], date: null }

function renderField(ui: React.ReactNode) {
  return render(
    withPickers(
      <ThemeProvider theme={stock}>
        <Form schema={schema} defaultValues={defaultValues} onSubmit={() => {}}>
          {ui}
        </Form>
      </ThemeProvider>,
    ),
  )
}

const options = [{ value: 'x', label: 'X' }]

/**
 * Every box input, keyed by how its rendered input is found and which input class the
 * built-in `filled` variant must produce. The pickers render MUI X's own
 * `PickersFilledInput`, not MUI's `FilledInput`, so they carry the `MuiPickersFilledInput`
 * class instead — same `slots.input ?? VARIANT_COMPONENT[variant]` resolution, different
 * component family.
 */
const boxInputs = [
  ['TextField', (v: EzTextFieldVariants) => <TextField name="text" label="F" variant={v} />],
  ['NumberField', (v: EzTextFieldVariants) => <NumberField name="num" label="F" variant={v} />],
  ['MoneyField', (v: EzTextFieldVariants) => <MoneyField name="num" label="F" variant={v} />],
  ['PercentField', (v: EzTextFieldVariants) => <PercentField name="num" label="F" variant={v} />],
  [
    'Select',
    (v: EzTextFieldVariants) => <Select name="text" label="F" options={options} variant={v} />,
  ],
  ['StateSelect', (v: EzTextFieldVariants) => <StateSelect name="text" label="F" variant={v} />],
  [
    'Autocomplete',
    (v: EzTextFieldVariants) => (
      <Autocomplete name="text" label="F" options={options} variant={v} />
    ),
  ],
  ['EmailField', (v: EzTextFieldVariants) => <EmailField name="text" label="F" variant={v} />],
  [
    'EmailListField',
    (v: EzTextFieldVariants) => <EmailListField name="list" label="F" variant={v} />,
  ],
  ['PhoneField', (v: EzTextFieldVariants) => <PhoneField name="text" label="F" variant={v} />],
  ['SsnField', (v: EzTextFieldVariants) => <SsnField name="text" label="F" variant={v} />],
  ['FeinField', (v: EzTextFieldVariants) => <FeinField name="text" label="F" variant={v} />],
  ['ZipField', (v: EzTextFieldVariants) => <ZipField name="text" label="F" variant={v} />],
  [
    'TextareaField',
    (v: EzTextFieldVariants) => <TextareaField name="text" label="F" variant={v} />,
  ],
  [
    'PasswordField',
    (v: EzTextFieldVariants) => <PasswordField name="text" label="F" variant={v} />,
  ],
  ['DateField', (v: EzTextFieldVariants) => <DateField name="date" label="F" variant={v} />],
  ['DatePicker', (v: EzTextFieldVariants) => <DatePicker name="date" label="F" variant={v} />],
  ['TimePicker', (v: EzTextFieldVariants) => <TimePicker name="date" label="F" variant={v} />],
  [
    'DateTimePicker',
    (v: EzTextFieldVariants) => <DateTimePicker name="date" label="F" variant={v} />,
  ],
] as const satisfies readonly (readonly [string, (v: EzTextFieldVariants) => React.ReactElement])[]

/** The pickers render MUI X's `PickersFilledInput`; everything else MUI's `FilledInput`. */
const PICKERS = new Set(['DateField', 'DatePicker', 'TimePicker', 'DateTimePicker'])

/**
 * The `InputBase` root the field rendered, whatever role its control has: a text field's
 * `textbox`, a Select's / Autocomplete's `combobox`, or a picker's `group`. Read off the
 * DOM rather than by role so one lookup serves all nineteen.
 */
const inputRoot = (container: HTMLElement) =>
  container.querySelector('.MuiInputBase-root, .MuiPickersInputBase-root')

describe('variant on every box input (#142)', () => {
  describe.each(boxInputs)('%s', (name, renderOne) => {
    it('routes the built-in `filled` variant to MUI’s own filled input', () => {
      // The prop reaching MUI at all is what this asserts: `filled` is a variant MUI
      // already knows, so the only way the class appears is the value arriving.
      const { container } = renderField(renderOne('filled'))
      const expected = PICKERS.has(name) ? 'MuiPickersFilledInput-root' : 'MuiFilledInput-root'
      expect(inputRoot(container)).toHaveClass(expected)
    })

    it('renders `stacked` under a stock theme, label present, without throwing', () => {
      // A variant MUI does not know. Unshimmed this throws; shimmed it falls back to
      // the outlined input and the label is still rendered and still *associated* —
      // asserted through the accessible name rather than a `<label>` tag, because
      // `Select` renders its `InputLabel` as a `<div>` over the `role="combobox"`
      // (there is no native `<input>` for a `for` to point at) and names the control
      // with `aria-labelledby` instead. The name is the thing that matters either way.
      // One render, not a `.not.toThrow()` wrapper plus a second: a throw inside
      // `render` fails the test on its own, and rendering twice would leave two
      // fields named "F" in the document for the query below.
      const { container } = renderField(renderOne('stacked'))
      // `getAllBy*`: a picker's label names both the `role="group"` field and the
      // section spans inside it, so one field legitimately answers to it more than
      // once. That there is at least one is the claim.
      expect(within(container).getAllByLabelText('F').length).toBeGreaterThan(0)
    })

    it('has no axe violations under `stacked`', async () => {
      const { container } = renderField(renderOne('stacked'))
      await expectNoA11yViolations(container)
    })
  })

  describe('the shim’s escape hatches and precedence', () => {
    it('leaves the notch closed for a custom variant, with no `notched` prop', () => {
      // MUI's TextField passes `label` to the input only under `variant === 'outlined'`
      // (TextField.js), so `NotchedOutline` renders with `withLabel` false: the legend
      // holds a zero-width placeholder span, never the label text. This is why the
      // preset can drop `MuiOutlinedInput.defaultProps.notched`.
      renderField(<TextField name="text" label="A" variant="stacked" />)
      const legend = document.querySelector('.MuiOutlinedInput-notchedOutline legend')!
      expect(legend.textContent).not.toContain('A')
      expect(legend.querySelector('span')).toHaveAttribute('aria-hidden', 'true')
    })

    it('leaves the other two built-in variants on MUI’s own inputs', () => {
      const { unmount } = renderField(<TextField name="text" label="A" variant="standard" />)
      expect(screen.getByRole('textbox', { name: 'A' }).closest('.MuiInputBase-root')).toHaveClass(
        'MuiInput-root',
      )
      unmount()
      renderField(<TextField name="text" label="A" variant="outlined" />)
      expect(screen.getByRole('textbox', { name: 'A' }).closest('.MuiInputBase-root')).toHaveClass(
        'MuiOutlinedInput-root',
      )
    })

    it('a consumer’s own slots.input wins over the shim’s', () => {
      // The upstream escape hatch: `slots.input` is how a variant chooses another
      // input, so `VariantInput` — spread *first* at every call site — must never
      // displace one the consumer passed.
      renderField(<TextField name="text" label="A" variant="stacked" slots={{ input: Input }} />)
      expect(screen.getByRole('textbox', { name: 'A' }).closest('.MuiInputBase-root')).toHaveClass(
        'MuiInput-root',
      )
    })

    it('an Autocomplete’s textFieldProps.variant wins over its top-level one', () => {
      // Same precedence as the `{...params} {...textFieldProps}` spread the component
      // already follows: `textFieldProps` is the lower-level escape hatch.
      const { container } = renderField(
        <Autocomplete
          name="text"
          label="A"
          options={options}
          variant="stacked"
          textFieldProps={{ variant: 'filled' }}
        />,
      )
      expect(inputRoot(container)).toHaveClass('MuiFilledInput-root')
    })

    it('a picker’s slotProps.textField.variant wins over its top-level one', () => {
      const { container } = renderField(
        <DatePicker
          name="date"
          label="A"
          variant="stacked"
          slotProps={{ textField: { variant: 'filled' } }}
        />,
      )
      expect(inputRoot(container)).toHaveClass('MuiPickersFilledInput-root')
    })
  })

  describe('types', () => {
    it('EzTextFieldVariants is MUI’s union plus what augments the overrides', () => {
      expectTypeOf<TextFieldVariants>().toExtend<EzTextFieldVariants>()
      expectTypeOf<'stacked'>().toExtend<EzTextFieldVariants>()
      expectTypeOf<'outlined'>().toExtend<EzTextFieldVariants>()
      expectTypeOf<'standard'>().toExtend<EzTextFieldVariants>()
      expectTypeOf<'filled'>().toExtend<EzTextFieldVariants>()
      // Not open to any string: an undeclared variant is still a type error, which is
      // the whole point of augmenting rather than widening to `string`.
      expectTypeOf<'dashed'>().not.toExtend<EzTextFieldVariants>()
    })

    it('the field’s own prop takes every one of them', () => {
      expectTypeOf<TextFieldProps['variant']>().toEqualTypeOf<EzTextFieldVariants | undefined>()
    })
  })
})
