import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { z } from 'zod'
import { Form } from '../Form'
import { FormError, formErrorClasses } from './FormError'
import { expectNoA11yViolations } from '../test/axe'

const schema = z.object({ email: z.email() })

describe('FormError', () => {
  it('renders nothing when there is no root error', () => {
    render(
      <Form schema={schema} defaultValues={{ email: 'a@b.co' }} onSubmit={() => {}}>
        <FormError />
      </Form>,
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('renders the root error as an alert once onSubmit sets it', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn((_values, form) => {
      form.setError('root.server', { message: 'Invalid email or password' })
    })
    render(
      <Form schema={schema} defaultValues={{ email: 'a@b.co' }} onSubmit={onSubmit}>
        <FormError />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.click(screen.getByRole('button', { name: 'Go' }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Invalid email or password')
    expect(alert).toHaveClass(formErrorClasses.root)
  })

  it('clears once the root error is cleared', async () => {
    const user = userEvent.setup()
    let shouldFail = true
    const onSubmit = vi.fn((_values, form) => {
      if (shouldFail) {
        form.setError('root.server', { message: 'Invalid email or password' })
      } else {
        form.clearErrors('root.server')
      }
    })
    render(
      <Form schema={schema} defaultValues={{ email: 'a@b.co' }} onSubmit={onSubmit}>
        <FormError />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.click(screen.getByRole('button', { name: 'Go' }))
    await screen.findByRole('alert')
    shouldFail = false
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('is accessible with no error and with one shown', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn((_values, form) => {
      form.setError('root.server', { message: 'Invalid email or password' })
    })
    const { container } = render(
      <Form schema={schema} defaultValues={{ email: 'a@b.co' }} onSubmit={onSubmit}>
        <FormError />
        <button type="submit">Go</button>
      </Form>,
    )
    await expectNoA11yViolations(container)
    await user.click(screen.getByRole('button', { name: 'Go' }))
    await screen.findByRole('alert')
    await expectNoA11yViolations(container)
  })
})
