import MuiTextField, { type TextFieldProps as MuiTextFieldProps } from '@mui/material/TextField'
import { useEzField } from '../useEzField'

/**
 * Omit only what the binding owns (`name`, `value`, `error`, `inputRef`).
 * Anything the consumer might also want (event handlers, `helperText`,
 * `disabled`, `required`, `id`, `slotProps`) is merged, hookform's handler first.
 */
export type TextFieldProps = Omit<MuiTextFieldProps, 'name' | 'value' | 'error' | 'inputRef'> & {
  name: string
}

export function TextField({
  name,
  helperText,
  disabled,
  onChange,
  onBlur,
  ...rest
}: TextFieldProps) {
  const { field, fieldState } = useEzField(name, 'TextField')
  const {
    ref,
    value,
    disabled: fieldDisabled,
    onChange: fieldOnChange,
    onBlur: fieldOnBlur,
    ...fieldProps
  } = field

  return (
    <MuiTextField
      {...fieldProps}
      value={value ?? ''}
      onChange={(e) => {
        fieldOnChange(e)
        onChange?.(e)
      }}
      onBlur={(e) => {
        fieldOnBlur()
        onBlur?.(e)
      }}
      disabled={disabled ?? fieldDisabled}
      inputRef={ref}
      error={fieldState.invalid}
      helperText={fieldState.error?.message ?? helperText}
      {...rest}
    />
  )
}
