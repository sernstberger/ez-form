import type { Meta, StoryObj } from '@storybook/react-vite'
import { z } from 'zod'
import type { FormParameters } from '../../../.storybook/preview'
import { MoneyField } from './MoneyField'

const schema = z.object({ price: z.number().min(0) })

const meta = {
  title: 'Fields/MoneyField',
  component: MoneyField,
  args: { name: 'price', label: 'Price' },
  parameters: { form: { schema, defaultValues: { price: 19.99 } } } satisfies FormParameters,
} satisfies Meta<typeof MoneyField>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Required: Story = {
  parameters: { form: { schema, defaultValues: {} } } satisfies FormParameters,
  args: { required: true },
}
export const MinMax: Story = {
  args: { min: 0, max: 10000, helperText: '$0 to $10,000' },
}
