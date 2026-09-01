import { useId, type ChangeEvent } from 'react'
import { useEzField, type UseEzFieldOptions } from './useEzField'

export function useBooleanField(
  name: string,
  componentName: string,
  options: UseEzFieldOptions<boolean> = {},
) {
  const { field, fieldState, required } = useEzField<boolean>(name, componentName, options)
  const helperTextId = useId()
  const errorMessage = fieldState.error?.message
  return {
    name: field.name,
    checked: Boolean(field.value),
    onChange: (e: ChangeEvent<HTMLInputElement>) => field.onChange(e.target.checked),
    onBlur: field.onBlur,
    inputRef: field.ref,
    disabled: field.disabled,
    required,
    invalid: fieldState.invalid,
    errorMessage,
    helperTextId,
  }
}
