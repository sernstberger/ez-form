import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createTheme, ThemeProvider } from '@mui/material/styles'
import { z } from 'zod'
import { Form } from '../Form'
import { SubmitButton } from '../SubmitButton'
import { TextField } from '../fields/TextField'
import { expectNoA11yViolations } from '../test/axe'
import { expectTargetSize } from '../test/targetSize'
import { FieldArray, fieldArrayClasses } from './FieldArray'
import { expectConsole } from '../test/expectConsole'

const schema = z.object({
  applicants: z.array(z.object({ name: z.string(), email: z.string() })),
})
type Values = z.infer<typeof schema>

const oneRow: Values = { applicants: [{ name: '', email: '' }] }

function Applicants({
  onSubmit = () => {},
  defaultValues = oneRow,
  ...props
}: {
  onSubmit?: (values: Values) => void
  defaultValues?: Values
} & Partial<React.ComponentProps<typeof FieldArray>>) {
  return (
    <Form schema={schema} defaultValues={defaultValues} onSubmit={onSubmit}>
      <FieldArray
        name="applicants"
        label="Applicants"
        emptyRow={() => ({ name: '', email: '' })}
        {...props}
      >
        {(row) => (
          <>
            <TextField name={row.name('name')} label="Name" />
            <TextField name={row.name('email')} label="Email" />
          </>
        )}
      </FieldArray>
      <SubmitButton />
    </Form>
  )
}

const rows = () => screen.getAllByRole('group', { name: /^Applicant \d+$/ })

// This array's own status region, not the <Form>'s submit-status live region —
// both are `role="status"`, so the role alone is ambiguous inside a form.
const statusRegion = () => document.querySelector<HTMLElement>(`.${fieldArrayClasses.status}`)!

