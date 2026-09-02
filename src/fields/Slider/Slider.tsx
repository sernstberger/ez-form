import type { ReactNode } from 'react'
import MuiSlider, { type SliderProps as MuiSliderProps } from '@mui/material/Slider'
import { mergeSlotProps } from '@mui/material/utils'
import type { FieldValues, Validate, ValidationRule } from 'react-hook-form'
import { FieldFrame } from '../FieldFrame'
import { mergeDisabled } from '../mergeDisabled'
import { FALLBACK_LABEL, defaultMessages, type FieldRules } from '../../rules'

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
  /**
   * Overrides `Form`'s `optionalText` for this field when the form's
   * `requiredIndicator` is `"optional"`; `false` hides it on this field.
   */
  optionalText?: ReactNode | false
} & Pick<FieldRules<SliderValue>, 'validate'>

const bound = (rule: ValidationRule<number> | undefined): number | undefined =>
  rule === undefined ? undefined : typeof rule === 'number' ? rule : rule.value

const toRecord = (
  validate: FieldRules<SliderValue>['validate'],
): Record<string, Validate<SliderValue, FieldValues>> =>
  validate === undefined ? {} : typeof validate === 'function' ? { validate } : validate

/**
 * `min`/`max` are checked here rather than through hookform's own rules: those
 * compare the value directly, so an array (a range slider) never fails them.
 */
const boundCheck = (
  rule: ValidationRule<number> | undefined,
  label: string,
  edge: (values: number[]) => number,
  ok: (edgeValue: number, limit: number) => boolean,
  message: (label: string, value: number) => string,
): Validate<SliderValue, FieldValues> => {
  return (value) => {
    const limit = bound(rule)
    if (limit === undefined || value == null) return true
    const values = Array.isArray(value) ? value : [value]
    if (values.length === 0) return true
    if (ok(edge(values), limit)) return true
    return (typeof rule === 'object' && rule.message) || message(label, limit)
  }
}

/**
 * Form value is a `number`, or `[number, number]` when the default value is an
 * array (MUI renders a range slider for an array value). A slider cannot leave
 * its bounds by itself; `min`/`max` still validate a default or `setValue`
 * outside them, for a number and for both ends of a range. There is no
 * `required`: HTML gives it no meaning on a range input, and a slider always
 * reports a value.
 */
export function Slider({
  name,
  label,
  helperText,
  disabled,
  min,
  max,
  validate,
  optionalText,
  onChange,
  onBlur,
  slotProps,
  ...rest
}: SliderProps) {
  const minBound = bound(min)
  const l = typeof label === 'string' ? label : FALLBACK_LABEL
  return (
    <FieldFrame<SliderValue>
      componentName="Slider"
      name={name}
      label={label}
      helperText={helperText}
      disabled={disabled}
      optionalText={optionalText}
      rules={{
        // Consumer entries first: a built-in key must not be silently replaced.
        validate: {
          ...toRecord(validate),
          min: boundCheck(
            min,
            l,
            (v) => Math.min(...v),
            (e, m) => e >= m,
            defaultMessages.min,
          ),
          max: boundCheck(
            max,
            l,
            (v) => Math.max(...v),
            (e, m) => e <= m,
            defaultMessages.max,
          ),
        },
      }}
      labelAs="legend"
      // Read, not destructured: it still reaches MuiSlider through `rest`.
      // No `aria-labelledby`: SliderProps omits it (the frame's legend owns it).
      aria-label={rest['aria-label']}
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
