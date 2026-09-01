import type { ReactNode } from 'react'
import { useController, type UseControllerReturn } from 'react-hook-form'
import { useEzFormContext } from '../useEzFormContext'
import { isRequired, normalizeRules, type FieldRules } from '../rules'

export interface UseEzFieldOptions<TValue = unknown> {
  /** The field's label; when it is a string it names the field in default rule messages. */
  label?: ReactNode
  rules?: FieldRules<TValue>
}

export type UseEzFieldReturn = UseControllerReturn & {
  /** Derived from the `required` rule; drives MUI's asterisk. */
  required: boolean
}

/**
 * Binds a field to the enclosing <Form>. Rules are normalized here (bare value
 * → `{ value, message }` with a label-derived default) and handed to
 * `useController`, which stores them on the field for `ezResolver` to run.
 */
export function useEzField<TValue = unknown>(
  name: string,
  componentName: string,
  { label, rules = {} }: UseEzFieldOptions<TValue> = {},
): UseEzFieldReturn {
  // Guard only: inside <Form>'s FormProvider, useController reads control from context.
  useEzFormContext(componentName)
  const normalized = normalizeRules(rules, typeof label === 'string' ? label : undefined)
  const controller = useController({ name, rules: normalized })
  return { ...controller, required: isRequired(normalized) }
}
