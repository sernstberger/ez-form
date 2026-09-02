import type { Meta, StoryObj } from '@storybook/react-vite'
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

export const WithUseConfirm: Story = {
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
