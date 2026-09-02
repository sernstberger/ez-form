import type { Meta, StoryObj } from '@storybook/react-vite'
import { z } from 'zod'
import type { FormParameters } from '../../../.storybook/preview'
import { ZipField } from './ZipField'

const schema = z.object({ zip: z.string().min(1, { error: 'Zip is required' }) })

const meta = {
  title: 'Fields/ZipField',
  component: ZipField,
  args: { name: 'zip', label: 'ZIP code' },
  parameters: { form: { schema, defaultValues: { zip: '' } } } satisfies FormParameters,
} satisfies Meta<typeof ZipField>

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
        story: 'A partial ZIP fails the built-in "5 digits" rule with `invalidMessage`.',
      },
    },
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText('ZIP code'), '902')
    await userEvent.click(canvas.getByRole('button', { name: 'Submit' }))
    await canvas.findByText('Enter a 5-digit ZIP code')
  },
}
