import type { Meta, StoryObj } from '@storybook/react-vite'
import { z } from 'zod'
import type { FormParameters } from '../../../.storybook/preview'
import { PhoneField } from './PhoneField'

const schema = z.object({ phone: z.string() })

const meta = {
  title: 'Fields/PhoneField',
  component: PhoneField,
  args: { name: 'phone', label: 'Phone' },
  parameters: { form: { schema, defaultValues: { phone: '' } } } satisfies FormParameters,
} satisfies Meta<typeof PhoneField>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Digits format into `###-###-####` as they are typed; the form value stays `5551234567`.',
      },
    },
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText('Phone'), '5551234567')
  },
}

export const CustomFormat: Story = {
  args: { format: '(###) ###-####' },
  parameters: {
    docs: {
      description: {
        story:
          'Any `#` template works. The number of `#`s is also the digit capacity and what the built-in completeness rule requires, so this is still a ten-digit field.',
      },
    },
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText('Phone'), '5551234567')
  },
}

export const WithError: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'A half-typed number fails on submit with `invalidMessage` — the default names the digit count the template holds.',
      },
    },
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText('Phone'), '55512')
    await userEvent.click(canvas.getByRole('button', { name: 'Submit' }))
    await canvas.findByText('Enter a 10-digit phone number')
  },
}

export const Required: Story = {
  args: { required: true },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Submit' }))
    await canvas.findByText('Phone is required.')
  },
}

export const Prefilled: Story = {
  parameters: { form: { schema, defaultValues: { phone: '5551234567' } } },
}

export const Disabled: Story = { args: { disabled: true } }
