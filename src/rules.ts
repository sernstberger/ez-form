import type {
  FieldValues,
  Message,
  Validate,
  ValidationRule,
  ValidationValueMessage,
} from 'react-hook-form'

/**
 * Hookform-shaped validation rules, accepted as individual props by every field.
 * A bare value uses a default message derived from the field's label;
 * `{ value, message }` overrides it. A rule error wins over zod's for that field.
 */
export interface FieldRules<TValue = unknown> {
  required?: Message | ValidationRule<boolean>
  min?: ValidationRule<number | string>
  max?: ValidationRule<number | string>
  minLength?: ValidationRule<number>
  maxLength?: ValidationRule<number>
  pattern?: ValidationRule<RegExp>
  validate?: Validate<TValue, FieldValues> | Record<string, Validate<TValue, FieldValues>>
}

export type BooleanFieldRules = Pick<FieldRules<boolean>, 'required' | 'validate'>

/** Every rule carries its message; `validate` maps `false` to the default message itself. */
export interface NormalizedRules {
  required?: ValidationValueMessage<boolean>
  min?: ValidationValueMessage<number | string>
  max?: ValidationValueMessage<number | string>
  minLength?: ValidationValueMessage<number>
  maxLength?: ValidationValueMessage<number>
  pattern?: ValidationValueMessage<RegExp>
  validate?: Validate<unknown, FieldValues> | Record<string, Validate<unknown, FieldValues>>
}

/**
 * Every label-derived default message the library produces, in one place so a
 * theme can replace the set: `theme.components.EzForm.defaultProps.messages`
 * (#23). `Form` merges a partial over `defaultMessages` and provides the
 * result through `RuleMessagesContext`; `normalizeRules`, `ezResolver`, the
 * pickers (`pickerMessage`) and the fields with a built-in check of their own
 * (`NumberField`, `Slider`, `OtpField`) all read from it. Every entry is a
 * function of the label so a translation can put the label wherever its
 * grammar wants it.
 */
export interface RuleMessages {
  /** Stands in for the label in a message when the field has no string label. */
  fallbackLabel: string
  required: (label: string) => string
  min: (label: string, value: number | string) => string
  max: (label: string, value: number | string) => string
  minLength: (label: string, value: number) => string
  maxLength: (label: string, value: number) => string
  pattern: (label: string) => string
  /** A `validate` rule that returned `false` (or an empty array). */
  validate: (label: string) => string
  /** `OtpField`'s built-in length check. */
  exactLength: (label: string, length: number) => string
  /** The date pickers' own codes (`invalidDate`, `min*`, `max*`, `disablePast`, …). */
  invalidDate: (label: string) => string
  tooEarly: (label: string) => string
  tooLate: (label: string) => string
  mustBeFuture: (label: string) => string
  mustBePast: (label: string) => string
  unavailable: (label: string) => string
}

export const defaultMessages: RuleMessages = {
  fallbackLabel: 'This field',
  required: (label) => `${label} is required.`,
  min: (label, value) => `${label} must be at least ${value}.`,
  max: (label, value) => `${label} must be at most ${value}.`,
  minLength: (label, value) => `${label} must be at least ${value} characters.`,
  maxLength: (label, value) => `${label} must be at most ${value} characters.`,
  pattern: (label) => `${label} is invalid.`,
  validate: (label) => `${label} is invalid.`,
  exactLength: (label, length) => `${label} must be ${length} characters.`,
  invalidDate: (label) => `${label} is invalid.`,
  tooEarly: (label) => `${label} is too early.`,
  tooLate: (label) => `${label} is too late.`,
  mustBeFuture: (label) => `${label} must be in the future.`,
  mustBePast: (label) => `${label} must be in the past.`,
  unavailable: (label) => `${label} is not available.`,
}

export const FALLBACK_LABEL = defaultMessages.fallbackLabel

function isValueMessage<T extends boolean | number | string | RegExp>(
  rule: ValidationRule<T> | Message,
): rule is ValidationValueMessage<T> {
  return typeof rule === 'object' && rule !== null && !(rule instanceof RegExp)
}

function withMessage<T extends number | string | RegExp>(
  rule: ValidationRule<T> | undefined,
  message: (value: T) => string,
): ValidationValueMessage<T> | undefined {
  if (rule === undefined) return undefined
  if (isValueMessage(rule)) {
    return rule.value === undefined
      ? undefined
      : { value: rule.value, message: rule.message || message(rule.value) }
  }
  return { value: rule, message: message(rule) }
}

function normalizeRequired(
  required: FieldRules['required'],
  label: string,
  messages: RuleMessages,
): ValidationValueMessage<boolean> | undefined {
  const fallback = messages.required(label)
  if (required === undefined || required === false) return undefined
  if (required === true) return { value: true, message: fallback }
  if (typeof required === 'string') return { value: true, message: required || fallback }
  if (!required.value) return undefined
  return { value: true, message: required.message || fallback }
}

function wrapValidate(
  fn: Validate<unknown, FieldValues>,
  fallback: string,
): Validate<unknown, FieldValues> {
  return async (value, values) => {
    const result = await fn(value, values)
    // `false` and an empty array are failures with no message of their own; use the label-derived one.
    return result === false || (Array.isArray(result) && result.length === 0) ? fallback : result
  }
}

/**
 * Converts bare rule values to `{ value, message }` using the label for default
 * messages. `messages` is the form's resolved set (`useRuleMessages()`); the
 * library defaults apply when it is omitted.
 */
export function normalizeRules<TValue>(
  rules: FieldRules<TValue>,
  label?: string,
  messages: RuleMessages = defaultMessages,
): NormalizedRules {
  const l = label ?? messages.fallbackLabel
  const out: NormalizedRules = {}

  out.required = normalizeRequired(rules.required, l, messages)
  out.min = withMessage(rules.min, (v) => messages.min(l, v))
  out.max = withMessage(rules.max, (v) => messages.max(l, v))
  out.minLength = withMessage(rules.minLength, (v) => messages.minLength(l, v))
  out.maxLength = withMessage(rules.maxLength, (v) => messages.maxLength(l, v))
  out.pattern = withMessage(rules.pattern, () => messages.pattern(l))

  const { validate } = rules
  if (typeof validate === 'function') {
    out.validate = wrapValidate(validate as Validate<unknown, FieldValues>, messages.validate(l))
  } else if (validate && typeof validate === 'object') {
    out.validate = Object.fromEntries(
      Object.entries(validate).map(([key, fn]) => [
        key,
        wrapValidate(fn as Validate<unknown, FieldValues>, messages.validate(l)),
      ]),
    )
  }

  for (const key of Object.keys(out) as (keyof NormalizedRules)[]) {
    if (out[key] === undefined) delete out[key]
  }
  return out
}

/** True when the normalized rules make the field required (drives MUI's asterisk). */
export function isRequired(rules: NormalizedRules): boolean {
  return rules.required?.value === true
}
