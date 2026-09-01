import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import Stack from '@mui/material/Stack'
import { z } from 'zod'
import { Form } from './Form'
import { TextField } from '../fields/TextField'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().min(1, 'Email is required').email('Invalid email'),
})

const meta = {
  title: 'Form',
  component: Form,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Form>

export default meta
type Story = StoryObj<typeof meta>

export const Basic: Story = {
  args: {
    schema,
    defaultValues: { name: '', email: '' },
    onSubmit: fn(),
    children: null,
  },
  render: (args) => (
    <Form {...args}>
      <Stack spacing={2} sx={{ width: 360 }}>
        <TextField name="name" label="Name" />
        <TextField name="email" label="Email" />
        <button type="submit">Submit</button>
      </Stack>
    </Form>
  ),
}
