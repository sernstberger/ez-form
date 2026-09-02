import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SignUp } from './SignUp'
import { SIGNUP_GOOD_CODE } from '../fakeApi'
import { expectNoA11yViolations } from '../../test/axe'

async function fillStepOne(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/^email/i), 'ada@example.com')
  await user.type(screen.getByLabelText(/^password/i), 'correct-horse-1')
  await user.type(screen.getByLabelText(/confirm password/i), 'correct-horse-1')
  await user.type(screen.getByLabelText(/display name/i), 'Ada Lovelace')
  await user.click(screen.getByRole('checkbox', { name: /terms/i }))
}

describe('SignUp', () => {
  it('has an accessible form name "Create your account"', () => {
    render(<SignUp />)
    expect(screen.getByRole('form', { name: 'Create your account' })).toBeInTheDocument()
  })

  it('groups Account and Profile fields under named fieldsets', () => {
    render(<SignUp />)
    const account = screen.getByRole('group', { name: 'Account' })
    expect(within(account).getByLabelText(/^email/i)).toBeInTheDocument()
    expect(within(account).getByLabelText(/^password/i)).toBeInTheDocument()
    expect(within(account).getByLabelText(/confirm password/i)).toBeInTheDocument()

    const profile = screen.getByRole('group', { name: 'Profile' })
    expect(within(profile).getByLabelText(/display name/i)).toBeInTheDocument()
    expect(within(profile).getByRole('checkbox', { name: /terms/i })).toBeInTheDocument()
  })

  it('shows the refine message on confirm password when the two passwords do not match', async () => {
    const user = userEvent.setup()
    render(<SignUp />)
    await user.type(screen.getByLabelText(/^email/i), 'ada@example.com')
    await user.type(screen.getByLabelText(/^password/i), 'correct-horse-1')
    await user.type(screen.getByLabelText(/confirm password/i), 'different-1')
    await user.type(screen.getByLabelText(/display name/i), 'Ada Lovelace')
    await user.click(screen.getByRole('checkbox', { name: /terms/i }))
    await user.click(screen.getByRole('button', { name: /next/i }))
    const confirmField = screen.getByLabelText(/confirm password/i)
    await waitFor(() => expect(confirmField).toHaveAccessibleDescription(/do not match|match/i))
  })

  it('blocks Next when the terms checkbox is unchecked', async () => {
    const user = userEvent.setup()
    render(<SignUp />)
    await user.type(screen.getByLabelText(/^email/i), 'ada@example.com')
    await user.type(screen.getByLabelText(/^password/i), 'correct-horse-1')
    await user.type(screen.getByLabelText(/confirm password/i), 'correct-horse-1')
    await user.type(screen.getByLabelText(/display name/i), 'Ada Lovelace')
    await user.click(screen.getByRole('button', { name: /next/i }))
    await screen.findByText(/you must accept the terms/i)
    // Still on step 1: the OTP field from step 2 has not appeared.
    expect(screen.queryByRole('textbox', { name: /verification code/i })).not.toBeInTheDocument()
  })

  it('Next validates only step 1: an empty step 1 keeps the wizard on step 1', async () => {
    const user = userEvent.setup()
    render(<SignUp />)
    await user.click(screen.getByRole('button', { name: /next/i }))
    await screen.findAllByText(/required|invalid/i)
    expect(screen.getByRole('group', { name: 'Account' })).toBeInTheDocument()
  })

  it('advances to the verification step once step 1 is valid', async () => {
    const user = userEvent.setup()
    render(<SignUp />)
    await fillStepOne(user)
    await user.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() =>
      expect(screen.getByRole('group', { name: 'Verification' })).toBeInTheDocument(),
    )
    expect(screen.getByRole('textbox', { name: /verification code/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /resend/i })).toBeInTheDocument()
  })

  it('shows a server error alert when the fake API rejects a wrong code', async () => {
    const user = userEvent.setup()
    render(<SignUp />)
    await fillStepOne(user)
    await user.click(screen.getByRole('button', { name: /next/i }))
    await screen.findByRole('textbox', { name: /verification code/i })
    await user.type(screen.getByRole('textbox', { name: /verification code/i }), '000000')
    await user.click(screen.getByRole('button', { name: /submit/i }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/incorrect/i)
  })

  it('calls the fake verify API exactly once with the good code and reports success', async () => {
    const user = userEvent.setup()
    const onSuccess = vi.fn()
    render(<SignUp onSuccess={onSuccess} />)
    await fillStepOne(user)
    await user.click(screen.getByRole('button', { name: /next/i }))
    await screen.findByRole('textbox', { name: /verification code/i })
    await user.type(screen.getByRole('textbox', { name: /verification code/i }), SIGNUP_GOOD_CODE)
    await user.click(screen.getByRole('button', { name: /submit/i }))
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
  })

  it('is accessible on step 1 and step 2', async () => {
    const user = userEvent.setup()
    const { container } = render(<SignUp />)
    await expectNoA11yViolations(container)
    await fillStepOne(user)
    await user.click(screen.getByRole('button', { name: /next/i }))
    await screen.findByRole('textbox', { name: /verification code/i })
    await expectNoA11yViolations(container)
  })

  it('is accessible with a server error shown on step 2', async () => {
    const user = userEvent.setup()
    const { container } = render(<SignUp />)
    await fillStepOne(user)
    await user.click(screen.getByRole('button', { name: /next/i }))
    await screen.findByRole('textbox', { name: /verification code/i })
    await user.type(screen.getByRole('textbox', { name: /verification code/i }), '000000')
    await user.click(screen.getByRole('button', { name: /submit/i }))
    await screen.findByRole('alert')
    await expectNoA11yViolations(container)
  })
})
