import MuiTextField, { type TextFieldProps as MuiTextFieldProps } from '@mui/material/TextField'
import { useEzField } from '../useEzField'

export type TextFieldProps = Omit<
  MuiTextFieldProps,
  'name' | 'value' | 'onChange' | 'onBlur' | 'error' | 'inputRef'
> & {
  name: string
}

export function TextField({ name, helperText, ...rest }: TextFieldProps) {
  const { field, fieldState } = useEzField(name, 'TextField')
  const { ref, value, disabled, ...fieldProps } = field

  return (
    <MuiTextField
      {...fieldProps}
      value={value ?? ''}
      disabled={rest.disabled ?? disabled}
      inputRef={ref}
      error={fieldState.invalid}
      helperText={fieldState.error?.message ?? helperText}
      {...rest}
    />
  )
}
