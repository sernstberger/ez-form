import type { Meta, StoryObj } from '@storybook/react-vite'
import { z } from 'zod'
import type { FormParameters } from '../../../.storybook/preview'
import { OtpField } from './OtpField'

const schema = z.object({ code: z.string() })

const meta = {
  title: 'Fields/OtpField',
  component: OtpField,
  args: { name: 'code', label: 'Verification code' },
  parameters: { form: { schema, defaultValues: { code: '' } } } satisfies FormParameters,
} satisfies Meta<typeof OtpField>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const FourDigits: Story = { args: { length: 4, size: 'small' } }
export const Masked: Story = { args: { mask: true, helperText: 'Hidden on shared screens' } }
export const Alphanumeric: Story = {
  args: { validationType: 'alphanumeric', normalizeValue: (v: string) => v.toUpperCase() },
}
export const Required: Story = { args: { required: true } }
export const Disabled: Story = { args: { disabled: true } }
export const Incomplete: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByRole('textbox', { name: 'Verification code' }), '12')
    await userEvent.click(canvas.getByRole('button', { name: 'Submit' }))
    await canvas.findByText('Verification code must be 6 characters.')
  },
}
