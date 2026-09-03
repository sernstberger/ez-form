import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { autocompleteClasses } from '@mui/material/Autocomplete'
import { createTheme, ThemeProvider } from '@mui/material/styles'
import { z } from 'zod'
import { Form } from '../../Form'
import {
  AddressField,
  addressFieldClasses,
  type AddressFieldProps,
  type AddressValue,
} from './AddressField'
import { addressSchema } from './addressSchema'
import type {
  AddressLookupContext,
  AddressLookupProvider,
  AddressSuggestion,
} from './addressLookup'
import { newSession } from './useAddressLookup'
import { useEzFormContext } from '../../useEzFormContext'
import { resetDevWarnings } from '../../devWarn'
import { describeFieldContract } from '../../test/describeFieldContract'
import { expectNoA11yViolations } from '../../test/axe'
import { consoleMessages, expectConsole } from '../../test/expectConsole'
import { mockAddressLookup } from '../../test/mockAddressLookup'

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
// the control the contract reads. `componentName` stays `AddressField`, so the
// "outside <Form>" case verifies the composite's own guard fires before any
// part's.
//
// What the contract does NOT cover here, and where it is covered instead:
//   - `toBeRequired()` on the control. The contract only asserts that when
//     `errorProps` is left undefined, and it is passed explicitly above (the
//     composite's own `required` would error all four parts and produce four
//     alerts). Covered by the 'required propagates …' case below, which checks
//     the announcement on all four parts plus its absence on street2.
//   - per-part error isolation, `<Form disabled>` across all five parts, and
//     the autofill tokens — all in the composite-specific cases below.
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

  it('under <Form assisted> emits autoComplete="off" on every part instead of the US tokens (#65)', () => {
    render(
      <Form schema={schema} defaultValues={defaultValues} onSubmit={vi.fn()} assisted>
        <AddressField name="address" />
      </Form>,
    )
    expect(street()).toHaveAttribute('autoComplete', 'off')
    expect(screen.getByRole('textbox', { name: 'Apartment, suite, etc.' })).toHaveAttribute(
      'autoComplete',
      'off',
    )
    expect(city()).toHaveAttribute('autoComplete', 'off')
    expect(zip()).toHaveAttribute('autoComplete', 'off')
    expect(document.querySelector('input[name="address.state"]')).toHaveAttribute(
      'autoComplete',
      'off',
    )
  })

  it('a consumer autoComplete on a part still wins under assisted', () => {
    render(
      <Form schema={schema} defaultValues={defaultValues} onSubmit={vi.fn()} assisted>
        <AddressField name="address" slotProps={{ street: { autoComplete: 'street-address' } }} />
      </Form>,
    )
    expect(street()).toHaveAttribute('autoComplete', 'street-address')
    // The other parts are unaffected by the one override.
    expect(city()).toHaveAttribute('autoComplete', 'off')
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

// ---------------------------------------------------------------------------
// `lookup`
// ---------------------------------------------------------------------------

// Every part a plain string, nothing required: these cases submit to read the
// form's values back, and a pick that leaves a part empty must still submit.
const looseSchema = z.object({
  address: z.object({
    street: z.string(),
    street2: z.string().optional(),
    city: z.string(),
    state: z.string(),
    zip: z.string(),
  }),
})

const streetBox = () => screen.getByRole('combobox', { name: 'Street address' })
const option = (name: RegExp) => screen.findByRole('option', { name })
const sessionShape = /^[A-Za-z0-9_-]{1,36}$/

/** A provider whose `search` promises are handed back to the test to settle by hand. */
function deferredLookup() {
  const pending: {
    query: string
    ctx: AddressLookupContext
    settle: (rows: AddressSuggestion[]) => void
  }[] = []
  const provider: AddressLookupProvider = {
    search: (query, ctx) =>
      new Promise<AddressSuggestion[]>((settle) => {
        pending.push({ query, ctx, settle })
      }),
    resolve: () => Promise.resolve({}),
  }
  return { provider, pending }
}

function renderLookup(
  lookup: AddressLookupProvider,
  props: Partial<AddressFieldProps> = {},
  onSubmit = vi.fn(),
) {
  render(
    <Form schema={looseSchema} defaultValues={defaultValues} onSubmit={onSubmit}>
      <AddressField name="address" lookup={lookup} lookupDebounceMs={0} {...props} />
      <button type="submit">Go</button>
    </Form>,
  )
  return { onSubmit }
}

/** Submits and returns the address the form handed `onSubmit`. */
async function submitted(
  user: ReturnType<typeof userEvent.setup>,
  onSubmit: ReturnType<typeof vi.fn>,
) {
  await user.click(screen.getByRole('button', { name: 'Go' }))
  await waitFor(() => expect(onSubmit).toHaveBeenCalled())
  return (onSubmit.mock.lastCall?.[0] as { address: AddressValue }).address
}

describe('AddressField lookup', () => {
  beforeEach(() => resetDevWarnings())

  it('without lookup the street is the plain text field it always was', () => {
    const { container } = render(
      <Form schema={schema} defaultValues={defaultValues} onSubmit={() => {}}>
        <AddressField name="address" />
      </Form>,
    )
    expect(street()).toHaveAttribute('autoComplete', 'street-address')
    expect(screen.queryByRole('combobox', { name: 'Street address' })).toBeNull()
    expect(container.querySelector(`.${addressFieldClasses.status}`)).toBeNull()
    expect(container.querySelector(`.${addressFieldClasses.attribution}`)).toBeNull()
  })

  it('searches once the query reaches the minimum length, keeping the autofill token', async () => {
    const user = userEvent.setup({ delay: null })
    const provider = mockAddressLookup()
    renderLookup(provider, { autoCompleteSection: 'shipping' })
    expect(streetBox()).toHaveAttribute('autoComplete', 'shipping street-address')
    await user.type(streetBox(), '16')
    // Two characters never leave the field.
    await new Promise((r) => setTimeout(r, 0))
    expect(provider.calls).toHaveLength(0)
    await user.type(streetBox(), '0')
    expect(await option(/1600 Pennsylvania Ave NW/)).toBeInTheDocument()
    expect(provider.calls.map((c) => c.query)).toEqual(['160'])
    expect(provider.calls[0]?.ctx.session).toMatch(sessionShape)
  })

  it('lookupMinChars lowers the threshold', async () => {
    const user = userEvent.setup({ delay: null })
    const provider = mockAddressLookup()
    renderLookup(provider, { lookupMinChars: 1 })
    await user.type(streetBox(), '3')
    expect(await option(/350 5th Ave/)).toBeInTheDocument()
  })

  it('a newer query aborts the older one and drops its late result', async () => {
    const user = userEvent.setup({ delay: null })
    const { provider, pending } = deferredLookup()
    renderLookup(provider)
    await user.type(streetBox(), '160')
    await waitFor(() => expect(pending).toHaveLength(1))
    await user.type(streetBox(), '0')
    await waitFor(() => expect(pending).toHaveLength(2))
    expect(pending[0]?.query).toBe('160')
    expect(pending[1]?.query).toBe('1600')
    // Aborted at keystroke time, before the newer request even started.
    expect(pending[0]?.ctx.signal.aborted).toBe(true)
    expect(pending[1]?.ctx.signal.aborted).toBe(false)
    // One session spans every query of one entry.
    expect(pending[1]?.ctx.session).toBe(pending[0]?.ctx.session)
    // The newer answer lands first, the stale one afterwards — and is ignored.
    pending[1]?.settle([{ id: 'new', label: 'Newer row' }])
    expect(await option(/Newer row/)).toBeInTheDocument()
    pending[0]?.settle([{ id: 'old', label: 'Stale row' }])
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.queryByRole('option', { name: /Stale row/ })).toBeNull()
    expect(screen.getByRole('option', { name: /Newer row/ })).toBeInTheDocument()
  })

  it('an empty query clears the list and aborts the request in flight', async () => {
    const user = userEvent.setup({ delay: null })
    const { provider, pending } = deferredLookup()
    renderLookup(provider)
    await user.type(streetBox(), '160')
    await waitFor(() => expect(pending).toHaveLength(1))
    await user.clear(streetBox())
    expect(pending[0]?.ctx.signal.aborted).toBe(true)
    pending[0]?.settle([{ id: 'late', label: 'Late row' }])
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('picking a row fills every part, marks the form dirty and announces it', async () => {
    const user = userEvent.setup({ delay: null })
    const provider = mockAddressLookup()
    let dirty = false
    function Probe() {
      dirty = useEzFormContext('Probe').formState.isDirty
      return null
    }
    const onSubmit = vi.fn()
    render(
      <Form schema={looseSchema} defaultValues={defaultValues} onSubmit={onSubmit}>
        <AddressField name="address" lookup={provider} lookupDebounceMs={0} />
        <Probe />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.type(streetBox(), '350')
    await user.click(await option(/350 5th Ave/))
    await waitFor(() => expect(city()).toHaveValue('New York'))
    expect(zip()).toHaveValue('10118')
    expect(screen.getByRole('textbox', { name: 'Apartment, suite, etc.' })).toHaveValue('Floor 86')
    expect(streetBox()).toHaveValue('350 5th Ave')
    expect(dirty).toBe(true)
    expect(screen.getByText('Address filled')).toHaveClass(addressFieldClasses.status)
    // The pick ended the session; the resolve used it, a fresh query gets a new one.
    const [search, resolve] = provider.calls
    expect(resolve?.kind).toBe('resolve')
    expect(resolve?.ctx.session).toBe(search?.ctx.session)
    expect(await submitted(user, onSubmit)).toEqual({
      street: '350 5th Ave',
      street2: 'Floor 86',
      city: 'New York',
      state: 'NY',
      zip: '10118',
    })
  })

  it('a later pick starts a new session and empties a part the new address lacks', async () => {
    const user = userEvent.setup({ delay: null })
    const provider = mockAddressLookup()
    const { onSubmit } = renderLookup(provider)
    await user.type(streetBox(), '350')
    await user.click(await option(/350 5th Ave/))
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Apartment, suite, etc.' })).toHaveValue(
        'Floor 86',
      ),
    )
    await user.clear(streetBox())
    await user.type(streetBox(), 'Infinite')
    await user.click(await option(/1 Infinite Loop/))
    await waitFor(() => expect(city()).toHaveValue('Cupertino'))
    expect(screen.getByRole('textbox', { name: 'Apartment, suite, etc.' })).toHaveValue('')
    const sessions = provider.calls.map((c) => c.ctx.session)
    expect(sessions[0]).toBe(sessions[1])
    expect(sessions[2]).not.toBe(sessions[1])
    expect(sessions[2]).toBe(sessions[3])
    expect(await submitted(user, onSubmit)).toEqual({
      street: '1 Infinite Loop',
      street2: '',
      city: 'Cupertino',
      state: 'CA',
      zip: '95014',
    })
  })

  it('a hidden street2 is never written', async () => {
    const user = userEvent.setup({ delay: null })
    const provider = mockAddressLookup()
    const onSubmit = vi.fn()
    render(
      <Form
        schema={z.object({ address: addressSchema({ street2: false }) })}
        defaultValues={{ address: { street: '', city: '', state: '', zip: '' } }}
        onSubmit={onSubmit}
      >
        <AddressField name="address" lookup={provider} lookupDebounceMs={0} street2={false} />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.type(streetBox(), '350')
    await user.click(await option(/350 5th Ave/))
    await waitFor(() => expect(city()).toHaveValue('New York'))
    expect(await submitted(user, onSubmit)).toEqual({
      street: '350 5th Ave',
      city: 'New York',
      state: 'NY',
      zip: '10118',
    })
  })

  it('typing without picking keeps the text as the street and never resolves', async () => {
    const user = userEvent.setup({ delay: null })
    const provider = mockAddressLookup()
    const { onSubmit } = renderLookup(provider)
    await user.type(streetBox(), '9 Nowhere Ln')
    await user.tab()
    expect(streetBox()).toHaveValue('9 Nowhere Ln')
    expect(await submitted(user, onSubmit)).toMatchObject({ street: '9 Nowhere Ln', city: '' })
    expect(provider.calls.every((c) => c.kind === 'search')).toBe(true)
  })

  it('Clear empties the street to a string, not null', async () => {
    const user = userEvent.setup({ delay: null })
    const { onSubmit } = renderLookup(mockAddressLookup())
    await user.type(streetBox(), '9 Nowhere Ln')
    await user.click(screen.getByRole('button', { name: 'Clear' }))
    expect(await submitted(user, onSubmit)).toMatchObject({ street: '' })
  })

  it('a failed resolve warns once and leaves the picked label in place', async () => {
    const user = userEvent.setup({ delay: null })
    expectConsole('warn', /lookup\.resolve failed: Error: no such place/)
    const provider: AddressLookupProvider = {
      ...mockAddressLookup(),
      resolve: () => Promise.reject(new Error('no such place')),
    }
    const { onSubmit } = renderLookup(provider)
    await user.type(streetBox(), '350')
    await user.click(await option(/350 5th Ave/))
    await waitFor(() => expect(consoleMessages('warn')).toHaveLength(1))
    expect(consoleMessages('warn')[0]).toContain('<AddressField name="address">')
    expect(streetBox()).toHaveValue('350 5th Ave')
    expect(city()).toHaveValue('')
    expect(screen.queryByText('Address filled')).toBeNull()
    expect(await submitted(user, onSubmit)).toMatchObject({ street: '350 5th Ave', city: '' })
  })

  it('a failed search warns and offers nothing', async () => {
    const user = userEvent.setup({ delay: null })
    expectConsole('warn', /lookup\.search failed: Error: offline/)
    const provider: AddressLookupProvider = {
      search: () => Promise.reject(new Error('offline')),
      resolve: () => Promise.resolve({}),
    }
    renderLookup(provider)
    await user.type(streetBox(), '350')
    await waitFor(() => expect(consoleMessages('warn')).toHaveLength(1))
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(streetBox()).toHaveValue('350')
  })

  it('ArrowDown + Enter picks; Escape closes the list', async () => {
    const user = userEvent.setup({ delay: null })
    renderLookup(mockAddressLookup())
    await user.type(streetBox(), '160')
    await option(/1600 Pennsylvania Ave NW/)
    await user.keyboard('{ArrowDown}{Enter}')
    await waitFor(() => expect(city()).toHaveValue('Washington'))
    expect(screen.queryByRole('listbox')).toBeNull()

    await user.clear(streetBox())
    await user.type(streetBox(), '350')
    await option(/350 5th Ave/)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).toBeNull()
    // Escape closes the list, it does not undo the typing.
    expect(streetBox()).toHaveValue('350')
  })

  it('renders the provider attribution under the listbox, and nothing without one', async () => {
    const user = userEvent.setup({ delay: null })
    const { unmount } = render(
      <Form schema={looseSchema} defaultValues={defaultValues} onSubmit={() => {}}>
        <AddressField
          name="address"
          lookup={mockAddressLookup({ attribution: 'Powered by Mock' })}
          lookupDebounceMs={0}
        />
      </Form>,
    )
    await user.type(streetBox(), '160')
    const listbox = (await option(/1600 Pennsylvania Ave NW/)).closest('[role="listbox"]')
    const attribution = screen.getByText('Powered by Mock')
    expect(attribution).toHaveClass(addressFieldClasses.attribution)
    // A sibling after the listbox inside the paper, never a child of the list.
    expect(listbox?.parentElement).toBe(attribution.parentElement)
    expect(listbox?.nextElementSibling).toBe(attribution)
    unmount()

    renderLookup(mockAddressLookup())
    await user.type(streetBox(), '160')
    await option(/1600 Pennsylvania Ave NW/)
    expect(document.querySelector(`.${addressFieldClasses.attribution}`)).toBeNull()
  })

  it('shows the secondary line on each row', async () => {
    const user = userEvent.setup({ delay: null })
    renderLookup(mockAddressLookup())
    await user.type(streetBox(), '160')
    expect(await option(/1600 Pennsylvania Ave NW/)).toHaveTextContent('Washington, DC')
  })

  it('folds the locality into the label when two rows share a street', async () => {
    const user = userEvent.setup({ delay: null })
    const provider: AddressLookupProvider = {
      search: () =>
        Promise.resolve([
          { id: 'a', label: '100 Main St', secondary: 'Springfield, IL' },
          { id: 'b', label: '100 Main St', secondary: 'Springfield, MO' },
        ]),
      resolve: () => Promise.resolve({}),
    }
    renderLookup(provider)
    await user.type(streetBox(), '100')
    await user.click(await option(/Springfield, MO/))
    await waitFor(() => expect(streetBox()).toHaveValue('100 Main St, Springfield, MO'))
  })

  it('slotProps.street reaches the lookup field', async () => {
    const user = userEvent.setup({ delay: null })
    const onChange = vi.fn()
    renderLookup(mockAddressLookup(), {
      slotProps: {
        street: {
          helperText: 'Start typing to search',
          onChange,
          placeholder: 'Search…',
          autoComplete: 'off',
          slotProps: { htmlInput: { 'data-testid': 'street-input' } },
        },
      },
    })
    expect(streetBox()).toHaveAccessibleDescription('Start typing to search')
    expect(streetBox()).toHaveAttribute('placeholder', 'Search…')
    expect(streetBox()).toHaveAttribute('autoComplete', 'off')
    expect(screen.getByTestId('street-input')).toBe(streetBox())
    await user.type(streetBox(), '1')
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('required and disabled reach the lookup street', () => {
    render(
      <Form schema={looseSchema} defaultValues={defaultValues} onSubmit={() => {}} disabled>
        <AddressField name="address" lookup={mockAddressLookup()} required />
      </Form>,
    )
    expect(streetBox()).toBeRequired()
    expect(streetBox()).toBeDisabled()
  })

  it('has no accessibility violations with the list open and attributed', async () => {
    const user = userEvent.setup({ delay: null })
    const { container } = render(
      <Form schema={looseSchema} defaultValues={defaultValues} onSubmit={() => {}}>
        <AddressField
          name="address"
          legend="Shipping address"
          lookup={mockAddressLookup({ attribution: 'Powered by Mock' })}
          lookupDebounceMs={0}
          required
        />
      </Form>,
    )
    await user.type(streetBox(), '160')
    const row = await option(/1600 Pennsylvania Ave NW/)
    await expectNoA11yViolations(container)
    // The list is portaled to <body>, outside `container`: audit the popper too.
    // (Auditing `document.body` instead trips axe's page-level landmark rule.)
    const popper = row.closest(`.${autocompleteClasses.popper}`)
    expect(popper).not.toBeNull()
    await expectNoA11yViolations(popper!)
  })
})

describe('newSession', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('is a UUID, within the 36 URL-safe characters a Places session allows', () => {
    const token = newSession()
    expect(token).toMatch(sessionShape)
    expect(token).not.toBe(newSession())
  })

  it('keeps the same shape without crypto.randomUUID', () => {
    vi.stubGlobal('crypto', {})
    const token = newSession()
    expect(token).toMatch(sessionShape)
    expect(token).toHaveLength(32)
    expect(token).not.toBe(newSession())
  })
})
