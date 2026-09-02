import type { Meta, StoryObj } from '@storybook/react-vite'
import { z } from 'zod'
import type { FormParameters } from '../../../.storybook/preview'
import { Rating } from './Rating'

const schema = z.object({ stars: z.number().nullable() })

const meta = {
  title: 'Fields/Rating',
  component: Rating,
  args: { name: 'stars', label: 'Stars' },
  parameters: { form: { schema, defaultValues: { stars: null } } } satisfies FormParameters,
} satisfies Meta<typeof Rating>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Required: Story = { args: { required: true, helperText: 'Rate to continue' } }
export const HalfStars: Story = { args: { precision: 0.5, size: 'large' } }
export const Disabled: Story = { args: { disabled: true } }
export const Error: Story = {
  args: { required: true },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Submit' }))
    await canvas.findByText('Stars is required.')
  },
}
