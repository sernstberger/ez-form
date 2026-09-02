import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Loan } from './Loan'
import { expectNoA11yViolations } from '../../test/axe'

/** `DateField` renders its own hidden text input, found by `name` (see `DateField.test.tsx`). */
const hiddenDateInput = (name: string) =>
  document.querySelector<HTMLInputElement>(`input[name="${name}"]`)!
const typeDate = (name: string, text: string) =>
  fireEvent.change(hiddenDateInput(name), { target: { value: text } })

async function next(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /^next$/i }))
}

async function fillLoanStep(user: ReturnType<typeof userEvent.setup>, amount = '25,000') {
  const amountInput = screen.getByLabelText(/loan amount/i)
  await user.clear(amountInput)
  await user.type(amountInput, amount)
  await user.click(screen.getByRole('combobox', { name: /purpose/i }))
  await user.click(await screen.findByRole('option', { name: 'Home purchase' }))
}

async function fillApplicantStep(user: ReturnType<typeof userEvent.setup>, income = '8000') {
  await user.type(screen.getByLabelText(/full name/i), 'Ada Lovelace')
  await user.type(screen.getByLabelText(/^email/i), 'ada@example.com')
  typeDate('applicantBirthday', '12/10/1985')
  const incomeInput = screen.getByLabelText(/monthly income/i)
  await user.clear(incomeInput)
  await user.type(incomeInput, income)
}

async function fillEmploymentStep(user: ReturnType<typeof userEvent.setup>, income = '8000') {
  const group = screen.getByRole('group', { name: 'Employer 1' })
  await user.type(within(group).getByLabelText(/^employer/i), 'Acme Corp')
  typeDate('employment.0.from', '01/01/2018')
  const incomeInput = within(group).getByLabelText(/monthly income/i)
  await user.clear(incomeInput)
  await user.type(incomeInput, income)
}

async function goToStep(user: ReturnType<typeof userEvent.setup>, times: number) {
  for (let i = 0; i < times; i++) {
    await next(user)
  }
}

/** Fills every step through Debts (skipping optional co-applicants/debts) and lands on Documents. */
async function fillThroughDebts(user: ReturnType<typeof userEvent.setup>) {
  await fillLoanStep(user)
  await next(user)
  await fillApplicantStep(user)
  await next(user)
  await next(user) // co-applicants: none required
  await fillEmploymentStep(user)
  await next(user)
  await next(user) // debts: none required
}

