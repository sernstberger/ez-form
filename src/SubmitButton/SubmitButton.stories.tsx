import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ReactNode } from 'react'
import { fn } from 'storybook/test'
import Stack from '@mui/material/Stack'
import type { DefaultValues } from 'react-hook-form'
import { z } from 'zod'
import { Form } from '../Form'
import { TextField } from '../fields/TextField'
import { SubmitButton } from './SubmitButton'

/**
 * `SubmitButton` is a form-level component, so these stories render their own
 * `<Form>` (the `FormError`/`Form` pattern) rather than using the
 * `parameters.form` decorator — that decorator appends a `<SubmitButton>` of
 * its own, which would put a second, unrelated Submit button in every story of
 * the component itself.
 */

const schema = z.object({ name: z.string().min(1, 'Name is required') })
type Values = z.input<typeof schema>

const filled: DefaultValues<Values> = { name: 'Ada' }

const onSubmit = fn()
const slowSubmit = fn(() => new Promise<void>((resolve) => setTimeout(resolve, 1500)))
const fetchUser = fn(
  () => new Promise<Values>((resolve) => setTimeout(() => resolve({ name: 'Ada' }), 2000)),
)

interface DemoProps {
  children?: ReactNode
  defaultValues?: DefaultValues<Values> | (() => Promise<Values>)
  onSubmit?: (values: Values) => void | Promise<void>
}

/** One field plus the button under test — the smallest form that can submit. */
function Demo({ children, defaultValues = filled, onSubmit: submit = onSubmit }: DemoProps) {
  return (
    <Form schema={schema} defaultValues={defaultValues} onSubmit={submit}>
      <Stack spacing={2} sx={{ width: 320 }}>
        <TextField name="name" label="Name" required />
        {children}
      </Stack>
    </Form>
  )
}

const meta = {
  title: 'SubmitButton',
  component: SubmitButton,
  parameters: { layout: 'centered' },
  render: (args) => (
    <Demo>
      <SubmitButton {...args} />
    </Demo>
  ),
} satisfies Meta<typeof SubmitButton>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The default: `variant="contained"`, the label `Submit`, `type="submit"` so Enter in any field triggers it too.',
      },
    },
  },
}

export const CustomLabel: Story = {
  args: { children: 'Create account' },
}

export const Submitting: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'While `onSubmit` is pending (1.5s here) the button disables itself and shows MUI\'s loading spinner — this is the double-submit guard that makes `SubmitButton` preferable to a raw `<button type="submit">`. Every field in the form disables with it.',
      },
    },
  },
  render: (args) => (
    <Demo onSubmit={slowSubmit}>
      <SubmitButton {...args}>Save (1.5s)</SubmitButton>
    </Demo>
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Save (1.5s)' }))
    await canvas.findByRole('progressbar')
  },
}

export const Disabled: Story = {
  parameters: {
    docs: {
      description: {
        story: 'A consumer `disabled` on the button itself; the fields around it stay editable.',
      },
    },
  },
  args: { disabled: true },
}

export const FormDisabled: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "`<Form disabled>` locks the whole form: the button reads it from context, and the form's lock wins over a `disabled={false}` on the button.",
      },
    },
  },
  render: (args) => (
    <Form schema={schema} defaultValues={filled} onSubmit={onSubmit} disabled>
      <Stack spacing={2} sx={{ width: 320 }}>
        <TextField name="name" label="Name" required />
        <SubmitButton {...args} disabled={false} />
      </Stack>
    </Form>
  ),
}

export const WhileLoading: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The form is loading its `defaultValues` (an async function, 2s here). `<Form>` owns that lifecycle and disables every field and the button until the values arrive — there is no `loading` prop to set.',
      },
    },
  },
  render: (args) => (
    <Demo defaultValues={fetchUser}>
      <SubmitButton {...args} />
    </Demo>
  ),
}

export const Variants: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Every MUI `Button` prop passes through, and `theme.components.EzSubmitButton.defaultProps` can change the default for a whole app.',
      },
    },
  },
  render: () => (
    <Demo>
      <Stack direction="row" spacing={1}>
        <SubmitButton />
        <SubmitButton variant="outlined">Outlined</SubmitButton>
        <SubmitButton variant="text">Text</SubmitButton>
      </Stack>
    </Demo>
  ),
}
