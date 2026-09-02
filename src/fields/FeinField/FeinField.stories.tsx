import type { Meta, StoryObj } from '@storybook/react-vite'
import { z } from 'zod'
import type { FormParameters } from '../../../.storybook/preview'
import { FeinField } from './FeinField'

const schema = z.object({ ein: z.string() })

const meta = {
  title: 'Fields/FeinField',
  component: FeinField,
  args: { name: 'ein', label: 'EIN' },
  parameters: { form: { schema, defaultValues: { ein: '' } } } satisfies FormParameters,
} satisfies Meta<typeof FeinField>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Required: Story = {
  args: { required: true, helperText: 'From your IRS determination letter' },
}

export const Prefilled: Story = {
  parameters: { form: { schema, defaultValues: { ein: '123456789' } } } satisfies FormParameters,
}

export const WithError: Story = {
  parameters: {
    docs: {
      description: {
        story: 'A partial EIN fails the built-in "9 digits" rule with `invalidMessage`.',
      },
    },
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText('EIN'), '12345')
    await userEvent.click(canvas.getByRole('button', { name: 'Submit' }))
    await canvas.findByText('Enter a 9-digit employer identification number')
  },
}
