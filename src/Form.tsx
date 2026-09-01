import type { FormHTMLAttributes, ReactNode } from 'react'
import {
  FormProvider,
  useForm,
  type DefaultValues,
  type FieldValues,
  type Mode,
  type Resolver,
} from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { z } from 'zod'

export interface FormProps<S extends z.ZodType<FieldValues, FieldValues>>
  extends Omit<FormHTMLAttributes<HTMLFormElement>, 'onSubmit'> {
  schema: S
  onSubmit: (values: z.output<S>) => void | Promise<void>
  defaultValues?: DefaultValues<z.input<S>>
  mode?: Mode
  children: ReactNode
}

export function Form<S extends z.ZodType<FieldValues, FieldValues>>({
  schema,
  onSubmit,
  defaultValues,
  mode = 'onSubmit',
  children,
  ...formProps
}: FormProps<S>) {
  const methods = useForm<z.input<S>, unknown, z.output<S>>({
    // The generic resolver from zodResolver widens to Resolver<FieldValues, ...>,
    // which TS will not narrow back to the schema's input/output types directly.
    resolver: zodResolver(schema) as unknown as Resolver<z.input<S>, unknown, z.output<S>>,
    defaultValues,
    mode,
  })

  return (
    <FormProvider {...methods}>
      <form noValidate {...formProps} onSubmit={methods.handleSubmit(onSubmit)}>
        {children}
      </form>
    </FormProvider>
  )
}
