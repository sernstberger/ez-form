import { zodResolver } from '@hookform/resolvers/zod'
import {
  get,
  set,
  type Field,
  type FieldError,
  type FieldErrors,
  type FieldValues,
  type Resolver,
} from 'react-hook-form'
import type { z } from 'zod'
import {
  defaultMessages,
  normalizeRules,
  type NormalizedRules,
  type RuleMessages,
} from '../rules'

type RuleError = Pick<FieldError, 'type' | 'message'>

/** hookform's emptiness for the value rules: `false` is not empty here (it only matters to `required`). */
const isEmpty = (value: unknown): boolean =>
  value === undefined ||
  value === null ||
  value === '' ||
  (Array.isArray(value) && value.length === 0)

const isNumeric = (value: unknown): boolean =>
  value !== '' && value !== null && typeof value !== 'boolean' && !Number.isNaN(Number(value))

/**
 * `true` when `value` is beyond `bound`, mirroring hookform's `validateField`:
 * a numeric value compares as a number (a non-numeric bound compares as NaN,
 * so never fails); otherwise a string bound compares as `Date`s, skipped when
 * either side is an Invalid Date; a numeric bound with a non-numeric value
 * never fails.
 */
function outOfRange(value: unknown, bound: number | string, direction: 'min' | 'max'): boolean {
  const below = (a: number | Date, b: number | Date) => (direction === 'min' ? a < b : a > b)
  if (isNumeric(value)) return below(Number(value), Number(bound))
  if (typeof bound !== 'string' || typeof value !== 'string' || value === '') return false
  const [valueDate, boundDate] = [new Date(value), new Date(bound)]
  if (Number.isNaN(valueDate.getTime()) || Number.isNaN(boundDate.getTime())) return false
  return below(valueDate, boundDate)
}

/**
 * Runs hookform-shaped rules in hookform's order; the first failure wins.
 * Matches hookform's `validateField` gating: `required` fails on an empty value
 * (`undefined | null | '' | []`) or `false`; `min`/`max`/`maxLength`/`minLength`/
 * `pattern` are skipped for empty values (and the three string rules apply to
 * string values only); `validate` always runs.
 */
export async function validateRules(
  rules: NormalizedRules,
  value: unknown,
  values: FieldValues,
  messages: RuleMessages = defaultMessages,
): Promise<RuleError | undefined> {
  if (rules.required?.value && (isEmpty(value) || value === false)) {
    return { type: 'required', message: rules.required.message }
  }
  if (!isEmpty(value)) {
    if (rules.min && outOfRange(value, rules.min.value!, 'min')) {
      return { type: 'min', message: rules.min.message }
    }
    if (rules.max && outOfRange(value, rules.max.value!, 'max')) {
      return { type: 'max', message: rules.max.message }
    }
    if (typeof value === 'string') {
      if (rules.maxLength && value.length > rules.maxLength.value!) {
        return { type: 'maxLength', message: rules.maxLength.message }
      }
      if (rules.minLength && value.length < rules.minLength.value!) {
        return { type: 'minLength', message: rules.minLength.message }
      }
      if (rules.pattern) {
        const regex = rules.pattern.value!
        regex.lastIndex = 0
        if (!regex.test(value)) return { type: 'pattern', message: rules.pattern.message }
      }
    }
  }
  if (rules.validate) {
    const entries =
      typeof rules.validate === 'function'
        ? [['validate', rules.validate] as const]
        : Object.entries(rules.validate)
    for (const [type, fn] of entries) {
      const result = await fn(value, values)
      // hookform: a string, an all-string array (even empty), or `false` is a failure.
      const message =
        typeof result === 'string'
          ? result
          : Array.isArray(result) && result.every((r) => typeof r === 'string')
            ? (result[0] ?? messages.validate(messages.fallbackLabel))
            : result === false
              ? messages.validate(messages.fallbackLabel)
              : undefined
      if (message !== undefined) return { type, message }
    }
  }
  return undefined
}

/**
 * zod first, then the field-level rules hookform stored on each mounted field
 * (`useController({ rules })`). A rule error replaces zod's error for that field;
 * zod still validates everything else and still types `onSubmit`.
 *
 * `messages` is the form's resolved rule-message set. The stored rules already
 * carry their messages (`useEzField` normalised them with the same set), so it
 * only speaks here for a `validate` result with no message of its own.
 */
export function ezResolver<TIn extends FieldValues, TOut>(
  schema: z.ZodType<TOut, TIn>,
  messages: RuleMessages = defaultMessages,
): Resolver<TIn, unknown, TOut> {
  const zod = zodResolver(schema)
  return async (values, context, options) => {
    const result = await zod(values, context, options)
    const errors: FieldErrors<TIn> = {}
    Object.assign(errors, result.errors)
    let failed = false
    for (const name of options.names ?? []) {
      // options.fields is nested by path (hookform's getResolverOptions uses set), hence get.
      const field: Field['_f'] | undefined = get(options.fields, name)
      if (!field || field.mount === false) continue
      const error = await validateRules(
        normalizeRules(field, undefined, messages),
        get(values, name),
        values,
        messages,
      )
      if (error) {
        set(errors, name, error)
        failed = true
      }
    }
    return failed ? { values: {}, errors } : result
  }
}
