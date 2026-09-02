import type { Meta, StoryObj } from '@storybook/react-vite'
import Stack from '@mui/material/Stack'
import { z } from 'zod'
import { Form } from '../Form'
import { SubmitButton } from '../SubmitButton'
import { TextField } from '../fields/TextField'
import { FormError } from './FormError'

const schema = z.object({ email: z.email() })

const meta = {
  title: 'FormError',
  component: FormError,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof FormError>
export default meta
type Story = StoryObj<typeof meta>

export const NoError: Story = {
  render: () => (
    <Form schema={schema} defaultValues={{ email: 'a@b.co' }} onSubmit={() => {}}>
      <Stack spacing={2} sx={{ width: 360 }}>
        <FormError />
        <TextField name="email" label="Email" />
        <SubmitButton />
      </Stack>
    </Form>
  ),
}

export const WithServerError: Story = {
  render: () => (
    <Form
      schema={schema}
      defaultValues={{ email: 'wrong@example.com' }}
      onSubmit={(_values, form) => {
        form.setError('root.server', { message: 'Invalid email or password' })
      }}
    >
      <Stack spacing={2} sx={{ width: 360 }}>
        <FormError />
        <TextField name="email" label="Email" />
        <SubmitButton />
      </Stack>
    </Form>
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Submit' }))
    await canvas.findByRole('alert')
  },
}
