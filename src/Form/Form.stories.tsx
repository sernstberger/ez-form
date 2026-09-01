import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import Stack from '@mui/material/Stack'
import type { DefaultValues } from 'react-hook-form'
import { z } from 'zod'
import { Form } from './Form'
import { SubmitButton } from '../SubmitButton'
import { TextField } from '../fields/TextField'
import { Select } from '../fields/Select'
import { Checkbox } from '../fields/Checkbox'
import { Switch } from '../fields/Switch'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.email({ error: (iss) => (iss.input === '' ? 'Email is required' : 'Invalid email') }),
  role: z.enum(['admin', 'user'], { error: 'Pick a role' }),
  tos: z.boolean().refine(Boolean, { error: 'You must accept the terms' }),
  newsletter: z.boolean(),
})

// `role` omitted: DefaultValues is DeepPartial; Select renders undefined as the empty state.
const emptyValues: DefaultValues<z.input<typeof schema>> = {
  name: '',
  email: '',
  tos: false,
  newsletter: false,
}

const roles = [
  { value: 'admin', label: 'Admin' },
  { value: 'user', label: 'User' },
] as const

const onSubmit = fn()
const slowSubmit = fn(() => new Promise<void>((r) => setTimeout(r, 1500)))

function SignupFields({ submitLabel = 'Create account' }: { submitLabel?: string }) {
  return (
    <Stack spacing={2} sx={{ width: 360 }}>
      <TextField name="name" label="Name" required />
      <TextField name="email" label="Email" helperText="We never share it" required />
      <Select name="role" label="Role" options={roles} required />
      <Checkbox name="tos" label="I accept the terms" required />
      <Switch name="newsletter" label="Send me the newsletter" />
      <SubmitButton>{submitLabel}</SubmitButton>
    </Stack>
  )
}

const meta = {
  title: 'Form',
  component: Form,
  parameters: { layout: 'centered' },
  args: { schema, defaultValues: emptyValues, onSubmit, children: null },
  render: (args) => (
    <Form {...args}>
      <SignupFields />
    </Form>
  ),
} satisfies Meta<typeof Form>

export default meta
type Story = StoryObj<typeof meta>

export const Basic: Story = {}

export const ValidationErrors: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Click submit with nothing filled in: every required field shows its label-derived rule message ("Name is required.") in place of the zod one; zod still types onSubmit and covers the rest.',
      },
    },
  },
}

export const AsyncSubmit: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Submit awaits 1.5s: every field is disabled and the button shows a spinner until it resolves.',
      },
    },
  },
  args: {
    defaultValues: {
      name: 'Ada',
      email: 'ada@example.com',
      role: 'admin',
      tos: true,
      newsletter: true,
    },
    onSubmit: slowSubmit,
  },
  render: (args) => (
    <Form {...args}>
      <SignupFields submitLabel="Save (1.5s)" />
    </Form>
  ),
}
