import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { z } from 'zod'
import { Form } from '../../Form'
import { TextField } from './TextField'
import { expectNoA11yViolations } from '../../test/axe'

const schema = z.object({
  email: z.email({ error: (iss) => (iss.input === '' ? 'Email is required' : 'Invalid email') }),
})

function renderForm(onSubmit = vi.fn(), helperText?: string) {
  render(
    <Form schema={schema} defaultValues={{ email: '' }} onSubmit={onSubmit}>
      <TextField name="email" label="Email" helperText={helperText} />
      <button type="submit">Go</button>
    </Form>,
  )
  return { onSubmit }
}

describe('TextField', () => {
  it('shows the zod message as helper text after a failed submit', async () => {
    const user = userEvent.setup()
    renderForm()
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByText('Email is required')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
  })

  it('submits the typed value', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderForm()
    await user.type(screen.getByLabelText('Email'), 'a@b.co')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ email: 'a@b.co' }, expect.anything())
  })

  it('shows consumer helperText when there is no error', () => {
    renderForm(vi.fn(), 'We never share it')
    expect(screen.getByText('We never share it')).toBeInTheDocument()
  })

  it('replaces consumer helperText with the error message', async () => {
    const user = userEvent.setup()
    renderForm(vi.fn(), 'We never share it')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByText('Email is required')).toBeInTheDocument()
    expect(screen.queryByText('We never share it')).not.toBeInTheDocument()
  })

  it('calls a consumer onChange after updating the form value', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <Form schema={schema} defaultValues={{ email: '' }} onSubmit={() => {}}>
        <TextField name="email" label="Email" onChange={onChange} />
      </Form>,
    )
    await user.type(screen.getByLabelText('Email'), 'a')
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(screen.getByLabelText('Email')).toHaveValue('a')
  })

  it('shows "<label> is required." when required and left empty', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={{ email: '' }} onSubmit={() => {}}>
        <TextField name="email" label="Email" required />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByText('Email is required.')).toBeInTheDocument()
  })

  it('lets a rule error win over the zod message for the same field', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={{ email: '' }} onSubmit={() => {}}>
        <TextField name="email" label="Email" required="Please fill in your email" />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByText('Please fill in your email')).toBeInTheDocument()
    expect(screen.queryByText('Email is required')).not.toBeInTheDocument()
  })

  it('derives a default message for a bare rule value', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={{ email: '' }} onSubmit={() => {}}>
        <TextField name="email" label="Email" minLength={3} />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.type(screen.getByLabelText('Email'), 'ab')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByText('Email must be at least 3 characters.')).toBeInTheDocument()
    expect(screen.queryByText('Invalid email')).not.toBeInTheDocument()
  })

  it('marks the input required and shows the asterisk when required', () => {
    render(
      <Form schema={schema} defaultValues={{ email: '' }} onSubmit={() => {}}>
        <TextField name="email" label="Email" required />
      </Form>,
    )
    expect(screen.getByRole('textbox', { name: 'Email' })).toBeRequired()
  })

  it('reports a rule message while typing in onChange mode', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={{ email: '' }} onSubmit={() => {}} mode="onChange">
        <TextField name="email" label="Email" minLength={3} />
      </Form>,
    )
    await user.type(screen.getByLabelText('Email'), 'ab')
    expect(await screen.findByText('Email must be at least 3 characters.')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Email'), 'c')
    expect(screen.queryByText('Email must be at least 3 characters.')).not.toBeInTheDocument()
  })

  it('submits when every rule passes', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <Form schema={schema} defaultValues={{ email: '' }} onSubmit={onSubmit}>
        <TextField name="email" label="Email" required minLength={3} pattern={/@/} />
        <button type="submit">Go</button>
      </Form>,
    )
    // A required label reads "Email *" to getByLabelText; the asterisk is aria-hidden, so query by role.
    await user.type(screen.getByRole('textbox', { name: 'Email' }), 'a@b.co')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ email: 'a@b.co' }, expect.anything())
  })

  it('has no accessibility violations', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <Form schema={schema} defaultValues={{ email: '' }} onSubmit={() => {}}>
        <TextField name="email" label="Email" helperText="We never share it" required />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByText('Email is required.')).toBeInTheDocument()
    await expectNoA11yViolations(container)
  })

  it('announces the error text as an alert and keeps consumer helper text quiet', async () => {
    const user = userEvent.setup()
    renderForm(vi.fn(), 'We never share it')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Email is required')
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('Email is required')
  })

  it('throws outside <Form>', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<TextField name="x" />)).toThrow(
      'ez-form: <TextField> must be rendered inside <Form>',
    )
  })
})
