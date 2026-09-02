import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { z } from 'zod'
import { Form } from '../../Form'
import { EmailListField, emailListFieldClasses, type EmailOption } from './EmailListField'
import { describeFieldContract } from '../../test/describeFieldContract'
import { expectNoA11yViolations } from '../../test/axe'
import { expectTargetSize } from '../../test/targetSize'

const schema = z.object({ to: z.array(z.string()) })
const requiredSchema = z.object({ to: z.array(z.string()).min(1, 'Add at least one recipient') })

const combobox = () => screen.getByRole('combobox', { name: 'To' })
const chips = () => Array.from(document.querySelectorAll(`.${emailListFieldClasses.chip}`))
const chipLabels = () => chips().map((c) => c.textContent)
const status = () => document.querySelector(`.${emailListFieldClasses.status}`)

const directory: EmailOption[] = [
  { value: 'ada@example.com', label: 'Ada Lovelace <ada@example.com>', id: 'u1' },
  { value: 'grace@example.com', label: 'Grace Hopper <grace@example.com>', id: 'u2' },
]

/** A lookup that resolves immediately, filtering the fixed directory by substring. */
const lookup = (query: string) =>
  Promise.resolve(directory.filter((o) => o.label.toLowerCase().includes(query.toLowerCase())))

function setup(
  ui: React.ReactElement,
  { onSubmit = vi.fn(), defaultValues = { to: [] as string[] } } = {},
) {
  const user = userEvent.setup()
  const result = render(
    <Form schema={schema} defaultValues={defaultValues} onSubmit={onSubmit}>
      {ui}
      <button type="submit">Go</button>
    </Form>,
  )
  return { user, onSubmit, ...result }
}

describeFieldContract({
  componentName: 'EmailListField',
  label: 'To',
  schema: requiredSchema,
  defaultValues: { to: [] },
  errorProps: { required: true },
  errorMessage: 'To is required.',
  render: (props) => <EmailListField name="to" label="To" {...props} />,
  getControl: combobox,
  interact: async (user) => {
    await user.type(combobox(), 'ada@example.com{Enter}')
  },
})

