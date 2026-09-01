import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { z } from 'zod'
import { Form } from '../../Form'
import { TextField } from './TextField'

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

  it('throws outside <Form>', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<TextField name="x" />)).toThrow(
      'ez-form: <TextField> must be rendered inside <Form>',
    )
  })
})
