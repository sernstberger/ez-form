import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import Stack from '@mui/material/Stack'
import { z } from 'zod'
import { Form } from '../../Form'
import { TextField } from './TextField'

const schema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email'),
})

const meta = {
  title: 'Fields/TextField',
  component: TextField,
  args: { name: 'email', label: 'Email' },
  decorators: [
    (Story) => (
      <Form schema={schema} defaultValues={{ email: '' }} onSubmit={fn()}>
        <Stack spacing={2} sx={{ maxWidth: 360 }}>
          <Story />
          <button type="submit">Submit</button>
        </Stack>
      </Form>
    ),
  ],
} satisfies Meta<typeof TextField>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithHelperText: Story = {
  args: { helperText: 'We never share your email' },
}

export const Disabled: Story = {
  args: { disabled: true },
}

export const WithError: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Submit' }))
    await canvas.findByText('Email is required')
  },
}
