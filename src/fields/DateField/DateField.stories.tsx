import type { Meta, StoryObj } from '@storybook/react-vite'
import { z } from 'zod'
import type { FormParameters } from '../../../.storybook/preview'
import { DateField } from './DateField'
import { DatePicker } from '../DatePicker'

const schema = z.object({ start: z.date().nullable(), birthday: z.date().nullable() })

const meta = {
  title: 'Fields/DateField',
  component: DateField,
  args: { name: 'start', label: 'Start' },
  parameters: {
    form: { schema, defaultValues: { start: null, birthday: null } },
  } satisfies FormParameters,
} satisfies Meta<typeof DateField>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Required: Story = { args: { required: true, helperText: 'When does it begin?' } }
export const Disabled: Story = { args: { disabled: true } }
export const Error: Story = {
  args: { required: true },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Submit' }))
    await canvas.findByText('Start is required.')
  },
}

/**
 * Typing beats paging a calendar back decades. `disableFuture` + a sane
 * `minDate` catches typos without a popup to navigate.
 */
export const Birthday: Story = {
  args: {
    name: 'birthday',
    label: 'Birthday',
    disableFuture: true,
    minDate: new Date(1900, 0, 1),
    required: true,
  },
}

/**
 * `DateField` next to `DatePicker` for the same kind of value: `DateField`
 * for a birthday (type it, no calendar to page back through), `DatePicker`
 * for a date near today (a calendar is faster to scan than typing).
 */
export const BirthdayVsDatePicker: Story = {
  render: () => (
    <>
      <DateField
        name="birthday"
        label="Birthday (DateField)"
        disableFuture
        minDate={new Date(1900, 0, 1)}
        required
      />
      <DatePicker name="start" label="Start date (DatePicker)" />
    </>
  ),
}
