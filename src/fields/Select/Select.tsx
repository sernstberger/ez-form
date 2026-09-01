import MenuItem from '@mui/material/MenuItem'
import { TextField, type TextFieldProps } from '../TextField'
import type { FieldRules } from '../../rules'

export interface SelectOption {
  value: string | number
  label: string
}

/** Rules are typed over the option value (string or number), not TextField's string. */
export type SelectProps = Omit<TextFieldProps, 'select' | 'children' | keyof FieldRules> &
  FieldRules<SelectOption['value']> & {
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
