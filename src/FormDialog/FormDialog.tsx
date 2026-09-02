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
import { Form, type FormProps } from '../Form'
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
  ...rest
}: ComponentProps<typeof Button> & { onCancel: (event: object) => void }) {
  const { disabled: formDisabled } = useFormState()
  return (
    <Button
      type="button"
      onClick={onCancel}
      {...rest}
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
  }) as FormDialogProps<TIn, TOut>
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
    children,
    'aria-labelledby': ariaLabelledBy,
    'aria-describedby': ariaDescribedBy,
    // Form's
    schema,
    onSubmit,
    defaultValues,
    values,
    resetOptions,
    onDefaultValuesError,
    ref,
    mode,
    disabled,
    confirm,
    guard,
    description,
    requiredIndicator,
    optionalText,
    requiredIndicatorText,
    // Dialog's
    ...dialogProps
  } = props
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
        // `description` renders inside the <form>, but it describes the dialog:
        // the `dialog` role lives on the paper, so the reference has to be here.
        aria-describedby={ariaDescribedBy ?? (description != null ? descriptionId : undefined)}
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
          schema={schema}
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
          defaultValues={defaultValues}
          values={values}
          resetOptions={resetOptions}
          onDefaultValuesError={onDefaultValuesError}
          ref={ref}
          mode={mode}
          disabled={disabled}
          confirm={confirm}
          guard={guard}
          description={description}
          requiredIndicator={requiredIndicator}
          optionalText={optionalText}
          requiredIndicatorText={requiredIndicatorText}
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
