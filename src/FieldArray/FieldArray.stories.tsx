import Stack from '@mui/material/Stack'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { z } from 'zod'
import type { FormParameters } from '../../.storybook/preview'
import { TextField } from '../fields/TextField'
import { FieldArray, type FieldArrayRow } from './FieldArray'

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
} satisfies Meta<typeof FieldArray>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** `reorder` adds Move up / Move down to every row, disabled at the ends. */
export const Reorder: Story = {
  args: { reorder: true },
  parameters: {
    form: {
      schema,
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
