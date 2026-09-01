import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import Stack from '@mui/material/Stack'
import { z } from 'zod'
import { Form } from '../../Form'
import { SubmitButton } from '../../SubmitButton'
import { Select } from './Select'

const schema = z.object({
  role: z.enum(['admin', 'user'], { error: 'Pick a role' }),
})

const onSubmit = fn()

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
  decorators: [
    (Story) => (
      <Form schema={schema} defaultValues={{}} onSubmit={onSubmit}>
        <Stack spacing={2} sx={{ width: 360 }}>
          <Story />
          <SubmitButton />
        </Stack>
      </Form>
    ),
  ],
} satisfies Meta<typeof Select>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Required: Story = { args: { required: true } }
export const Disabled: Story = { args: { disabled: true } }
