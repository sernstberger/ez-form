import type { ReactNode } from 'react'
import MuiSwitch, { type SwitchProps as MuiSwitchProps } from '@mui/material/Switch'
import { mergeSlotProps } from '@mui/material/utils'
import { BooleanFieldControl } from '../BooleanFieldControl'
import type { BooleanFieldRules } from '../../rules'

export type SwitchProps = Omit<MuiSwitchProps, 'name' | 'checked' | 'required'> & {
  name: string
  label: ReactNode
  helperText?: ReactNode
} & BooleanFieldRules

// MUI 9's Switch sets role="switch" on the input itself; nothing to add here.
export function Switch({
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
}: SwitchProps) {
  return (
    <BooleanFieldControl
      componentName="Switch"
      {...{ name, label, helperText, disabled, required, validate, onChange, onBlur }}
      renderControl={({ inputProps, ...bound }) => (
        <MuiSwitch
          {...rest}
          {...bound}
          slotProps={{ ...slotProps, input: mergeSlotProps(slotProps?.input, inputProps) }}
        />
      )}
    />
  )
}