describe('EmailListField', () => {
  it('commits a typed address on Enter and stores a string array', async () => {
    const { user, onSubmit } = setup(<EmailListField name="to" label="To" />)
    await user.type(combobox(), 'ada@example.com{Enter}')
    expect(chipLabels()).toEqual(['ada@example.com'])
    expect(combobox()).toHaveValue('')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ to: ['ada@example.com'] }, expect.anything())
  })

  it.each([
    ['comma', ','],
    ['semicolon', ';'],
    ['space', ' '],
  ])('commits a complete address on %s', async (_name, key) => {
    const { user } = setup(<EmailListField name="to" label="To" />)
    await user.type(combobox(), `ada@example.com${key}`)
    expect(chipLabels()).toEqual(['ada@example.com'])
  })

  it('does not commit on a space that follows an incomplete address', async () => {
    const { user } = setup(<EmailListField name="to" label="To" />)
    await user.type(combobox(), 'Ada Lovelace')
    expect(chips()).toHaveLength(0)
    expect(combobox()).toHaveValue('Ada Lovelace')
  })

  it('splits a pasted list on commas, semicolons and whitespace', async () => {
    const { user, onSubmit } = setup(<EmailListField name="to" label="To" />)
    await user.click(combobox())
    await user.paste('a@x.com, b@y.com; c@z.com')
    expect(chipLabels()).toEqual(['a@x.com', 'b@y.com', 'c@z.com'])
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith(
      { to: ['a@x.com', 'b@y.com', 'c@z.com'] },
      expect.anything(),
    )
  })

  it('collapses duplicates case-insensitively and announces the rejection', async () => {
    const { user } = setup(<EmailListField name="to" label="To" />)
    await user.type(combobox(), 'Ada@Example.com{Enter}')
    await user.type(combobox(), 'ada@example.com{Enter}')
    expect(chipLabels()).toEqual(['Ada@Example.com'])
    expect(status()).toHaveTextContent('Already added')
  })

  it('keeps an invalid address as an errored chip and blocks submit', async () => {
    const { user, onSubmit } = setup(<EmailListField name="to" label="To" />)
    await user.type(combobox(), 'not-an-email{Enter}')
    expect(chipLabels()).toEqual(['not-an-email'])
    expect(chips()[0]).toHaveClass('MuiChip-colorError')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a valid email address')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('takes a custom invalidMessage', async () => {
    const { user } = setup(<EmailListField name="to" label="To" invalidMessage="Bad address" />)
    await user.type(combobox(), 'nope{Enter}')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Bad address')
  })

  it('commits what is typed when the field is blurred', async () => {
    const { user } = setup(<EmailListField name="to" label="To" />)
    await user.type(combobox(), 'ada@example.com')
    await user.tab()
    expect(chipLabels()).toEqual(['ada@example.com'])
  })

  it('announces each add and remove in its own live region', async () => {
    const { user } = setup(<EmailListField name="to" label="To" />)
    await user.type(combobox(), 'ada@example.com{Enter}')
    expect(status()).toHaveTextContent('ada@example.com added')
    await user.click(screen.getByRole('button', { name: 'Remove ada@example.com' }))
    expect(status()).toHaveTextContent('ada@example.com removed')
    expect(chips()).toHaveLength(0)
  })

  describe('lookup', () => {
    it('renders options from loadOptions and labels the chip with the option label', async () => {
      const { user, onSubmit } = setup(
        <EmailListField name="to" label="To" loadOptions={lookup} debounceMs={0} />,
      )
      await user.type(combobox(), 'ada')
      await user.click(
        await screen.findByRole('option', { name: 'Ada Lovelace <ada@example.com>' }),
      )
      // The chip reads as the person; only the address is stored.
      expect(chipLabels()).toEqual(['Ada Lovelace <ada@example.com>'])
      await user.click(screen.getByRole('button', { name: 'Go' }))
      expect(onSubmit).toHaveBeenCalledWith({ to: ['ada@example.com'] }, expect.anything())
    })

    it('debounces and aborts the superseded request when typing continues', async () => {
      const seen: { query: string; signal: AbortSignal }[] = []
      const slow = (query: string, signal: AbortSignal) => {
        seen.push({ query, signal })
        return new Promise<EmailOption[]>((resolve) => {
          setTimeout(() => resolve(directory), 5)
        })
      }
      // No inter-keystroke delay: the three characters land inside one debounce window.
      const user = userEvent.setup({ delay: null })
      render(
        <Form schema={schema} defaultValues={{ to: [] }} onSubmit={vi.fn()}>
          <EmailListField name="to" label="To" loadOptions={slow} debounceMs={10} />
        </Form>,
      )
      // Typed with no pause: only the final text survives the debounce window.
      await user.type(combobox(), 'ada')
      await waitFor(() => expect(seen).toHaveLength(1))
      expect(seen[0]?.query).toBe('ada')

      // Typing on aborts the request already in flight.
      await user.type(combobox(), 'x')
      expect(seen[0]?.signal.aborted).toBe(true)
      await waitFor(() => expect(seen).toHaveLength(2))
      expect(seen[1]?.query).toBe('adax')
      expect(seen[1]?.signal.aborted).toBe(false)
    })

    it('rejects a typed address that is not in the results under allowNew={false}', async () => {
      const { user, onSubmit } = setup(
        <EmailListField
          name="to"
          label="To"
          loadOptions={lookup}
          debounceMs={0}
          allowNew={false}
        />,
      )
      // Well-formed, but nobody the directory knows about.
      await user.type(combobox(), 'stranger@example.com{Enter}')
      expect(chips()[0]).toHaveClass('MuiChip-colorError')
      await user.click(screen.getByRole('button', { name: 'Go' }))
      expect(await screen.findByRole('alert')).toHaveTextContent('Enter a valid email address')
      expect(onSubmit).not.toHaveBeenCalled()
    })

    it('accepts a looked-up address under allowNew={false}', async () => {
      const { user, onSubmit } = setup(
        <EmailListField
          name="to"
          label="To"
          loadOptions={lookup}
          debounceMs={0}
          allowNew={false}
        />,
      )
      await user.type(combobox(), 'grace')
      await user.click(
        await screen.findByRole('option', { name: 'Grace Hopper <grace@example.com>' }),
      )
      await user.click(screen.getByRole('button', { name: 'Go' }))
      expect(onSubmit).toHaveBeenCalledWith({ to: ['grace@example.com'] }, expect.anything())
    })
  })

  it('clears the input and announces when a duplicate is rejected at blur', async () => {
    const { user, onSubmit } = setup(<EmailListField name="to" label="To" />)
    await user.type(combobox(), 'ada@example.com{Enter}')
    await user.type(combobox(), 'ADA@example.com')
    await user.tab()
    // The address is already in the list, so the text must not be stranded in
    // the box where submit would silently drop it.
    expect(combobox()).toHaveValue('')
    expect(chipLabels()).toEqual(['ada@example.com'])
    expect(status()).toHaveTextContent('Already added')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ to: ['ada@example.com'] }, expect.anything())
  })

  it('clears the input and announces when a duplicate is rejected by comma', async () => {
    const { user } = setup(<EmailListField name="to" label="To" />)
    await user.type(combobox(), 'ada@example.com{Enter}')
    await user.type(combobox(), 'ada@example.com,')
    expect(combobox()).toHaveValue('')
    expect(chipLabels()).toEqual(['ada@example.com'])
    expect(status()).toHaveTextContent('Already added')
  })

  it('clears the input and announces when a pasted list is entirely duplicates', async () => {
    const { user } = setup(<EmailListField name="to" label="To" />)
    await user.click(combobox())
    await user.paste('a@x.com, b@y.com')
    await user.paste('A@X.com; b@Y.com')
    expect(combobox()).toHaveValue('')
    expect(chipLabels()).toEqual(['a@x.com', 'b@y.com'])
    expect(status()).toHaveTextContent('Already added')
  })

  it('announces the added addresses and the rejected duplicate together', async () => {
    const { user } = setup(<EmailListField name="to" label="To" />)
    await user.type(combobox(), 'a@x.com{Enter}')
    await user.click(combobox())
    await user.paste('a@x.com, b@y.com')
    // One was new and one was already there; neither half may be lost.
    expect(status()).toHaveTextContent('b@y.com added Already added')
    expect(chipLabels()).toEqual(['a@x.com', 'b@y.com'])
  })

  it('does not announce a duplicate when nothing was actually skipped', async () => {
    const { user } = setup(<EmailListField name="to" label="To" />)
    await user.type(combobox(), 'a@x.com{Enter}')
    expect(status()).toHaveTextContent('a@x.com added')
    expect(status()).not.toHaveTextContent('Already added')
  })

  it('takes custom plural announcement strings', async () => {
    const { user } = setup(
      <EmailListField
        name="to"
        label="To"
        addedManyMessage={(n) => `${n} agregadas`}
        removedManyMessage={(n) => `${n} eliminadas`}
      />,
    )
    await user.click(combobox())
    await user.paste('a@x.com, b@y.com')
    expect(status()).toHaveTextContent('2 agregadas')
    await user.click(screen.getByRole('button', { name: 'Clear' }))
    expect(status()).toHaveTextContent('2 eliminadas')
  })

  it('keeps chips deletable when a consumer passes slotProps.chip', async () => {
    const onDelete = vi.fn()
    const { user } = setup(
      <EmailListField name="to" label="To" slotProps={{ chip: { onDelete } }} />,
    )
    await user.type(combobox(), 'ada@example.com{Enter}')
    await user.click(screen.getByRole('button', { name: 'Remove ada@example.com' }))
    // The consumer's handler runs, and MUI's removal still happens.
    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(chips()).toHaveLength(0)
  })

  it('lets a consumer veto a removal with preventDefault', async () => {
    const { user } = setup(
      <EmailListField
        name="to"
        label="To"
        slotProps={{ chip: { onDelete: (e) => e.preventDefault() } }}
      />,
    )
    await user.type(combobox(), 'ada@example.com{Enter}')
    await user.click(screen.getByRole('button', { name: 'Remove ada@example.com' }))
    expect(chipLabels()).toEqual(['ada@example.com'])
  })

  it('keeps the delete control named even when slotProps.chip is supplied', async () => {
    // `deleteIcon` is excluded from the slot's type (the accessible name is part
    // of the field's a11y contract); everything else on the chip still merges.
    const { user } = setup(
      <EmailListField name="to" label="To" slotProps={{ chip: { className: 'probe' } }} />,
    )
    await user.type(combobox(), 'ada@example.com{Enter}')
    expect(screen.getByRole('button', { name: 'Remove ada@example.com' })).toBeInTheDocument()
    expect(chips()[0]).toHaveClass('probe')
  })

  it("gives each chip's delete control a name and a 24x24 target", async () => {
    const { user } = setup(<EmailListField name="to" label="To" />)
    await user.type(combobox(), 'ada@example.com{Enter}')
    const remove = screen.getByRole('button', { name: 'Remove ada@example.com' })
    expectTargetSize(remove)
  })

  it('sets autoComplete="email" on the input', () => {
    setup(<EmailListField name="to" label="To" />)
    expect(combobox()).toHaveAttribute('autocomplete', 'email')
  })

  it('drops autoComplete to "off" under <Form assisted>', () => {
    render(
      <Form schema={schema} defaultValues={{ to: [] }} onSubmit={vi.fn()} assisted>
        <EmailListField name="to" label="To" />
      </Form>,
    )
    expect(combobox()).toHaveAttribute('autocomplete', 'off')
  })

  it('lets an explicit autoComplete win, even under assisted', () => {
    render(
      <Form schema={schema} defaultValues={{ to: [] }} onSubmit={vi.fn()} assisted>
        <EmailListField name="to" label="To" autoComplete="work email" />
      </Form>,
    )
    expect(combobox()).toHaveAttribute('autocomplete', 'work email')
  })

  it('has no accessibility violations with chips and an open listbox', async () => {
    const { user, container } = setup(
      <EmailListField name="to" label="To" loadOptions={lookup} debounceMs={0} />,
    )
    await user.type(combobox(), 'ada@example.com{Enter}')
    await user.type(combobox(), 'grace')
    await screen.findByRole('option', { name: 'Grace Hopper <grace@example.com>' })
    await expectNoA11yViolations(container)
  })
})
