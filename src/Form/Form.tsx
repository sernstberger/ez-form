import {
  useCallback,
  forwardRef,
  Fragment,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ElementType,
  type FormHTMLAttributes,
  type ReactNode,
  type Ref,
} from 'react'
import {
  FormProvider,
  useForm,
  useFormState,
  type DefaultValues,
  type FieldValues,
  type KeepStateOptions,
  type Mode,
  type UseFormReturn,
} from 'react-hook-form'
import { useDefaultProps } from '@mui/material/DefaultPropsProvider'
import generateUtilityClasses from '@mui/material/generateUtilityClasses'
import { styled } from '@mui/material/styles'
import Typography, { type TypographyProps } from '@mui/material/Typography'
import type { z } from 'zod'
import { ezResolver } from './ezResolver'
import { useConfirm, type ConfirmOptions } from '../ConfirmDialog'
import { ErrorSummaryContext } from './ErrorSummaryContext'
import { LiveRegion, type LiveRegionProps } from './LiveRegion'
import { RequiredIndicatorContext } from './RequiredIndicatorContext'
import { shouldBlockUnsavedChanges } from '../useFormGuard'

/**
 * The hookform methods for this form. It is the same object `useFormContext()`
 * returns inside the form; it is handed to `onSubmit` so the component that
 * owns the form can `reset`, `setError`, etc. without a child component, and
 * exposed through `ref` for the same purpose from outside.
 */
export type FormMethods<TIn extends FieldValues, TOut> = UseFormReturn<TIn, unknown, TOut>

export const formClasses = generateUtilityClasses('EzForm', [
  'root',
  'title',
  'description',
  'status',
])

/** Typography plus `component`, so a slot can pick its element (heading level). */
export type FormTextSlotProps = TypographyProps & { component?: ElementType }

const FormRoot = styled('form', { name: 'EzForm', slot: 'Root' })({})
const FormTitle = styled(Typography, { name: 'EzForm', slot: 'Title' })({})
const FormDescription = styled(Typography, { name: 'EzForm', slot: 'Description' })({})
// The submit-status region gets its own EzForm slot rather than rendering a bare
// LiveRegion: every migrated call site now carries `EzLiveRegion-root` too, so
// that class alone no longer identifies *this* region — a form containing a
// FieldArray or ResendCodeButton has several, and this one renders last.
// `formClasses.status` is what names it, for a theme and for a test query.
const FormStatus = styled(LiveRegion, { name: 'EzForm', slot: 'Status' })({})

export interface FormProps<TIn extends FieldValues, TOut> extends Omit<
  FormHTMLAttributes<HTMLFormElement>,
  'onSubmit' | 'title'
