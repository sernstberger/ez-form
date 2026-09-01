import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import Stack from '@mui/material/Stack'
import { z } from 'zod'
import { Form } from '../../Form'
import { SubmitButton } from '../../SubmitButton'
import { NumberField } from './NumberField'

const schema = z.object({ age: z.number({ error: 'Enter your age' }) })

const onSubmit = fn()

const meta = {
  title: 'Fields/NumberField',
  component: NumberField,
  args: { name: 'age', label: 'Age' },
  decorators: [
    (Story) => (
      <Form schema={schema} defaultValues={{}} onSubmit={onSubmit}>
        <Stack spacing={2} sx={{ width: 360 }}>
          <Story />
          <SubmitButton />
        </Stack>
      </Form>
    ),
  ],
} satisfies Meta<typeof NumberField>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const MinMax: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The stepper stops at 18 and 120; typing 17 shows "Age must be at least 18." on submit. Pass `allowOutOfRange={false}` to clamp typed input instead.',
      },
    },
  },
  args: { min: 18, max: 120, helperText: '18 to 120' },
}
export const Step: Story = {
  args: { step: 5, largeStep: 25, helperText: 'Shift+arrow steps by 25' },
}
export const Small: Story = { args: { size: 'small' } }
export const Disabled: Story = { args: { disabled: true } }
export const Error: Story = {
  args: { required: true },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Submit' }))
    await canvas.findByText('Age is required.')
  },
}

const priceSchema = z.object({ price: z.number().min(0) })

export const Formatted: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Base UI `format` (Intl.NumberFormat options) shows currency; the form value stays a number.',
      },
    },
  },
  decorators: [
    (Story) => (
      <Form schema={priceSchema} defaultValues={{ price: 19.99 }} onSubmit={onSubmit}>
        <Stack spacing={2} sx={{ width: 360 }}>
          <Story />
          <SubmitButton />
        </Stack>
      </Form>
    ),
  ],
  args: {
    name: 'price',
    label: 'Price',
    format: { style: 'currency', currency: 'USD' },
    step: 0.5,
  },
}
