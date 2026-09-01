import { useFormContext, type UseFormReturn } from 'react-hook-form'

/**
 * Guard hook: returns the hookform methods from context or throws a clear
 * error naming the component that was rendered outside `<Form>`.
 *
 * The null check is real, not defensive: react-hook-form types
 * `useFormContext()` as non-null, but it is literally
 * `React.useContext(HookFormContext)` with a `null` default, so outside a
 * `FormProvider` it returns `null` at runtime.
 */
export function useEzFormContext(componentName: string): UseFormReturn {
  const ctx = useFormContext()
  if (!ctx) {
    throw new Error(`ez-form: <${componentName}> must be rendered inside <Form>`)
  }
  return ctx
}
