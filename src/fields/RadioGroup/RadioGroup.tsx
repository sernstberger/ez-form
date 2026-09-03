import type { ReactNode } from 'react'
import FormControlLabel from '@mui/material/FormControlLabel'
import Radio from '@mui/material/Radio'
import MuiRadioGroup, { type RadioGroupProps as MuiRadioGroupProps } from '@mui/material/RadioGroup'
import { FieldFrame } from '../FieldFrame'
import type { Option } from '../Option'
import type { FieldRules } from '../../rules'
import { warnDuplicateOptions } from '../../devWarn'

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
  /**
   * Overrides `Form`'s `optionalText` for this field when the form's
   * `requiredIndicator` is `"optional"`; `false` hides it on this field.
   */
  optionalText?: ReactNode | false
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
  optionalText,
  onChange,
  onBlur,
  ...rest
}: RadioGroupProps) {
  warnDuplicateOptions('RadioGroup', name, options)
  return (
    <FieldFrame<Option['value']>
      componentName="RadioGroup"
      name={name}
      label={label}
      helperText={helperText}
      disabled={disabled}
      rules={{ required, validate }}
      optionalText={optionalText}
      labelAs="legend"
      // For the dev-mode "no accessible name" check only — read, not destructured, so
      // both still reach the control through `rest`.
      aria-label={rest['aria-label']}
      aria-labelledby={rest['aria-labelledby']}
      renderControl={({ field, required: isRequired, inputA11y, labelId }) => (
        <MuiRadioGroup
          {...rest}
          {...inputA11y}
          // `?? rest`: the legend's id wins when there is a legend, otherwise a
          // consumer's own `aria-labelledby` survives the spread above it.
          aria-labelledby={labelId ?? rest['aria-labelledby']}
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
