import { useFormContext, type FieldValues, type UseFormReturn } from 'react-hook-form'

export function useEzFormContext<T extends FieldValues = FieldValues>(
  componentName: string,
): UseFormReturn<T> {
  const ctx = useFormContext<T>()
  if (!ctx) {
    throw new Error(`ez-form: <${componentName}> must be rendered inside <Form>`)
  }
  return ctx
}
