import { createContext, useContext } from 'react'

/**
 * Registers a mounted `<FormErrorSummary>` with the enclosing `<Form>` so it can suppress
 * hookform's own "focus the first invalid field" behaviour (`shouldFocusError`) — the summary
 * moves focus to itself instead, and a field also getting focused would fight it. Returns an
 * unregister callback; `<Form>` counts registrations rather than storing a single boolean so
 * more than one summary (e.g. one per wizard step) mounted at once is still correct.
 */
export interface ErrorSummaryContextValue {
  registerErrorSummary: () => () => void
}

export const ErrorSummaryContext = createContext<ErrorSummaryContextValue | null>(null)

const noopRegister = () => () => {}

/**
 * The raw `registerErrorSummary` function, to call from an effect (never from render — it
 * calls `setState` on `<Form>`). No-op outside `<Form>` — `<FormErrorSummary>` itself still
 * guards via `useEzFormContext`.
 */
export function useRegisterErrorSummary(): () => () => void {
  const ctx = useContext(ErrorSummaryContext)
  return ctx ? ctx.registerErrorSummary : noopRegister
}
