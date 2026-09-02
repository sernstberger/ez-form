import type { Meta, StoryObj } from '@storybook/react-vite'
import { z } from 'zod'
import type { FormParameters } from '../../../.storybook/preview'
import { TextField } from './TextField'

const schema = z.object({
  email: z.email({ error: (iss) => (iss.input === '' ? 'Email is required' : 'Invalid email') }),
  age: z.coerce.number().optional(),
  nick: z.string().optional(),
})

const meta = {
  title: 'Fields/TextField',
  component: TextField,
  args: { name: 'email', label: 'Email' },
  parameters: {
    form: { schema, defaultValues: { email: '', age: '', nick: '' } },
  } satisfies FormParameters,
} satisfies Meta<typeof TextField>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithHelperText: Story = {
  args: { helperText: 'We never share your email' },
}

export const Disabled: Story = {
  args: { disabled: true },
}

export const WithError: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Submit' }))
    await canvas.findByText('Email is required')
  },
}

/**
 * Field-level rules as props. A bare value gets a message derived from the label;
 * `{ value, message }` overrides it. A rule error wins over zod's for that field.
 */
export const Rules: Story = {
  render: () => (
    <>
      <TextField name="email" label="Email" required />
      <TextField
        name="age"
        label="Age"
        type="number"
        required
        min={18}
        max={{ value: 99, message: 'Nobody is that old' }}
      />
      <TextField
        name="nick"
        label="Nickname"
        minLength={3}
        maxLength={{ value: 12, message: 'Too long!' }}
        pattern={/^[a-z]+$/}
        helperText="Lowercase letters, 3-12 characters"
      />
    </>
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Submit' }))
    await canvas.findByText('Email is required.')
    await canvas.findByText('Age is required.')
  },
}
