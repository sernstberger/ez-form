import type { Meta, StoryObj } from '@storybook/react-vite'
import { z } from 'zod'
import type { FormParameters } from '../../../.storybook/preview'
import { MoneyField } from './MoneyField'

const schema = z.object({ price: z.number().min(0) })

// The meta's baseline is empty, not prefilled: Storybook deep-merges a story's
// `defaultValues` over the meta's and a story cannot unset a key it inherits (see
// FormParameters in .storybook/preview.tsx), so a meta-level `price` would leave
// `Required` prefilled with no way to clear it. The stories that want the prefill
// state it themselves.
const meta = {
  title: 'Fields/MoneyField',
  component: MoneyField,
  args: { name: 'price', label: 'Price' },
  parameters: { form: { schema, defaultValues: {} } } satisfies FormParameters,
} satisfies Meta<typeof MoneyField>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  parameters: { form: { defaultValues: { price: 19.99 } } } satisfies FormParameters,
}

export const Required: Story = {
  args: { required: true },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Submit' }))
    await canvas.findByText('Price is required.')
  },
}

export const MinMax: Story = {
  parameters: { form: { defaultValues: { price: 19.99 } } } satisfies FormParameters,
  args: { min: 0, max: 10000, helperText: '$0 to $10,000' },
}
