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
  children: ReactNode
}

export function Form<TIn extends FieldValues, TOut>({
  schema,
  onSubmit,
  defaultValues,
  values,
  resetOptions,
  ref,
  mode = 'onSubmit',
  disabled = false,
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
  const methods = useForm<TIn, unknown, TOut>({
    resolver: ezResolver(schema),
    defaultValues,
    values,
    resetOptions,
    mode,
    disabled: disabled || submitting || loading,
  })
  const { isLoading } = useFormState({ control: methods.control })
  useEffect(() => {
    setLoading(isLoading)
  }, [isLoading])
  useImperativeHandle(ref, () => methods, [methods])

  return (
    <FormProvider {...methods}>
      <form
        noValidate
        {...formProps}
        onSubmit={methods.handleSubmit(async (submitted) => {
          setSubmitting(true)
          try {
            await onSubmit(submitted, methods)
          } finally {
            setSubmitting(false)
          }
        })}
      >
        {children}
      </form>
    </FormProvider>
  )
}
