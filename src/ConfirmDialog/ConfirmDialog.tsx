import { useId, useRef, type ReactNode } from 'react'
import Button, { type ButtonProps } from '@mui/material/Button'
import Dialog, { type DialogProps } from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import { styled } from '@mui/material/styles'
import { useDefaultProps } from '@mui/material/DefaultPropsProvider'
import generateUtilityClasses from '@mui/material/generateUtilityClasses'
import type { TransitionProps } from '@mui/material/transitions'

/**
 * Whether `element` is in the tab order. Used only to tell a real control apart from the
 * dialog's own `tabIndex=-1` paper; not a general tabbability check.
 */
function isTabbable(element: Element): boolean {
  return (
    element instanceof HTMLElement && !element.hasAttribute('disabled') && element.tabIndex >= 0
  )
}

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
     * accident, and is re-focused once the dialog's enter transition finishes
     * (MUI's `Dialog` claims initial focus for its own paper — see the note on
     * `ConfirmDialog`). Pass `{ autoFocus: false }` here to opt out of both —
     * it's applied after the default, so it wins.
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
 *
 * Getting that focus onto Cancel takes `autoFocus` *and* a re-focus after the
 * enter transition. Since v9.0.1 (mui/material-ui#48280, which fixed keyboard
 * scrolling in `fullScreen` dialogs) MUI's `Dialog` marks its own paper
 * `data-mui-focusable`, and `FocusTrap` focuses that marked target rather than
 * any `autoFocus` child. `autoFocus` only survives when the dialog is `open`
 * from its first render — React then focuses Cancel in the same commit that
 * mounts the paper, so `FocusTrap`'s `contains(root, activeElement)` guard
 * short-circuits. Every real caller here (`useConfirm`, `Form confirm`,
 * `ClearButton confirm`, `FormDialog`'s exit prompt, `useFormGuard`'s blocker)
 * instead flips `open` in a click handler, `Modal`'s `exited` state splits that
 * mount across commits, the guard doesn't fire, and focus lands on the paper —
 * so Enter right after open did nothing and the safe-button-focused property
 * was lost (#119).
 *
 * The paper keeping focus is correct for a generic dialog; an `alertdialog`
 * wants the least destructive control instead (APG), so we opt out here rather
 * than upstream. `onEntered` is MUI's own documented post-enter hook and runs
 * after the trap has settled, which keeps `FocusTrap` fully in charge of the
 * trap itself — no `disableAutoFocus`, and `disableRestoreFocus` is untouched,
 * so focus still returns to the trigger on close.
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
  const {
    confirm: confirmSlot,
    cancel: cancelSlot,
    transition: transitionSlot,
    ...dialogSlotProps
  } = slotProps ?? {}
  const confirmProps = { variant: 'contained' as const, color: confirmColor, ...confirmSlot }
  const cancelProps = { ...cancelSlot }
  // `autoFocus` is what the consumer opted out of; honour it for the re-focus too.
  const focusCancelOnEnter = cancelProps.autoFocus ?? true
  const cancelRef = useRef<HTMLButtonElement>(null)
  const makeHandleEntered =
    (consumerOnEntered: TransitionProps['onEntered']): TransitionProps['onEntered'] =>
    (node, isAppearing) => {
      const cancel = cancelRef.current
      // Only reclaim focus from the surface MUI parked it on. That surface is the dialog's
      // own paper, which is deliberately not tabbable (`tabIndex=-1`), so "the active
      // element is not tabbable" identifies it without reaching into MUI's private
      // `data-mui-focusable` marker. If focus already sits on a real control — a consumer's
      // own `onEntered`, an `autoFocus` in custom content, or the user clicking or tabbing
      // during the transition — leave it exactly where it is.
      const active = cancel?.ownerDocument.activeElement
      if (focusCancelOnEnter && cancel && (!active || !isTabbable(active))) {
        cancel.focus()
      }
      consumerOnEntered?.(node, isAppearing)
    }
  // `slotProps.transition` may be an object or an ownerState callback; resolve the callback
  // form so a consumer's own props (and their `onEntered`) survive rather than being dropped.
  const transitionSlotProps: NonNullable<DialogProps['slotProps']>['transition'] = (ownerState) => {
    const resolved =
      (typeof transitionSlot === 'function' ? transitionSlot(ownerState) : transitionSlot) ?? {}
    return { ...resolved, onEntered: makeHandleEntered(resolved.onEntered) }
  }
  const cancelButton = (
    <ConfirmDialogCancel
      key="cancel"
      ref={cancelRef}
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
      slotProps={{ ...dialogSlotProps, transition: transitionSlotProps }}
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
