import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createTheme, ThemeProvider } from '@mui/material/styles'
import { z } from 'zod'
import { Form } from '../../Form'
import { AddressField, addressFieldClasses, type AddressValue } from './AddressField'
import { addressSchema } from './addressSchema'
import { describeFieldContract } from '../../test/describeFieldContract'
import { expectNoA11yViolations } from '../../test/axe'

const schema = z.object({ address: addressSchema() })
const emptyAddress = { street: '', street2: '', city: '', state: '', zip: '' }
const defaultValues = { address: emptyAddress }

const street = () => screen.getByRole('textbox', { name: 'Street address' })
const city = () => screen.getByRole('textbox', { name: 'City' })
const state = () => screen.getByRole('combobox', { name: 'State' })
const zip = () => screen.getByRole('textbox', { name: 'ZIP code' })

// The shared contract assumes one control per component: `getControl`,
// `expectDisabled`, and the helperText/error case all target a single element,
// and the error case asserts exactly one `role="alert"`. A composite has five
// controls, so the contract runs against the `street` part — `helperText`,
// `onChange` and the failing `required` reach it through `slotProps.street`,
// leaving the other four parts valid so a single alert appears. `disabled`
// still goes to the composite, since that case checks the form's lock reaches
// the control the contract reads. The parts the contract cannot see (per-part
// errors, `required` propagation to all four, `<Form disabled>` across all
// five) are covered by the composite-specific cases below. `componentName`
// stays `AddressField`, so the "outside <Form>" case verifies the composite's
// own guard fires before any part's.
// Only `street` is required here, so a failing submit produces exactly the one
// alert the contract expects; the composite's real schema (`addressSchema`,
// used everywhere else in this file) requires all four.
const streetOnlySchema = z.object({
  address: z.object({
    street: z.string().min(1),
    street2: z.string().optional(),
    city: z.string(),
    state: z.string(),
    zip: z.string(),
  }),
})

describeFieldContract({
  componentName: 'AddressField',
  label: 'Street address',
  schema: streetOnlySchema,
  defaultValues,
  errorProps: { required: true },
  errorMessage: 'Street address is required.',
  render: ({ helperText, onChange, required, ...props }) => (
    <AddressField
      name="address"
      {...props}
      slotProps={{ street: { helperText, onChange, required } }}
    />
  ),
  getControl: street,
  interact: (user) => user.type(street(), '1'),
})

function renderForm(onSubmit = vi.fn(), props = {}) {
  render(
    <Form schema={schema} defaultValues={defaultValues} onSubmit={onSubmit}>
      <AddressField name="address" {...props} />
      <button type="submit">Go</button>
    </Form>,
  )
  return { onSubmit }
}

