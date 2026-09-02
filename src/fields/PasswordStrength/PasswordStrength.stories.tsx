import Stack from '@mui/material/Stack'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { z } from 'zod'
import type { FormParameters } from '../../../.storybook/preview'
import { PasswordField } from '../PasswordField'
import { PasswordStrength } from './PasswordStrength'

const schema = z.object({ password: z.string() })

const meta = {
  title: 'Fields/PasswordStrength',
  component: PasswordStrength,
  args: { name: 'password' },
  parameters: { form: { schema, defaultValues: { password: '' } } } satisfies FormParameters,
} satisfies Meta<typeof PasswordStrength>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Stack spacing={1}>
      <PasswordField name="password" label="Password" autoComplete="new-password" />
      <PasswordStrength name="password" />
    </Stack>
  ),
}

export const CustomScorer: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'A `score` prop swaps in any scorer — here, one that only rewards length, ignoring character variety entirely. Consumers who want zxcvbn-grade scoring pass their own function the same way.',
      },
    },
  },
  render: () => (
    <Stack spacing={1}>
      <PasswordField name="password" label="Password" autoComplete="new-password" />
      <PasswordStrength
        name="password"
        score={(password) => Math.min(4, Math.floor(password.length / 4)) as 0 | 1 | 2 | 3 | 4}
      />
    </Stack>
  ),
}

export const CustomLabels: Story = {
  render: () => (
    <Stack spacing={1}>
      <PasswordField name="password" label="Password" autoComplete="new-password" />
      <PasswordStrength name="password" labels={['Terrible', 'Bad', 'Okay', 'Good', 'Excellent']} />
    </Stack>
  ),
}
