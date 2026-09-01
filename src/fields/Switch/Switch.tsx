import type { ReactNode } from 'react'
import MuiSwitch, { type SwitchProps as MuiSwitchProps } from '@mui/material/Switch'
import { mergeSlotProps } from '@mui/material/utils'
import { FieldFrame } from '../FieldFrame'
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
    <FieldFrame<boolean>
      componentName="Switch"
      name={name}
      label={label}
      helperText={helperText}
      disabled={disabled}
      rules={{ required, validate }}
      labelAs="control"
      renderControl={({ field, inputA11y }) => (
        <MuiSwitch
          {...rest}
          name={field.name}
          checked={Boolean(field.value)}
          onChange={(e, checked) => {
            field.onChange(checked)
            onChange?.(e, checked)
          }}
          onBlur={(e) => {
            field.onBlur()
            onBlur?.(e)
          }}
          slotProps={{
            ...slotProps,
            input: mergeSlotProps(slotProps?.input, { ref: field.ref, ...inputA11y }),
          }}
        />
      )}
    />
  )
}
