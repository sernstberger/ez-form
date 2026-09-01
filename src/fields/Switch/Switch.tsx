import type { ReactNode } from 'react'
import MuiSwitch, { type SwitchProps as MuiSwitchProps } from '@mui/material/Switch'
import FormControl from '@mui/material/FormControl'
import FormControlLabel from '@mui/material/FormControlLabel'
import FormHelperText from '@mui/material/FormHelperText'
import { mergeSlotProps } from '@mui/material/utils'
import { useBooleanField } from '../useBooleanField'
import type { BooleanFieldRules } from '../../rules'

export type SwitchProps = Omit<MuiSwitchProps, 'name' | 'checked' | 'required'> & {
  name: string
  label: ReactNode
  helperText?: ReactNode
} & BooleanFieldRules

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
  const f = useBooleanField(name, 'Switch', { label, rules: { required, validate } })
  const text = f.errorMessage ?? helperText

  return (
    <FormControl error={f.invalid} disabled={disabled ?? f.disabled} required={f.required}>
      <FormControlLabel
        label={label}
        required={f.required}
        control={
          <MuiSwitch
            {...rest}
            name={f.name}
            checked={f.checked}
            onChange={(e, checked) => {
              f.onChange(e)
              onChange?.(e, checked)
            }}
            onBlur={(e) => {
              f.onBlur()
              onBlur?.(e)
            }}
            slotProps={{
              ...slotProps,
              input: mergeSlotProps(slotProps?.input, {
                ref: f.inputRef,
                'aria-invalid': f.invalid || undefined,
                'aria-describedby': text ? f.helperTextId : undefined,
              }),
            }}
          />
        }
      />
      {text ? <FormHelperText id={f.helperTextId}>{text}</FormHelperText> : null}
    </FormControl>
  )
}
