import type { Meta, StoryObj } from '@storybook/react-vite'
import { z } from 'zod'
import type { FormParameters } from '../../../.storybook/preview'
import { Checkbox } from './Checkbox'

const schema = z.object({
  tos: z.boolean().refine(Boolean, { error: 'You must accept the terms' }),
})

const meta = {
  title: 'Fields/Checkbox',
  component: Checkbox,
  args: { name: 'tos', label: 'I accept the terms' },
  parameters: { form: { schema, defaultValues: { tos: false } } } satisfies FormParameters,
} satisfies Meta<typeof Checkbox>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const WithHelperText: Story = { args: { helperText: 'Required to continue' } }
export const Required: Story = { args: { required: true } }
export const Disabled: Story = { args: { disabled: true } }
