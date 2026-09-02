import { useId, type ReactNode } from 'react'
import Button, { type ButtonProps } from '@mui/material/Button'
import Dialog, { type DialogProps } from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import { styled } from '@mui/material/styles'
import { useDefaultProps } from '@mui/material/DefaultPropsProvider'
import generateUtilityClasses from '@mui/material/generateUtilityClasses'

export const confirmDialogClasses = generateUtilityClasses('EzConfirmDialog', [
  'root',
  'confirm',
  'cancel',
])

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
  extends ConfirmOptions, Omit<DialogProps, 'title' | 'onClose' | 'open' | 'slotProps'> {
  open: boolean
  onConfirm: () => void
  /** Also called for Escape and backdrop click. */
  onCancel: () => void
  /** Props for the Confirm / Cancel buttons. */
  slotProps?: {
    confirm?: ButtonProps
    cancel?: ButtonProps
  }
}

const ConfirmDialogRoot = styled(Dialog, { name: 'EzConfirmDialog', slot: 'Root' })({})
const ConfirmDialogConfirm = styled(Button, { name: 'EzConfirmDialog', slot: 'Confirm' })({})
const ConfirmDialogCancel = styled(Button, { name: 'EzConfirmDialog', slot: 'Cancel' })({})

/**
 * MUI Dialog as an `alertdialog`: named by the title, described by the
 * message, initial focus on Cancel so Enter never confirms by accident.
 */
export function ConfirmDialog(inProps: ConfirmDialogProps) {
  const {
    open,
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    confirmColor,
    onConfirm,
    onCancel,
    className,
    slotProps,
    ...rest
  } = useDefaultProps({ props: inProps, name: 'EzConfirmDialog' })
  const titleId = useId()
  const messageId = useId()
  const confirmProps = { variant: 'contained' as const, color: confirmColor, ...slotProps?.confirm }
  const cancelProps = { ...slotProps?.cancel }
  return (
    <ConfirmDialogRoot
      {...rest}
      open={open}
      onClose={onCancel}
      role="alertdialog"
      aria-labelledby={titleId}
      aria-describedby={message ? messageId : undefined}
      className={`${confirmDialogClasses.root}${className ? ` ${className}` : ''}`}
    >
      <DialogTitle id={titleId}>{title}</DialogTitle>
      {message && (
        <DialogContent>
          <DialogContentText id={messageId}>{message}</DialogContentText>
        </DialogContent>
      )}
      <DialogActions>
        <ConfirmDialogCancel
          onClick={onCancel}
          autoFocus
          className={confirmDialogClasses.cancel}
          {...cancelProps}
        >
          {cancelLabel}
        </ConfirmDialogCancel>
        <ConfirmDialogConfirm
          onClick={onConfirm}
          className={confirmDialogClasses.confirm}
          {...confirmProps}
        >
          {confirmLabel}
        </ConfirmDialogConfirm>
      </DialogActions>
    </ConfirmDialogRoot>
  )
}
