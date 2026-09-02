import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
    const user = userEvent.setup()
    render(<Login />)
    await user.type(screen.getByLabelText(/email/i), 'ada@example.com')
    await user.type(screen.getByLabelText(/^password/i), LOGIN_BAD_PASSWORD)
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/invalid email or password/i)
  })

  it('shows a pending state on the submit button while the fake API call is in flight', async () => {
    const user = userEvent.setup()
    render(<Login />)
    await user.type(screen.getByLabelText(/email/i), 'ada@example.com')
    await user.type(screen.getByLabelText(/^password/i), 'correct-horse')
    const button = screen.getByRole('button', { name: /sign in/i })
    await user.click(button)
    await waitFor(() => expect(button).toBeDisabled())
  })

  it('calls the fake API exactly once with the submitted values for correct credentials', async () => {
    const user = userEvent.setup()
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
    const user = userEvent.setup()
    const { container } = render(<Login />)
    await expectNoA11yViolations(container)
    await user.type(screen.getByLabelText(/email/i), 'ada@example.com')
    await user.type(screen.getByLabelText(/^password/i), LOGIN_BAD_PASSWORD)
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    await screen.findByRole('alert')
    await expectNoA11yViolations(container)
  })
})
