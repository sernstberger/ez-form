import type { Meta, StoryObj } from '@storybook/react-vite'
import { z } from 'zod'
import type { FormParameters } from '../../../.storybook/preview'
import { DatePicker } from './DatePicker'

const schema = z.object({ start: z.date().nullable() })

const meta = {
  title: 'Fields/DatePicker',
  component: DatePicker,
  args: { name: 'start', label: 'Start' },
  parameters: { form: { schema, defaultValues: { start: null } } } satisfies FormParameters,
} satisfies Meta<typeof DatePicker>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Required: Story = { args: { required: true, helperText: 'When does it begin?' } }
export const FutureOnly: Story = {
  args: { disablePast: true, errorMessages: { disablePast: 'Pick a day from today on' } },
}
export const Disabled: Story = { args: { disabled: true } }
export const Error: Story = {
  args: { required: true },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Submit' }))
    await canvas.findByText('Start is required.')
  },
}
