import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { z } from 'zod'
import { Form } from '../../Form'
import { Select } from './Select'
import { expectNoA11yViolations } from '../../test/axe'

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

  it('shows consumer helperText when there is no error', () => {
    render(
      <Form schema={schema} defaultValues={{}} onSubmit={() => {}}>
        <Select name="role" label="Role" options={options} helperText="Pick one" />
      </Form>,
    )
    expect(screen.getByRole('combobox', { name: 'Role' })).toHaveAccessibleDescription('Pick one')
  })

  it('calls a consumer onChange after updating the form value', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const onSubmit = vi.fn()
    render(
      <Form schema={schema} defaultValues={{}} onSubmit={onSubmit}>
        <Select name="role" label="Role" options={options} onChange={onChange} />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.click(screen.getByRole('combobox', { name: 'Role' }))
    await user.click(await screen.findByRole('option', { name: 'Admin' }))
    expect(onChange).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ role: 'admin' }, expect.anything())
  })

  it('types validate over the option value, including numeric options', async () => {
    const user = userEvent.setup()
    const levels = z.object({ level: z.number() })
    const levelOptions = [
      { value: 1, label: 'One' },
      { value: 2, label: 'Two' },
    ] as const
    render(
      <Form schema={levels} defaultValues={{}} onSubmit={() => {}}>
        <Select
          name="level"
          label="Level"
          options={levelOptions}
          validate={(v) => v !== 2 || 'Not two'}
        />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.click(screen.getByRole('combobox', { name: 'Level' }))
    await user.click(await screen.findByRole('option', { name: 'Two' }))
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByText('Not two')).toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <Form schema={schema} defaultValues={{}} onSubmit={() => {}}>
        <Select name="role" label="Role" options={options} helperText="Pick one" required />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByText('Role is required.')).toBeInTheDocument()
    await expectNoA11yViolations(container)
  })

  it('has no accessibility violations with the listbox open', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={{}} onSubmit={() => {}}>
        <Select name="role" label="Role" options={options} required />
      </Form>,
    )
    await user.click(screen.getByRole('combobox', { name: 'Role' }))
    expect(await screen.findByRole('option', { name: 'User' })).toBeInTheDocument()
    // MUI portals the listbox outside `container`; scope axe to the popover's listbox.
    // (Running on document.body only adds the page-level `region` landmark rule, which a
    // portaled popover cannot satisfy and which is page structure, not the component.)
    await expectNoA11yViolations(screen.getByRole('listbox'))
  })
})
