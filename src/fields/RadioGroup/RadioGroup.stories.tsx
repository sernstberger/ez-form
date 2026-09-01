import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import Stack from '@mui/material/Stack'
import { z } from 'zod'
import { Form } from '../../Form'
import { SubmitButton } from '../../SubmitButton'
import { RadioGroup } from './RadioGroup'

const schema = z.object({ plan: z.number({ error: 'Pick a plan' }) })

const onSubmit = fn()

const meta = {
  title: 'Fields/RadioGroup',
  component: RadioGroup,
  args: {
    name: 'plan',
    label: 'Plan',
    options: [
      { value: 1, label: 'Basic' },
      { value: 2, label: 'Pro' },
      { value: 3, label: 'Enterprise' },
    ],
  },
  decorators: [
    (Story) => (
      <Form schema={schema} defaultValues={{}} onSubmit={onSubmit}>
        <Stack spacing={2} sx={{ width: 360 }}>
          <Story />
          <SubmitButton />
        </Stack>
      </Form>
    ),
  ],
} satisfies Meta<typeof RadioGroup>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Required: Story = { args: { required: true, helperText: 'Pick one to continue' } }
export const Row: Story = { args: { row: true } }
export const DisabledOption: Story = {
  args: {
    options: [
      { value: 1, label: 'Basic' },
      { value: 2, label: 'Pro' },
      { value: 3, label: 'Enterprise', disabled: true },
    ],
  },
}
export const Disabled: Story = { args: { disabled: true } }
export const Error: Story = {
  args: { required: true },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Submit' }))
    await canvas.findByText('Plan is required.')
  },
}
