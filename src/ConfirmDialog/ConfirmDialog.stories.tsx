import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, waitFor, within } from 'storybook/test'
import { useState } from 'react'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { ConfirmDialog } from './ConfirmDialog'
import { useConfirm } from './useConfirm'

const meta = {
  title: 'ConfirmDialog',
  component: ConfirmDialog,
  parameters: { layout: 'centered' },
  args: {
    open: true,
    title: 'Send invoice?',
    message: 'This emails the client.',
    onConfirm: () => {},
    onCancel: () => {},
  },
} satisfies Meta<typeof ConfirmDialog>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Destructive: Story = {
  args: {
    title: 'Delete project?',
    message: 'This cannot be undone.',
    confirmLabel: 'Delete',
    confirmColor: 'error',
  },
}

/**
 * `actionsOrder="confirm-cancel"` renders Confirm before Cancel in the DOM — tab order
 * follows, not just the visual order. Cancel still gets `autoFocus`. Also settable globally
 * via `theme.components.EzConfirmDialog.defaultProps.actionsOrder`.
 */
export const ReversedOrder: Story = {
  args: { actionsOrder: 'confirm-cancel' },
}

/**
 * The dialog mounts on click, the way every real caller opens one. MUI's `Dialog` claims
 * initial focus for its own paper, so Cancel is re-focused once the enter transition
 * finishes (#119) — Enter right after opening cancels, it never confirms. The play below
 * asserts exactly that, so it can be re-verified in a real browser and not just jsdom.
 */
export const WithUseConfirm: Story = {
  play: async ({ canvas, userEvent, step }) => {
    await step('Cancel is focused once the dialog has opened', async () => {
      await userEvent.click(canvas.getByRole('button', { name: 'Ask' }))
      const cancel = await within(document.body).findByRole('button', { name: 'Cancel' })
      await waitFor(() => expect(cancel).toHaveFocus())
    })
    await step('Enter therefore cancels rather than confirming', async () => {
      await userEvent.keyboard('{Enter}')
      await waitFor(() => expect(canvas.getByText('Last answer: cancelled')).toBeInTheDocument())
    })
  },
  render: () => {
    const { confirm, dialog } = useConfirm()
    const [last, setLast] = useState<string>('—')
    return (
      <Stack spacing={2} sx={{ alignItems: 'flex-start' }}>
        <Button
          variant="outlined"
          onClick={() =>
            void confirm({ title: 'Really?' }).then((ok) => setLast(ok ? 'confirmed' : 'cancelled'))
          }
        >
          Ask
        </Button>
        <Typography>Last answer: {last}</Typography>
        {dialog}
      </Stack>
    )
  },
}
