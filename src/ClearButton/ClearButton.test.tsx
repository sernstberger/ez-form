import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { z } from 'zod'
import { Form } from '../Form'
import { TextField } from '../fields/TextField'
import { NumberField } from '../fields/NumberField'
import { ClearButton } from './ClearButton'
import { expectNoA11yViolations } from '../test/axe'

const schema = z.object({ name: z.string(), seats: z.number().nullable() })
const defaults = { name: 'Ada', seats: 2 }

function Fields() {
  return (
    <>
      <TextField name="name" label="Name" />
      <NumberField name="seats" label="Seats" />
    </>
  )
}

describe('ClearButton', () => {
  it('is a type=button named Clear, disabled while pristine', () => {
    render(
      <Form schema={schema} defaultValues={defaults} onSubmit={() => {}}>
        <Fields />
        <ClearButton />
      </Form>,
    )
    const btn = screen.getByRole('button', { name: 'Clear' })
    expect(btn).toHaveAttribute('type', 'button')
    expect(btn).toBeDisabled()
  })

  it('resets to defaultValues once dirty', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={defaults} onSubmit={() => {}}>
        <Fields />
        <ClearButton />
      </Form>,
    )
    const name = screen.getByRole('textbox', { name: 'Name' })
    await user.type(name, 'm')
    const btn = screen.getByRole('button', { name: 'Clear' })
    await waitFor(() => expect(btn).toBeEnabled())
    await user.click(btn)
    expect(name).toHaveValue('Ada')
    await waitFor(() => expect(btn).toBeDisabled())
  })

  it('to="empty" blanks every field by type', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={defaults} onSubmit={() => {}}>
        <Fields />
        <ClearButton to="empty" />
      </Form>,
    )
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'm')
    await user.click(screen.getByRole('button', { name: 'Clear' }))
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('')
    expect(screen.getByRole('textbox', { name: 'Seats' })).toHaveValue('')
  })

  it('confirm: Cancel keeps the values, Confirm resets', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={defaults} onSubmit={() => {}}>
        <Fields />
        <ClearButton confirm />
      </Form>,
    )
    const name = screen.getByRole('textbox', { name: 'Name' })
    await user.type(name, 'm')
    await user.click(screen.getByRole('button', { name: 'Clear' }))
    expect(await screen.findByRole('alertdialog', { name: 'Discard changes?' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(name).toHaveValue('Adam')
    await user.click(screen.getByRole('button', { name: 'Clear' }))
    await user.click(await screen.findByRole('button', { name: 'Confirm' }))
    await waitFor(() => expect(name).toHaveValue('Ada'))
  })

  it('is disabled while the form is disabled, even when dirty', async () => {
    const user = userEvent.setup()
    const { rerender } = render(
      <Form schema={schema} defaultValues={defaults} onSubmit={() => {}}>
        <Fields />
        <ClearButton />
      </Form>,
    )
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'm')
    rerender(
      <Form schema={schema} defaultValues={defaults} onSubmit={() => {}} disabled>
        <Fields />
        <ClearButton />
      </Form>,
    )
    await waitFor(() => expect(screen.getByRole('button', { name: 'Clear' })).toBeDisabled())
  })

  it('has no accessibility violations', async () => {
    const { container } = render(
      <Form schema={schema} defaultValues={defaults} onSubmit={() => {}}>
        <Fields />
        <ClearButton />
      </Form>,
    )
    await expectNoA11yViolations(container)
  })

  it('throws outside <Form>', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<ClearButton />)).toThrow(
      'ez-form: <ClearButton> must be rendered inside <Form>',
    )
  })
})
