import type { Meta, StoryObj } from '@storybook/react-vite'
import { z } from 'zod'
import type { FormParameters } from '../../../.storybook/preview'
import { PasswordField } from './PasswordField'

const schema = z.object({
  password: z.string().min(1, { error: 'Password is required' }),
})

const meta = {
  title: 'Fields/PasswordField',
  component: PasswordField,
  args: { name: 'password', label: 'Password' },
  parameters: { form: { schema, defaultValues: { password: '' } } } satisfies FormParameters,
} satisfies Meta<typeof PasswordField>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const NotRevealable: Story = {
  parameters: {
    docs: {
      description: {
        story: '`revealable={false}` renders no toggle — the value can never be shown.',
      },
    },
  },
  args: { revealable: false },
}

const signupSchema = z
  .object({
    password: z.string().min(8, { error: 'At least 8 characters' }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: 'Passwords must match',
    path: ['confirmPassword'],
  })

export const NewPassword: Story = {
  parameters: {
    form: { schema: signupSchema, defaultValues: { password: '', confirmPassword: '' } },
    docs: {
      description: {
        story:
          '`autoComplete="new-password"` on both fields, with a zod `refine` checking they match.',
      },
    },
  },
  render: () => (
    <>
      <PasswordField name="password" label="Password" autoComplete="new-password" />
      <PasswordField name="confirmPassword" label="Confirm password" autoComplete="new-password" />
    </>
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText('Password'), 'hunter22')
    await userEvent.type(canvas.getByLabelText('Confirm password'), 'hunter23')
    await userEvent.click(canvas.getByRole('button', { name: 'Submit' }))
    await canvas.findByText('Passwords must match')
  },
}

export const Disabled: Story = { args: { disabled: true } }

export const WithError: Story = {
  args: { required: true },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Submit' }))
    await canvas.findByText('Password is required.')
  },
}
