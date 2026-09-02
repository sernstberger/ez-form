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
  /**
   * DOM order of the two buttons, not just their visual order — tab order
   * follows. Default `'cancel-confirm'` (Material). Cancel keeps `autoFocus`
   * regardless of order.
   */
  actionsOrder?: 'cancel-confirm' | 'confirm-cancel'
  /** Dialog's own slots (root, backdrop, container, transition, paper), plus the Confirm / Cancel buttons. */
  slotProps?: DialogProps['slotProps'] & {
    confirm?: ButtonProps
    /**
     * Cancel receives `autoFocus` by default so Enter never confirms by
     * accident. Pass `{ autoFocus: false }` here to opt out — it's applied
     * after the default, so it wins.
     */
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
    actionsOrder = 'cancel-confirm',
    className,
    slotProps,
    ...rest
  } = useDefaultProps({ props: inProps, name: 'EzConfirmDialog' })
  const titleId = useId()
  const messageId = useId()
  const { confirm: confirmSlot, cancel: cancelSlot, ...dialogSlotProps } = slotProps ?? {}
  const confirmProps = { variant: 'contained' as const, color: confirmColor, ...confirmSlot }
  const cancelProps = { ...cancelSlot }
  const cancelButton = (
    <ConfirmDialogCancel
      key="cancel"
      onClick={onCancel}
      /* The rule is about autofocus on a page, which moves focus without the user asking. A
         modal dialog is the documented exception: APG requires focus to move *into* the dialog
         when it opens, and puts it on the least destructive control — here, Cancel. Removing
         this would strand focus behind the modal. */
      // eslint-disable-next-line jsx-a11y/no-autofocus
      autoFocus
      className={confirmDialogClasses.cancel}
      {...cancelProps}
    >
      {cancelLabel}
    </ConfirmDialogCancel>
  )
  const confirmButton = (
    <ConfirmDialogConfirm
      key="confirm"
      onClick={onConfirm}
      className={confirmDialogClasses.confirm}
      {...confirmProps}
    >
      {confirmLabel}
    </ConfirmDialogConfirm>
  )
  return (
    <ConfirmDialogRoot
      {...rest}
      open={open}
      onClose={onCancel}
      role="alertdialog"
      aria-labelledby={titleId}
      aria-describedby={message ? messageId : undefined}
      className={`${confirmDialogClasses.root}${className ? ` ${className}` : ''}`}
      slotProps={dialogSlotProps}
    >
      <DialogTitle id={titleId}>{title}</DialogTitle>
      {message && (
        <DialogContent>
          <DialogContentText id={messageId}>{message}</DialogContentText>
        </DialogContent>
      )}
      <DialogActions>
        {actionsOrder === 'confirm-cancel'
          ? [confirmButton, cancelButton]
          : [cancelButton, confirmButton]}
      </DialogActions>
    </ConfirmDialogRoot>
  )
}
