import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SignUp } from './SignUp'
import { SIGNUP_GOOD_CODE } from '../fakeApi'
import { expectNoA11yViolations } from '../../test/axe'
import { setValue } from '../../test/setValue'

async function fillStepOne(user: ReturnType<typeof userEvent.setup>) {
  setValue(screen.getByLabelText(/^email/i), 'ada@example.com')
  setValue(screen.getByLabelText(/^password(?! strength)/i), 'correct-horse-1')
  setValue(screen.getByLabelText(/confirm password/i), 'correct-horse-1')
  setValue(screen.getByLabelText(/display name/i), 'Ada Lovelace')
  await user.click(screen.getByRole('checkbox', { name: /terms/i }))
  await user.click(screen.getByRole('combobox', { name: /how did you hear/i }))
  await user.click(await screen.findByRole('option', { name: 'Search engine' }))
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
    expect(within(account).getByLabelText(/^password(?! strength)/i)).toBeInTheDocument()
    expect(within(account).getByRole('meter')).toBeInTheDocument()
    expect(within(account).getByLabelText(/confirm password/i)).toBeInTheDocument()

    const profile = screen.getByRole('group', { name: 'Profile' })
    expect(within(profile).getByLabelText(/display name/i)).toBeInTheDocument()
    expect(within(profile).getByRole('checkbox', { name: /terms/i })).toBeInTheDocument()
    expect(within(profile).getByRole('combobox', { name: /how did you hear/i })).toBeInTheDocument()
  })

  it('hides "Please specify" until the referral source is "Other"', async () => {
    const user = userEvent.setup({ delay: null })
    render(<SignUp />)
    expect(screen.queryByLabelText(/please specify/i)).not.toBeInTheDocument()
    await user.click(screen.getByRole('combobox', { name: /how did you hear/i }))
    await user.click(await screen.findByRole('option', { name: 'Other' }))
    expect(screen.getByLabelText(/please specify/i)).toBeInTheDocument()
  })

  it('requires "Please specify" only when the referral source is "Other"', async () => {
    const user = userEvent.setup({ delay: null })
    render(<SignUp />)
    await user.type(screen.getByLabelText(/^email/i), 'ada@example.com')
    await user.type(screen.getByLabelText(/^password(?! strength)/i), 'correct-horse-1')
    await user.type(screen.getByLabelText(/confirm password/i), 'correct-horse-1')
    await user.type(screen.getByLabelText(/display name/i), 'Ada Lovelace')
    await user.click(screen.getByRole('checkbox', { name: /terms/i }))
    await user.click(screen.getByRole('combobox', { name: /how did you hear/i }))
    await user.click(await screen.findByRole('option', { name: 'Other' }))
    await user.click(screen.getByRole('button', { name: /next/i }))
    await screen.findByRole('alert')
    // Still on step 1: Next was blocked by the empty "Other" specify field.
    expect(screen.queryByRole('textbox', { name: /verification code/i })).not.toBeInTheDocument()
  })

  it('advances once "Please specify" is filled in for an "Other" referral source', async () => {
    const user = userEvent.setup({ delay: null })
    render(<SignUp />)
    await fillStepOne(user)
    await user.click(screen.getByRole('combobox', { name: /how did you hear/i }))
    await user.click(await screen.findByRole('option', { name: 'Other' }))
    await user.type(screen.getByLabelText(/please specify/i), 'A podcast ad')
    await user.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() =>
      expect(screen.getByRole('group', { name: 'Verification' })).toBeInTheDocument(),
    )
  })

  it('shows the refine message on confirm password when the two passwords do not match', async () => {
    const user = userEvent.setup({ delay: null })
    render(<SignUp />)
    await user.type(screen.getByLabelText(/^email/i), 'ada@example.com')
    await user.type(screen.getByLabelText(/^password(?! strength)/i), 'correct-horse-1')
    await user.type(screen.getByLabelText(/confirm password/i), 'different-1')
    await user.type(screen.getByLabelText(/display name/i), 'Ada Lovelace')
    await user.click(screen.getByRole('checkbox', { name: /terms/i }))
    await user.click(screen.getByRole('button', { name: /next/i }))
    const confirmField = screen.getByLabelText(/confirm password/i)
    await waitFor(() => expect(confirmField).toHaveAccessibleDescription(/do not match|match/i))
  })

  it('shows the mismatch message even when the terms checkbox is left unchecked', async () => {
    // Regression: zod skips a `.refine` once any other field has a "non-continuable"
    // issue -- `terms` is a `z.literal(true)` starting `false`, which would otherwise
    // silently swallow the "Passwords do not match" message until terms is checked.
    const user = userEvent.setup({ delay: null })
    render(<SignUp />)
    await user.type(screen.getByLabelText(/^email/i), 'ada@example.com')
    await user.type(screen.getByLabelText(/^password(?! strength)/i), 'correct-horse-1')
    await user.type(screen.getByLabelText(/confirm password/i), 'different-1')
    await user.type(screen.getByLabelText(/display name/i), 'Ada Lovelace')
    // terms left unchecked on purpose
    await user.click(screen.getByRole('button', { name: /next/i }))
    const confirmField = screen.getByLabelText(/confirm password/i)
    await waitFor(() => expect(confirmField).toHaveAccessibleDescription(/do not match|match/i))
  })

  it('blocks Next when the terms checkbox is unchecked', async () => {
    const user = userEvent.setup({ delay: null })
    render(<SignUp />)
    await user.type(screen.getByLabelText(/^email/i), 'ada@example.com')
    await user.type(screen.getByLabelText(/^password(?! strength)/i), 'correct-horse-1')
    await user.type(screen.getByLabelText(/confirm password/i), 'correct-horse-1')
    await user.type(screen.getByLabelText(/display name/i), 'Ada Lovelace')
    await user.click(screen.getByRole('button', { name: /next/i }))
    await screen.findByText(/you must accept the terms/i)
    // Still on step 1: the OTP field from step 2 has not appeared.
    expect(screen.queryByRole('textbox', { name: /verification code/i })).not.toBeInTheDocument()
  })

  it('Next validates only step 1: an empty step 1 keeps the wizard on step 1', async () => {
    const user = userEvent.setup({ delay: null })
    render(<SignUp />)
    await user.click(screen.getByRole('button', { name: /next/i }))
    await screen.findAllByText(/required|invalid/i)
    expect(screen.getByRole('group', { name: 'Account' })).toBeInTheDocument()
  })

  it('advances to the verification step once step 1 is valid', async () => {
    const user = userEvent.setup({ delay: null })
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
    const user = userEvent.setup({ delay: null })
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
    const user = userEvent.setup({ delay: null })
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
    const user = userEvent.setup({ delay: null })
    const { container } = render(<SignUp />)
    await expectNoA11yViolations(container)
    await fillStepOne(user)
    await user.click(screen.getByRole('button', { name: /next/i }))
    await screen.findByRole('textbox', { name: /verification code/i })
    await expectNoA11yViolations(container)
  })

  it('is accessible with a server error shown on step 2', async () => {
    const user = userEvent.setup({ delay: null })
    const { container } = render(<SignUp />)
    await fillStepOne(user)
    await user.click(screen.getByRole('button', { name: /next/i }))
    await screen.findByRole('textbox', { name: /verification code/i })
    await user.type(screen.getByRole('textbox', { name: /verification code/i }), '000000')
    await user.click(screen.getByRole('button', { name: /submit/i }))
    await screen.findByRole('alert')
    // The alert appears while the rejected submit is still settling (`isSubmitting` flips
    // back, the nav and the OTP field re-render). axe walks the tree for long enough that,
    // on a loaded machine, those updates land mid-scan and React reports them as un-acted.
    // Waiting for the button to leave its loading state is the behaviour-level "the submit
    // has finished" signal, and leaves the scan on a settled tree.
    await waitFor(() => expect(screen.getByRole('button', { name: /submit/i })).toBeEnabled())
    await expectNoA11yViolations(container)
  })
})
