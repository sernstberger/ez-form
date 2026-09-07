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

/**
 * MUI's `variant`, reopened (#142). The preset's default is `stacked` — ez-form's own
 * variant, whose label sits above the input with no float and no notch — and any field
 * opts back to MUI's own look with `variant="outlined"` / `"standard"` / `"filled"`.
 *
 * A consumer adds their own the same way the MUI docs will once this lands upstream:
 * `declare module '@mui/material/TextField' { interface TextFieldPropsVariantOverrides
 * { dashed: true } }` in a `.d.ts`, then a `theme.components.MuiTextField.variants`
 * entry for the look. A custom variant renders `OutlinedInput` unless
 * `slots.input` says otherwise. (No such augmentation is declared in `src/`: a module
 * augmentation is global, so a demo one would leak into every file in the library.)
 */
export const Variants: Story = {
  render: () => (
    <>
      <TextField name="email" label="Stacked (the preset's default)" />
      <TextField name="nick" label="Outlined" variant="outlined" />
      <TextField name="nick" label="Standard" variant="standard" />
      <TextField name="nick" label="Filled" variant="filled" />
    </>
  ),
}
