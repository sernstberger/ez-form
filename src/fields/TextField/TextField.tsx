import MuiTextField, { type TextFieldProps as MuiTextFieldProps } from '@mui/material/TextField'
import { useEzField } from '../useEzField'

export type TextFieldProps = Omit<
  MuiTextFieldProps,
  'name' | 'value' | 'onChange' | 'onBlur' | 'error' | 'inputRef'
> & {
  name: string
}

export function TextField({ name, helperText, disabled, ...rest }: TextFieldProps) {
  const { field, fieldState } = useEzField(name, 'TextField')
  const { ref, value, disabled: fieldDisabled, ...fieldProps } = field

  return (
    <MuiTextField
      {...fieldProps}
      value={value ?? ''}
      disabled={disabled ?? fieldDisabled}
      inputRef={ref}
      error={fieldState.invalid}
      helperText={fieldState.error?.message ?? helperText}
      {...rest}
    />
  )
}