describe('FieldArray', () => {
  it('renders the array as a named group with one named group per row', () => {
    render(<Applicants />)
    const array = screen.getByRole('group', { name: 'Applicants' })
    expect(array.tagName).toBe('FIELDSET')
    const row = within(array).getByRole('group', { name: 'Applicant 1' })
    expect(within(row).getByRole('textbox', { name: 'Name' })).toBeInTheDocument()
    expect(within(row).getByRole('textbox', { name: 'Email' })).toBeInTheDocument()
  })

  it('names the row fields by array path so values submit in order', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<Applicants onSubmit={onSubmit} />)
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Ada')
    await user.type(screen.getByRole('textbox', { name: 'Email' }), 'ada@example.com')
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        { applicants: [{ name: 'Ada', email: 'ada@example.com' }] },
        expect.anything(),
      ),
    )
  })

  it('Add appends a row and focuses its first field', async () => {
    const user = userEvent.setup()
    render(<Applicants />)
    await user.click(screen.getByRole('button', { name: 'Add' }))
    expect(rows()).toHaveLength(2)
    const second = screen.getByRole('group', { name: 'Applicant 2' })
    await waitFor(() => expect(within(second).getByRole('textbox', { name: 'Name' })).toHaveFocus())
  })

  it('focuses the appended row even when two Adds land in one batch', async () => {
    const user = userEvent.setup()
    render(<Applicants defaultValues={{ applicants: [] }} />)
    const add = screen.getByRole('button', { name: 'Add' })
    await user.click(add)
    await user.click(add)
    expect(rows()).toHaveLength(2)
    // Focus follows the row that was actually appended last, not an index read
    // from a stale render closure.
    const second = screen.getByRole('group', { name: 'Applicant 2' })
    await waitFor(() => expect(within(second).getByRole('textbox', { name: 'Name' })).toHaveFocus())
  })

  it('Remove drops the row and focuses the previous row first field', async () => {
    const user = userEvent.setup()
    render(
      <Applicants
        defaultValues={{
          applicants: [
            { name: 'A', email: '' },
            { name: 'B', email: '' },
          ],
        }}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Remove Applicant 2' }))
    expect(rows()).toHaveLength(1)
    const first = screen.getByRole('group', { name: 'Applicant 1' })
    await waitFor(() => expect(within(first).getByRole('textbox', { name: 'Name' })).toHaveFocus())
  })

  it('removing the first row focuses the Add button when no row precedes it', async () => {
    const user = userEvent.setup()
    render(<Applicants />)
    await user.click(screen.getByRole('button', { name: 'Remove Applicant 1' }))
    expect(screen.queryAllByRole('group', { name: /^Applicant \d+$/ })).toHaveLength(0)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add' })).toHaveFocus())
  })

  it('reorder moves a row, keeps the new order in the payload, and keeps focus on the Move button', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <Applicants
        reorder
        onSubmit={onSubmit}
        defaultValues={{
          applicants: [
            { name: 'A', email: 'a@x.com' },
            { name: 'B', email: 'b@x.com' },
          ],
        }}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Move Applicant 2 up' }))
    // B is now first; its Move-down button is the one that has focus (the row moved with it).
    const first = screen.getByRole('group', { name: 'Applicant 1' })
    expect(within(first).getByRole('textbox', { name: 'Name' })).toHaveValue('B')
    await waitFor(() =>
      expect(within(first).getByRole('button', { name: 'Move Applicant 1 down' })).toHaveFocus(),
    )
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        {
          applicants: [
            { name: 'B', email: 'b@x.com' },
            { name: 'A', email: 'a@x.com' },
          ],
        },
        expect.anything(),
      ),
    )
  })

  it('disables Move up on the first row and Move down on the last', () => {
    render(
      <Applicants
        reorder
        defaultValues={{
          applicants: [
            { name: 'A', email: '' },
            { name: 'B', email: '' },
          ],
        }}
      />,
    )
    expect(screen.getByRole('button', { name: 'Move Applicant 1 up' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Move Applicant 1 down' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Move Applicant 2 up' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Move Applicant 2 down' })).toBeDisabled()
  })

  it('announces add, remove and move in a status region', async () => {
    const user = userEvent.setup()
    render(<Applicants reorder />)
    // Re-queried each time on purpose: each announcement mounts a fresh status
    // node (see the repeat test below), so a held reference would go stale.
    const status = statusRegion
    expect(status()).toBeEmptyDOMElement()
    await user.click(screen.getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(status()).toHaveTextContent('Row 2 added'))
    await user.click(screen.getByRole('button', { name: 'Move Applicant 2 up' }))
    await waitFor(() => expect(status()).toHaveTextContent('Row 1 moved up'))
    await user.click(screen.getByRole('button', { name: 'Remove Applicant 2' }))
    await waitFor(() => expect(status()).toHaveTextContent('Row 2 removed'))
  })

  it('re-announces an identical repeated action (the status node is replaced)', async () => {
    const user = userEvent.setup()
    render(
      <Applicants
        defaultValues={{
          applicants: [
            { name: 'A', email: '' },
            { name: 'B', email: '' },
            { name: 'C', email: '' },
          ],
        }}
      />,
    )
    // Removing "row 2" twice produces the same message both times. A live region
    // only re-announces if its content actually changes, so the component must
    // mount a fresh status node rather than re-render the same one with the same
    // text — otherwise the second removal is silent to assistive tech.
    const announcements: string[] = []
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node instanceof HTMLElement && node.classList.contains(fieldArrayClasses.status)) {
            announcements.push(node.textContent ?? '')
          }
        }
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })

    await user.click(screen.getByRole('button', { name: 'Remove Applicant 2' }))
    await waitFor(() => expect(statusRegion()).toHaveTextContent('Row 2 removed'))
    const first = statusRegion()
    await user.click(screen.getByRole('button', { name: 'Remove Applicant 2' }))
    await waitFor(() => expect(statusRegion()).toHaveTextContent('Row 2 removed'))
    const second = statusRegion()
    observer.disconnect()

    expect(second).not.toBe(first)
    expect(announcements.filter((text) => text === 'Row 2 removed')).toHaveLength(2)
  })

  it('re-announces a repeated Add', async () => {
    const user = userEvent.setup()
    render(<Applicants defaultValues={{ applicants: [] }} />)
    const add = screen.getByRole('button', { name: 'Add' })
    await user.click(add)
    await waitFor(() => expect(statusRegion()).toHaveTextContent('Row 1 added'))
    const first = statusRegion()
    // A different message, but the node must still be a new one each time.
    await user.click(add)
    await waitFor(() => expect(statusRegion()).toHaveTextContent('Row 2 added'))
    expect(statusRegion()).not.toBe(first)
  })

  it('minRows disables Remove at the floor; maxRows disables Add at the ceiling', async () => {
    const user = userEvent.setup()
    render(<Applicants minRows={1} maxRows={2} />)
    expect(screen.getByRole('button', { name: 'Remove Applicant 1' })).toBeDisabled()
    const add = screen.getByRole('button', { name: 'Add' })
    expect(add).toBeEnabled()
    await user.click(add)
    expect(rows()).toHaveLength(2)
    expect(add).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Remove Applicant 1' })).toBeEnabled()
  })

  it('an array-level zod .min(1) error appears under Add as an alert after submit', async () => {
    const user = userEvent.setup()
    const minSchema = z.object({
      applicants: z
        .array(z.object({ name: z.string(), email: z.string() }))
        .min(1, 'Add at least one applicant'),
    })
    render(
      <Form schema={minSchema} defaultValues={{ applicants: [] }} onSubmit={() => {}}>
        <FieldArray name="applicants" label="Applicants" emptyRow={() => ({ name: '', email: '' })}>
          {(row) => <TextField name={row.name('name')} label="Name" />}
        </FieldArray>
        <SubmitButton />
      </Form>,
    )
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Add at least one applicant')
    expect(alert).toHaveClass(fieldArrayClasses.errorText)
  })

  it('a per-row field error stays on that row field, not on the array', async () => {
    const user = userEvent.setup()
    const rowSchema = z.object({
      applicants: z.array(z.object({ name: z.string().min(1, 'Name is required') })),
    })
    render(
      <Form
        schema={rowSchema}
        defaultValues={{ applicants: [{ name: '' }, { name: 'ok' }] }}
        onSubmit={() => {}}
      >
        <FieldArray name="applicants" label="Applicants" emptyRow={() => ({ name: '' })}>
          {(row) => <TextField name={row.name('name')} label="Name" />}
        </FieldArray>
        <SubmitButton />
      </Form>,
    )
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    const firstRow = await screen.findByRole('group', { name: 'Applicant 1' })
    await waitFor(() =>
      expect(within(firstRow).getByRole('textbox', { name: 'Name' })).toHaveAccessibleDescription(
        'Name is required',
      ),
    )
    const secondRow = screen.getByRole('group', { name: 'Applicant 2' })
    expect(within(secondRow).getByRole('textbox', { name: 'Name' })).toHaveAccessibleDescription('')
    // The array root is not the place a row error lands.
    const array = screen.getByRole('group', { name: 'Applicants' })
    expect(array.querySelector(`.${fieldArrayClasses.errorText}`)).toBeNull()
  })

  it('keys stay stable across a remove: typed values follow their own rows', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <Applicants
        onSubmit={onSubmit}
        defaultValues={{
          applicants: [
            { name: '', email: '' },
            { name: '', email: '' },
            { name: '', email: '' },
          ],
        }}
      />,
    )
    const names = () => screen.getAllByRole('textbox', { name: 'Name' })
    const nameAt = (index: number) => {
      const input = names()[index]
      if (!input) throw new Error(`no Name field at row ${index}`)
      return input
    }
    await user.type(nameAt(0), 'A')
    await user.type(nameAt(1), 'B')
    await user.type(nameAt(2), 'C')
    await user.click(screen.getByRole('button', { name: 'Remove Applicant 2' }))
    expect(names()).toHaveLength(2)
    expect(nameAt(0)).toHaveValue('A')
    expect(nameAt(1)).toHaveValue('C')
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        {
          applicants: [
            { name: 'A', email: '' },
            { name: 'C', email: '' },
          ],
        },
        expect.anything(),
      ),
    )
  })

  it('singular and rowLabel name the rows', () => {
    render(<Applicants singular="Co-applicant" />)
    expect(screen.getByRole('group', { name: 'Co-applicant 1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove Co-applicant 1' })).toBeInTheDocument()
  })

  it('rowLabel overrides the derived row name everywhere it is used', () => {
    render(<Applicants rowLabel={(index) => `Person ${String.fromCharCode(65 + index)}`} />)
    expect(screen.getByRole('group', { name: 'Person A' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove Person A' })).toBeInTheDocument()
  })

  it('addLabel and removeLabel replace the button text', () => {
    render(<Applicants addLabel="Add applicant" removeLabel="Delete" />)
    expect(screen.getByRole('button', { name: 'Add applicant' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove Applicant 1' })).toHaveTextContent('Delete')
  })

  it('every interactive control meets the 24px minimum target size', () => {
    render(<Applicants reorder />)
    expectTargetSize(screen.getByRole('button', { name: 'Move Applicant 1 up' }))
    expectTargetSize(screen.getByRole('button', { name: 'Move Applicant 1 down' }))
  })

  it('theme styleOverrides reach every slot', () => {
    const theme = createTheme({
      components: {
        EzFieldArray: {
          styleOverrides: {
            root: { letterSpacing: '1px' },
            row: { letterSpacing: '2px' },
            actions: { letterSpacing: '3px' },
            add: { letterSpacing: '4px' },
            remove: { letterSpacing: '5px' },
            move: { letterSpacing: '6px' },
            status: { letterSpacing: '7px' },
          },
        },
      },
    })
    const { container } = render(
      <ThemeProvider theme={theme}>
        <Applicants reorder />
      </ThemeProvider>,
    )
    const spacing = (selector: string) =>
      getComputedStyle(container.querySelector(selector)!).letterSpacing
    expect(spacing(`.${fieldArrayClasses.root}`)).toBe('1px')
    expect(spacing(`.${fieldArrayClasses.row}`)).toBe('2px')
    expect(spacing(`.${fieldArrayClasses.actions}`)).toBe('3px')
    expect(spacing(`.${fieldArrayClasses.add}`)).toBe('4px')
    expect(spacing(`.${fieldArrayClasses.remove}`)).toBe('5px')
    expect(spacing(`.${fieldArrayClasses.move}`)).toBe('6px')
    expect(spacing(`.${fieldArrayClasses.status}`)).toBe('7px')
  })

  it('theme defaultProps reach the component', () => {
    const theme = createTheme({
      components: { EzFieldArray: { defaultProps: { addLabel: 'Add another' } } },
    })
    render(
      <ThemeProvider theme={theme}>
        <Applicants />
      </ThemeProvider>,
    )
    expect(screen.getByRole('button', { name: 'Add another' })).toBeInTheDocument()
  })

  it('throws a clear error outside <Form>', () => {
    // React logs every error it caught while rendering before rethrowing it. The `toThrow`
    // below is the assertion; these allow the noise that necessarily comes with it.
    expectConsole('error', 'must be rendered inside <Form>')
    expectConsole('error', 'The above error occurred')
    expect(() =>
      render(
        <FieldArray name="applicants" label="Applicants" emptyRow={() => ({})}>
          {() => null}
        </FieldArray>,
      ),
    ).toThrow('ez-form: <FieldArray> must be rendered inside <Form>')
  })

  it('has no a11y violations', async () => {
    const { container } = render(<Applicants reorder />)
    await expectNoA11yViolations(container)
  })

  it('has no a11y violations with an array-level error showing', async () => {
    const user = userEvent.setup()
    const minSchema = z.object({
      applicants: z.array(z.object({ name: z.string() })).min(1, 'Add at least one applicant'),
    })
    const { container } = render(
      <Form schema={minSchema} defaultValues={{ applicants: [] }} onSubmit={() => {}}>
        <FieldArray name="applicants" label="Applicants" emptyRow={() => ({ name: '' })}>
          {(row) => <TextField name={row.name('name')} label="Name" />}
        </FieldArray>
        <SubmitButton />
      </Form>,
    )
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    await screen.findByRole('alert')
    await expectNoA11yViolations(container)
  })
})
