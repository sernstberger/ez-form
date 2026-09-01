import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import Stack from '@mui/material/Stack'
import { z } from 'zod'
import { Form } from '../../Form'
import { SubmitButton } from '../../SubmitButton'
import { Checkbox } from './Checkbox'

const schema = z.object({
  tos: z.boolean().refine(Boolean, { error: 'You must accept the terms' }),
})

const onSubmit = fn()

const meta = {
  title: 'Fields/Checkbox',
  component: Checkbox,
  args: { name: 'tos', label: 'I accept the terms' },
  decorators: [
    (Story) => (
      <Form schema={schema} defaultValues={{ tos: false }} onSubmit={onSubmit}>
        <Stack spacing={2} sx={{ width: 360 }}>
          <Story />
          <SubmitButton />
        </Stack>
      </Form>
    ),
  ],
} satisfies Meta<typeof Checkbox>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const WithHelperText: Story = { args: { helperText: 'Required to continue' } }
export const Required: Story = { args: { required: true } }
export const Disabled: Story = { args: { disabled: true } }
