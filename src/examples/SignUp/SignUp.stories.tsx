import type { Meta, StoryObj } from '@storybook/react-vite'
import { SignUp } from './SignUp'
import { SIGNUP_GOOD_CODE } from '../fakeApi'

const meta = {
  title: 'Examples/Sign-up',
  component: SignUp,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof SignUp>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const MismatchedPasswords: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'A zod refine checks the two password fields match; a mismatch reports on Confirm password when Next validates step 1.',
      },
    },
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText(/^email/i), 'ada@example.com')
    await userEvent.type(canvas.getByLabelText(/^password/i), 'correct-horse-1')
    await userEvent.type(canvas.getByLabelText(/confirm password/i), 'different-1')
    await userEvent.type(canvas.getByLabelText(/display name/i), 'Ada Lovelace')
    await userEvent.click(canvas.getByRole('checkbox', { name: /terms/i }))
    await userEvent.click(canvas.getByRole('button', { name: /next/i }))
    await canvas.findByText(/passwords do not match/i)
  },
}

export const WrongCode: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Step 1 valid, then the fake verify API rejects an unrecognized code: the form-level error appears through FormError.',
      },
    },
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText(/^email/i), 'ada@example.com')
    await userEvent.type(canvas.getByLabelText(/^password/i), 'correct-horse-1')
    await userEvent.type(canvas.getByLabelText(/confirm password/i), 'correct-horse-1')
    await userEvent.type(canvas.getByLabelText(/display name/i), 'Ada Lovelace')
    await userEvent.click(canvas.getByRole('checkbox', { name: /terms/i }))
    await userEvent.click(canvas.getByRole('button', { name: /next/i }))
    await canvas.findByRole('textbox', { name: /verification code/i })
    await userEvent.type(canvas.getByRole('textbox', { name: /verification code/i }), '000000')
    await userEvent.click(canvas.getByRole('button', { name: /submit/i }))
    await canvas.findByRole('alert')
  },
}

export const Verified: Story = {
  parameters: {
    docs: {
      description: {
        story: "Submits the fake API's known-good code: the promise resolves and onSuccess fires.",
      },
    },
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText(/^email/i), 'ada@example.com')
    await userEvent.type(canvas.getByLabelText(/^password/i), 'correct-horse-1')
    await userEvent.type(canvas.getByLabelText(/confirm password/i), 'correct-horse-1')
    await userEvent.type(canvas.getByLabelText(/display name/i), 'Ada Lovelace')
    await userEvent.click(canvas.getByRole('checkbox', { name: /terms/i }))
    await userEvent.click(canvas.getByRole('button', { name: /next/i }))
    await canvas.findByRole('textbox', { name: /verification code/i })
    await userEvent.type(
      canvas.getByRole('textbox', { name: /verification code/i }),
      SIGNUP_GOOD_CODE,
    )
    await userEvent.click(canvas.getByRole('button', { name: /submit/i }))
  },
}
