import { useId, type ReactNode } from 'react'
import Button, { type ButtonProps } from '@mui/material/Button'
import Dialog, { type DialogProps } from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'

/** Copy and styling for one confirmation; shared by `ConfirmDialog`, `useConfirm`, `Form confirm`, and `ClearButton confirm`. */
export interface ConfirmOptions {
  title: ReactNode
  message?: ReactNode
  /** Default `Confirm`. */
  confirmLabel?: ReactNode
  /** Default `Cancel`. */
  cancelLabel?: ReactNode
  confirmColor?: ButtonProps['color']
}

export interface ConfirmDialogProps
  extends ConfirmOptions, Omit<DialogProps, 'title' | 'onClose' | 'open'> {
  open: boolean
  onConfirm: () => void
  /** Also called for Escape and backdrop click. */
  onCancel: () => void
}

/**
 * MUI Dialog as an `alertdialog`: named by the title, described by the
 * message, initial focus on Cancel so Enter never confirms by accident.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmColor,
  onConfirm,
  onCancel,
  slotProps,
  ...rest
}: ConfirmDialogProps) {
  const titleId = useId()
  const messageId = useId()
  return (
    <Dialog
      {...rest}
      open={open}
      onClose={onCancel}
      aria-labelledby={titleId}
      aria-describedby={message ? messageId : undefined}
      slotProps={{
        ...slotProps,
        paper: {
          role: 'alertdialog',
          ...(typeof slotProps?.paper === 'object' ? slotProps.paper : {}),
        },
      }}
    >
      <DialogTitle id={titleId}>{title}</DialogTitle>
      {message && (
        <DialogContent>
          <DialogContentText id={messageId}>{message}</DialogContentText>
        </DialogContent>
      )}
      <DialogActions>
        <Button onClick={onCancel} autoFocus>
          {cancelLabel}
        </Button>
        <Button onClick={onConfirm} variant="contained" color={confirmColor}>
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
