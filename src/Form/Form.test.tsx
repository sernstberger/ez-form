import { render, renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { z } from 'zod'
import { Form } from './Form'
import { useEzFormContext } from '../useEzFormContext'

const schema = z.object({ email: z.string().email() })

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
    expect(onSubmit).toHaveBeenCalledWith({ email: 'a@b.co' })
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
