import { useController, type UseControllerReturn } from 'react-hook-form'
import { useEzFormContext } from '../useEzFormContext'

export function useEzField(name: string, componentName: string): UseControllerReturn {
  // Guard only: inside <Form>'s FormProvider, useController reads control from context.
  useEzFormContext(componentName)
  return useController({ name })
}