describe('AddressField', () => {
  it('renders the five parts with their default labels', () => {
    renderForm()
    expect(street()).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Apartment, suite, etc.' })).toBeInTheDocument()
    expect(city()).toBeInTheDocument()
    expect(state()).toBeInTheDocument()
    expect(zip()).toBeInTheDocument()
  })

  it('registers every part under the nested object name', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderForm(onSubmit)
    await user.type(street(), '1 Main St')
    await user.type(screen.getByRole('textbox', { name: 'Apartment, suite, etc.' }), 'Apt 2')
    await user.type(city(), 'Springfield')
    await user.click(state())
    await user.click(await screen.findByRole('option', { name: 'California' }))
    await user.type(zip(), '90210')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith(
      {
        address: {
          street: '1 Main St',
          street2: 'Apt 2',
          city: 'Springfield',
          state: 'CA',
          zip: '90210',
        },
      },
      expect.anything(),
    )
  })

  it('sets the US autofill token on each part', () => {
    renderForm()
    expect(street()).toHaveAttribute('autoComplete', 'street-address')
    expect(screen.getByRole('textbox', { name: 'Apartment, suite, etc.' })).toHaveAttribute(
      'autoComplete',
      'address-line2',
    )
    expect(city()).toHaveAttribute('autoComplete', 'address-level2')
    expect(zip()).toHaveAttribute('autoComplete', 'postal-code')
    // StateSelect puts its token on the hidden native input MUI's Select renders.
    expect(document.querySelector('input[name="address.state"]')).toHaveAttribute(
      'autoComplete',
      'address-level1',
    )
  })

  it('autoCompleteSection prefixes every token', () => {
    renderForm(vi.fn(), { autoCompleteSection: 'shipping' })
    expect(street()).toHaveAttribute('autoComplete', 'shipping street-address')
    expect(screen.getByRole('textbox', { name: 'Apartment, suite, etc.' })).toHaveAttribute(
      'autoComplete',
      'shipping address-line2',
    )
    expect(city()).toHaveAttribute('autoComplete', 'shipping address-level2')
    expect(zip()).toHaveAttribute('autoComplete', 'shipping postal-code')
    expect(document.querySelector('input[name="address.state"]')).toHaveAttribute(
      'autoComplete',
      'shipping address-level1',
    )
  })

  it('required propagates to street, city, state and zip but never street2', () => {
    renderForm(vi.fn(), { required: true })
    expect(street()).toBeRequired()
    expect(city()).toBeRequired()
    expect(zip()).toBeRequired()
    expect(state()).toHaveAttribute('aria-required', 'true')
    expect(screen.getByRole('textbox', { name: 'Apartment, suite, etc.' })).not.toBeRequired()
  })

  it('street2={false} hides the second street line and drops it from the value', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    const noStreet2 = z.object({ address: addressSchema({ street2: false }) })
    render(
      <Form
        schema={noStreet2}
        defaultValues={{ address: { street: '', city: '', state: '', zip: '' } }}
        onSubmit={onSubmit}
      >
        <AddressField name="address" street2={false} />
        <button type="submit">Go</button>
      </Form>,
    )
    expect(
      screen.queryByRole('textbox', { name: 'Apartment, suite, etc.' }),
    ).not.toBeInTheDocument()
    await user.type(street(), '1 Main St')
    await user.type(city(), 'Springfield')
    await user.click(state())
    await user.click(await screen.findByRole('option', { name: 'California' }))
    await user.type(zip(), '90210')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith(
      { address: { street: '1 Main St', city: 'Springfield', state: 'CA', zip: '90210' } },
      expect.anything(),
    )
  })

  it('shows a per-part error on the part that failed, not on the others', async () => {
    const user = userEvent.setup()
    renderForm()
    await user.type(street(), '1 Main St')
    await user.type(city(), 'Springfield')
    await user.click(state())
    await user.click(await screen.findByRole('option', { name: 'California' }))
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByText('ZIP code is required')).toBeInTheDocument()
    expect(zip()).toHaveAttribute('aria-invalid', 'true')
    expect(zip()).toHaveAccessibleDescription('ZIP code is required')
    expect(street()).toHaveAttribute('aria-invalid', 'false')
    expect(city()).toHaveAttribute('aria-invalid', 'false')
    expect(screen.queryByText('Street address is required')).not.toBeInTheDocument()
  })

  it('labels are props a consumer overrides', () => {
    renderForm(vi.fn(), {
      streetLabel: 'Address',
      street2Label: 'Unit',
      cityLabel: 'Town',
      stateLabel: 'Province',
      zipLabel: 'Postcode',
    })
    expect(screen.getByRole('textbox', { name: 'Address' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Unit' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Town' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Province' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Postcode' })).toBeInTheDocument()
  })

  it('legend renders a named fieldset', () => {
    renderForm(vi.fn(), { legend: 'Shipping address', description: 'Where it ships.' })
    const group = screen.getByRole('group', { name: 'Shipping address' })
    expect(group).toHaveAccessibleDescription('Where it ships.')
    expect(group).toContainElement(street())
  })

  it('disables every part under <Form disabled>', () => {
    render(
      <Form schema={schema} defaultValues={defaultValues} onSubmit={() => {}} disabled>
        <AddressField name="address" />
      </Form>,
    )
    expect(street()).toBeDisabled()
    expect(screen.getByRole('textbox', { name: 'Apartment, suite, etc.' })).toBeDisabled()
    expect(city()).toBeDisabled()
    expect(zip()).toBeDisabled()
    expect(state()).toHaveAttribute('aria-disabled', 'true')
  })

  it('a theme styleOverride reaches the root slot', () => {
    const theme = createTheme({
      components: {
        EzAddressField: { styleOverrides: { root: { gap: '40px' } } },
      },
    })
    const { container } = render(
      <ThemeProvider theme={theme}>
        <Form schema={schema} defaultValues={defaultValues} onSubmit={() => {}}>
          <AddressField name="address" />
        </Form>
      </ThemeProvider>,
    )
    expect(container.querySelector(`.${addressFieldClasses.root}`)).toHaveStyle({ gap: '40px' })
  })

  it('a theme defaultProp reaches the composite', () => {
    const theme = createTheme({
      components: { EzAddressField: { defaultProps: { zipLabel: 'Postal code' } } },
    })
    render(
      <ThemeProvider theme={theme}>
        <Form schema={schema} defaultValues={defaultValues} onSubmit={() => {}}>
          <AddressField name="address" />
        </Form>
      </ThemeProvider>,
    )
    expect(screen.getByRole('textbox', { name: 'Postal code' })).toBeInTheDocument()
  })

  it('has no accessibility violations with a legend and every part required', async () => {
    const { container } = render(
      <Form schema={schema} defaultValues={defaultValues} onSubmit={() => {}}>
        <AddressField name="address" legend="Shipping address" required />
      </Form>,
    )
    await expectNoA11yViolations(container)
  })
})

