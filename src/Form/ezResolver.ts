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
import { FALLBACK_LABEL, defaultMessages, normalizeRules, type NormalizedRules } from '../rules'

type RuleError = Pick<FieldError, 'type' | 'message'>

/** hookform's emptiness for the value rules: `false` is not empty here (it only matters to `required`). */
const isEmpty = (value: unknown): boolean =>
  value === undefined ||
  value === null ||
  value === '' ||
  (Array.isArray(value) && value.length === 0)

const isNumeric = (value: unknown): boolean =>
  value !== '' && value !== null && typeof value !== 'boolean' && !Number.isNaN(Number(value))

/** `true` when `value` is beyond `bound` in the given direction, mirroring hookform. */
function outOfRange(value: unknown, bound: number | string, direction: 'min' | 'max'): boolean {
  if (isNumeric(value) && isNumeric(bound)) {
    return direction === 'min' ? Number(value) < Number(bound) : Number(value) > Number(bound)
  }
  const [a, b] = [String(value), String(bound)]
  return direction === 'min' ? a < b : a > b
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
): Promise<RuleError | undefined> {
  if (rules.required?.value && (isEmpty(value) || value === false)) {
    return { type: 'required', message: rules.required.message }
  }
  if (!isEmpty(value)) {
    if (rules.min && outOfRange(value, rules.min.value as number | string, 'min')) {
      return { type: 'min', message: rules.min.message }
    }
    if (rules.max && outOfRange(value, rules.max.value as number | string, 'max')) {
      return { type: 'max', message: rules.max.message }
    }
    if (typeof value === 'string') {
      if (rules.maxLength && value.length > (rules.maxLength.value as number)) {
        return { type: 'maxLength', message: rules.maxLength.message }
      }
      if (rules.minLength && value.length < (rules.minLength.value as number)) {
        return { type: 'minLength', message: rules.minLength.message }
      }
      if (rules.pattern) {
        const regex = rules.pattern.value as RegExp
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
      const message =
        typeof result === 'string'
          ? result
          : Array.isArray(result)
            ? result[0]
            : result === false
              ? defaultMessages.validate(FALLBACK_LABEL)
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
 */
export function ezResolver<TIn extends FieldValues, TOut>(
  schema: z.ZodType<TOut, TIn>,
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
      const error = await validateRules(normalizeRules(field), get(values, name), values)
      if (error) {
        set(errors, name, error)
        failed = true
      }
    }
    return failed ? { values: {}, errors } : result
  }
}