> {
  /** zod schema. Its input type types `defaultValues`; its output type types `onSubmit`. */
  schema: z.ZodType<TOut, TIn>
  onSubmit: (values: NoInfer<TOut>, form: FormMethods<TIn, TOut>) => void | Promise<void>
  /**
   * Initial values, or an async function that loads them (for example from an
   * API). While the function is pending the whole form is disabled, like
   * during a pending submit, and the fields fill in when it resolves.
   */
  defaultValues?: NoInfer<DefaultValues<TIn>> | (() => Promise<NoInfer<TIn>>)
  /**
   * Reactive values: whenever this prop changes the form resets to it. For
   * consumers who fetch with a data hook (React Query, SWR).
   */
  values?: NoInfer<TIn>
  /** What a reset caused by `values` or async `defaultValues` keeps (dirty values, errors, …). */
  resetOptions?: KeepStateOptions
  /**
   * Called when the async `defaultValues` function rejects. The form
   * re-enables with its fields empty (no defaults were applied), subject to
   * `resetOptions` (hookform applies it on this reset too). If omitted, the
   * rejection is rethrown so it surfaces as an unhandled rejection; the form
   * still re-enables either way.
   *
   * Called after hookform's own post-rejection reset has settled, so a
   * `setError` made synchronously inside this callback (via `ref` or the
   * `form` argument passed elsewhere) is not wiped by that reset — it is
   * safe to call `setError` here directly, with no `setTimeout`/deferral.
   */
  onDefaultValuesError?: (error: unknown) => void
  /** The form methods, for `reset` / `setValue` / `setError` from a parent. */
  ref?: Ref<FormMethods<TIn, TOut>>
  mode?: Mode
  /**
   * Disables every field in the form (hookform's form-level `disabled`).
   * Like a native form, hookform excludes disabled fields from the submit
   * payload while the form is disabled; re-enabling restores them. Fields are
   * also disabled automatically while `onSubmit` is pending (the values for
   * that submit are already captured, so they are unaffected) and while async
   * `defaultValues` are loading.
   */
  disabled?: boolean
  /**
   * Ask before submitting. Runs after validation inside the submit handler,
   * so an invalid form never asks, and every submit path (button, Enter in a
   * field, `form.requestSubmit()`) asks. `true` uses the default copy
   * (`Submit?`); pass `ConfirmOptions` for your own.
   */
  confirm?: true | ConfirmOptions
  /**
   * Warn on tab close / reload while the form is dirty and not submitting
   * (a `beforeunload` listener). For in-app navigation use `useFormGuard`.
   */
  guard?: boolean
  /**
   * Accessible name of the form, rendered as a heading (`h2` by default,
   * `slotProps.title.component` changes the level) and wired to the `<form>`
   * through `aria-labelledby`. A consumer's own `aria-labelledby` wins.
   */
  title?: ReactNode
  /** Instructions under the title, wired through `aria-describedby`. */
  description?: ReactNode
  /**
   * How fields mark required/optional. `'asterisk'` (default): every field's
   * own `required` drives MUI's usual asterisk, nothing else changes.
   * `'optional'`: required fields keep `required`/`aria-required` but render
   * no asterisk; fields that are not required get `optionalText` appended to
   * their label. Theme-defaultable via `theme.components.EzForm.defaultProps`.
   */
  requiredIndicator?: 'asterisk' | 'optional'
  /** Appended to a not-required field's label when `requiredIndicator="optional"`. */
  optionalText?: ReactNode
  /**
   * States the `requiredIndicator="optional"` convention once, in the form's
   * `description` (appended as a second sentence when `description` is also
   * set). `false` suppresses it. Ignored in `'asterisk'` mode.
   */
  requiredIndicatorText?: ReactNode | false
  /**
   * Announced when a submit starts. `false` suppresses just this one.
   * Default "Submitting…".
   */
  submitPendingText?: ReactNode | false
  /** Announced when `onSubmit` resolves. `false` suppresses. Default "Submitted." */
  submitSuccessText?: ReactNode | false
  /**
   * Announced when `onSubmit` rejects. `false` suppresses. Default "Submit failed."
   *
   * A *validation* failure is not this: the schema rejected, `onSubmit` never
   * ran, and `<FormErrorSummary>` already announces and lists what is wrong.
   * Announcing "Submit failed." there would talk over it.
   */
  submitErrorText?: ReactNode | false
  slotProps?: {
    title?: FormTextSlotProps
    description?: FormTextSlotProps
    /** The form's submit-status live region. `message`/`announcementKey` are owned by the form. */
    liveRegion?: Omit<LiveRegionProps, 'message' | 'announcementKey'>
  }
  children: ReactNode
}

