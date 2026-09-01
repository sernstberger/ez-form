import MuiTextField, { type TextFieldProps as MuiTextFieldProps } from '@mui/material/TextField'
import { mergeSlotProps } from '@mui/material/utils'
import { useEzField } from '../useEzField'
import { mergeDisabled } from '../mergeDisabled'
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
  slotProps,
  required,
  min,
  max,
  minLength,
  maxLength,
  pattern,
  validate,
  ...rest
}: TextFieldProps) {
  const f = useEzField<string>(name, 'TextField', {
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
  } = f.field

  // MUI TextField sets aria-invalid and aria-describedby itself; only `role` comes from the hook.
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
      disabled={mergeDisabled(disabled, fieldDisabled)}
      required={f.required}
      inputRef={ref}
      error={f.invalid}
      helperText={f.helperText(helperText)}
      slotProps={{
        ...slotProps,
        formHelperText: mergeSlotProps(slotProps?.formHelperText, { role: f.helperTextA11y.role }),
      }}
      {...rest}
    />
  )
}
