import { createContext, useContext } from 'react'
import { defaultMessages, type RuleMessages } from '../rules'

/**
 * The form's resolved rule messages: `defaultMessages` with the `<Form
 * messages>` prop (theme-defaultable via `EzForm.defaultProps.messages`, which
 * is how the locale objects translate them) merged over it. Provided by
 * `Form`, read by `useEzField` and by every field that materialises a message
 * of its own. The default is the library's English set, which is also what a
 * field rendered outside `<Form>` would see — the "must be rendered inside
 * <Form>" guard fires first, so that never actually happens.
 */
export const RuleMessagesContext = createContext<RuleMessages>(defaultMessages)

export function useRuleMessages(): RuleMessages {
  return useContext(RuleMessagesContext)
}
