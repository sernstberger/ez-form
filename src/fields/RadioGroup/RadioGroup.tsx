import type { ReactNode } from 'react'
import FormControlLabel from '@mui/material/FormControlLabel'
import Radio from '@mui/material/Radio'
import MuiRadioGroup, { type RadioGroupProps as MuiRadioGroupProps } from '@mui/material/RadioGroup'
import { FieldFrame } from '../FieldFrame'
import type { Option } from '../Option'
import type { FieldRules } from '../../rules'

export type RadioGroupProps = Omit<
  MuiRadioGroupProps,
  'name' | 'value' | 'defaultValue' | 'children'
> & {
  name: string
  /** Rendered as the group's legend. */
  label: ReactNode
  options: readonly Option[]
  helperText?: ReactNode
  disabled?: boolean
} & Pick<FieldRules<Option['value']>, 'required' | 'validate'>

/**
 * One value across N radios. MUI radios emit strings, so the change handler
 * maps the string back to the option's typed value before storing it; the
 * form value keeps the option's type (a number stays a number).
 */
export function RadioGroup({
  name,
  label,
  options,
  helperText,
  disabled,
  required,
  validate,
  onChange,
  onBlur,
  ...rest
}: RadioGroupProps) {
  return (
    <FieldFrame<Option['value']>
      componentName="RadioGroup"
      name={name}
      label={label}
      helperText={helperText}
      disabled={disabled}
      rules={{ required, validate }}
      labelAs="legend"
      renderControl={({ field, required: isRequired, inputA11y, labelId }) => (
        <MuiRadioGroup
          {...rest}
          {...inputA11y}
          aria-labelledby={labelId}
          aria-required={isRequired || undefined}
          name={field.name}
          value={field.value == null ? '' : String(field.value)}
          onChange={(e, value) => {
            const option = options.find((o) => String(o.value) === value)
            field.onChange(option ? option.value : value)
            onChange?.(e, value)
          }}
          onBlur={(e) => {
            field.onBlur()
            onBlur?.(e)
          }}
        >
          {options.map((o, i) => (
            <FormControlLabel
              key={String(o.value)}
              value={String(o.value)}
              label={o.label}
              disabled={o.disabled}
              // hookform's ref on the first radio: the group is focused on submit error.
              control={<Radio slotProps={i === 0 ? { input: { ref: field.ref } } : undefined} />}
            />
          ))}
        </MuiRadioGroup>
      )}
    />
  )
}
