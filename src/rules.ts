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

export const FALLBACK_LABEL = 'This field'

export const defaultMessages = {
  required: (label: string) => `${label} is required.`,
  min: (label: string, value: number | string) => `${label} must be at least ${value}.`,
  max: (label: string, value: number | string) => `${label} must be at most ${value}.`,
  minLength: (label: string, value: number) => `${label} must be at least ${value} characters.`,
  maxLength: (label: string, value: number) => `${label} must be at most ${value} characters.`,
  pattern: (label: string) => `${label} is invalid.`,
  validate: (label: string) => `${label} is invalid.`,
}

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
    return rule.value === undefined ? undefined : { value: rule.value, message: rule.message || message(rule.value) }
  }
  return { value: rule, message: message(rule) }
}

function normalizeRequired(
  required: FieldRules['required'],
  label: string,
): ValidationValueMessage<boolean> | undefined {
  const fallback = defaultMessages.required(label)
  if (required === undefined || required === false) return undefined
  if (required === true) return { value: true, message: fallback }
  if (typeof required === 'string') return { value: true, message: required || fallback }
  if (!required.value) return undefined
  return { value: true, message: required.message || fallback }
}

function wrapValidate(fn: Validate<unknown, FieldValues>, fallback: string): Validate<unknown, FieldValues> {
  return async (value, values) => {
    const result = await fn(value, values)
    return result === false ? fallback : result
  }
}

/** Converts bare rule values to `{ value, message }` using the label for default messages. */
export function normalizeRules<TValue>(rules: FieldRules<TValue>, label?: string): NormalizedRules {
  const l = label ?? FALLBACK_LABEL
  const out: NormalizedRules = {}

  out.required = normalizeRequired(rules.required, l)
  out.min = withMessage(rules.min, (v) => defaultMessages.min(l, v))
  out.max = withMessage(rules.max, (v) => defaultMessages.max(l, v))
  out.minLength = withMessage(rules.minLength, (v) => defaultMessages.minLength(l, v))
  out.maxLength = withMessage(rules.maxLength, (v) => defaultMessages.maxLength(l, v))
  out.pattern = withMessage(rules.pattern, () => defaultMessages.pattern(l))

  const { validate } = rules
  if (typeof validate === 'function') {
    out.validate = wrapValidate(validate as Validate<unknown, FieldValues>, defaultMessages.validate(l))
  } else if (validate && typeof validate === 'object') {
    out.validate = Object.fromEntries(
      Object.entries(validate).map(([key, fn]) => [
        key,
        wrapValidate(fn as Validate<unknown, FieldValues>, defaultMessages.validate(l)),
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
