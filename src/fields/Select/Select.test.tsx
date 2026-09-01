import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { z } from 'zod'
import { Form } from '../../Form'
import { Select } from './Select'
import { expectNoA11yViolations } from '../../test/axe'
import { describeFieldContract } from '../../test/describeFieldContract'

const schema = z.object({
  role: z.enum(['admin', 'user'], { error: 'Pick a role' }),
})

// `as const` proves `options` accepts a readonly array.
const options = [
  { value: 'admin', label: 'Admin' },
  { value: 'user', label: 'User' },
] as const

describeFieldContract({
  // Select is a thin wrapper over TextField (`<TextField select>`), so the
  // "outside <Form>" guard fires from useEzField with componentName 'TextField'.
  componentName: 'TextField',
  label: 'Role',
  schema,
  defaultValues: {},
  render: (props) => <Select name="role" label="Role" options={options} {...props} />,
  getControl: () => screen.getByRole('combobox', { name: 'Role' }),
  expectDisabled: (control) => expect(control).toHaveAttribute('aria-disabled', 'true'),
  interact: async (user) => {
    await user.click(screen.getByRole('combobox', { name: 'Role' }))
    await user.click(await screen.findByRole('option', { name: 'User' }))
  },
})

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

  it('renders a disabled option as disabled', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={{}} onSubmit={() => {}}>
        <Select
          name="role"
          label="Role"
          options={[
            { value: 'admin', label: 'Admin', disabled: true },
            { value: 'user', label: 'User' },
          ]}
        />
      </Form>,
    )
    await user.click(screen.getByRole('combobox', { name: 'Role' }))
    expect(await screen.findByRole('option', { name: 'Admin' })).toHaveAttribute('aria-disabled', 'true')
  })
})
