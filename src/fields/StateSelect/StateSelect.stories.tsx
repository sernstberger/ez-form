import type { Meta, StoryObj } from '@storybook/react-vite'
import { z } from 'zod'
import type { FormParameters } from '../../../.storybook/preview'
import { StateSelect } from './StateSelect'

const schema = z.object({ state: z.string().min(1, { error: 'Pick a state' }) })

const meta = {
  title: 'Fields/StateSelect',
  component: StateSelect,
  args: { name: 'state', label: 'State' },
  parameters: { form: { schema, defaultValues: {} } } satisfies FormParameters,
} satisfies Meta<typeof StateSelect>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Required: Story = { args: { required: true } }

export const WithTerritories: Story = {
  args: { label: 'State or territory', territories: true },
  parameters: {
    docs: {
      description: {
        story:
          '`territories` adds Puerto Rico, Guam, the U.S. Virgin Islands, American Samoa, and the Northern Mariana Islands after the 50 states + DC.',
      },
    },
  },
}