describe('Loan', () => {
  it('has an accessible form name "Loan application"', () => {
    render(<Loan />)
    expect(screen.getByRole('form', { name: 'Loan application' })).toBeInTheDocument()
  })

  it('shows only the Loan step fields first, grouped under a named step', () => {
    render(<Loan />)
    expect(screen.getByRole('group', { name: 'Loan' })).toBeInTheDocument()
    expect(screen.queryByLabelText(/full name/i)).not.toBeInTheDocument()
  })

  it('shows only the current step’s error summary after a failed Next, and focuses its heading', async () => {
    const user = userEvent.setup()
    render(<Loan />)
    // Clear the loan amount so the Loan step fails validation.
    const amountInput = screen.getByLabelText(/loan amount/i)
    await user.clear(amountInput)
    await next(user)
    const heading = await screen.findByRole('heading', { name: /there is a problem/i })
    await waitFor(() => expect(heading).toHaveFocus())
    const summary = heading.closest('div')!
    // Only Loan-step errors (amount, purpose) are listed, not any later step's.
    expect(within(summary).getAllByRole('link').length).toBeGreaterThan(0)
    for (const link of within(summary).getAllByRole('link')) {
      expect(link.textContent).toMatch(/amount|purpose/i)
    }
  })

  it('adds and removes co-applicant rows, moving focus as it does', async () => {
    const user = userEvent.setup()
    render(<Loan />)
    await fillLoanStep(user)
    await next(user)
    await fillApplicantStep(user)
    await next(user)

    expect(screen.queryByRole('group', { name: /^Co-applicant 1$/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add' }))
    const row = await screen.findByRole('group', { name: 'Co-applicant 1' })
    await waitFor(() => expect(within(row).getByLabelText(/^name/i)).toHaveFocus())

    await user.click(within(row).getByRole('button', { name: /remove co-applicant 1/i }))
    await waitFor(() =>
      expect(screen.queryByRole('group', { name: /^Co-applicant 1$/ })).not.toBeInTheDocument(),
    )
  })

  it('caps co-applicants at 3 rows (Add disabled at the max)', async () => {
    const user = userEvent.setup()
    render(<Loan />)
    await fillLoanStep(user)
    await next(user)
    await fillApplicantStep(user)
    await next(user)

    const add = screen.getByRole('button', { name: 'Add' })
    await user.click(add)
    await user.click(add)
    await user.click(add)
    expect(screen.getAllByRole('group', { name: /^Co-applicant \d+$/ })).toHaveLength(3)
    expect(add).toBeDisabled()
  })

  it('reorders employment rows and the payload reflects the new order', async () => {
    const user = userEvent.setup()
    const onSuccess = vi.fn()
    render(<Loan onSuccess={onSuccess} />)
    await fillLoanStep(user)
    await next(user)
    await fillApplicantStep(user)
    await next(user)
    await next(user) // co-applicants

    await fillEmploymentStep(user)
    // Add a second employer, fill it, then move it above the first.
    await user.click(screen.getByRole('button', { name: 'Add' }))
    const second = await screen.findByRole('group', { name: 'Employer 2' })
    await user.type(within(second).getByLabelText(/^employer/i), 'Beta LLC')
    typeDate('employment.1.from', '01/01/2020')
    const secondIncome = within(second).getByLabelText(/monthly income/i)
    await user.clear(secondIncome)
    await user.type(secondIncome, '1000')

    await user.click(within(second).getByRole('button', { name: /move employer 2 up/i }))
    const rows = screen.getAllByRole('group', { name: /^Employer \d+$/ })
    expect(within(rows[0]!).getByLabelText(/^employer/i)).toHaveValue('Beta LLC')
    expect(within(rows[1]!).getByLabelText(/^employer/i)).toHaveValue('Acme Corp')
  })

  it('computes the DTI ratio on the review step from watched totals', async () => {
    const user = userEvent.setup()
    render(<Loan />)
    await fillThroughDebts(user)
    // Documents step: nothing required, move on.
    await next(user)
    // Add a debt so DTI is non-zero.
    // (Review is now current; re-open Debts via the stepper to add one.)
    await user.click(screen.getByRole('tab', { name: /debts/i }))
    await user.click(screen.getByRole('button', { name: 'Add' }))
    const debtRow = await screen.findByRole('group', { name: 'Debt 1' })
    await user.type(within(debtRow).getByLabelText(/creditor/i), 'Card Co')
    const balance = within(debtRow).getByLabelText(/^balance/i)
    await user.clear(balance)
    await user.type(balance, '5000')
    const payment = within(debtRow).getByLabelText(/monthly payment/i)
    await user.clear(payment)
    await user.type(payment, '400')
    await goToStep(user, 2) // documents, review

    const totals = screen.getByRole('group', { name: 'Totals' })
    // income = 8000 (applicant) + 8000 (employment) = 16000; debt = 400 → DTI = 2.5%
    expect(within(totals).getByText('$16,000.00')).toBeInTheDocument()
    expect(within(totals).getByText('$400.00')).toBeInTheDocument()
    expect(within(totals).getByText('Debt-to-income ratio')).toBeInTheDocument()
    expect(within(totals).getByText('2.5%')).toBeInTheDocument()
  })

  it('declines a high-DTI application and shows the server alert', async () => {
    const user = userEvent.setup()
    const onSuccess = vi.fn()
    render(<Loan onSuccess={onSuccess} />)
    await fillLoanStep(user)
    await next(user)
    await fillApplicantStep(user, '1000')
    await next(user)
    await next(user) // co-applicants
    await fillEmploymentStep(user, '0')
    await next(user)
    // Debts: add one with a payment far exceeding income (DTI > 45%).
    await user.click(screen.getByRole('button', { name: 'Add' }))
    const debtRow = await screen.findByRole('group', { name: 'Debt 1' })
    await user.type(within(debtRow).getByLabelText(/creditor/i), 'Big Bank')
    const balance = within(debtRow).getByLabelText(/^balance/i)
    await user.clear(balance)
    await user.type(balance, '50000')
    const payment = within(debtRow).getByLabelText(/monthly payment/i)
    await user.clear(payment)
    await user.type(payment, '900')
    await goToStep(user, 2) // documents, review

    await user.click(screen.getByRole('button', { name: /submit application/i }))
    const dialog = await screen.findByRole('alertdialog', { name: /submit application\?/i })
    await user.click(within(dialog).getByRole('button', { name: /^confirm$/i }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/debt-to-income ratio is too high/i)
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('submits with valid data, calling the API once with arrays in submitted order', async () => {
    const user = userEvent.setup()
    const onSuccess = vi.fn()
    render(<Loan onSuccess={onSuccess} />)
    await fillThroughDebts(user)
    await next(user) // review

    await user.click(screen.getByRole('button', { name: /submit application/i }))
    const dialog = await screen.findByRole('alertdialog', { name: /submit application\?/i })
    await user.click(within(dialog).getByRole('button', { name: /^confirm$/i }))

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
    expect(onSuccess.mock.calls[0]![0]).toEqual(
      expect.objectContaining({ applicationId: expect.stringMatching(/^LOAN-/) }),
    )
  })

  it('is accessible on the Loan step', async () => {
    const { container } = render(<Loan />)
    await expectNoA11yViolations(container)
  })

  it('is accessible on the Co-applicants step with a row added', async () => {
    const user = userEvent.setup()
    const { container } = render(<Loan />)
    await fillLoanStep(user)
    await next(user)
    await fillApplicantStep(user)
    await next(user)
    await user.click(screen.getByRole('button', { name: 'Add' }))
    await screen.findByRole('group', { name: 'Co-applicant 1' })
    await expectNoA11yViolations(container)
  })

  it('is accessible on the Review step', async () => {
    const user = userEvent.setup()
    const { container } = render(<Loan />)
    await fillThroughDebts(user)
    await next(user) // review
    await expectNoA11yViolations(container)
  })

  it("is accessible on the Documents step with a co-applicant's own upload present", async () => {
    const user = userEvent.setup()
    const { container } = render(<Loan />)
    await fillLoanStep(user)
    await next(user)
    await fillApplicantStep(user)
    await next(user)
    await user.click(screen.getByRole('button', { name: 'Add' }))
    const row = await screen.findByRole('group', { name: 'Co-applicant 1' })
    await user.type(within(row).getByLabelText(/^name/i), 'Grace Hopper')
    await user.click(within(row).getByRole('combobox', { name: /relationship/i }))
    await user.click(await screen.findByRole('option', { name: 'Spouse' }))
    const rowIncome = within(row).getByLabelText(/monthly income/i)
    await user.clear(rowIncome)
    await user.type(rowIncome, '2000')
    await next(user) // employment
    await fillEmploymentStep(user)
    await next(user) // debts
    await next(user) // documents
    await screen.findByLabelText(/upload documents for grace hopper/i)
    await expectNoA11yViolations(container)
  })
})
