import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Insurance } from './Insurance'
import { APPLICATION_DECLINED_FOR } from '../fakeApi'
import { expectNoA11yViolations } from '../../test/axe'
import { withPickers } from '../../test/pickers'

const STORAGE_KEY = 'ez-form:insurance-resume'

/** DateField renders its own hidden text input, found by `name` (see DateField.test.tsx). */
const hiddenInput = (name: string) =>
  document.querySelector<HTMLInputElement>(`input[name="${name}"]`)!
const typeDate = (name: string, text: string) =>
  fireEvent.change(hiddenInput(name), { target: { value: text } })

async function goNext(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /^next$/i }))
}

async function fillApplicant(user: ReturnType<typeof userEvent.setup>, firstName = 'Ada') {
  await user.type(screen.getByLabelText(/first name/i), firstName)
  await user.type(screen.getByLabelText(/last name/i), 'Lovelace')
  typeDate('birthday', '01/01/1985')
  await goNext(user)
}

async function fillContact(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/^email/i), 'ada@example.com')
  await user.type(screen.getByLabelText(/^phone/i), '555-555-5555')
  const address = screen.getByRole('group', { name: 'Address' })
  await user.type(within(address).getByLabelText(/street address/i), '1 Analytical Way')
  await user.type(within(address).getByLabelText(/^city/i), 'London')
  await user.type(within(address).getByLabelText(/zip code/i), 'SW1A1AA')
  await goNext(user)
}

async function fillCoverage(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('radio', { name: 'Liability only' }))
  await user.type(screen.getByLabelText(/coverage amount/i), '10000')
  await goNext(user)
}

async function skipVehicle(user: ReturnType<typeof userEvent.setup>) {
  // hasVehicle defaults to false: Next goes straight to Drivers.
  await goNext(user)
}

async function takeVehicle(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('checkbox', { name: /insure a vehicle/i }))
  await goNext(user)
}

async function fillVehicle(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/^make/i), 'Toyota')
  await user.type(screen.getByLabelText(/^model/i), 'Corolla')
  await user.type(screen.getByLabelText(/^year/i), '2020')
  await user.type(screen.getByLabelText(/plate number/i), 'ABC123')
  await goNext(user)
}

async function fillDrivers(user: ReturnType<typeof userEvent.setup>) {
  const drivers = screen.getByRole('group', { name: 'Primary driver' })
  await user.type(within(drivers).getByLabelText(/full name/i), 'Ada Lovelace')
  await user.type(within(drivers).getByLabelText(/license number/i), 'D1234567')
  typeDate('driver.licenseDate', '01/01/2010')
  await goNext(user)
}

async function fillHistory(user: ReturnType<typeof userEvent.setup>) {
  await goNext(user)
}

async function fillDocuments(user: ReturnType<typeof userEvent.setup>) {
  await goNext(user)
}

/** Fills every step from Applicant through Documents, landing on Review. `vehicle: true` also takes the conditional Vehicle step. */
async function fillThroughReview(
  user: ReturnType<typeof userEvent.setup>,
  { vehicle = false, firstName = 'Ada' }: { vehicle?: boolean; firstName?: string } = {},
) {
  await fillApplicant(user, firstName)
  await fillContact(user)
  await fillCoverage(user)
  if (vehicle) {
    await takeVehicle(user)
    await fillVehicle(user)
  } else {
    await skipVehicle(user)
  }
  await fillDrivers(user)
  await fillHistory(user)
  await fillDocuments(user)
}

/** A complete, schema-valid set of values matching what `fillThroughReview({ vehicle: true })` produces by hand. */
const COMPLETE_VALUES = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  birthday: new Date(1985, 0, 1),
  email: 'ada@example.com',
  phone: '555-555-5555',
  address: { street: '1 Analytical Way', city: 'London', zip: 'SW1A1AA' },
  coverageType: 'liability',
  deductible: 500,
  coverageAmount: 10000,
  hasVehicle: true,
  vehicle: { make: 'Toyota', model: 'Corolla', year: 2020, plate: 'ABC123' },
  driver: { name: 'Ada Lovelace', licenseNumber: 'D1234567', licenseDate: new Date(2010, 0, 1) },
  claims: '',
  priorIncidents: [],
  incidentDetails: '',
  documents: [],
}

/**
 * Writes the example's own localStorage resume payload (see `saveState`/`loadSaved` in
 * `Insurance.tsx`) so the wizard mounts directly on Review with values restored, instead of
 * driving all eight prior steps through `userEvent` first. `visited` lists every step id so
 * every Review row's Edit link resolves to a real, reachable step (mirrors what a genuine
 * walk-through would have left behind). `JSON.stringify` serializes the `Date` fields as ISO
 * strings exactly as `saveState` does, and `loadSaved`'s reviver turns them back into `Date`s
 * on the way in.
 */
