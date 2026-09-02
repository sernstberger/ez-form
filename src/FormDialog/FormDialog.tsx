import {
  useCallback,
  useEffect,
  useId,
  useRef,
  type ComponentProps,
  type FormHTMLAttributes,
  type ReactNode,
} from 'react'
import Button from '@mui/material/Button'
import Dialog, { type DialogProps } from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import { useDefaultProps } from '@mui/material/DefaultPropsProvider'
import generateUtilityClasses from '@mui/material/generateUtilityClasses'
import { styled } from '@mui/material/styles'
import { useFormState, type FieldValues } from 'react-hook-form'
import { Form, willRenderFormDescription, type FormProps } from '../Form'
import { SubmitButton, type SubmitButtonProps } from '../SubmitButton'
import { useConfirm, type ConfirmOptions } from '../ConfirmDialog'
import { mergeDisabled } from '../fields/mergeDisabled'
import { shouldBlockUnsavedChanges } from '../useFormGuard'

export const formDialogClasses = generateUtilityClasses('EzFormDialog', [
  'root',
  'form',
  'title',
  'content',
  'actions',
  'cancel',
  'submit',
])

/**
 * Why the dialog asked to close: MUI's own `Dialog` reasons plus this
 * component's two — `'cancelClick'` (the default Cancel button) and
 * `'submit'` (a successful submit).
 */
export type FormDialogCloseReason =
  | 'escapeKeyDown'
  | 'backdropClick'
  | 'cancelClick'
  | 'submit'
  // Keeps the union open for a future MUI reason without widening it to `string`
  // at the call site, where the four above still autocomplete.
  | (string & {})

/**
 * `Form`'s binding props only. Its `FormHTMLAttributes` half is dropped here
 * because `FormDialog`'s own DOM surface is the `Dialog`'s (a `div`) and the
 * two declare every React event handler over a different element type; native
 * `<form>` attributes go on `slotProps.form` instead.
 */
type FormBindingProps<TIn extends FieldValues, TOut> = Omit<
  FormProps<TIn, TOut>,
  | Exclude<keyof FormHTMLAttributes<HTMLFormElement>, 'children' | 'onSubmit'>
  | 'title'
  | 'slotProps'
>

export interface FormDialogProps<TIn extends FieldValues, TOut>
  extends
    Omit<
      DialogProps,
      // `title` and `children` are this component's (a heading and the fields);
      // `onClose` gains two reasons; `ref` and `onSubmit` belong to the `<form>`.
      'title' | 'onClose' | 'open' | 'slotProps' | 'children' | 'ref' | 'onSubmit'
    >,
    FormBindingProps<TIn, TOut> {
  open: boolean
  /**
   * Asked to close. Not called while the exit confirmation is pending — only
   * once it is confirmed, so `onClose` always means "it is closing".
   */
  onClose: (event: object, reason: FormDialogCloseReason) => void
  /** Dialog heading, rendered as `DialogTitle` and wired to `aria-labelledby`. */
  title?: ReactNode
  /**
   * Buttons for `DialogActions`. Defaults to a Cancel `Button` plus a
   * `SubmitButton` — pass your own to change, reorder, or add to them.
   */
  actions?: ReactNode
  /** Default `Cancel`. Ignored when `actions` is given. */
  cancelLabel?: ReactNode
  /** Default `Submit` (`SubmitButton`'s own default). Ignored when `actions` is given. */
  submitLabel?: ReactNode
  /**
   * Copy for the unsaved-changes prompt shown when a close is requested while
   * the form is dirty. Defaults to `Discard changes?` / `Discard` / `Keep
   * editing`; `false` closes immediately, dirty or not.
   */
  exitConfirm?: ConfirmOptions | false
  /** Close on a successful submit, with reason `'submit'`. Default `true`. */
  closeOnSubmit?: boolean
  slotProps?: DialogProps['slotProps'] & {
    /** The `<form>` element: native form attributes plus `Form`'s own `slotProps`. */
    form?: Omit<FormHTMLAttributes<HTMLFormElement>, 'onSubmit'> &
      Pick<FormProps<TIn, TOut>, 'slotProps'>
    title?: ComponentProps<typeof DialogTitle>
    content?: ComponentProps<typeof DialogContent>
    actions?: ComponentProps<typeof DialogActions>
    /** Ignored when `actions` is given. */
    cancel?: ComponentProps<typeof Button>
    /** Ignored when `actions` is given. */
    submit?: SubmitButtonProps
  }
}

