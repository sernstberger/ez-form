import type { ReactNode } from 'react'
import MuiCheckbox, { type CheckboxProps as MuiCheckboxProps } from '@mui/material/Checkbox'
import { mergeSlotProps } from '@mui/material/utils'
import { BooleanFieldControl } from '../BooleanFieldControl'
import type { BooleanFieldRules } from '../../rules'

export type CheckboxProps = Omit<MuiCheckboxProps, 'name' | 'checked' | 'required'> & {
  name: string
  label: ReactNode
  helperText?: ReactNode
} & BooleanFieldRules

export function Checkbox({
  name,
  label,
  helperText,
  disabled,
  required,
  validate,
  onChange,
  onBlur,
  slotProps,
  ...rest
}: CheckboxProps) {
  return (
    <BooleanFieldControl
      componentName="Checkbox"
      {...{ name, label, helperText, disabled, required, validate, onChange, onBlur }}
      renderControl={({ inputProps, ...bound }) => (
        <MuiCheckbox
          {...rest}
          {...bound}
          slotProps={{ ...slotProps, input: mergeSlotProps(slotProps?.input, inputProps) }}
        />
      )}
    />
  )
}
