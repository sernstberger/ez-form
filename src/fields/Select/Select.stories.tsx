import type { Meta, StoryObj } from '@storybook/react-vite'
import { z } from 'zod'
import type { FormParameters } from '../../../.storybook/preview'
import { Select } from './Select'

const schema = z.object({
  role: z.enum(['admin', 'user'], { error: 'Pick a role' }),
})

const meta = {
  title: 'Fields/Select',
  component: Select,
  args: {
    name: 'role',
    label: 'Role',
    options: [
      { value: 'admin', label: 'Admin' },
      { value: 'user', label: 'User' },
    ],
  },
  parameters: { form: { schema, defaultValues: {} } } satisfies FormParameters,
} satisfies Meta<typeof Select>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Required: Story = { args: { required: true } }
export const Disabled: Story = { args: { disabled: true } }