/**
 * Every `Form` binding prop, by name, so the two halves of `FormDialogProps` can
 * be split at runtime instead of hand-destructured.
 *
 * Ruling: a `satisfies Record<keyof FormBindingProps<…>, true>` guard rather than
 * a hand-maintained destructure — a prop added to `FormProps` upstream used to
 * fall through into `...dialogProps` and land on the MUI `Dialog`'s `div` (React
 * then warns, or silently drops it). Merging #3/#4 did exactly that with
 * `submitPendingText` / `submitSuccessText` / `submitErrorText`. Now a new `Form`
 * prop fails typecheck here until it is listed. Cost if wrong: nothing silent —
 * the build breaks and names the missing key.
 */
const FORM_PROP_KEYS = {
  schema: true,
  onSubmit: true,
  defaultValues: true,
  values: true,
  resetOptions: true,
  onDefaultValuesError: true,
  ref: true,
  mode: true,
  disabled: true,
  confirm: true,
  guard: true,
  assisted: true,
  description: true,
  requiredIndicator: true,
  optionalText: true,
  requiredIndicatorText: true,
  submitPendingText: true,
  submitSuccessText: true,
  submitErrorText: true,
  children: true,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} satisfies Record<keyof FormBindingProps<any, any>, true>

const FormDialogRoot = styled(Dialog, { name: 'EzFormDialog', slot: 'Root' })({})
// MUI's dialog paper is a flex column capped at `calc(100% - 64px)`, and
// `DialogContent`'s own `flex: 1 1 auto; overflow-y: auto` is what makes long
// content scroll inside it. The `<form>` sits between the two, so it has to
// pass that layout through or nothing scrolls and the paper grows off-screen.
// Overridable via `theme.components.EzFormDialog.styleOverrides.form`.
const FormDialogForm = styled(Form, { name: 'EzFormDialog', slot: 'Form' })({
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
  flex: '1 1 auto',
}) as typeof Form
const FormDialogTitle = styled(DialogTitle, { name: 'EzFormDialog', slot: 'Title' })({})
const FormDialogContent = styled(DialogContent, { name: 'EzFormDialog', slot: 'Content' })({})
const FormDialogActions = styled(DialogActions, { name: 'EzFormDialog', slot: 'Actions' })({})

/**
 * Publishes the enclosing form's "has unsaved changes" state into a ref the
 * dialog's close handlers — which live outside the form — can read.
 *
 * Ruling: a child inside `<Form>` writing to a ref, rather than `FormDialog`
 * reading `formState` off the `Form`'s imperative `ref` — hookform's
 * `formState` is a Proxy that only keeps `isDirty` current once something has
 * *subscribed* to it during render (`control._proxyFormState.isDirty`), and a
 * read that first happens inside a keydown handler is not a subscription, so
 * the value can be stale. `useFormState()` in a real child is that
 * subscription. Cost if wrong: the exit prompt misses edits and the dialog
 * throws away work.
 */
function DirtyProbe({ dirtyRef }: { dirtyRef: React.RefObject<boolean> }) {
  const { isDirty, isSubmitting, isSubmitSuccessful } = useFormState()
  // The same predicate as `<Form guard>` and `useFormGuard` (#74): hookform
  // never clears isDirty on its own, so a form that has just been submitted
  // successfully must not still prompt on the way out.
  const dirty = shouldBlockUnsavedChanges({ isDirty, isSubmitting, isSubmitSuccessful })
  useEffect(() => {
    dirtyRef.current = dirty
  }, [dirty, dirtyRef])
  return null
}

