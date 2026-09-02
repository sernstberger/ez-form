import type { Meta, StoryObj } from '@storybook/react-vite'
import { z } from 'zod'
import type { FormParameters } from '../../../.storybook/preview'
import { Switch } from './Switch'

const schema = z.object({ darkMode: z.boolean() })

const meta = {
  title: 'Fields/Switch',
  component: Switch,
  args: { name: 'darkMode', label: 'Dark mode' },
  parameters: { form: { schema, defaultValues: { darkMode: false } } } satisfies FormParameters,
} satisfies Meta<typeof Switch>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const WithHelperText: Story = { args: { helperText: 'Easier on the eyes' } }
export const Required: Story = { args: { required: true } }
export const Disabled: Story = { args: { disabled: true } }
