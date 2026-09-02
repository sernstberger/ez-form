import type { Meta, StoryObj } from '@storybook/react-vite'
import { z } from 'zod'
import type { FormParameters } from '../../../.storybook/preview'
import { CheckboxGroup } from './CheckboxGroup'

const schema = z.object({ toppings: z.array(z.number()) })

const meta = {
  title: 'Fields/CheckboxGroup',
  component: CheckboxGroup,
  args: {
    name: 'toppings',
    label: 'Toppings',
    options: [
      { value: 1, label: 'Cheese' },
      { value: 2, label: 'Ham' },
      { value: 3, label: 'Pineapple' },
    ],
  },
  parameters: { form: { schema, defaultValues: { toppings: [1] } } } satisfies FormParameters,
} satisfies Meta<typeof CheckboxGroup>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Required: Story = {
  args: { required: true, helperText: 'Pick at least one' },
  parameters: { form: { schema, defaultValues: { toppings: [] } } } satisfies FormParameters,
}
export const Row: Story = { args: { row: true } }
export const DisabledOption: Story = {
  args: {
    options: [
      { value: 1, label: 'Cheese' },
      { value: 2, label: 'Ham' },
      { value: 3, label: 'Pineapple', disabled: true },
    ],
  },
}
export const Disabled: Story = { args: { disabled: true } }
export const Error: Story = {
  args: { required: true },
  parameters: { form: { schema, defaultValues: { toppings: [] } } } satisfies FormParameters,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Submit' }))
    await canvas.findByText('Toppings is required.')
  },
}
