import { useState, type FormHTMLAttributes, type ReactNode } from 'react'
import {
  FormProvider,
  useForm,
  type DefaultValues,
  type FieldValues,
  type Mode,
  type UseFormReturn,
} from 'react-hook-form'
import type { z } from 'zod'
import { ezResolver } from './ezResolver'

/**
 * The hookform methods for this form. It is the same object `useFormContext()`
 * returns inside the form; it is handed to `onSubmit` so the component that
 * owns the form can `reset`, `setError`, etc. without a child component.
 */
export type FormMethods<TIn extends FieldValues, TOut> = UseFormReturn<TIn, unknown, TOut>

export interface FormProps<TIn extends FieldValues, TOut>
  extends Omit<FormHTMLAttributes<HTMLFormElement>, 'onSubmit'> {
  /** zod schema. Its input type types `defaultValues`; its output type types `onSubmit`. */
  schema: z.ZodType<TOut, TIn>
  onSubmit: (values: NoInfer<TOut>, form: FormMethods<TIn, TOut>) => void | Promise<void>
  defaultValues?: NoInfer<DefaultValues<TIn>>
  mode?: Mode
  /**
   * Disables every field in the form (hookform's form-level `disabled`).
   * Like a native form, hookform excludes disabled fields from the submit
   * payload while the form is disabled; re-enabling restores them. Fields are
   * also disabled automatically while `onSubmit` is pending (the values for
   * that submit are already captured, so they are unaffected).
   */
  disabled?: boolean
  children: ReactNode
}

export function Form<TIn extends FieldValues, TOut>({
  schema,
  onSubmit,
  defaultValues,
  mode = 'onSubmit',
  disabled = false,
  children,
  ...formProps
}: FormProps<TIn, TOut>) {
  // Local flag rather than formState.isSubmitting: useForm hands this component
  // a React-state snapshot of formState, so the new value is not readable before
  // the useForm call on the render where it changes. hookform applies the
  // `disabled` option reactively (control._disableForm in an effect).
  const [submitting, setSubmitting] = useState(false)
  const methods = useForm<TIn, unknown, TOut>({
    resolver: ezResolver(schema),
    defaultValues,
    mode,
    disabled: disabled || submitting,
  })

  return (
    <FormProvider {...methods}>
      <form
        noValidate
        {...formProps}
        onSubmit={methods.handleSubmit(async (values) => {
          setSubmitting(true)
          try {
            await onSubmit(values, methods)
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
