import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { z } from 'zod'
import { Form } from '../../Form'
import { Select } from './Select'

const schema = z.object({
  role: z.enum(['admin', 'user'], { error: 'Pick a role' }),
})

// `as const` proves `options` accepts a readonly array.
const options = [
  { value: 'admin', label: 'Admin' },
  { value: 'user', label: 'User' },
] as const

// No `role` default: `DefaultValues` is DeepPartial and Select renders `undefined` as the empty state.
describe('Select', () => {
  it('submits the chosen option', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <Form schema={schema} defaultValues={{}} onSubmit={onSubmit}>
        <Select name="role" label="Role" options={options} />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.click(screen.getByRole('combobox', { name: 'Role' }))
    await user.click(await screen.findByRole('option', { name: 'User' }))
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ role: 'user' }, expect.anything())
  })

  it('shows the zod message when nothing is chosen', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={{}} onSubmit={() => {}}>
        <Select name="role" label="Role" options={options} />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByText('Pick a role')).toBeInTheDocument()
  })

  it('shows the required rule message instead of the zod one when required', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={{}} onSubmit={() => {}}>
        <Select name="role" label="Role" options={options} required />
        <button type="submit">Go</button>
      </Form>,
    )
    expect(screen.getByRole('combobox', { name: 'Role' })).toBeRequired()
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByText('Role is required.')).toBeInTheDocument()
    expect(screen.queryByText('Pick a role')).not.toBeInTheDocument()
  })
})
