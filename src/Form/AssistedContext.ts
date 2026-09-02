import { createContext, useContext } from 'react'

/**
 * Whether `<Form assisted>` is on. Provided by `Form`, read by every field
 * that emits an `autoComplete` token (through `resolveAutoComplete`) so a
 * browser/password-manager never offers the person operating the form their
 * own saved data for someone else's information. A field rendered outside
 * `<Form>` (the "must be rendered inside <Form>" guard fires first in every
 * field, so this default is never actually read in practice) falls back to
 * `false` — today's behavior.
 */
export const AssistedContext = createContext<boolean>(false)

export function useAssisted(): boolean {
  return useContext(AssistedContext)
}
