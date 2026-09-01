import type { ReactNode } from 'react'
import MuiCheckbox, { type CheckboxProps as MuiCheckboxProps } from '@mui/material/Checkbox'
import { mergeSlotProps } from '@mui/material/utils'
import { FieldFrame } from '../FieldFrame'
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
    <FieldFrame<boolean>
      componentName="Checkbox"
      name={name}
      label={label}
      helperText={helperText}
      disabled={disabled}
      rules={{ required, validate }}
      labelAs="control"
      renderControl={({ field, inputA11y }) => (
        <MuiCheckbox
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
