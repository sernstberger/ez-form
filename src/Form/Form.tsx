import type { FormHTMLAttributes, ReactNode } from 'react'
import {
  FormProvider,
  useForm,
  type DefaultValues,
  type FieldValues,
  type Mode,
  type UseFormReturn,
} from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { z } from 'zod'

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
   * Unlike a field-level `disabled`, values are still submitted.
   */
  disabled?: boolean
  children: ReactNode
}

export function Form<TIn extends FieldValues, TOut>({
  schema,
  onSubmit,
  defaultValues,
  mode = 'onSubmit',
  disabled,
  children,
  ...formProps
}: FormProps<TIn, TOut>) {
  const methods = useForm<TIn, unknown, TOut>({
    resolver: zodResolver(schema),
    defaultValues,
    mode,
    disabled,
  })

  return (
    <FormProvider {...methods}>
      <form
        noValidate
        {...formProps}
        onSubmit={methods.handleSubmit((values) => onSubmit(values, methods))}
      >
        {children}
      </form>
    </FormProvider>
  )
}
