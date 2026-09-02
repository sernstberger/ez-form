import type { Meta, StoryObj } from '@storybook/react-vite'
import { z } from 'zod'
import type { FormParameters } from '../../../.storybook/preview'
import { DateTimePicker } from './DateTimePicker'

const schema = z.object({ when: z.date().nullable() })

const meta = {
  title: 'Fields/DateTimePicker',
  component: DateTimePicker,
  args: { name: 'when', label: 'When' },
  parameters: { form: { schema, defaultValues: { when: null } } } satisfies FormParameters,
} satisfies Meta<typeof DateTimePicker>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Required: Story = {
  args: { required: true, helperText: 'Date and time of the event' },
}
export const FutureOnly: Story = {
  args: { disablePast: true, errorMessages: { disablePast: 'Pick a moment from now on' } },
}
export const Disabled: Story = { args: { disabled: true } }
export const Error: Story = {
  args: { required: true },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Submit' }))
    await canvas.findByText('When is required.')
  },
}