function seedReview(values: Record<string, unknown> = COMPLETE_VALUES, step = 'review') {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      step,
      visited: [
        'applicant',
        'contact',
        'coverage',
        'has-vehicle',
        'vehicle',
        'drivers',
        'history',
        'documents',
        'review',
      ],
      values,
    }),
  )
}

beforeEach(() => {
  localStorage.clear()
})

/*
 * A longer per-test budget than the 5s default, for this file only. StrictMode (see
 * src/test/setup.ts) renders every component twice, and these tests walk a multi-step wizard
 * filling every field on the way — roughly double the work of any other suite here. The tests
 * themselves are already as lean as they go (`delay: null` on userEvent, a zeroed fake-API
 * delay, a seeded resume state for the Review step); what is left is real double-rendering,
 * not waiting. See #85 for the wider slowness of these two example suites.
 */
describe('Insurance', { timeout: 20_000 }, () => {
  it('has an accessible form name "Auto insurance application"', () => {
    render(withPickers(<Insurance />))
    expect(screen.getByRole('form', { name: 'Auto insurance application' })).toBeInTheDocument()
  })

  it('renders exactly one named group per step, with aria-current="step" on the stepper', async () => {
    const user = userEvent.setup({ delay: null })
    render(withPickers(<Insurance />))
    expect(screen.getByRole('group', { name: 'Applicant' })).toBeInTheDocument()
    const current = screen.getByRole('tab', { name: /Applicant/ })
    expect(current).toHaveAttribute('aria-current', 'step')

    await fillApplicant(user)
    expect(screen.getByRole('group', { name: 'Contact' })).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Applicant' })).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Contact/ })).toHaveAttribute('aria-current', 'step')
  })

  it('skips the Vehicle step when "has vehicle?" is No (the default)', async () => {
    const user = userEvent.setup({ delay: null })
    render(withPickers(<Insurance />))
    await fillApplicant(user)
    await fillContact(user)
    await fillCoverage(user)
    // On the has-vehicle step, still unchecked (default false).
    expect(screen.getByRole('group', { name: 'Vehicle?' })).toBeInTheDocument()
    await goNext(user)
    // Next from has-vehicle (false) lands on Drivers, not Vehicle.
    expect(screen.getByRole('group', { name: 'Primary driver' })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: /^Vehicle$/ })).not.toBeInTheDocument()
  })

  it('shows the Vehicle step when "has vehicle?" is Yes', async () => {
    const user = userEvent.setup({ delay: null })
    render(withPickers(<Insurance />))
    await fillApplicant(user)
    await fillContact(user)
    await fillCoverage(user)
    await user.click(screen.getByRole('checkbox', { name: /insure a vehicle/i }))
    await goNext(user)
    expect(screen.getByRole('group', { name: 'Vehicle' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /^Vehicle$/ })).toBeInTheDocument()
  })

  it('lists every value on the Review step, with a working Edit link back to its step', async () => {
    const user = userEvent.setup({ delay: null })
    seedReview()
    render(withPickers(<Insurance />))
    const review = screen.getByRole('group', { name: 'Review' })
    expect(within(review).getByText('Ada')).toBeInTheDocument()
    expect(within(review).getByText('Lovelace')).toBeInTheDocument()
    expect(within(review).getByText('ada@example.com')).toBeInTheDocument()
    expect(within(review).getByText('Toyota')).toBeInTheDocument()

    await user.click(within(review).getByRole('button', { name: /edit first name/i }))
    expect(screen.getByRole('group', { name: 'Applicant' })).toBeInTheDocument()
    expect(screen.getByLabelText(/first name/i)).toHaveValue('Ada')
  })

  it('shows the error summary listing step-owned fields on a failed final submit', async () => {
    const user = userEvent.setup({ delay: null })
    render(withPickers(<Insurance />))
    // Reach Review with "has vehicle?" still No, then flip it on via the Edit link (backward
    // nav skips validation) without ever visiting/filling the newly-shown Vehicle step: the
    // whole schema is only checked on final submit, so this is the realistic way an
    // otherwise-valid wizard reaches Review with an invalid field (see Wizard's own
    // `fields`-ownership doc: a field listed in no *visited* step is caught at submit). Since
    // the resulting submit is invalid, <Form confirm> never asks — the error summary appears
    // directly, with no confirm dialog in between.
    await fillThroughReview(user)
    const review = screen.getByRole('group', { name: 'Review' })
    await user.click(within(review).getByRole('button', { name: /edit has vehicle/i }))
    await user.click(screen.getByRole('checkbox', { name: /insure a vehicle/i }))
    await user.click(screen.getByRole('tab', { name: /Review/ }))
    await user.click(screen.getByRole('button', { name: /submit application/i }))
    await screen.findByRole('heading', { name: /there is a problem/i })
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    // No `href` on this summary item: the field it points at (on the now-hidden Vehicle step)
    // isn't rendered, so `fieldElementId` never resolves one and the link has no accessible
    // `link` role — see FormErrorSummary's `fieldElementId` doc. The text is still shown.
    expect(screen.getByText(/make is required/i)).toBeInTheDocument()
  })

  it('resumes from localStorage after a remount: step and values are restored', async () => {
    const user = userEvent.setup({ delay: null })
    const { unmount } = render(withPickers(<Insurance />))
    await fillApplicant(user)
    await user.type(screen.getByLabelText(/^email/i), 'ada@example.com')
    await waitFor(() => expect(localStorage.getItem(STORAGE_KEY)).toBeTruthy())
    unmount()

    render(withPickers(<Insurance />))
    expect(screen.getByRole('group', { name: 'Contact' })).toBeInTheDocument()
    expect(screen.getByLabelText(/^email/i)).toHaveValue('ada@example.com')
    // Going back confirms the earlier step's values also survived.
    await user.click(screen.getByRole('button', { name: /^back$/i }))
    expect(screen.getByLabelText(/first name/i)).toHaveValue('Ada')
  })

  it('does not persist uploaded documents: resuming after an upload still submits cleanly with Documents empty', async () => {
    const user = userEvent.setup({ delay: null })
    const { unmount } = render(withPickers(<Insurance />))
    await fillApplicant(user)
    await fillContact(user)
    await fillCoverage(user)
    await skipVehicle(user)
    await fillDrivers(user)
    await fillHistory(user)
    // On Documents: upload a file, then let the autosave effect run before remounting.
    const file = new File(['%PDF'], 'policy.pdf', { type: 'application/pdf' })
    await user.upload(screen.getByLabelText(/^upload documents/i), file)
    expect(screen.getByText('policy.pdf')).toBeInTheDocument()
    await waitFor(() => expect(localStorage.getItem(STORAGE_KEY)).toBeTruthy())
    // A `File` has no own-enumerable properties (they're prototype getters), so
    // `JSON.stringify` would otherwise serialize it as `{}` — confirm that never lands in
    // storage: the saved `documents` is an empty array, not `[{}]` or similar.
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as {
      values: { documents: unknown }
    }
    expect(saved.values.documents).toEqual([])
    unmount()

    render(withPickers(<Insurance />))
    // Resumes on Documents (the last-visited step); the upload did not survive, and nothing
    // renders a stray "[object Object]" chip or an unlabelled Remove button.
    expect(screen.getByRole('group', { name: 'Documents' })).toBeInTheDocument()
    expect(screen.queryByText('policy.pdf')).not.toBeInTheDocument()
    expect(screen.queryByText('[object Object]')).not.toBeInTheDocument()
    await goNext(user) // -> Review
    await user.click(screen.getByRole('button', { name: /submit application/i }))
    const dialog = await screen.findByRole('alertdialog', { name: /submit application\?/i })
    await user.click(within(dialog).getByRole('button', { name: /^confirm$/i }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(screen.queryByRole('heading', { name: /there is a problem/i })).not.toBeInTheDocument()
  })

  it('a stale "vehicle" in a saved visited list (from a session where "has vehicle?" was later turned off) resumes onto a real, visible step', async () => {
    // Simulates a saved session where the Vehicle step was visited, then "has vehicle?"
    // was turned back off before the tab closed: `visited` still names a step id that
    // `useInsuranceSteps(false)` no longer includes. `Wizard` already filters ids that
    // don't resolve to a current step index before picking the last-visited one (see
    // `Wizard.tsx`'s `visitedIndexes` comment), so this should land on a real step rather
    // than crash or render blank.
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        step: 'vehicle',
        visited: ['applicant', 'contact', 'coverage', 'has-vehicle', 'vehicle'],
        values: { hasVehicle: false },
      }),
    )
    render(withPickers(<Insurance />))
    // Falls back to the last visited step that still matches a current step id
    // ("has-vehicle"), not the stale "vehicle" — and definitely not a crash.
    expect(screen.getByRole('group', { name: 'Vehicle?' })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: /^Vehicle$/ })).not.toBeInTheDocument()
  })

  it('"Start over" clears localStorage and resets to the first step with empty values', async () => {
    const user = userEvent.setup({ delay: null })
    render(withPickers(<Insurance />))
    await fillApplicant(user)
    await waitFor(() => expect(localStorage.getItem(STORAGE_KEY)).toBeTruthy())
    await user.click(screen.getByRole('button', { name: /start over/i }))
    expect(screen.getByRole('group', { name: 'Applicant' })).toBeInTheDocument()
    expect(screen.getByLabelText(/first name/i)).toHaveValue('')
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('submits and reports a server error for a declined application', async () => {
    const user = userEvent.setup({ delay: null })
    render(withPickers(<Insurance />))
    await fillThroughReview(user, { firstName: APPLICATION_DECLINED_FOR })
    await user.click(screen.getByRole('button', { name: /submit application/i }))
    const dialog = await screen.findByRole('alertdialog', { name: /submit application\?/i })
    await user.click(within(dialog).getByRole('button', { name: /^confirm$/i }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/could not process/i)
  })

  it('submits successfully and clears saved resume state', async () => {
    const user = userEvent.setup({ delay: null })
    const onSuccess = vi.fn()
    render(withPickers(<Insurance onSuccess={onSuccess} />))
    await fillThroughReview(user)
    await waitFor(() => expect(localStorage.getItem(STORAGE_KEY)).toBeTruthy())
    await user.click(screen.getByRole('button', { name: /submit application/i }))
    const dialog = await screen.findByRole('alertdialog', { name: /submit application\?/i })
    await user.click(within(dialog).getByRole('button', { name: /^confirm$/i }))
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  describe('page layout', () => {
    it('renders every step as a named group with valid heading order, and is axe-clean', async () => {
      const { container } = render(withPickers(<Insurance layout="page" />))
      ;[
        'Applicant',
        'Contact',
        'Coverage',
        'Vehicle?',
        'Primary driver',
        'History',
        'Documents',
        'Review',
      ].forEach((name) => {
        expect(screen.getByRole('group', { name })).toBeInTheDocument()
      })
      // page layout has no stepper/nav chrome.
      expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
      await expectNoA11yViolations(container)
    })
  })

  describe('agent mode', () => {
    it('has autoComplete off, renders one page, and shows every error after one submit', async () => {
      const user = userEvent.setup({ delay: null })
      render(withPickers(<Insurance agentMode />))
      const form = screen.getByRole('form', { name: 'Auto insurance application' })
      expect(form).toHaveAttribute('autocomplete', 'off')
      expect(screen.getByRole('group', { name: 'Applicant' })).toBeInTheDocument()
      expect(screen.getByRole('group', { name: 'Review' })).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: /submit application/i }))
      // No confirm dialog in agent mode.
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
      expect((await screen.findAllByText(/first name is required/i)).length).toBeGreaterThan(0)
      expect((await screen.findAllByText(/is required/i)).length).toBeGreaterThan(1)
    })
  })

  it('is accessible on the Applicant step', async () => {
    const { container } = render(withPickers(<Insurance />))
    await expectNoA11yViolations(container)
  })

  it('History step: incident details appear only once an incident is ticked, and are required then (#82)', async () => {
    seedReview(COMPLETE_VALUES, 'history')
    const user = userEvent.setup({ delay: null })
    render(<Insurance onSuccess={vi.fn()} />)
    expect(screen.getByRole('group', { name: 'History' })).toBeInTheDocument()
    expect(screen.queryByLabelText(/please describe the incident/i)).not.toBeInTheDocument()
    await user.click(screen.getAllByRole('checkbox')[0]!)
    const details = await screen.findByLabelText(/please describe the incident/i)
    await goNext(user)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Describe the incident(s) before continuing',
    )
    expect(screen.getByRole('group', { name: 'History' })).toBeInTheDocument()
    await user.type(details, 'Minor parking scrape, no injuries')
    await goNext(user)
    expect(await screen.findByRole('group', { name: 'Documents' })).toBeInTheDocument()
  })

  it('is accessible on the Coverage step', async () => {
    const user = userEvent.setup({ delay: null })
    const { container } = render(withPickers(<Insurance />))
    await fillApplicant(user)
    await fillContact(user)
    await expectNoA11yViolations(container)
  })

  it('is accessible on the Review step', async () => {
    seedReview()
    const { container } = render(withPickers(<Insurance />))
    await expectNoA11yViolations(container)
  })
})
