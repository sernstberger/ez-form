import MenuItem from '@mui/material/MenuItem'
import { useEzFormContext } from '../../useEzFormContext'
import { TextField, type TextFieldProps } from '../TextField'
import type { Option } from '../Option'
import type { FieldRules } from '../../rules'
import { warnDuplicateOptions } from '../../devWarn'

export type SelectOption = Option

/** Rules are typed over the option value (string or number), not TextField's string. */
export type SelectProps = Omit<
  TextFieldProps,
  'select' | 'children' | 'componentName' | keyof FieldRules
> &
  FieldRules<Option['value']> & {
    options: readonly Option[]
  }

export function Select({ options, ...rest }: SelectProps) {
  // Ahead of TextField's own guard, so the "outside <Form>" error names <Select>.
  useEzFormContext('Select')
  warnDuplicateOptions('Select', rest.name, options)
  return (
    <TextField select componentName="Select" {...rest}>
      {options.map((o) => (
        <MenuItem key={o.value} value={o.value} disabled={o.disabled}>
          {o.label}
        </MenuItem>
      ))}
    </TextField>
  )
}
