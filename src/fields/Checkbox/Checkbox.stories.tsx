import type { Meta, StoryObj } from '@storybook/react-vite'
import { z } from 'zod'
import type { FormParameters } from '../../../.storybook/preview'
import { Checkbox } from './Checkbox'

const schema = z.object({
  tos: z.boolean().refine(Boolean, { error: 'You must accept the terms' }),
})

const meta = {
  title: 'Fields/Checkbox',
  component: Checkbox,
  args: { name: 'tos', label: 'I accept the terms' },
  parameters: {
    form: { schema, defaultValues: { tos: false } },
    docs: {
      description: {
        component:
          'A yes/no answer or opt-in recorded when the form is submitted — "I accept the terms", "Same as shipping", "Insure a vehicle" — or one of several independent options (`CheckboxGroup`). If the page has a Submit button, this is almost always the right control; see README "Checkbox vs Switch" for the full rule. Prefer `Switch` only for a setting that takes effect immediately, with no submit step.',
      },
    },
  } satisfies FormParameters,
} satisfies Meta<typeof Checkbox>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const WithHelperText: Story = { args: { helperText: 'Required to continue' } }
export const Required: Story = { args: { required: true } }
export const Disabled: Story = { args: { disabled: true } }