function FormImpl<TIn extends FieldValues, TOut>(
  inProps: FormProps<TIn, TOut>,
  forwardedRef: Ref<FormMethods<TIn, TOut>>,
) {
  const {
    schema,
    onSubmit,
    defaultValues,
    values,
    resetOptions,
    onDefaultValuesError,
    // `ref` stays in `FormProps` because that is the consumer-facing type, but it is never
    // read from props here: React removes it before props reach a `forwardRef` render
    // function and hands it over as the second argument instead, on both majors. Pulled
    // out of the rest anyway so a stray one could never land on the DOM `<form>`.
    ref: _ref,
    mode = 'onSubmit',
    disabled = false,
    confirm,
    guard = false,
    title,
    description,
    requiredIndicator = 'asterisk',
    optionalText = '(optional)',
    requiredIndicatorText = 'All fields are required unless marked optional.',
    submitPendingText = 'Submitting…',
    submitSuccessText = 'Submitted.',
    submitErrorText = 'Submit failed.',
    slotProps,
    className,
    children,
    'aria-labelledby': ariaLabelledBy,
    'aria-describedby': ariaDescribedBy,
    ...formProps
  } = useDefaultProps({ props: inProps, name: 'EzForm' }) as FormProps<TIn, TOut>
  const baseId = useId()
  const titleId = `${baseId}-title`
  const descriptionId = `${baseId}-description`
  const titleProps = { component: 'h2', variant: 'h5', ...slotProps?.title } as const
  const descriptionProps = { component: 'p', variant: 'body2', ...slotProps?.description } as const
  // The "required unless marked optional" convention is stated once, in the same
  // slot as `description`: appended as a second sentence when both are set, or
  // rendered alone when `description` is unset. Only relevant in `optional` mode;
  // `requiredIndicatorText={false}` (or `asterisk` mode) suppresses it.
  const showRequiredIndicatorText =
    requiredIndicator === 'optional' && requiredIndicatorText !== false
  const effectiveDescription = showRequiredIndicatorText ? (
    description != null ? (
      <Fragment>
        {description} {requiredIndicatorText}
      </Fragment>
    ) : (
      requiredIndicatorText
    )
  ) : (
    description
  )
  // Local flags rather than formState: useForm hands this component a React-state
  // snapshot of formState, so the new value is not readable before the useForm
  // call on the render where it changes. hookform applies the `disabled` option
  // reactively (control._disableForm in an effect).
  const [submitting, setSubmitting] = useState(false)
  // hookform reports async defaults through formState.isLoading; it starts true
  // when defaultValues is a function, so the form is disabled from the first render.
  const [loading, setLoading] = useState(typeof defaultValues === 'function')
  // A rejection to report once hookform's own post-rejection reset has settled (see
  // below) rather than from inside the .catch() below. Ruling: a ref, not state — it
  // is read once from an effect and cleared synchronously in that same pass, so it
  // never needs to drive a render itself. Cost if wrong: a second rejection landing
  // before the effect flushes the first would only ever have the newer one to report,
  // since hookform allows at most one in-flight _resetDefaultValues() at a time.
  const pendingDefaultValuesError = useRef<{ error: unknown } | null>(null)
  // hookform's internal _resetDefaultValues() calls defaultValues().then(...) with no
  // .catch, so isLoading (and this form's `loading`) never clears on rejection. Wrap it
  // so a rejection still clears `loading` (via the isLoading-driven effect below, not
  // here — see the ruling on that effect) and either report it or rethrow so it surfaces
  // as an unhandled rejection (current JS norm) — either way the form re-enables.
  // Recreating this wrapper on every render is safe: useForm only reads the function-form
  // defaultValues once, at mount (createFormControl runs once, guarded by !_formControl.current),
  // so a new closure identity here each render never triggers an extra reset.
  //
  // Ruling: stash the error in a ref here and report it from the isLoading effect below,
  // instead of calling onDefaultValuesError (or setLoading) synchronously in this .catch —
  // #70. hookform's _resetDefaultValues does `_options.defaultValues().then(values => {
  // reset(values, resetOptions); _subjects.state.next({isLoading: false})})`, i.e. it
  // chains its own reset onto the very promise this .catch() resolves, and that reset
  // clears formState.errors unless resetOptions.keepErrors is set
  // (node_modules/react-hook-form/dist/index.esm.mjs, _reset:
  // `if (!keepStateOptions.keepErrors) { _formState.errors = {} }`). A setError called
  // synchronously in this .catch() is guaranteed to run *before* that clear, not after —
  // the opposite of what a consumer needs. Queuing a microtask here does not fix it either:
  // hookform's .then() is itself only one microtask away at this point, so a single queued
  // microtask still lands before it (verified empirically against this exact hookform
  // version). The isLoading flip is a reliable "after" signal instead, because it is what
  // that same reset causes (_reset sets _formState.errors = {} synchronously, *then*
  // _resetDefaultValues's .then() sends {isLoading: false} to hookform's state subject,
  // which is what useFormState's subscription turns into the isLoading this component
  // reads) — so an effect keyed on isLoading turning false necessarily runs after the
  // errors clear has already happened. setLoading(false) must also move into that same
  // effect (not stay here) so the fields re-enable in lockstep with the error report,
  // rather than a beat earlier from this .catch — otherwise a consumer awaiting "fields
  // enabled" as a proxy for "settled" observes state from before the reset even reset.
  // Cost if wrong: onDefaultValuesError would again run too early and a setError inside
  // it would be silently wiped, same as #70.
  const wrappedDefaultValues =
    typeof defaultValues === 'function'
      ? () =>
          defaultValues().catch((error: unknown) => {
            if (onDefaultValuesError) {
              // hookform's own reset (see the ruling above) is what will flip isLoading to
              // false; let the effect below clear `loading` then, so it does so in lockstep
              // with reporting the error.
              pendingDefaultValuesError.current = { error }
              return {} as NoInfer<TIn>
            }
            // Rethrowing keeps hookform's _resetDefaultValues().then(...) from ever running
            // (no .catch there), so its isLoading never flips to false — this form's own
            // `loading` has to clear right here instead.
            setLoading(false)
            throw error
          })
      : defaultValues
  // How many mounted <FormErrorSummary> are inside this form. hookform's own "focus the
  // first invalid field" (shouldFocusError) would fight a summary that moves focus to its
  // heading instead, so it is suppressed for as long as at least one is mounted.
  const [errorSummaryCount, setErrorSummaryCount] = useState(0)
  const registerErrorSummary = useCallback(() => {
    setErrorSummaryCount((n) => n + 1)
    return () => setErrorSummaryCount((n) => n - 1)
  }, [])
  // Bumped when the confirm path's own pre-submit trigger() (below) comes back invalid — see
  // ErrorSummaryContext's failedConfirmAttempt doc for why a plain form's summary needs this.
  const [failedConfirmAttempt, setFailedConfirmAttempt] = useState(0)
  const errorSummaryContext = useMemo(
    () => ({ registerErrorSummary, errorSummaryCount, failedConfirmAttempt }),
    [registerErrorSummary, errorSummaryCount, failedConfirmAttempt],
  )
  const methods = useForm<TIn, unknown, TOut>({
    resolver: ezResolver(schema),
    defaultValues: wrappedDefaultValues,
    values,
    resetOptions,
    mode,
    disabled: disabled || submitting || loading,
    // Ruling: passed directly to useForm rather than written into control._options by a
    // separate effect — react-hook-form's own useForm re-assigns `control._options = props`
    // on every render (unconditionally, not just at mount; see its source), so this option is
    // already live as errorSummaryCount changes with no extra wiring needed. Cost if wrong: a
    // summary mounted after the initial render would fail to suppress hookform's own
    // first-invalid-field focus, so both it and the summary heading would compete for focus.
    shouldFocusError: errorSummaryCount === 0,
  })
  const { isLoading, isDirty, isSubmitting, isSubmitSuccessful } = useFormState({
    control: methods.control,
  })
  // Ruling: read methods.formState.errors here, unused — #70. hookform only re-renders a
  // form-wide (non-per-field) error like 'root.server' if some *root* consumer has read
  // formState.errors at least once: getProxyFormState's getter marks control._proxyFormState
  // in a way only a root reader (useForm itself, via `methods.formState`) satisfies, not a
  // scoped one (useFormState's own proxy, or a field's per-name useController/fieldState —
  // what every field in src/fields/*.tsx actually reads). Without this line, nothing in a
  // typical form ever reads the whole-form `errors` object, so setError('root.server', …)
  // mutates hookform's internal state correctly (verified directly on `control._formState`)
  // but no render ever picks it up — `ref.current.formState.errors` stays stale forever, not
  // just late. Cost if wrong/removed: root-level errors like this become invisible through
  // `ref`/`formState` even though setError "succeeded", with no error and no obvious cause.
  void methods.formState.errors
  useEffect(() => {
    if (pendingDefaultValuesError.current) {
      const { error } = pendingDefaultValuesError.current
      pendingDefaultValuesError.current = null
      onDefaultValuesError?.(error)
    }
    setLoading(isLoading)
  }, [isLoading, onDefaultValuesError])
  useImperativeHandle(forwardedRef, () => methods, [methods])

  const { confirm: ask, dialog } = useConfirm()
  const confirmOptions: ConfirmOptions | undefined =
    confirm === true ? { title: 'Submit?' } : confirm

  // Ruling: share shouldBlockUnsavedChanges with useFormGuard rather than repeating
  // the isDirty/isSubmitting/isSubmitSuccessful formula inline — #74. isDirty stays
  // true after a successful submit (hookform only clears it on an explicit reset()),
  // so without isSubmitSuccessful this effect re-armed the listener the instant
  // isSubmitting flipped back to false post-submit, warning on unload for changes
  // that were, in fact, just saved. Cost if wrong: the beforeunload prompt fires
  // after every successful submit until the next edit, and a future edit to one
  // guard's predicate silently drifts from the other's.
  useEffect(() => {
    if (!guard || !shouldBlockUnsavedChanges({ isDirty, isSubmitting, isSubmitSuccessful })) return
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [guard, isDirty, isSubmitting, isSubmitSuccessful])

  // Ruling: announce from inside this handler rather than from an effect on
  // formState — the existing submit path is already the one place that knows all
  // three outcomes, and hookform's own flags cannot tell them apart on their own.
  // `isSubmitSuccessful` is false both when the schema rejected and when
  // `onSubmit` threw (handleSubmit sets it to `isEmptyObject(errors) &&
  // !onValidError`), so an effect would have to re-derive "did onValid actually
  // run" from the errors object to avoid announcing "Submit failed." at a
  // validation failure — which requirement 2 forbids, since FormErrorSummary
  // owns that case. Here the distinction is free: this callback only runs when
  // validation passed, so its catch is unambiguously a submit failure. Cost if
  // wrong: a validation failure would announce over the error summary, and the
  // pending/settled pair could drift out of step with the real submit.
  const [announcement, setAnnouncement] = useState<{ text: ReactNode; seq: number }>({
    text: null,
    seq: 0,
  })
  // `seq` (not the text) is what makes a repeat audible: a second failed submit
  // sets the identical string, which is not a content change on its own. See
  // LiveRegion's `announcementKey`.
  const announce = useCallback((text: ReactNode | false) => {
    if (text === false) return
    setAnnouncement((prev) => ({ text, seq: prev.seq + 1 }))
  }, [])

  const submit = methods.handleSubmit(async (submitted) => {
    setSubmitting(true)
    announce(submitPendingText)
    try {
      await onSubmit(submitted, methods)
      announce(submitSuccessText)
    } catch (error) {
      announce(submitErrorText)
      throw error
    } finally {
      setSubmitting(false)
    }
  })

  return (
    <FormProvider {...methods}>
      <ErrorSummaryContext.Provider value={errorSummaryContext}>
        <FormRoot
          noValidate
          {...formProps}
          className={`${formClasses.root}${className ? ` ${className}` : ''}`}
          aria-labelledby={ariaLabelledBy ?? (title != null ? titleId : undefined)}
          aria-describedby={
            ariaDescribedBy ?? (effectiveDescription != null ? descriptionId : undefined)
          }
          onSubmit={
            confirmOptions
              ? async (event) => {
                  event.preventDefault()
                  // Validate first (focusing the first error like handleSubmit does, unless a
                  // mounted summary is handling that instead) so an invalid form never asks;
                  // handleSubmit re-validates on Confirm, which is cheap and keeps hookform's
                  // isSubmitting confined to the real submit. No try/catch: a rejecting
                  // resolver here (e.g. a throwing `validate` rule) propagates like the
                  // non-confirm path's handleSubmit does. Nothing is stranded either way —
                  // `submitting` and the dialog only ever get set after this awaits
                  // successfully (`ask` itself never rejects, see useConfirm).
                  const valid = await methods.trigger(undefined, {
                    shouldFocus: errorSummaryCount === 0,
                  })
                  if (!valid) {
                    // This path never reaches handleSubmit, so submitCount never increments —
                    // a plain form's <FormErrorSummary> (outside a Wizard) needs its own signal
                    // that an attempt just failed. See ErrorSummaryContext.failedConfirmAttempt.
                    setFailedConfirmAttempt((n) => n + 1)
                    return
                  }
                  if (await ask(confirmOptions)) await submit(event)
                }
              : submit
          }
        >
          {title != null && (
            <FormTitle
              {...titleProps}
              id={titleId}
              className={`${formClasses.title}${titleProps.className ? ` ${titleProps.className}` : ''}`}
            >
              {title}
            </FormTitle>
          )}
          {effectiveDescription != null && (
            <FormDescription
              {...descriptionProps}
              id={descriptionId}
              className={`${formClasses.description}${descriptionProps.className ? ` ${descriptionProps.className}` : ''}`}
            >
              {effectiveDescription}
            </FormDescription>
          )}
          <RequiredIndicatorContext.Provider value={{ requiredIndicator, optionalText }}>
            {children}
          </RequiredIndicatorContext.Provider>
          {/*
            Rendered unconditionally, empty at rest: a live region has to be in
            the DOM before its text arrives, or assistive tech has no prior
            content to observe changing and the first announcement is missed.
          */}
          <FormStatus
            {...slotProps?.liveRegion}
            message={announcement.text}
            announcementKey={announcement.seq}
            className={`${formClasses.status}${slotProps?.liveRegion?.className ? ` ${slotProps.liveRegion.className}` : ''}`}
          />
          {dialog}
        </FormRoot>
      </ErrorSummaryContext.Provider>
    </FormProvider>
  )
}

/**
 * The form. See `FormProps` for the API.
 *
 * Wrapped in `forwardRef` so `ref` reaches the imperative handle on React 18 as well as
 * 19 (#71): on 19 a function component receives `ref` as an ordinary prop, but on 18 it
 * does not — a plain `Form` would silently never populate the consumer's ref there, while
 * the peer range advertises `^18 || ^19`. `forwardRef` delivers it on both.
 *
 * `forwardRef` erases the generics (it returns a non-generic exotic component), so the
 * result is cast back to a callable generic signature — the same thing MUI does for its
 * own generic components (see `@mui/material/Autocomplete`, whose `forwardRef` result is
 * cast to a generic call signature). The cast is the only way to keep `Form<TIn, TOut>`
 * inferring from `schema`/`defaultValues`; it changes no runtime behaviour, and
 * `FormProps` (including its `ref` field) is unchanged for consumers.
 */
export const Form = forwardRef(FormImpl) as <TIn extends FieldValues, TOut>(
  props: FormProps<TIn, TOut>,
) => ReactNode
