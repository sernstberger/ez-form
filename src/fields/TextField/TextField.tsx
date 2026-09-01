import MuiTextField, { type TextFieldProps as MuiTextFieldProps } from '@mui/material/TextField'
import { useEzField } from '../useEzField'
import type { FieldRules } from '../../rules'

/**
 * Omit only what the binding owns (`name`, `value`, `error`, `inputRef`, and
 * `required`, which the `required` rule drives). Anything the consumer might
 * also want (event handlers, `helperText`, `disabled`, `id`, `slotProps`) is
 * merged, hookform's handler first.
 */
export type TextFieldProps = Omit<
  MuiTextFieldProps,
  'name' | 'value' | 'error' | 'inputRef' | 'required'
> & {
  name: string
} & FieldRules<string>

export function TextField({
  name,
  label,
  helperText,
  disabled,
  onChange,
  onBlur,
  required,
  min,
  max,
  minLength,
  maxLength,
  pattern,
  validate,
  ...rest
}: TextFieldProps) {
  const {
    field,
    fieldState,
    required: isRequired,
  } = useEzField<string>(name, 'TextField', {
    label,
    rules: { required, min, max, minLength, maxLength, pattern, validate },
  })
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
      label={label}
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
      required={isRequired}
      inputRef={ref}
      error={fieldState.invalid}
      helperText={fieldState.error?.message ?? helperText}
      {...rest}
    />
  )
}
