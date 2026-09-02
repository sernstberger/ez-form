import {
  useEffect,
  useImperativeHandle,
  useState,
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
import type { z } from 'zod'
import { ezResolver } from './ezResolver'
import { useConfirm, type ConfirmOptions } from '../ConfirmDialog'

/**
 * The hookform methods for this form. It is the same object `useFormContext()`
 * returns inside the form; it is handed to `onSubmit` so the component that
 * owns the form can `reset`, `setError`, etc. without a child component, and
 * exposed through `ref` for the same purpose from outside.
 */
export type FormMethods<TIn extends FieldValues, TOut> = UseFormReturn<TIn, unknown, TOut>

export interface FormProps<TIn extends FieldValues, TOut> extends Omit<
  FormHTMLAttributes<HTMLFormElement>,
  'onSubmit'
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
  children: ReactNode
}

export function Form<TIn extends FieldValues, TOut>({
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
  children,
  ...formProps
}: FormProps<TIn, TOut>) {
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
  const methods = useForm<TIn, unknown, TOut>({
    resolver: ezResolver(schema),
    defaultValues: wrappedDefaultValues,
    values,
    resetOptions,
    mode,
    disabled: disabled || submitting || loading,
  })
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
      <form
        noValidate
        {...formProps}
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
        {children}
        {dialog}
      </form>
    </FormProvider>
  )
}
