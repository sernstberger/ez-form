import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createTheme, ThemeProvider } from '@mui/material/styles'
import { z } from 'zod'
import { Form } from '../Form'
import { SubmitButton } from '../SubmitButton'
import { TextField } from '../fields/TextField'
import { expectNoA11yViolations } from '../test/axe'
import { expectTargetSize } from '../test/targetSize'
import { FieldArray, fieldArrayClasses, type FieldArrayColumn } from './FieldArray'
import { NumberField } from '../fields/NumberField'
import { Select } from '../fields/Select'
import { DatePicker } from '../fields/DatePicker'
import { RadioGroup } from '../fields/RadioGroup'
import { AddressField, addressSchema } from '../fields/AddressField'
import { fieldLayoutClasses } from '../fields/LabelPlacementContext'
import { withPickers } from '../test/pickers'
import { expectConsole } from '../test/expectConsole'

const schema = z.object({
  applicants: z.array(z.object({ name: z.string(), email: z.string() })),
})
type Values = z.infer<typeof schema>

const oneRow: Values = { applicants: [{ name: '', email: '' }] }

function Applicants({
  onSubmit = () => {},
  defaultValues = oneRow,
  // Overridable so the focus-after-failed-submit cases can mark the parts `required`
  // without every other case paying for the errors that produces.
  children = (row) => (
    <>
      <TextField name={row.name('name')} label="Name" />
      <TextField name={row.name('email')} label="Email" />
    </>
  ),
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
        {children}
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

  /*
   * The FieldArray half of #102 row 5. The rest of that line rides on
   * `describeFieldContract`, which runs one field at a time and so cannot ask this:
   * whether hookform's `shouldFocusError` can reach a control registered under an
   * *indexed* path (`applicants.1.name`) rather than a flat one. #122 named it a
   * suspected failure; it is not one, and this pins that.
   *
   * The second case is the one that would catch a real regression — a row-1-shaped
   * search, or a `ref` keyed by field name rather than by path, would land on the wrong
   * row's input while still passing the first case.
   */
  const RequiredApplicants = (props: React.ComponentProps<typeof Applicants>) => (
    <Applicants
      {...props}
      children={(row) => (
        <>
          <TextField name={row.name('name')} label="Name" required />
          <TextField name={row.name('email')} label="Email" required />
        </>
      )}
    />
  )

  it('focuses the first invalid row field after a failed submit', async () => {
    const user = userEvent.setup()
    render(
      <RequiredApplicants
        defaultValues={{
          applicants: [
            { name: '', email: '' },
            { name: '', email: '' },
          ],
        }}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    await screen.findAllByRole('alert')
    await waitFor(() =>
      expect(within(rows()[0]!).getByRole('textbox', { name: /^Name/ })).toHaveFocus(),
    )
  })

  it('focuses a later row when the earlier rows are valid', async () => {
    const user = userEvent.setup()
    render(
      <RequiredApplicants
        defaultValues={{
          applicants: [
            { name: 'Ada', email: 'ada@example.com' },
            { name: '', email: '' },
          ],
        }}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    await screen.findAllByRole('alert')
    await waitFor(() =>
      expect(within(rows()[1]!).getByRole('textbox', { name: /^Name/ })).toHaveFocus(),
    )
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

  // These three land two actions in a single React batch (`fireEvent` inside one
  // `act`, no re-render between), so both handlers run against the *same*
  // render closure. A count read from that closure's `fields.length` is stale
  // for the second action; the announcement must come from the updated array.
  it('announces the post-update count when two Adds land in one batch', async () => {
    render(<Applicants />)
    const add = screen.getByRole('button', { name: 'Add' })
    act(() => {
      fireEvent.click(add)
      fireEvent.click(add)
    })
    expect(rows()).toHaveLength(3)
    await waitFor(() => expect(statusRegion()).toHaveTextContent('Row 3 added'))
  })

  it('announces the post-update count for a Remove then an Add in one batch', async () => {
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
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Remove Applicant 1' }))
      fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    })
    expect(rows()).toHaveLength(2)
    // Two rows, so the appended one is row 2 — not "Row 3", the closure's `length + 1`.
    await waitFor(() => expect(statusRegion()).toHaveTextContent('Row 2 added'))
  })

  it('announces the removed row for an Add then a Remove in one batch', async () => {
    render(<Applicants />)
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Add' }))
      fireEvent.click(screen.getByRole('button', { name: 'Remove Applicant 1' }))
    })
    expect(rows()).toHaveLength(1)
    await waitFor(() => expect(statusRegion()).toHaveTextContent('Row 1 removed'))
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

  /**
   * `layout="table"` (#14). The cell-mode contract itself (hidden label, headers as the
   * name, helper text as the description) is `useEzField`'s and is pinned in
   * `labelPlacement.test.tsx`; what is asserted here is the table: its markup, its
   * naming, its density, its slots, and that Add/Remove/Move behave as in stacked rows.
   */
  describe('layout="table"', () => {
    const lineSchema = z.object({
      lines: z.array(
        z.object({
          sku: z.string().min(1, 'SKU is required'),
          qty: z.number().min(1, 'Qty must be at least 1'),
          category: z.string(),
          due: z.date().nullable(),
        }),
      ),
    })
    type Line = z.infer<typeof lineSchema>['lines'][number]
    const line = (sku = '', qty = 1): Line => ({ sku, qty, category: '', due: null })

    const columns: FieldArrayColumn<Line>[] = [
      {
        key: 'sku',
        header: 'SKU',
        render: (row) => <TextField name={row.name('sku')} label="SKU" />,
      },
      {
        key: 'qty',
        header: 'Qty',
        width: '6rem',
        align: 'right',
        render: (row) => <NumberField name={row.name('qty')} label="Qty" />,
      },
      {
        key: 'category',
        header: 'Category',
        render: (row) => (
          <Select
            name={row.name('category')}
            label="Category"
            options={[
              { value: 'a', label: 'A' },
              { value: 'b', label: 'B' },
            ]}
          />
        ),
      },
      {
        key: 'due',
        header: 'Due',
        render: (row) => <DatePicker name={row.name('due')} label="Due" />,
      },
    ]

    function Lines({
      rows = [line()],
      onSubmit = () => {},
      ...props
    }: { rows?: Line[]; onSubmit?: (values: unknown) => void } & Partial<
      React.ComponentProps<typeof FieldArray<Line>>
    >) {
      return withPickers(
        <Form schema={lineSchema} defaultValues={{ lines: rows }} onSubmit={onSubmit}>
          <FieldArray<Line>
            name="lines"
            label="Line items"
            layout="table"
            columns={columns}
            emptyRow={() => line()}
            {...props}
          />
          <SubmitButton />
        </Form>,
      )
    }

    const cellControl = (row: number, header: string) =>
      screen.getByRole(
        header === 'Category' ? 'combobox' : header === 'Due' ? 'group' : 'textbox',
        {
          name: `Line item ${row} ${header}`,
        },
      )

    it('renders one table named by the legend, headers from columns, a hidden row header per row', () => {
      render(<Lines rows={[line('A'), line('B')]} />)
      const table = screen.getByRole('table', { name: 'Line items' })
      const headers = within(table).getAllByRole('columnheader')
      expect(headers.map((h) => h.textContent)).toEqual([
        'Line item',
        'SKU',
        'Qty',
        'Category',
        'Due',
        'Actions',
      ])
      // The row-name column header and the actions header text are out of sight, not gone.
      expect(getComputedStyle(headers[0]!).position).toBe('absolute')
      const actionsText = within(headers[5]!).getByText('Actions')
      expect(getComputedStyle(actionsText).position).toBe('absolute')
      // `scope` on both axes, and every data cell points at its column.
      expect(headers[1]).toHaveAttribute('scope', 'col')
      const rowHeaders = within(table).getAllByRole('rowheader')
      expect(rowHeaders.map((h) => h.textContent)).toEqual(['Line item 1', 'Line item 2'])
      expect(rowHeaders[0]).toHaveAttribute('scope', 'row')
      expect(getComputedStyle(rowHeaders[0]!).position).toBe('absolute')
      const skuCell = cellControl(2, 'SKU').closest('td')!
      expect(skuCell).toHaveAttribute('headers', headers[1]!.id)
      // Column `width`/`align` land on the cells as props.
      expect(headers[2]!.style.width).toBe('6rem')
      expect(headers[2]).toHaveClass('MuiTableCell-alignRight')
      expect(cellControl(1, 'Qty').closest('td')).toHaveClass('MuiTableCell-alignRight')
      // No stacked row groups in this layout.
      expect(screen.queryByRole('group', { name: /^Line item \d+$/ })).toBeNull()
    })

    it('names every cell control "<row> <header>" across the field families', () => {
      render(<Lines rows={[line(), line()]} />)
      for (const row of [1, 2]) {
        for (const header of ['SKU', 'Qty', 'Category', 'Due']) {
          expect(cellControl(row, header)).toBeInTheDocument()
        }
      }
      expect(cellControl(2, 'SKU').closest('.MuiFormControl-root')).toHaveClass(
        fieldLayoutClasses.cell,
        fieldLayoutClasses.cellHelperHidden,
      )
      // `slotProps.rowHeader.visuallyHidden: false` shows the row names as a first column.
      cleanupAndRender(<Lines slotProps={{ rowHeader: { visuallyHidden: false } }} />)
      expect(getComputedStyle(screen.getByRole('rowheader')).position).not.toBe('absolute')
    })

    it('Remove and Move live in the actions column with the same names, Add sits under the table', async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn()
      render(<Lines reorder rows={[line('A'), line('B')]} onSubmit={onSubmit} />)
      const table = screen.getByRole('table', { name: 'Line items' })
      const remove = within(table).getByRole('button', { name: 'Remove Line item 2' })
      expect(remove.closest('td')).toHaveClass(fieldArrayClasses.actionsCell)
      expect(within(table).getByRole('button', { name: 'Move Line item 2 up' })).toBeInTheDocument()
      const add = screen.getByRole('button', { name: 'Add' })
      expect(table.contains(add)).toBe(false)
      // Move keeps the payload order; Remove drops the row and focuses the previous row's
      // first control — the stacked rules, unchanged.
      await user.click(screen.getByRole('button', { name: 'Move Line item 2 up' }))
      expect(cellControl(1, 'SKU')).toHaveValue('B')
      await user.click(screen.getByRole('button', { name: 'Remove Line item 2' }))
      expect(screen.getAllByRole('rowheader')).toHaveLength(1)
      await waitFor(() => expect(cellControl(1, 'SKU')).toHaveFocus())
      await user.click(add)
      expect(screen.getAllByRole('rowheader')).toHaveLength(2)
      await waitFor(() => expect(cellControl(2, 'SKU')).toHaveFocus())
      await waitFor(() => expect(statusRegion()).toHaveTextContent('Row 2 added'))
    })

    it('cells are dense by default; the table size drives it and an explicit field size wins', () => {
      render(
        <Lines
          columns={[
            ...columns.slice(0, 1),
            {
              key: 'qty',
              header: 'Qty',
              render: (row) => <NumberField name={row.name('qty')} label="Qty" size="medium" />,
            },
          ]}
        />,
      )
      expect(screen.getAllByRole('columnheader')[1]).toHaveClass('MuiTableCell-sizeSmall')
      expect(cellControl(1, 'SKU').closest('.MuiInputBase-root')).toHaveClass(
        'MuiInputBase-sizeSmall',
      )
      expect(cellControl(1, 'Qty').closest('.MuiInputBase-root')).not.toHaveClass(
        'MuiInputBase-sizeSmall',
      )
      cleanupAndRender(<Lines slotProps={{ table: { size: 'medium' } }} />)
      expect(screen.getAllByRole('columnheader')[1]).toHaveClass('MuiTableCell-sizeMedium')
      expect(cellControl(1, 'SKU').closest('.MuiInputBase-root')).not.toHaveClass(
        'MuiInputBase-sizeSmall',
      )
      // A field *outside* the table is untouched by the nested theme.
      cleanupAndRender(
        withPickers(
          <Form schema={lineSchema} defaultValues={{ lines: [line()] }} onSubmit={() => {}}>
            <TextField name="lines.0.sku" label="Outside" />
            <FieldArray<Line>
              name="lines"
              label="Line items"
              layout="table"
              columns={columns}
              emptyRow={line}
            />
          </Form>,
        ),
      )
      expect(
        screen.getByRole('textbox', { name: 'Outside' }).closest('.MuiInputBase-root'),
      ).not.toHaveClass('MuiInputBase-sizeSmall')
    })

    it("a cell error is the control's hidden description under summary and visible under inline", async () => {
      const user = userEvent.setup()
      render(<Lines rows={[line('', 0)]} />)
      await user.click(screen.getByRole('button', { name: 'Submit' }))
      await screen.findAllByRole('alert')
      const sku = cellControl(1, 'SKU')
      expect(sku).toHaveAttribute('aria-invalid', 'true')
      expect(sku).toHaveAccessibleDescription('SKU is required')
      const helper = sku.closest('.MuiFormControl-root')!.querySelector('.MuiFormHelperText-root')!
      expect(getComputedStyle(helper).position).toBe('absolute')

      cleanupAndRender(<Lines rows={[line('', 0)]} cellErrors="inline" />)
      await user.click(screen.getByRole('button', { name: 'Submit' }))
      await screen.findAllByRole('alert')
      const inlineSku = cellControl(1, 'SKU')
      expect(inlineSku).toHaveAccessibleDescription('SKU is required')
      const shown = inlineSku
        .closest('.MuiFormControl-root')!
        .querySelector('.MuiFormHelperText-root')!
      expect(getComputedStyle(shown).position).not.toBe('absolute')
      expect(inlineSku.closest('.MuiFormControl-root')).not.toHaveClass(
        fieldLayoutClasses.cellHelperHidden,
      )
    })

    it('an array-level error still renders under Add', async () => {
      const user = userEvent.setup()
      const minSchema = lineSchema.extend({
        lines: lineSchema.shape.lines.min(1, 'Add at least one line'),
      })
      render(
        <Form schema={minSchema} defaultValues={{ lines: [] }} onSubmit={() => {}}>
          <FieldArray<Line>
            name="lines"
            label="Line items"
            layout="table"
            columns={columns.slice(0, 1)}
            emptyRow={line}
          />
          <SubmitButton />
        </Form>,
      )
      await user.click(screen.getByRole('button', { name: 'Submit' }))
      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent('Add at least one line')
      expect(alert).toHaveClass(fieldArrayClasses.errorText)
    })

    it('theme styleOverrides reach every table slot', () => {
      const theme = createTheme({
        components: {
          EzFieldArray: {
            styleOverrides: {
              tableContainer: { letterSpacing: '1px' },
              table: { letterSpacing: '2px' },
              tableHead: { letterSpacing: '3px' },
              tableRow: { letterSpacing: '4px' },
              cell: { letterSpacing: '5px' },
              rowHeader: { letterSpacing: '6px' },
              actionsCell: { letterSpacing: '7px' },
              actionsHeaderText: { letterSpacing: '8px' },
            },
          },
        },
      })
      const { container } = render(
        <ThemeProvider theme={theme}>
          <Lines />
        </ThemeProvider>,
      )
      const spacing = (selector: string) =>
        getComputedStyle(container.querySelector(selector)!).letterSpacing
      expect(spacing(`.${fieldArrayClasses.tableContainer}`)).toBe('1px')
      expect(spacing(`.${fieldArrayClasses.table}`)).toBe('2px')
      expect(spacing(`.${fieldArrayClasses.tableHead}`)).toBe('3px')
      expect(spacing(`.${fieldArrayClasses.tableRow}`)).toBe('4px')
      expect(spacing(`.${fieldArrayClasses.cell}`)).toBe('5px')
      expect(spacing(`.${fieldArrayClasses.rowHeader}`)).toBe('6px')
      expect(spacing(`.${fieldArrayClasses.actionsCell}`)).toBe('7px')
      expect(spacing(`.${fieldArrayClasses.actionsHeaderText}`)).toBe('8px')
    })

    it('actionsHeader is a theme-settable default (a locale string)', () => {
      const theme = createTheme({
        components: { EzFieldArray: { defaultProps: { actionsHeader: 'Acciones' } } },
      })
      render(
        <ThemeProvider theme={theme}>
          <Lines />
        </ThemeProvider>,
      )
      expect(screen.getByRole('columnheader', { name: 'Acciones' })).toBeInTheDocument()
    })

    it('warns in dev when the render prop does not match the layout', () => {
      expectConsole('warn', 'renders through `columns`, which is missing')
      render(
        <Form schema={lineSchema} defaultValues={{ lines: [] }} onSubmit={() => {}}>
          <FieldArray<Line> name="lines" label="Line items" layout="table" emptyRow={line} />
        </Form>,
      )
    })

    /*
     * The keyboard model (spec §4). `onSubmit` is the tell for "Enter submitted": every row
     * here is valid, so a submit that got through would reach it.
     */
    describe('keyboard', () => {
      it('Enter moves to the same column in the next row and never submits', async () => {
        const user = userEvent.setup()
        const onSubmit = vi.fn()
        render(<Lines rows={[line('A'), line('B')]} onSubmit={onSubmit} />)
        await user.click(cellControl(1, 'Qty'))
        await user.keyboard('{Enter}')
        await waitFor(() => expect(cellControl(2, 'Qty')).toHaveFocus())
        // Also from a Select cell: Enter on a *closed* Select opens its menu (MUI prevents
        // it), so the table leaves it alone — no row change, no submit. Focused, not
        // clicked: a click opens the menu on mousedown already. The open menu is a Modal
        // that hides the rest of the page from the a11y tree, so the row check waits for it
        // to close.
        const category = cellControl(1, 'Category')
        // `act`: focusing flips `FormControl`'s focused state, a React update.
        act(() => category.focus())
        await user.keyboard('{Enter}')
        expect(await screen.findByRole('listbox')).toBeInTheDocument()
        await user.keyboard('{Escape}')
        await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull())
        expect(category).toHaveFocus()
        expect(onSubmit).not.toHaveBeenCalled()
      })

      it('Enter on the last row appends a row and lands in the same column; at maxRows it stays', async () => {
        const user = userEvent.setup()
        const onSubmit = vi.fn()
        render(<Lines rows={[line('A')]} maxRows={2} onSubmit={onSubmit} />)
        await user.click(cellControl(1, 'Qty'))
        await user.keyboard('{Enter}')
        await waitFor(() => expect(screen.getAllByRole('rowheader')).toHaveLength(2))
        await waitFor(() => expect(cellControl(2, 'Qty')).toHaveFocus())
        await waitFor(() => expect(statusRegion()).toHaveTextContent('Row 2 added'))
        // At the cap: nothing appends, focus stays, and still no submit.
        await user.keyboard('{Enter}')
        expect(screen.getAllByRole('rowheader')).toHaveLength(2)
        expect(cellControl(2, 'Qty')).toHaveFocus()
        expect(onSubmit).not.toHaveBeenCalled()
      })

      it("Enter in a picker cell does not submit either (MUI X's own requestSubmit is disarmed)", async () => {
        const user = userEvent.setup()
        const onSubmit = vi.fn()
        render(<Lines rows={[line('A'), line('B')]} onSubmit={onSubmit} />)
        // MUI X's `PickersInputBase` calls `form.requestSubmit(submitButton)` on Enter when
        // the form has a submit button — this form does — guarded only by
        // `defaultMuiPrevented` — which it checks *after* the consumer's `onKeyDown`, so
        // `usePickerField` sets it there (`preventMuiDefault`) when the picker is in a cell.
        await user.click(cellControl(1, 'Due'))
        await user.keyboard('{Enter}')
        await waitFor(() =>
          expect(cellControl(2, 'Due').contains(document.activeElement)).toBe(true),
        )
        expect(onSubmit).not.toHaveBeenCalled()
      })

      it('ArrowDown / ArrowUp move rows in the same column, without wrapping', async () => {
        const user = userEvent.setup()
        render(<Lines rows={[line('A'), line('B')]} />)
        await user.click(cellControl(1, 'SKU'))
        // Top row: ArrowUp has nowhere to go and is left to the control.
        await user.keyboard('{ArrowUp}')
        expect(cellControl(1, 'SKU')).toHaveFocus()
        await user.keyboard('{ArrowDown}')
        await waitFor(() => expect(cellControl(2, 'SKU')).toHaveFocus())
        // Bottom row: ArrowDown does not wrap.
        await user.keyboard('{ArrowDown}')
        expect(cellControl(2, 'SKU')).toHaveFocus()
        await user.keyboard('{ArrowUp}')
        await waitFor(() => expect(cellControl(1, 'SKU')).toHaveFocus())
      })

      it('ArrowDown on a closed Select opens its menu — MUI consumed the key, so the row stays', async () => {
        const user = userEvent.setup()
        render(<Lines rows={[line('A'), line('B')]} />)
        const category = cellControl(1, 'Category')
        // `act`: focusing flips `FormControl`'s focused state, a React update.
        act(() => category.focus())
        await user.keyboard('{ArrowDown}')
        // Measured: `SelectInput`'s `handleKeyDown` treats ArrowDown as an open key and
        // `preventDefault`s it, which is exactly the signal `isPlainKey` defers to. This is
        // the exclusion working, not a gap.
        expect(await screen.findByRole('listbox')).toBeInTheDocument()
        await user.keyboard('{Escape}')
        await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull())
        expect(category).toHaveFocus()
      })

      it('ArrowDown / ArrowUp in a RadioGroup cell stay with the radios (F1)', async () => {
        const user = userEvent.setup()
        const radioSchema = z.object({
          lines: z.array(z.object({ sku: z.string(), size: z.string() })),
        })
        render(
          <Form
            schema={radioSchema}
            defaultValues={{
              lines: [
                { sku: 'A', size: 's' },
                { sku: 'B', size: 's' },
              ],
            }}
            onSubmit={() => {}}
          >
            <FieldArray
              name="lines"
              label="Line items"
              layout="table"
              emptyRow={{ sku: '', size: '' }}
              columns={[
                {
                  key: 'sku',
                  header: 'SKU',
                  render: (row) => <TextField name={row.name('sku')} label="SKU" />,
                },
                {
                  key: 'size',
                  header: 'Size',
                  render: (row) => (
                    <RadioGroup
                      name={row.name('size')}
                      label="Size"
                      options={[
                        { value: 's', label: 'S' },
                        { value: 'm', label: 'M' },
                      ]}
                    />
                  ),
                },
              ]}
            />
          </Form>,
        )
        const rows = screen.getAllByRole('row').slice(1)
        const firstRadio = within(rows[0]!).getByRole('radio', { name: 'S' })
        act(() => firstRadio.focus())
        await user.keyboard('{ArrowDown}')
        // A radio's arrows are the browser's own (MUI installs no handler, nothing is
        // prevented), so the table must not treat them as a row move: focus stays in row 1.
        expect(rows[0]!.contains(document.activeElement)).toBe(true)
        expect(rows[1]!.contains(document.activeElement)).toBe(false)
      })

      it("keys in the actions column are the buttons' own", async () => {
        const user = userEvent.setup()
        const onSubmit = vi.fn()
        render(<Lines rows={[line('A'), line('B')]} onSubmit={onSubmit} />)
        screen.getByRole('button', { name: 'Remove Line item 2' }).focus()
        await user.keyboard('{Enter}')
        // Enter on a button is a click: the row is removed, nothing else moves.
        await waitFor(() => expect(screen.getAllByRole('rowheader')).toHaveLength(1))
        expect(onSubmit).not.toHaveBeenCalled()
      })
    })

    it('a composite (AddressField) in a cell keeps its own part labels and takes no cell class (F2)', () => {
      const schema = z.object({
        lines: z.array(z.object({ sku: z.string(), ship: addressSchema() })),
      })
      const address = { street: '', street2: '', city: '', state: '', zip: '' }
      const { container } = render(
        <Form
          schema={schema}
          defaultValues={{ lines: [{ sku: 'A', ship: address }] }}
          onSubmit={() => {}}
        >
          <FieldArray
            name="lines"
            label="Line items"
            layout="table"
            emptyRow={{ sku: '', ship: address }}
            columns={[
              {
                key: 'sku',
                header: 'SKU',
                render: (row) => <TextField name={row.name('sku')} label="SKU" />,
              },
              {
                key: 'ship',
                header: 'Ship to',
                render: (row) => <AddressField name={row.name('ship')} />,
              },
            ]}
          />
        </Form>,
      )
      // The single-control cell is named by the table; the composite's parts are not.
      expect(screen.getByRole('textbox', { name: 'Line item 1 SKU' })).toBeInTheDocument()
      expect(screen.getByRole('textbox', { name: 'Street address' })).toBeInTheDocument()
      expect(screen.getByRole('textbox', { name: 'City' })).toBeInTheDocument()
      expect(screen.queryByRole('textbox', { name: /Line item 1 Ship to/ })).toBeNull()
      // Exactly the SKU box carries the cell class — none of the address's five.
      expect(container.querySelectorAll(`.${fieldLayoutClasses.cell}`)).toHaveLength(1)
    })

    it.each(['summary', 'inline'] as const)(
      'has no a11y violations at rest and in error (cellErrors=%s)',
      async (cellErrors) => {
        const user = userEvent.setup()
        const { container } = render(
          <Lines reorder rows={[line('', 0), line('B')]} cellErrors={cellErrors} />,
        )
        await expectNoA11yViolations(container)
        await user.click(screen.getByRole('button', { name: 'Submit' }))
        await screen.findAllByRole('alert')
        await expectNoA11yViolations(container)
      },
    )
  })
})

/** Unmount whatever is rendered and render the next tree — for cases that compare two setups. */
function cleanupAndRender(ui: React.ReactElement) {
  cleanup()
  return render(ui)
}
