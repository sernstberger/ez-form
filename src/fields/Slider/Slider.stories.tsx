import type { Meta, StoryObj } from '@storybook/react-vite'
import { z } from 'zod'
import type { FormParameters } from '../../../.storybook/preview'
import { Slider } from './Slider'

const schema = z.object({ volume: z.number() })

const meta = {
  title: 'Fields/Slider',
  component: Slider,
  args: { name: 'volume', label: 'Volume' },
  parameters: { form: { schema, defaultValues: { volume: 30 } } } satisfies FormParameters,
} satisfies Meta<typeof Slider>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Marks: Story = { args: { step: 10, marks: true, valueLabelDisplay: 'auto' } }
export const Range: Story = {
  args: { name: 'hours', label: 'Hours', max: 24 },
  parameters: {
    form: {
      schema: z.object({ hours: z.tuple([z.number(), z.number()]) }),
      defaultValues: { hours: [9, 17] },
    },
  } satisfies FormParameters,
}
export const Bounded: Story = {
  args: { min: 0, max: { value: 50, message: 'Keep it under 50' }, helperText: 'Default is out of range' },
  parameters: { form: { schema, defaultValues: { volume: 80 } } } satisfies FormParameters,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Submit' }))
    await canvas.findByText('Keep it under 50')
  },
}
export const Disabled: Story = { args: { disabled: true } }
