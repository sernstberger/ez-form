import type { Meta, StoryObj } from '@storybook/react-vite'
import { z } from 'zod'
import type { FormParameters } from '../../../.storybook/preview'
import { ToggleButtonGroup } from './ToggleButtonGroup'

const schema = z.object({ align: z.string().nullable() })

const meta = {
  title: 'Fields/ToggleButtonGroup',
  component: ToggleButtonGroup,
  args: {
    name: 'align',
    label: 'Align',
    exclusive: true,
    options: [
      { value: 'left', label: 'Left' },
      { value: 'center', label: 'Center' },
      { value: 'right', label: 'Right' },
    ],
  },
  parameters: { form: { schema, defaultValues: { align: null } } } satisfies FormParameters,
} satisfies Meta<typeof ToggleButtonGroup>

export default meta
type Story = StoryObj<typeof meta>

export const Exclusive: Story = {}
export const Multiple: Story = {
  args: {
    name: 'format',
    label: 'Format',
    exclusive: false,
    options: [
      { value: 'bold', label: 'Bold' },
      { value: 'italic', label: 'Italic' },
      { value: 'underline', label: 'Underline' },
    ],
  },
  parameters: {
    form: { schema: z.object({ format: z.array(z.string()) }), defaultValues: { format: ['bold'] } },
  } satisfies FormParameters,
}
export const Required: Story = { args: { required: true, helperText: 'Pick an alignment' } }
export const Disabled: Story = { args: { disabled: true } }
export const Error: Story = {
  args: { required: true },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Submit' }))
    await canvas.findByText('Align is required.')
  },
}
