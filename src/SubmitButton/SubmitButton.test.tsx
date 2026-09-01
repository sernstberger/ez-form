import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { z } from 'zod'
import { Form } from '../Form'
import { SubmitButton } from './SubmitButton'

const schema = z.object({ ok: z.boolean() })

describe('SubmitButton', () => {
  it('renders a submit button with default label', () => {
    render(
      <Form schema={schema} defaultValues={{ ok: true }} onSubmit={() => {}}>
        <SubmitButton />
      </Form>,
    )
    const btn = screen.getByRole('button', { name: 'Submit' })
    expect(btn).toHaveAttribute('type', 'submit')
    expect(btn).toBeEnabled()
  })

  it('is disabled and shows a progress indicator while onSubmit is pending, then re-enabled', async () => {
    const user = userEvent.setup()
    let resolve!: () => void
    const onSubmit = vi.fn(() => new Promise<void>((r) => (resolve = r)))
    render(
      <Form schema={schema} defaultValues={{ ok: true }} onSubmit={onSubmit}>
        <SubmitButton>Save</SubmitButton>
      </Form>,
    )
    const btn = screen.getByRole('button', { name: 'Save' })
    await user.click(btn)
    await waitFor(() => expect(btn).toBeDisabled())
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
    resolve()
    await waitFor(() => expect(btn).toBeEnabled())
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })

  it('respects a consumer disabled prop', () => {
    render(
      <Form schema={schema} defaultValues={{ ok: true }} onSubmit={() => {}}>
        <SubmitButton disabled />
      </Form>,
    )
    expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled()
  })

  it('is disabled while the form is disabled', () => {
    render(
      <Form schema={schema} defaultValues={{ ok: true }} onSubmit={() => {}} disabled>
        <SubmitButton />
      </Form>,
    )
    expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled()
  })

  it('throws outside <Form>', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<SubmitButton />)).toThrow(
      'ez-form: <SubmitButton> must be rendered inside <Form>',
    )
  })
})
