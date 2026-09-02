import {
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
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

/**
 * The hookform methods for this form. It is the same object `useFormContext()`
 * returns inside the form; it is handed to `onSubmit` so the component that
 * owns the form can `reset`, `setError`, etc. without a child component, and
 * exposed through `ref` for the same purpose from outside.
 */
export type FormMethods<TIn extends FieldValues, TOut> = UseFormReturn<TIn, unknown, TOut>

export const formClasses = generateUtilityClasses('EzForm', ['root', 'title', 'description'])

/** Typography plus `component`, so a slot can pick its element (heading level). */
export type FormTextSlotProps = TypographyProps & { component?: ElementType }

const FormRoot = styled('form', { name: 'EzForm', slot: 'Root' })({})
const FormTitle = styled(Typography, { name: 'EzForm', slot: 'Title' })({})
const FormDescription = styled(Typography, { name: 'EzForm', slot: 'Description' })({})

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
  slotProps?: {
    title?: FormTextSlotProps
    description?: FormTextSlotProps
  }
  children: ReactNode
}

export function Form<TIn extends FieldValues, TOut>(inProps: FormProps<TIn, TOut>) {
  const {
    schema,
    onSubmit,
    defaultValues,
    values,
    resetOptions,
    onDefaultValuesError,
    ref,
    mode = 'onSubmit',
    disabled = false,
    confirm,
    guard = false,
    title,
    description,
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
  // Local flags rather than formState: useForm hands this component a React-state
  // snapshot of formState, so the new value is not readable before the useForm
  // call on the render where it changes. hookform applies the `disabled` option
  // reactively (control._disableForm in an effect).
  const [submitting, setSubmitting] = useState(false)
  // hookform reports async defaults through formState.isLoading; it starts true
  // when defaultValues is a function, so the form is disabled from the first render.
  const [loading, setLoading] = useState(typeof defaultValues === 'function')
  // hookform's internal _resetDefaultValues() calls defaultValues().then(...) with no
  // .catch, so isLoading (and this form's `loading`) never clears on rejection. Wrap it
  // so a rejection still clears `loading`, then either report it or rethrow so it
  // surfaces as an unhandled rejection (current JS norm) — either way the form re-enables.
  // Recreating this wrapper on every render is safe: useForm only reads the function-form
  // defaultValues once, at mount (createFormControl runs once, guarded by !_formControl.current),
  // so a new closure identity here each render never triggers an extra reset.
  const wrappedDefaultValues =
    typeof defaultValues === 'function'
      ? () =>
          defaultValues().catch((error: unknown) => {
            setLoading(false)
            if (onDefaultValuesError) {
              onDefaultValuesError(error)
              return {} as NoInfer<TIn>
            }
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
  const errorSummaryContext = useMemo(() => ({ registerErrorSummary }), [registerErrorSummary])
  const methods = useForm<TIn, unknown, TOut>({
    resolver: ezResolver(schema),
    defaultValues: wrappedDefaultValues,
    values,
    resetOptions,
    mode,
    disabled: disabled || submitting || loading,
    // Read once, at mount, like every other useForm option normally would be — kept live below.
    shouldFocusError: errorSummaryCount === 0,
  })
  // Ruling: hookform's `_focusError` reads `_options.shouldFocusError` fresh on every
  // submit rather than capturing the value passed to `useForm()`, so mutating the private
  // `control._options` in an effect (rather than only setting it once, at mount) is enough
  // to keep it correct as summaries mount/unmount later — verified against
  // react-hook-form's source (`_focusError = () => _options.shouldFocusError && …`).
  // Cost if wrong: a summary mounted after the initial render would fail to suppress
  // hookform's own first-invalid-field focus, so both it and the summary heading would
  // compete for focus after a failed submit.
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(methods.control as any)._options.shouldFocusError = errorSummaryCount === 0
  }, [methods.control, errorSummaryCount])
  const { isLoading, isDirty, isSubmitting } = useFormState({ control: methods.control })
  useEffect(() => {
    setLoading(isLoading)
  }, [isLoading])
  useImperativeHandle(ref, () => methods, [methods])

  const { confirm: ask, dialog } = useConfirm()
  const confirmOptions: ConfirmOptions | undefined =
    confirm === true ? { title: 'Submit?' } : confirm

  useEffect(() => {
    if (!guard || !isDirty || isSubmitting) return
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [guard, isDirty, isSubmitting])

  const submit = methods.handleSubmit(async (submitted) => {
    setSubmitting(true)
    try {
      await onSubmit(submitted, methods)
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
          aria-describedby={ariaDescribedBy ?? (description != null ? descriptionId : undefined)}
          onSubmit={
            confirmOptions
              ? async (event) => {
                  event.preventDefault()
                  // Validate first (focusing the first error like handleSubmit does) so an
                  // invalid form never asks; handleSubmit re-validates on Confirm, which is
                  // cheap and keeps hookform's isSubmitting confined to the real submit.
                  // No try/catch: a rejecting resolver here (e.g. a throwing `validate` rule)
                  // propagates like the non-confirm path's handleSubmit does. Nothing is
                  // stranded either way — `submitting` and the dialog only ever get set after
                  // this awaits successfully (`ask` itself never rejects, see useConfirm).
                  const valid = await methods.trigger(undefined, { shouldFocus: true })
                  if (!valid) return
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
          {description != null && (
            <FormDescription
              {...descriptionProps}
              id={descriptionId}
              className={`${formClasses.description}${descriptionProps.className ? ` ${descriptionProps.className}` : ''}`}
            >
              {description}
            </FormDescription>
          )}
          {children}
          {dialog}
        </FormRoot>
      </ErrorSummaryContext.Provider>
    </FormProvider>
  )
}
