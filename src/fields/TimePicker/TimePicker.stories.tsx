import type { Meta, StoryObj } from '@storybook/react-vite'
import { z } from 'zod'
import type { FormParameters } from '../../../.storybook/preview'
import { TimePicker } from './TimePicker'

const schema = z.object({ at: z.date().nullable() })

const meta = {
  title: 'Fields/TimePicker',
  component: TimePicker,
  args: { name: 'at', label: 'At' },
  parameters: { form: { schema, defaultValues: { at: null } } } satisfies FormParameters,
} satisfies Meta<typeof TimePicker>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Required: Story = { args: { required: true, helperText: 'When should we call?' } }
export const OfficeHours: Story = {
  args: {
    minTime: new Date(2000, 0, 1, 9, 0),
    maxTime: new Date(2000, 0, 1, 17, 0),
    helperText: '9 AM to 5 PM',
  },
}
export const Disabled: Story = { args: { disabled: true } }
export const Error: Story = {
  args: { required: true },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Submit' }))
    await canvas.findByText('At is required.')
  },
}
