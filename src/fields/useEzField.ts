import { useId, type ReactNode } from 'react'
import { useController, type UseControllerReturn } from 'react-hook-form'
import { useEzFormContext } from '../useEzFormContext'
import { isRequired, normalizeRules, type FieldRules } from '../rules'

export interface UseEzFieldOptions<TValue = unknown> {
  /** The field's label; when it is a string it names the field in default rule messages. */
  label?: ReactNode
  rules?: FieldRules<TValue>
}

/** For the real `<input>` (or the radiogroup). `aria-invalid` is omitted when valid. */
export interface InputA11y {
  'aria-invalid': true | undefined
  'aria-describedby': string | undefined
}

/** For the `FormHelperText`: its id, and `role="alert"` while it shows an error. */
export interface HelperTextA11y {
  id: string
  role: 'alert' | undefined
}

export type UseEzFieldReturn = UseControllerReturn & {
  /** Derived from the `required` rule; drives MUI's asterisk. */
  required: boolean
  invalid: boolean
  errorMessage: string | undefined
  helperTextId: string
  /** The text to show under the control: the error message, else the consumer's helper text. */
  helperText: (consumerText: ReactNode) => ReactNode
  /** a11y attributes for the control, linked to the helper text only when there is some. */
  inputA11y: (text: ReactNode) => InputA11y
  helperTextA11y: HelperTextA11y
}

/**
 * Binds a field to the enclosing <Form>. Rules are normalized here (bare value
 * → `{ value, message }` with a label-derived default) and handed to
 * `useController`, which stores them on the field for `ezResolver` to run.
 * Also the single owner of the a11y wiring every field applies: the helper
 * text id, `aria-invalid`/`aria-describedby` for the control, and
 * `role="alert"` on the helper text while it shows an error (the live region
 * that announces errors in onChange/onBlur modes).
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
  const helperTextId = useId()
  const invalid = controller.fieldState.invalid
  const errorMessage = controller.fieldState.error?.message
  return {
    ...controller,
    required: isRequired(normalized),
    invalid,
    errorMessage,
    helperTextId,
    helperText: (consumerText) => errorMessage ?? consumerText,
    inputA11y: (text) => ({
      'aria-invalid': invalid || undefined,
      'aria-describedby': text ? helperTextId : undefined,
    }),
    helperTextA11y: { id: helperTextId, role: invalid ? 'alert' : undefined },
  }
}
