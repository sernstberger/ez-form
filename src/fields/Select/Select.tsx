import MenuItem from '@mui/material/MenuItem'
import { TextField, type TextFieldProps } from '../TextField'

export interface SelectOption {
  value: string | number
  label: string
}

export type SelectProps = Omit<TextFieldProps, 'select' | 'children'> & {
  options: readonly SelectOption[]
}

export function Select({ options, ...rest }: SelectProps) {
  return (
    <TextField select {...rest}>
      {options.map((o) => (
        <MenuItem key={o.value} value={o.value}>
          {o.label}
        </MenuItem>
      ))}
    </TextField>
  )
}
