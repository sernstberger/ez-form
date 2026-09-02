import type { Meta, StoryObj } from '@storybook/react-vite'
import { z } from 'zod'
import type { FormParameters } from '../../../.storybook/preview'
import { EmailField } from './EmailField'

const schema = z.object({ email: z.string() })

const meta = {
  title: 'Fields/EmailField',
  component: EmailField,
  args: { name: 'email', label: 'Email' },
  parameters: { form: { schema, defaultValues: { email: '' } } } satisfies FormParameters,
} satisfies Meta<typeof EmailField>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Required: Story = {
  args: { required: true },
}

export const WithError: Story = {
  parameters: {
    docs: {
      description: {
        story: "An address that isn't one fails the built-in format rule with `invalidMessage`.",
      },
    },
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText('Email'), 'ada@')
    await userEvent.click(canvas.getByRole('button', { name: 'Submit' }))
    await canvas.findByText('Enter a valid email address')
  },
}

export const Normalized: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Blurring trims and lower-cases the value, so what is submitted is canonical.',
      },
    },
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText('Email'), 'Ada@Example.COM')
    await userEvent.tab()
    await canvas.findByDisplayValue('ada@example.com')
  },
}

export const NotNormalized: Story = {
  args: { normalize: false, helperText: 'Stored exactly as typed' },
}
