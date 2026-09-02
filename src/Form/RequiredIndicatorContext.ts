import { createContext, useContext, type ReactNode } from 'react'

/**
 * How `<Form>` wants required/optional communicated to its fields. Provided
 * by `Form`, read by `useEzField` (the single place that decides what a
 * field's label and asterisk look like). A field rendered outside `<Form>`
 * (the "must be rendered inside <Form>" guard fires first in every field, so
 * this default is never actually read in practice) falls back to today's
 * behavior.
 */
export interface RequiredIndicatorContextValue {
  requiredIndicator: 'asterisk' | 'optional'
  optionalText: ReactNode
}

export const RequiredIndicatorContext = createContext<RequiredIndicatorContextValue>({
  requiredIndicator: 'asterisk',
  optionalText: '(optional)',
})

export function useRequiredIndicator(): RequiredIndicatorContextValue {
  return useContext(RequiredIndicatorContext)
}
