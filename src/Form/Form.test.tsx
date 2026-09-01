import { render, renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { z } from 'zod'
import { Form, type FormMethods } from './Form'
import { SubmitButton } from '../SubmitButton'
import { TextField } from '../fields/TextField'
import { Select } from '../fields/Select'
import { Checkbox } from '../fields/Checkbox'
import { Switch } from '../fields/Switch'
import { useEzFormContext } from '../useEzFormContext'
import { expectNoA11yViolations } from '../test/axe'

const schema = z.object({ email: z.email() })

describe('Form', () => {
  it('calls onSubmit with parsed values when defaultValues are valid', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <Form schema={schema} defaultValues={{ email: 'a@b.co' }} onSubmit={onSubmit}>
        <button type="submit">Go</button>
      </Form>,
    )
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith({ email: 'a@b.co' }, expect.anything())
  })

  it('hands the form methods to onSubmit so the caller can map a server error', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn(
      (_values: { email: string }, form: FormMethods<{ email: string }, { email: string }>) =>
        form.setError('email', { message: 'Already registered' }),
    )
    render(
      <Form schema={schema} defaultValues={{ email: 'a@b.co' }} onSubmit={onSubmit}>
        <TextField name="email" label="Email" />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByText('Already registered')).toBeInTheDocument()
  })

  it('does not call onSubmit when values fail the schema', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <Form schema={schema} defaultValues={{ email: 'nope' }} onSubmit={onSubmit}>
        <button type="submit">Go</button>
      </Form>,
    )
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('renders a noValidate form and forwards extra props', () => {
    render(
      <Form schema={schema} onSubmit={() => {}} aria-label="signup" className="x">
        <span>child</span>
      </Form>,
    )
    const form = screen.getByRole('form', { name: 'signup' })
    expect(form).toHaveAttribute('novalidate')
    expect(form).toHaveClass('x')
    expect(screen.getByText('child')).toBeInTheDocument()
  })

  it('disables every field when the form is disabled', () => {
    render(
      <Form schema={schema} defaultValues={{ email: '' }} onSubmit={() => {}} disabled>
        <TextField name="email" label="Email" />
      </Form>,
    )
    expect(screen.getByLabelText('Email')).toBeDisabled()
  })

  it('disables the fields while onSubmit is pending, then re-enables them', async () => {
    const user = userEvent.setup()
    let resolve!: () => void
    const onSubmit = vi.fn(() => new Promise<void>((r) => (resolve = r)))
    render(
      <Form schema={schema} defaultValues={{ email: 'a@b.co' }} onSubmit={onSubmit}>
        <TextField name="email" label="Email" />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.click(screen.getByRole('button', { name: 'Go' }))
    await waitFor(() => expect(screen.getByLabelText('Email')).toBeDisabled())
    resolve()
    await waitFor(() => expect(screen.getByLabelText('Email')).toBeEnabled())
  })
})

describe('Form accessibility', () => {
  const signup = z.object({
    name: z.string(),
    email: z.email(),
    role: z.enum(['admin', 'user'], { error: 'Pick a role' }),
    tos: z.boolean(),
    newsletter: z.boolean(),
  })
  const roles = [
    { value: 'admin', label: 'Admin' },
    { value: 'user', label: 'User' },
  ] as const

  function renderSignup() {
    return render(
      <Form
        schema={signup}
        defaultValues={{ name: '', email: '', tos: false, newsletter: false }}
        onSubmit={() => {}}
        aria-label="Sign up"
      >
        <TextField name="name" label="Name" required />
        <TextField name="email" label="Email" helperText="We never share it" required />
        <Select name="role" label="Role" options={roles} required />
        <Checkbox name="tos" label="I accept the terms" required />
        <Switch name="newsletter" label="Send me the newsletter" />
        <SubmitButton>Create account</SubmitButton>
      </Form>,
    )
  }

  it('has no accessibility violations at rest', async () => {
    const { container } = renderSignup()
    await expectNoA11yViolations(container)
  })

  it('has no accessibility violations after an empty submit', async () => {
    const user = userEvent.setup()
    const { container } = renderSignup()
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByText('Name is required.')).toBeInTheDocument()
    await expectNoA11yViolations(container)
  })
})

describe('useEzFormContext', () => {
  it('throws a clear error outside <Form>', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderHook(() => useEzFormContext('Probe'))).toThrow(
      'ez-form: <Probe> must be rendered inside <Form>',
    )
  })

  it('returns the form methods inside <Form>', () => {
    const { result } = renderHook(() => useEzFormContext('Reader'), {
      wrapper: ({ children }) => (
        <Form schema={schema} onSubmit={() => {}}>
          {children}
        </Form>
      ),
    })
    expect(result.current).toHaveProperty('control')
  })
})
