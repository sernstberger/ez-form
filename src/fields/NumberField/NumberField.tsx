import type { FocusEventHandler, ReactNode } from 'react'
import type { NumberField as BaseNumberField } from '@base-ui/react/number-field'
import type { ValidationRule } from 'react-hook-form'
import { NumberFieldControl, type NumberFieldInputProps } from './NumberFieldControl'
import { useEzField } from '../useEzField'
import { mergeDisabled } from '../mergeDisabled'
import { useRuleMessages } from '../../Form/RuleMessagesContext'
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
  /**
   * Internal. A pair of inverse functions applied to the value as it crosses
   * the binding boundary, for the fields whose stored value and displayed
   * value deliberately differ in scale: `PercentField` under
   * `scale="fraction"` stores `0.125` and shows `12.5%`. `toDisplay` runs on
   * the value read from the form, `toStored` on the value the control
   * produces; `min`/`max`/`step` and everything else stay in display units.
   * The binding is otherwise unchanged — the form value, validation and
   * `aria-*` wiring all still come from `name`. This is `TextField`'s
   * `displayValue`, for a numeric field.
   *
   * Left `undefined` (the default, and every plain `<NumberField>`), the bound
   * value is displayed as-is.
   *
   * @internal
   */
  valueScale?: { toDisplay: (stored: number) => number; toStored: (display: number) => number }
} & Pick<FieldRules<number | null>, 'required' | 'validate'>

const bound = (rule: ValidationRule<number> | undefined): number | undefined =>
  rule === undefined ? undefined : typeof rule === 'number' ? rule : rule.value

type ValueScale = NonNullable<NumberFieldProps['valueScale']>

const scaleToDisplay = (value: number | null, scale: ValueScale | undefined) =>
  value === null || scale === undefined ? value : scale.toDisplay(value)

const scaleToStored = (value: number | null, scale: ValueScale | undefined) =>
  value === null || scale === undefined ? value : scale.toStored(value)

/**
 * A `min`/`max` rule restated in stored units so it compares against the value
 * the form actually holds, while its message keeps the number the consumer
 * wrote: `max={100}` on a `scale="fraction"` PercentField compares as `1` but
 * still reads "must be at most 100." A bare number carries no message of its
 * own, so the display-unit default is materialised here before the value is
 * scaled — otherwise `normalizeRules` would derive it from the scaled number.
 * Untouched without a `valueScale`.
 */
function scaleRule(
  rule: ValidationRule<number> | undefined,
  scale: ValueScale | undefined,
  message: (label: string, value: number) => string,
  label: string,
): ValidationRule<number> | undefined {
  if (rule === undefined || scale === undefined) return rule
  if (typeof rule === 'number') {
    return { value: scale.toStored(rule), message: message(label, rule) }
  }
  // `ValidationValueMessage` types `value` as possibly `undefined` (a rule
  // switched off); `normalizeRules` drops such a rule, so pass it straight on.
  if (rule.value === undefined) return rule
  return {
    ...rule,
    value: scale.toStored(rule.value),
    message: rule.message || message(label, rule.value),
  }
}

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
  valueScale,
  ...rest
}: NumberFieldProps) {
  // The same label and message set `useEzField` would use for a default rule message.
  const messages = useRuleMessages()
  const ruleLabel = typeof label === 'string' ? label : messages.fallbackLabel
  const f = useEzField<number | null>(name, 'NumberField', {
    label,
    // `min`/`max` are written in display units (they are also the stepper
    // bounds), but the rule runs against the *stored* value, so under a
    // `valueScale` the bounds cross into stored units with it. The message
    // keeps the number the consumer wrote — `max={100}` still reads "at most
    // 100" even when it is compared as `1`.
    rules: {
      required,
      min: scaleRule(min, valueScale, messages.min, ruleLabel),
      max: scaleRule(max, valueScale, messages.max, ruleLabel),
      validate,
    },
    optionalText,
    // Read, not destructured: both still reach the control through `rest`.
    'aria-label': rest['aria-label'],
    'aria-labelledby': rest['aria-labelledby'],
  })
  const text = f.helperText(helperText)

  return (
    <NumberFieldControl
      {...rest}
      step={step}
      format={format}
      name={f.field.name}
      label={f.displayLabel}
      value={scaleToDisplay(f.field.value ?? null, valueScale)}
      onValueChange={(value, details) => {
        const stored = scaleToStored(value, valueScale)
        f.field.onChange(stored)
        // The consumer's handler sees the value in *stored* units, matching
        // what the form holds and what `onSubmit` will receive.
        onValueChange?.(stored, details)
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
