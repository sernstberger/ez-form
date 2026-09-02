import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { z } from 'zod'
import { Form } from '../../Form'
import { Autocomplete } from './Autocomplete'
import { describeFieldContract } from '../../test/describeFieldContract'

const schema = z.object({ role: z.enum(['admin', 'user'], { error: 'Pick a role' }) })

const roles = [
  { value: 'admin', label: 'Admin' },
  { value: 'user', label: 'User' },
] as const

const combobox = () => screen.getByRole('combobox', { name: 'Role' })

async function pick(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(combobox())
  await user.click(await screen.findByRole('option', { name }))
}

describeFieldContract({
  componentName: 'Autocomplete',
  label: 'Role',
  schema,
  defaultValues: {},
  render: (props) => <Autocomplete name="role" label="Role" options={roles} {...props} />,
  getControl: combobox,
  interact: (user) => pick(user, 'User'),
})

describe('Autocomplete', () => {
  it('submits the chosen option value', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <Form schema={schema} defaultValues={{}} onSubmit={onSubmit}>
        <Autocomplete name="role" label="Role" options={roles} />
        <button type="submit">Go</button>
      </Form>,
    )
    await pick(user, 'User')
    expect(combobox()).toHaveValue('User')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ role: 'user' }, expect.anything())
  })

  it('renders a default value by its option label', () => {
    render(
      <Form schema={schema} defaultValues={{ role: 'admin' }} onSubmit={() => {}}>
        <Autocomplete name="role" label="Role" options={roles} />
      </Form>,
    )
    expect(combobox()).toHaveValue('Admin')
  })

  it('submits null when cleared and shows the zod message', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={{ role: 'admin' }} onSubmit={() => {}}>
        <Autocomplete name="role" label="Role" options={roles} />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.click(combobox())
    await user.click(screen.getByRole('button', { name: 'Clear' }))
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByText('Pick a role')).toBeInTheDocument()
  })

  it('submits an array of values when multiple', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    const multi = z.object({
      roles: z.array(z.enum(['admin', 'user'])).min(1, 'Pick at least one'),
    })
    render(
      <Form schema={multi} defaultValues={{ roles: [] }} onSubmit={onSubmit}>
        <Autocomplete name="roles" label="Role" options={roles} multiple />
        <button type="submit">Go</button>
      </Form>,
    )
    await pick(user, 'Admin')
    await pick(user, 'User')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ roles: ['admin', 'user'] }, expect.anything())
  })

  it('treats an empty array as empty for the required rule', async () => {
    const user = userEvent.setup()
    const multi = z.object({ roles: z.array(z.enum(['admin', 'user'])) })
    render(
      <Form schema={multi} defaultValues={{ roles: [] }} onSubmit={() => {}}>
        <Autocomplete name="roles" label="Role" options={roles} multiple required />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByText('Role is required.')).toBeInTheDocument()
  })

  it('submits typed text under freeSolo', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    const free = z.object({ role: z.string() })
    render(
      <Form schema={free} defaultValues={{}} onSubmit={onSubmit}>
        <Autocomplete name="role" label="Role" options={roles} freeSolo />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.type(combobox(), 'Owner{Enter}')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ role: 'Owner' }, expect.anything())
  })

  it('stores the option object when getOptionValue returns it', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    const objectSchema = z.object({ role: z.object({ value: z.string(), label: z.string() }) })
    render(
      <Form schema={objectSchema} defaultValues={{}} onSubmit={onSubmit}>
        <Autocomplete name="role" label="Role" options={roles} getOptionValue={(o) => o} />
        <button type="submit">Go</button>
      </Form>,
    )
    await pick(user, 'User')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith(
      { role: { value: 'user', label: 'User' } },
      expect.anything(),
    )
  })

  it('still renders a value that is not in the current options', () => {
    const free = z.object({ city: z.string() })
    render(
      <Form schema={free} defaultValues={{ city: 'Springfield' }} onSubmit={() => {}}>
        <Autocomplete name="city" label="City" options={[]} />
      </Form>,
    )
    expect(screen.getByRole('combobox', { name: 'City' })).toHaveValue('Springfield')
  })

  it('hands the consumer onChange the full option, extra fields included', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const places = [{ value: '1 Main St', label: '1 Main St', placeId: 'p1' }]
    render(
      <Form schema={z.object({ address: z.string() })} defaultValues={{}} onSubmit={() => {}}>
        <Autocomplete name="address" label="Address" options={places} onChange={onChange} />
      </Form>,
    )
    await user.click(screen.getByRole('combobox', { name: 'Address' }))
    await user.click(await screen.findByRole('option', { name: '1 Main St' }))
    expect(onChange).toHaveBeenCalledWith(
      expect.anything(),
      { value: '1 Main St', label: '1 Main St', placeId: 'p1' },
      'selectOption',
      expect.anything(),
    )
  })

  it('shows the required rule message and focuses the input after a failed submit', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={{}} onSubmit={() => {}}>
        <Autocomplete name="role" label="Role" options={roles} required />
        <button type="submit">Go</button>
      </Form>,
    )
    expect(combobox()).toBeRequired()
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByText('Role is required.')).toBeInTheDocument()
    expect(combobox()).toHaveFocus()
  })

  describe('default isOptionEqualToValue (#29)', () => {
    const objectSchema = z.object({ role: z.object({ value: z.string(), label: z.string() }) })
    const objectMultiSchema = z.object({
      roles: z.array(z.object({ value: z.string(), label: z.string() })),
    })

    it('shows a structurally-equal default value as selected, without an MUI console warning', () => {
      // "without an MUI console warning" is the console guard's job now
      // (src/test/expectConsole.ts): any console.warn/error this test does not opt into fails
      // it. The absence of an `expectConsole` call is the assertion.
      render(
        <Form
          schema={objectSchema}
          // A fresh object, structurally equal to `roles[0]` but not the same reference
          // (e.g. as returned by a server round-trip).
          defaultValues={{ role: { value: 'admin', label: 'Admin' } }}
          onSubmit={() => {}}
        >
          <Autocomplete name="role" label="Role" options={roles} getOptionValue={(o) => o} />
        </Form>,
      )
      expect(combobox()).toHaveValue('Admin')
    })

    it('renders both chips for structurally-equal default values under multiple', () => {
      // "without an MUI console warning" is the console guard's job now
      // (src/test/expectConsole.ts): any console.warn/error this test does not opt into fails
      // it. The absence of an `expectConsole` call is the assertion.
      render(
        <Form
          schema={objectMultiSchema}
          defaultValues={{
            roles: [
              { value: 'admin', label: 'Admin' },
              { value: 'user', label: 'User' },
            ],
          }}
          onSubmit={() => {}}
        >
          <Autocomplete
            name="roles"
            label="Role"
            options={roles}
            getOptionValue={(o) => o}
            multiple
          />
        </Form>,
      )
      expect(screen.getByRole('button', { name: 'Admin' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'User' })).toBeInTheDocument()
    })

    it('uses a consumer-supplied isOptionEqualToValue instead of the default', async () => {
      const user = userEvent.setup()
      const isOptionEqualToValue = vi.fn(
        (option: (typeof roles)[number], value: (typeof roles)[number]) =>
          option.value === value.value,
      )
      render(
        <Form
          schema={objectSchema}
          defaultValues={{ role: { value: 'admin', label: 'Admin' } }}
          onSubmit={() => {}}
        >
          <Autocomplete
            name="role"
            label="Role"
            options={roles}
            getOptionValue={(o) => o}
            isOptionEqualToValue={isOptionEqualToValue}
          />
        </Form>,
      )
      expect(combobox()).toHaveValue('Admin')
      await user.click(combobox())
      expect(await screen.findByRole('option', { name: 'Admin' })).toHaveAttribute(
        'aria-selected',
        'true',
      )
      expect(isOptionEqualToValue).toHaveBeenCalled()
    })
  })

  describe('inputProps', () => {
    it('reaches the <input> itself, where textFieldProps cannot', () => {
      render(
        <Form schema={schema} defaultValues={{}} onSubmit={() => {}}>
          <Autocomplete
            name="role"
            label="Role"
            options={roles}
            inputProps={{ autoComplete: 'email', 'data-probe': 'yes' }}
          />
        </Form>,
      )
      // MUI's own `getInputProps()` sets autoComplete="off"; the caller's wins.
      expect(combobox()).toHaveAttribute('autocomplete', 'email')
      expect(combobox()).toHaveAttribute('data-probe', 'yes')
    })

    it("composes handlers with Autocomplete's own rather than replacing them", async () => {
      const user = userEvent.setup()
      const onKeyDown = vi.fn()
      render(
        <Form schema={schema} defaultValues={{}} onSubmit={() => {}}>
          <Autocomplete name="role" label="Role" options={roles} inputProps={{ onKeyDown }} />
        </Form>,
      )
      // The caller's handler runs...
      await user.type(combobox(), '{ArrowDown}')
      expect(onKeyDown).toHaveBeenCalled()
      // ...and MUI's still opens the listbox and highlights the first option.
      expect(await screen.findByRole('option', { name: 'Admin' })).toBeInTheDocument()
    })

    it('is inert when undefined', () => {
      render(
        <Form schema={schema} defaultValues={{}} onSubmit={() => {}}>
          <Autocomplete name="role" label="Role" options={roles} />
        </Form>,
      )
      // Falls back to exactly what Autocomplete sets for itself.
      expect(combobox()).toHaveAttribute('autocomplete', 'off')
    })
  })

  describe('requiredIndicator', () => {
    it('"optional": required stays required with no asterisk', () => {
      const { container } = render(
        <Form schema={schema} defaultValues={{}} onSubmit={() => {}} requiredIndicator="optional">
          <Autocomplete name="role" label="Role" options={roles} required />
        </Form>,
      )
      expect(combobox()).toBeRequired()
      expect(container.querySelector('[class*="asterisk"]')).toBeNull()
    })

    it('"optional": not-required gets the optional suffix in its label', () => {
      render(
        <Form schema={schema} defaultValues={{}} onSubmit={() => {}} requiredIndicator="optional">
          <Autocomplete name="role" label="Role" options={roles} />
        </Form>,
      )
      expect(screen.getByLabelText('Role (optional)')).toBeInTheDocument()
    })
  })
})