describe('addressSchema', () => {
  it('parses to AddressValue', () => {
    // Compile-time only — no runtime call, so nothing here can throw.
    // `AddressValue` and what `addressSchema()` parses to are two declarations
    // of the same shape and would otherwise be free to drift; this fails
    // `pnpm typecheck` if either side gains, loses or retypes a key.
    //
    // Assignability in both directions rather than `toEqualTypeOf`:
    // `addressSchema()`'s `street2` flag is a runtime argument, not a type
    // parameter, so its return type is a *union* of the with- and
    // without-`street2` objects. Mutual assignability is the exactness that
    // union can express, and it still rejects a renamed, added or retyped key.
    expectTypeOf<z.infer<ReturnType<typeof addressSchema>>>().toMatchTypeOf<AddressValue>()
    expectTypeOf<AddressValue>().toMatchTypeOf<z.infer<ReturnType<typeof addressSchema>>>()
  })

  it('requires street, city, state and zip', () => {
    const result = addressSchema().safeParse({ street: '', city: '', state: '', zip: '' })
    expect(result.success).toBe(false)
    expect(result.error?.issues.map((i) => i.message)).toEqual([
      'Street address is required',
      'City is required',
      'State is required',
      'ZIP code is required',
    ])
  })

  it('leaves street2 optional', () => {
    expect(
      addressSchema().safeParse({
        street: '1 Main St',
        city: 'Springfield',
        state: 'CA',
        zip: '90210',
      }).success,
    ).toBe(true)
  })

  it('street2: false drops the key', () => {
    const parsed = addressSchema({ street2: false }).parse({
      street: '1 Main St',
      street2: 'Apt 2',
      city: 'Springfield',
      state: 'CA',
      zip: '90210',
    })
    expect(parsed).not.toHaveProperty('street2')
  })

  it('messages override the defaults', () => {
    const result = addressSchema({ messages: { zip: 'Need a ZIP' } }).safeParse({
      street: '1 Main St',
      city: 'Springfield',
      state: 'CA',
      zip: '',
    })
    expect(result.error?.issues[0]?.message).toBe('Need a ZIP')
  })
})
