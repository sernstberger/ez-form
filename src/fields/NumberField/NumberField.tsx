import type { FocusEventHandler, ReactNode } from 'react'
import type { NumberField as BaseNumberField } from '@base-ui/react/number-field'
import type { ValidationRule } from 'react-hook-form'
import { NumberFieldControl, type NumberFieldInputProps } from './NumberFieldControl'
import { useEzField } from '../useEzField'
import { mergeDisabled } from '../mergeDisabled'
import type { FieldRules } from '../../rules'

export type NumberFieldProps = Omit<
  BaseNumberField.Root.Props,
  | 'name'
  | 'value'
  | 'defaultValue'
  | 'onValueChange'
  | 'required'
  | 'disabled'
  | 'min'
  | 'max'
  | 'render'
  | 'children'
  // Root's own div-level focus handlers and its hidden-input ref: re-declared
  // below over the visible <input>, which is what a consumer means by these.
  | 'onBlur'
  | 'onFocus'
  | 'inputRef'
  // Root renders no element of its own here (`TextField` is the root), so this is
  // MUI's plain `string`, not Base UI's `(state) => string` form.
  | 'className'
  // Root's own div-level attribute, not the visible <input>'s: re-declared below,
  // defaulted from `step`/`format` and always routed to the real input (#6, #7).
  | 'inputMode'
> & {
  name: string
  className?: string
  label?: ReactNode
  helperText?: ReactNode
  size?: 'small' | 'medium'
  disabled?: boolean
  /**
   * Mobile keyboard hint on the visible input. Defaults to `'decimal'`, or `'numeric'`
   * when the field is integer-only (no fractional `step`, and no `format` with a
   * nonzero `maximumFractionDigits`).
   */
  inputMode?: NumberFieldInputProps['inputMode']
  /**
   * Overrides `Form`'s `optionalText` for this field when the form's
   * `requiredIndicator` is `"optional"`; `false` hides it on this field.
   */
  optionalText?: ReactNode | false
  /** Runs after the form's own handler. */
  onValueChange?: BaseNumberField.Root.Props['onValueChange']
  /** Runs after the form's own handler. On the visible input, not Root's div. */
  onBlur?: FocusEventHandler<HTMLInputElement>
  onFocus?: FocusEventHandler<HTMLInputElement>
  /**
   * One prop for both: the bound the stepper stops at and the validation
   * message (`<label> must be at least <value>.`). Typed input may go past it
   * and shows the message; set `allowOutOfRange={false}` to clamp instead.
   */
  min?: ValidationRule<number>
  max?: ValidationRule<number>
} & Pick<FieldRules<number | null>, 'required' | 'validate'>

const bound = (rule: ValidationRule<number> | undefined): number | undefined =>
  rule === undefined ? undefined : typeof rule === 'number' ? rule : rule.value

// `numeric` for an integer-only field (no fractional `step`, and no `format` that allows
// fraction digits), `decimal` otherwise — Base UI's own default is always `numeric` (#6, #7).
const isIntegerOnly = (
  step: number | 'any' | undefined,
  format: Intl.NumberFormatOptions | undefined,
) => {
  const fractionalStep = typeof step === 'number' && !Number.isInteger(step)
  const formatAllowsFraction = (format?.maximumFractionDigits ?? 0) > 0
  return !fractionalStep && !formatAllowsFraction
}

/**
 * Numeric input whose form value is `number | null` (empty is `null`), so
 * `z.number()` works and `min`/`max` compare as numbers.
 */
export function NumberField({
  name,
  label,
  helperText,
  disabled,
  required,
  min,
  max,
  validate,
  optionalText,
  onValueChange,
  onBlur,
  onFocus,
  allowOutOfRange = true,
  step,
  format,
  inputMode = isIntegerOnly(step, format) ? 'numeric' : 'decimal',
  ...rest
}: NumberFieldProps) {
  const f = useEzField<number | null>(name, 'NumberField', {
    label,
    rules: { required, min, max, validate },
    optionalText,
  })
  const text = f.helperText(helperText)

  return (
    <NumberFieldControl
      {...rest}
      step={step}
      format={format}
      name={f.field.name}
      label={f.displayLabel}
      value={f.field.value ?? null}
      onValueChange={(value, details) => {
        f.field.onChange(value)
        onValueChange?.(value, details)
      }}
      min={bound(min)}
      max={bound(max)}
      allowOutOfRange={allowOutOfRange}
      required={f.required}
      labelRequired={f.labelRequired}
      disabled={mergeDisabled(disabled, f.field.disabled)}
      error={f.invalid}
      helperText={text}
      helperTextProps={f.helperTextA11y}
      inputRef={f.field.ref}
      inputProps={{
        ...f.inputA11y(text),
        inputMode,
        onBlur: (e) => {
          f.field.onBlur()
          onBlur?.(e)
        },
        onFocus,
      }}
    />
  )
}
