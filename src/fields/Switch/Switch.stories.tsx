import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import Stack from '@mui/material/Stack'
import { z } from 'zod'
import { Form } from '../../Form'
import { SubmitButton } from '../../SubmitButton'
import { Switch } from './Switch'

const schema = z.object({ darkMode: z.boolean() })

const onSubmit = fn()

const meta = {
  title: 'Fields/Switch',
  component: Switch,
  args: { name: 'darkMode', label: 'Dark mode' },
  decorators: [
    (Story) => (
      <Form schema={schema} defaultValues={{ darkMode: false }} onSubmit={onSubmit}>
        <Stack spacing={2} sx={{ width: 360 }}>
          <Story />
          <SubmitButton />
        </Stack>
      </Form>
    ),
  ],
} satisfies Meta<typeof Switch>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const WithHelperText: Story = { args: { helperText: 'Easier on the eyes' } }
export const Required: Story = { args: { required: true } }
export const Disabled: Story = { args: { disabled: true } }