/**
 * The default Cancel button. Disabled while the form is — which includes a
 * pending submit, where cancelling would abandon a save already in flight
 * (and would not even prompt, since a submitting form counts as not dirty).
 * The same `mergeDisabled` contract as `ClearButton` and `SubmitButton`.
 */
function CancelButton({
  onCancel,
  className,
  disabled,
  children,
  onClick,
  ...rest
}: ComponentProps<typeof Button> & { onCancel: (event: object) => void }) {
  const { disabled: formDisabled } = useFormState()
  return (
    <Button
      {...rest}
      type="button"
      onClick={(event) => {
        // The consumer's handler runs first and can veto the close with
        // `event.preventDefault()` — the native cancel idiom, and the only way
        // to keep a dialog open from a `slotProps.cancel.onClick`. It is
        // destructured out of `rest` (rather than left to the spread) so it can
        // never silently replace the close gate: before this, a consumer
        // `onClick` took the button over and Escape/backdrop were the only ways
        // out. Same shape as `ClearButton`'s handler composition (#75).
        onClick?.(event)
        if (event.defaultPrevented) return
        onCancel(event)
      }}
      disabled={mergeDisabled(disabled, formDisabled)}
      className={`${formDialogClasses.cancel}${className ? ` ${className}` : ''}`}
    >
      {children}
    </Button>
  )
}

/**
 * A `<Form>` inside a MUI `Dialog`, with the title, scrolling content and
 * actions wired up. Closing it — Escape, backdrop, or Cancel — asks first when
 * there are unsaved changes; a successful submit closes it without asking.
 */
