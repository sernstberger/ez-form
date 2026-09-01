import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import Stack from '@mui/material/Stack'
import { z } from 'zod'
import { Form } from './Form'
import { SubmitButton } from '../SubmitButton'
import { TextField } from '../fields/TextField'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.email({ error: (iss) => (iss.input === '' ? 'Email is required' : 'Invalid email') }),
})

const onSubmit = fn()
const slowSubmit = fn(() => new Promise<void>((r) => setTimeout(r, 1500)))

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
    onSubmit,
    children: null,
  },
  render: (args) => (
    <Form {...args}>
      <Stack spacing={2} sx={{ width: 360 }}>
        <TextField name="name" label="Name" />
        <TextField name="email" label="Email" />
        <SubmitButton />
      </Stack>
    </Form>
  ),
}

export const AsyncSubmit: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Submit awaits 1.5s: every field is disabled and the button shows a spinner until it resolves.',
      },
    },
  },
  args: {
    schema,
    defaultValues: { name: 'Ada', email: 'ada@example.com' },
    onSubmit: slowSubmit,
    children: null,
  },
  render: (args) => (
    <Form {...args}>
      <Stack spacing={2} sx={{ width: 360 }}>
        <TextField name="name" label="Name" />
        <TextField name="email" label="Email" />
        <SubmitButton>Save (1.5s)</SubmitButton>
      </Stack>
    </Form>
  ),
}
