import MenuItem from '@mui/material/MenuItem'
import { TextField, type TextFieldProps } from '../TextField'
import type { Option } from '../Option'
import type { FieldRules } from '../../rules'

export type SelectOption = Option

/** Rules are typed over the option value (string or number), not TextField's string. */
export type SelectProps = Omit<TextFieldProps, 'select' | 'children' | keyof FieldRules> &
  FieldRules<Option['value']> & {
    options: readonly Option[]
  }

export function Select({ options, ...rest }: SelectProps) {
  return (
    <TextField select {...rest}>
      {options.map((o) => (
        <MenuItem key={o.value} value={o.value} disabled={o.disabled}>
          {o.label}
        </MenuItem>
      ))}
    </TextField>
  )
}