export function FormDialog<TIn extends FieldValues, TOut>(inProps: FormDialogProps<TIn, TOut>) {
  const props = useDefaultProps({
    props: inProps,
    name: 'EzFormDialog',
  })
  const {
    // FormDialog's own
    open,
    onClose,
    title,
    actions,
    cancelLabel = 'Cancel',
    submitLabel,
    exitConfirm,
    closeOnSubmit = true,
    slotProps,
    className,
    'aria-labelledby': ariaLabelledBy,
    'aria-describedby': ariaDescribedBy,
    // `description` and `requiredIndicatorText` are read here *as well as* being
    // forwarded in `formProps` below: the dialog needs them to decide whether
    // Form will render a description worth pointing `aria-describedby` at.
    description,
    requiredIndicatorText,
    ...rest
  } = props
  // Split what is left by name rather than by hand: everything named in
  // `FORM_PROP_KEYS` goes to `<Form>`, everything else to the MUI `Dialog`. The
  // two buckets are disjoint by construction, so the casts below only recover
  // the types that `Object.entries` erases — they assert nothing new.
  const formBucket: Record<string, unknown> = {}
  const dialogBucket: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(rest)) {
    ;(key in FORM_PROP_KEYS ? formBucket : dialogBucket)[key] = value
  }
  const { children, onSubmit, ...formOwnProps } = formBucket as unknown as FormBindingProps<
    TIn,
    TOut
  >
  const dialogProps = dialogBucket as Omit<
    DialogProps,
    'title' | 'onClose' | 'open' | 'slotProps' | 'children' | 'ref' | 'onSubmit'
  >
  const baseId = useId()
  const titleId = `${baseId}-title`
  const descriptionId = `${baseId}-description`
  const {
    form: formSlot,
    title: titleSlot,
    content: contentSlot,
    actions: actionsSlot,
    cancel: cancelSlot,
    submit: submitSlot,
    ...dialogSlotProps
  } = slotProps ?? {}

  const describedByForm = willRenderFormDescription({ description, requiredIndicatorText })

  const dirtyRef = useRef(false)
  const { confirm: ask, dialog: exitDialog } = useConfirm()
  const exitOptions: ConfirmOptions | false =
    exitConfirm === false
      ? false
      : {
          title: 'Discard changes?',
          confirmLabel: 'Discard',
          cancelLabel: 'Keep editing',
          ...exitConfirm,
        }
  // Read through a ref so `requestClose` can stay stable across renders while
  // still seeing the latest copy; `exitConfirm` is usually an inline object.
  const exitOptionsRef = useRef(exitOptions)
  exitOptionsRef.current = exitOptions

  /** The one gate every close path goes through, except a successful submit. */
  const requestClose = useCallback(
    async (event: object, reason: FormDialogCloseReason) => {
      const options = exitOptionsRef.current
      if (options && dirtyRef.current && !(await ask(options))) return
      onClose(event, reason)
    },
    [ask, onClose],
  )

  return (
    <>
      <FormDialogRoot
        {...dialogProps}
        open={open}
        onClose={(event, reason) => void requestClose(event, reason)}
        aria-labelledby={ariaLabelledBy ?? (title != null ? titleId : undefined)}
        // The description renders inside the <form>, but it describes the
        // dialog: the `dialog` role lives on the paper, so the reference has to
        // be here. `description != null` is the wrong test — the
        // requiredIndicator convention is stated in that same slot and is on by
        // default in both modes (#4), so a dialog with no `description` still
        // gets one. Ask Form's own predicate instead of guessing.
        aria-describedby={ariaDescribedBy ?? (describedByForm ? descriptionId : undefined)}
        className={`${formDialogClasses.root}${className ? ` ${className}` : ''}`}
        slotProps={dialogSlotProps}
      >
        {title != null && (
          <FormDialogTitle
            {...titleSlot}
            id={titleId}
            className={`${formDialogClasses.title}${titleSlot?.className ? ` ${titleSlot.className}` : ''}`}
          >
            {title}
          </FormDialogTitle>
        )}
        <FormDialogForm
          {...formOwnProps}
          description={description}
          requiredIndicatorText={requiredIndicatorText}
          onSubmit={async (submitted, form) => {
            await onSubmit(submitted, form)
            // Only after the consumer's own handler resolves: a save that
            // rejects never reaches this line, so the dialog stays open with
            // its values intact. (A handler that reports a failure through
            // `form.setError` instead of rejecting has, as far as this
            // component can tell, succeeded — reject, or set `closeOnSubmit`,
            // to keep the dialog open in that case.) The exit prompt is not
            // consulted on this path: a submitted form has nothing unsaved.
            if (closeOnSubmit) onClose({}, 'submit')
          }}
          {...formSlot}
          slotProps={{
            ...formSlot?.slotProps,
            description: { id: descriptionId, ...formSlot?.slotProps?.description },
          }}
          className={`${formDialogClasses.form}${formSlot?.className ? ` ${formSlot.className}` : ''}`}
        >
          <FormDialogContent
            {...contentSlot}
            className={`${formDialogClasses.content}${contentSlot?.className ? ` ${contentSlot.className}` : ''}`}
          >
            {children}
          </FormDialogContent>
          <FormDialogActions
            {...actionsSlot}
            className={`${formDialogClasses.actions}${actionsSlot?.className ? ` ${actionsSlot.className}` : ''}`}
          >
            {actions ?? (
              <>
                <CancelButton
                  onCancel={(event) => void requestClose(event, 'cancelClick')}
                  {...cancelSlot}
                >
                  {cancelLabel}
                </CancelButton>
                <SubmitButton
                  {...submitSlot}
                  className={`${formDialogClasses.submit}${submitSlot?.className ? ` ${submitSlot.className}` : ''}`}
                >
                  {submitLabel ?? submitSlot?.children}
                </SubmitButton>
              </>
            )}
          </FormDialogActions>
          <DirtyProbe dirtyRef={dirtyRef} />
        </FormDialogForm>
      </FormDialogRoot>
      {exitDialog}
    </>
  )
}
