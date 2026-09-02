import type { Meta, StoryObj } from '@storybook/react-vite'
import { z } from 'zod'
import type { FormParameters } from '../../../.storybook/preview'
import { SsnField } from './SsnField'

const schema = z.object({ ssn: z.string() })

const meta = {
  title: 'Fields/SsnField',
  component: SsnField,
  args: { name: 'ssn', label: 'Social Security number' },
  parameters: { form: { schema, defaultValues: { ssn: '' } } } satisfies FormParameters,
} satisfies Meta<typeof SsnField>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Hidden by default: digits format into `###-##-####` as they are typed, and `type="password"` masks the formatted text. The form value stays `123456789`.',
      },
    },
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText('Social Security number'), '123456789')
  },
}

export const Revealed: Story = {
  parameters: {
    docs: {
      description: {
        story: 'The toggle switches the input to `type="text"` so an entry can be checked.',
      },
    },
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText('Social Security number'), '123456789')
    await userEvent.click(canvas.getByRole('button', { name: 'Show Social Security number' }))
  },
}

export const NoReveal: Story = {
  args: { reveal: false },
  parameters: {
    docs: {
      description: {
        story: '`reveal={false}` renders no toggle — the number can never be shown.',
      },
    },
  },
}

export const WithError: Story = {
  parameters: {
    docs: {
      description: {
        story: 'A half-typed number fails on submit with `invalidMessage`.',
      },
    },
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText('Social Security number'), '12345')
    await userEvent.click(canvas.getByRole('button', { name: 'Submit' }))
    await canvas.findByText('Enter a 9-digit Social Security number')
  },
}

export const Required: Story = {
  args: { required: true },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Submit' }))
    await canvas.findByText('Social Security number is required.')
  },
}

export const Prefilled: Story = {
  parameters: { form: { schema, defaultValues: { ssn: '123456789' } } },
}

export const Disabled: Story = { args: { disabled: true } }
