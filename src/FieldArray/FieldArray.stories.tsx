import Stack from '@mui/material/Stack'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { z } from 'zod'
import type { FormParameters } from '../../.storybook/preview'
import { TextField } from '../fields/TextField'
import { NumberField } from '../fields/NumberField'
import { MoneyField } from '../fields/MoneyField'
import { Select } from '../fields/Select'
import { DatePicker } from '../fields/DatePicker'
import { FieldArray, type FieldArrayColumn, type FieldArrayRow } from './FieldArray'

const applicant = z.object({ name: z.string(), email: z.string() })
const schema = z.object({ applicants: z.array(applicant) })

const rowFields = (row: FieldArrayRow) => (
  <Stack spacing={2}>
    <TextField name={row.name('name')} label="Name" />
    <TextField name={row.name('email')} label="Email" />
  </Stack>
)

const meta = {
  title: 'FieldArray',
  component: FieldArray,
  args: {
    name: 'applicants',
    label: 'Co-applicants',
    emptyRow: () => ({ name: '', email: '' }),
    addLabel: 'Add co-applicant',
    children: rowFields,
  },
  parameters: {
    form: {
      schema,
      defaultValues: { applicants: [{ name: '', email: '' }] },
    },
  } satisfies FormParameters,
  // The row type is left open (`Record<string, unknown>`), not inferred from the meta's
  // `emptyRow`, so the `Table` story below can carry a different row shape.
} satisfies Meta<typeof FieldArray<Record<string, unknown>>>
export default meta
// Over the *widened* meta type rather than `typeof meta`: an object literal's inferred
// type keeps `emptyRow`'s row shape, which would type every story's `columns` and
// `emptyRow` against the co-applicant rows.
type Story = StoryObj<Meta<typeof FieldArray<Record<string, unknown>>>>

export const Default: Story = {}

/** `reorder` adds Move up / Move down to every row, disabled at the ends. */
export const Reorder: Story = {
  args: { reorder: true },
  parameters: {
    form: {
      defaultValues: {
        applicants: [
          { name: 'Ada Lovelace', email: 'ada@example.com' },
          { name: 'Grace Hopper', email: 'grace@example.com' },
        ],
      },
    },
  } satisfies FormParameters,
}

/**
 * `minRows` keeps at least one row (Remove disabled at the floor) and
 * `maxRows` caps the list (Add disabled at the ceiling).
 */
export const MinMax: Story = {
  args: { minRows: 1, maxRows: 3, reorder: true },
}

const lineSchema = z.object({
  lines: z.array(
    z.object({
      sku: z.string().min(1, 'SKU is required'),
      qty: z.number().min(1, 'Qty must be at least 1'),
      price: z.number().min(0, 'Price cannot be negative'),
      category: z.string().min(1, 'Pick a category'),
      due: z.date().nullable(),
    }),
  ),
})

const categories = [
  { value: 'parts', label: 'Parts' },
  { value: 'labour', label: 'Labour' },
  { value: 'shipping', label: 'Shipping' },
]

const lineColumns: FieldArrayColumn[] = [
  { key: 'sku', header: 'SKU', render: (row) => <TextField name={row.name('sku')} label="SKU" /> },
  {
    key: 'qty',
    header: 'Qty',
    width: '6rem',
    align: 'right',
    render: (row) => <NumberField name={row.name('qty')} label="Qty" min={1} />,
  },
  {
    key: 'price',
    header: 'Price',
    width: '9rem',
    align: 'right',
    render: (row) => <MoneyField name={row.name('price')} label="Price" />,
  },
  {
    key: 'category',
    header: 'Category',
    width: '10rem',
    render: (row) => <Select name={row.name('category')} label="Category" options={categories} />,
  },
  {
    key: 'due',
    header: 'Due',
    width: '11rem',
    render: (row) => <DatePicker name={row.name('due')} label="Due" />,
  },
]

/**
 * `layout="table"` (#14): one MUI `Table`, a column per field, the row's Remove / Move
 * in a trailing actions column and Add under the table. Each control is named
 * "Line item 2 Qty" (row header + column header); its own label is visually hidden.
 * Errors show as the cell's invalid outline — the text is in `<FormErrorSummary>` — or
 * inline under the cell with `cellErrors="inline"`.
 *
 * The Select and DatePicker columns exercise the arrow-key exclusion: ArrowDown on a
 * closed Select opens its menu rather than moving rows.
 */
export const Table: Story = {
  args: {
    name: 'lines',
    label: 'Line items',
    singular: 'Line item',
    layout: 'table',
    columns: lineColumns,
    children: undefined,
    emptyRow: () => ({ sku: '', qty: 1, price: 0, category: '', due: null }),
    addLabel: 'Add line',
    minRows: 1,
    reorder: true,
  },
  parameters: {
    form: {
      schema: lineSchema,
      defaultValues: {
        lines: [
          { sku: 'BRK-100', qty: 2, price: 45, category: 'parts', due: null },
          { sku: '', qty: 1, price: 0, category: '', due: null },
        ],
      },
    },
  } satisfies FormParameters,
}

/** The same table with every cell's error text visible under its control. */
export const TableInlineErrors: Story = {
  ...Table,
  args: { ...Table.args, cellErrors: 'inline' },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Submit' }))
    await canvas.findByText('SKU is required')
  },
}
