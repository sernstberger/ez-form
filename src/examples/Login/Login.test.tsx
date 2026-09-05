import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { formClasses } from '../../Form'
import { Login } from './Login'
import { LOGIN_BAD_PASSWORD } from '../fakeApi'
import { expectNoA11yViolations } from '../../test/axe'

describe('Login', () => {
  it('has an accessible form name "Sign in"', () => {
    render(<Login />)
    expect(screen.getByRole('form', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('renders email, password, remember-me, and submit', () => {
    render(<Login />)
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^password/i)).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /remember me/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('shows a server error alert when the fake API rejects a wrong password', async () => {
    const user = userEvent.setup({ delay: null })
    render(<Login />)
    await user.type(screen.getByLabelText(/email/i), 'ada@example.com')
    await user.type(screen.getByLabelText(/^password/i), LOGIN_BAD_PASSWORD)
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/invalid email or password/i)
  })

  /**
   * #124's own repro, as a regression test. `onSubmit` here catches the API's rejection and
   * maps it to `setError('root.server', …)` without rethrowing — the pattern this library
   * documents — so `<Form>` sees a resolved promise. It used to announce "Submitted." over
   * the top of the alert saying the opposite, and left focus on `<body>`.
   */
  it('announces the failure (not "Submitted.") and focuses the alert on a wrong password', async () => {
    const user = userEvent.setup({ delay: null })
    render(<Login />)
    await user.type(screen.getByLabelText(/email/i), 'ada@example.com')
    await user.type(screen.getByLabelText(/^password/i), LOGIN_BAD_PASSWORD)
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    const alert = await screen.findByRole('alert')
    const status = () => document.querySelector<HTMLElement>(`.${formClasses.status}`)!
    await waitFor(() => expect(status()).toHaveTextContent(/invalid email or password/i))
    expect(status()).not.toHaveTextContent('Submitted.')
    await waitFor(() => expect(alert).toHaveFocus())
  })

  it('shows a pending state on the submit button while the fake API call is in flight', async () => {
    const user = userEvent.setup({ delay: null })
    render(<Login />)
    await user.type(screen.getByLabelText(/email/i), 'ada@example.com')
    await user.type(screen.getByLabelText(/^password/i), 'correct-horse')
    const button = screen.getByRole('button', { name: /sign in/i })
    await user.click(button)
    await waitFor(() => expect(button).toBeDisabled())
  })

  it('calls the fake API exactly once with the submitted values for correct credentials', async () => {
    const user = userEvent.setup({ delay: null })
    const onSuccess = vi.fn()
    render(<Login onSuccess={onSuccess} />)
    await user.type(screen.getByLabelText(/email/i), 'ada@example.com')
    await user.type(screen.getByLabelText(/^password/i), 'correct-horse')
    await user.click(screen.getByRole('checkbox', { name: /remember me/i }))
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
    expect(onSuccess).toHaveBeenCalledWith({ email: 'ada@example.com' })
  })

  it('is accessible with no error and with a server error shown', async () => {
    const user = userEvent.setup({ delay: null })
    const { container } = render(<Login />)
    await expectNoA11yViolations(container)
    await user.type(screen.getByLabelText(/email/i), 'ada@example.com')
    await user.type(screen.getByLabelText(/^password/i), LOGIN_BAD_PASSWORD)
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    await screen.findByRole('alert')
    // The alert renders while the rejected submit is still settling (`isSubmitting` flips
    // back and the button re-renders). axe's tree walk is slow enough that on a loaded
    // machine those updates land mid-scan and React reports them as un-acted. Waiting for
    // the button to leave its loading state is the behaviour-level "submit has finished".
    await waitFor(() => expect(screen.getByRole('button', { name: /sign in/i })).toBeEnabled())
    await expectNoA11yViolations(container)
  })
})
