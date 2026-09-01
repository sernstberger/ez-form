import { createRef } from 'react'
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

  it('disables the fields and submit while async defaultValues load, then fills them', async () => {
    let resolve!: (values: { email: string }) => void
    const load = vi.fn(() => new Promise<{ email: string }>((r) => (resolve = r)))
    render(
      <Form schema={schema} defaultValues={load} onSubmit={() => {}}>
        <TextField name="email" label="Email" />
        <SubmitButton />
      </Form>,
    )
    expect(screen.getByLabelText('Email')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled()
    resolve({ email: 'a@b.co' })
    await waitFor(() => expect(screen.getByLabelText('Email')).toHaveValue('a@b.co'))
    await waitFor(() => expect(screen.getByLabelText('Email')).toBeEnabled())
    expect(screen.getByRole('button', { name: 'Submit' })).toBeEnabled()
  })

  it('re-syncs the fields when values changes', async () => {
    const view = render(
      <Form schema={schema} values={{ email: 'a@b.co' }} onSubmit={() => {}}>
        <TextField name="email" label="Email" />
      </Form>,
    )
    expect(screen.getByLabelText('Email')).toHaveValue('a@b.co')
    view.rerender(
      <Form schema={schema} values={{ email: 'c@d.co' }} onSubmit={() => {}}>
        <TextField name="email" label="Email" />
      </Form>,
    )
    await waitFor(() => expect(screen.getByLabelText('Email')).toHaveValue('c@d.co'))
  })

  it('exposes the form methods through ref', async () => {
    const user = userEvent.setup()
    const ref = createRef<FormMethods<{ email: string }, { email: string }>>()
    render(
      <>
        <Form ref={ref} schema={schema} defaultValues={{ email: '' }} onSubmit={() => {}}>
          <TextField name="email" label="Email" />
        </Form>
        <button type="button" onClick={() => ref.current?.reset({ email: 'r@s.co' })}>
          Load
        </button>
      </>,
    )
    await user.type(screen.getByLabelText('Email'), 'typed')
    await user.click(screen.getByRole('button', { name: 'Load' }))
    expect(screen.getByLabelText('Email')).toHaveValue('r@s.co')
  })
})

describe('Form with all five components', () => {
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

  it('locks every field and the submit button under <Form disabled>, even with disabled={false}', () => {
    render(
      <Form
        schema={signup}
        defaultValues={{ name: '', email: '', tos: false, newsletter: false }}
        onSubmit={() => {}}
        disabled
      >
        <TextField name="name" label="Name" disabled={false} />
        <Select name="role" label="Role" options={roles} disabled={false} />
        <Checkbox name="tos" label="I accept the terms" disabled={false} />
        <Switch name="newsletter" label="Send me the newsletter" disabled={false} />
        <SubmitButton disabled={false}>Create account</SubmitButton>
      </Form>,
    )
    expect(screen.getByRole('textbox', { name: 'Name' })).toBeDisabled()
    expect(screen.getByRole('combobox', { name: 'Role' })).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByRole('checkbox', { name: 'I accept the terms' })).toBeDisabled()
    expect(screen.getByRole('switch', { name: 'Send me the newsletter' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Create account' })).toBeDisabled()
  })

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
