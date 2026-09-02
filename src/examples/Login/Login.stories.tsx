import type { Meta, StoryObj } from '@storybook/react-vite'
import { Login } from './Login'
import { LOGIN_BAD_PASSWORD } from '../fakeApi'

const meta = {
  title: 'Examples/Login',
  component: Login,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Login>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WrongPassword: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Submits with the fake API's known-bad password: onSubmit rejects, and the form-level error appears through FormError.",
      },
    },
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText(/email/i), 'ada@example.com')
    await userEvent.type(canvas.getByLabelText(/password/i), LOGIN_BAD_PASSWORD)
    await userEvent.click(canvas.getByRole('button', { name: /sign in/i }))
    await canvas.findByRole('alert')
  },
}

export const SignedIn: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Submits with any other password: the fake API resolves after a short delay.',
      },
    },
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText(/email/i), 'ada@example.com')
    await userEvent.type(canvas.getByLabelText(/password/i), 'correct-horse-battery-staple')
    await userEvent.click(canvas.getByRole('button', { name: /sign in/i }))
  },
}
