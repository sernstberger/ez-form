import Stack from '@mui/material/Stack'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { z } from 'zod'
import type { FormParameters } from '../../../.storybook/preview'
import { TextField } from '../TextField'
import { ReadOnlyField } from './ReadOnlyField'

const schema = z.object({
  name: z.string(),
  role: z.string(),
  tags: z.array(z.string()),
  tos: z.boolean(),
  cardNumber: z.string(),
})

const roles = [
  { value: 'admin', label: 'Administrator' },
  { value: 'user', label: 'User' },
]

const meta = {
  title: 'Fields/ReadOnlyField',
  component: ReadOnlyField,
  args: { name: 'name', label: 'Name' },
  parameters: {
    form: {
      schema,
      defaultValues: {
        name: 'Ada Lovelace',
        role: 'admin',
        tags: ['math', 'engines'],
        tos: true,
        cardNumber: '',
      },
    },
  } satisfies FormParameters,
} satisfies Meta<typeof ReadOnlyField>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Summary: Story = {
  render: () => (
    <Stack spacing={2}>
      <TextField name="name" label="Edit name (live)" />
      <ReadOnlyField name="name" />
      <ReadOnlyField name="role" options={roles} />
      <ReadOnlyField name="tags" />
      <ReadOnlyField name="tos" label="Accepted terms" />
      <ReadOnlyField name="cardNumber" />
      <ReadOnlyField
        name="tags"
        label="Tag count"
        format={(v) => `${(v as string[]).length} tags`}
      />
    </Stack>
  ),
}
