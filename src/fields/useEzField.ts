import { useController, type UseControllerReturn } from 'react-hook-form'
import { useEzFormContext } from '../useEzFormContext'

export function useEzField(name: string, componentName: string): UseControllerReturn {
  const { control } = useEzFormContext(componentName)
  return useController({ name, control })
}
