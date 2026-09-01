import { useFormContext, type UseFormReturn } from 'react-hook-form'

/**
 * Guard hook: returns the hookform methods from context or throws a clear
 * error naming the component that was rendered outside `<Form>`.
 *
 * RHF's `useFormContext` is typed as non-null but is literally
 * `React.useContext(HookFormContext)` with a `null` default, so the runtime
 * check is real, not defensive.
 */
export function useEzFormContext(componentName: string): UseFormReturn {
  const ctx = useFormContext()
  if (!ctx) {
    throw new Error(`ez-form: <${componentName}> must be rendered inside <Form>`)
  }
  return ctx
}
