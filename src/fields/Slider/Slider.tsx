import type { ReactNode } from 'react'
import MuiSlider, { type SliderProps as MuiSliderProps } from '@mui/material/Slider'
import { mergeSlotProps } from '@mui/material/utils'
import type { ValidationRule } from 'react-hook-form'
import { FieldFrame } from '../FieldFrame'
import { mergeDisabled } from '../mergeDisabled'
import type { FieldRules } from '../../rules'

export type SliderValue = number | number[]

export type SliderProps = Omit<
  MuiSliderProps,
  'name' | 'value' | 'defaultValue' | 'min' | 'max' | 'aria-labelledby'
> & {
  name: string
  /** Rendered as the legend above the slider (MUI's Slider has no label of its own). */
  label: ReactNode
  helperText?: ReactNode
  disabled?: boolean
  /** One prop for both: the slider's bound and the validation message. */
  min?: ValidationRule<number>
  max?: ValidationRule<number>
} & Pick<FieldRules<SliderValue>, 'required' | 'validate'>

const bound = (rule: ValidationRule<number> | undefined): number | undefined =>
  rule === undefined ? undefined : typeof rule === 'number' ? rule : rule.value

/**
 * Form value is a `number`, or `[number, number]` when the default value is an
 * array (MUI renders a range slider for an array value). A slider cannot leave
 * its bounds by itself; `min`/`max` still validate a default or `setValue`
 * outside them.
 */
export function Slider({
  name,
  label,
  helperText,
  disabled,
  required,
  min,
  max,
  validate,
  onChange,
  onBlur,
  slotProps,
  ...rest
}: SliderProps) {
  const minBound = bound(min)
  return (
    <FieldFrame<SliderValue>
      componentName="Slider"
      name={name}
      label={label}
      helperText={helperText}
      disabled={disabled}
      rules={{ required, min, max, validate }}
      labelAs="legend"
      renderControl={({ field, inputA11y, labelId }) => (
        <MuiSlider
          {...rest}
          name={field.name}
          aria-labelledby={labelId}
          // MUI's Slider does not read `disabled` from FormControl context (unlike Radio/Checkbox).
          disabled={mergeDisabled(disabled, field.disabled)}
          min={minBound}
          max={bound(max)}
          // `?? 0`: a form with no default for this field still renders a controlled slider.
          value={(field.value as SliderValue | undefined) ?? minBound ?? 0}
          onChange={(e, value, activeThumb) => {
            field.onChange(value)
            onChange?.(e, value, activeThumb)
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
