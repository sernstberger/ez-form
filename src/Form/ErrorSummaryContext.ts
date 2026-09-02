import { createContext, useContext } from 'react'

export interface ErrorSummaryContextValue {
  /**
   * Registers a mounted `<FormErrorSummary>` with the enclosing `<Form>` so it can suppress
   * hookform's own "focus the first invalid field" behaviour (`shouldFocusError`) — the summary
   * moves focus to itself instead, and a field also getting focused would fight it. Returns an
   * unregister callback; `<Form>` counts registrations rather than storing a single boolean so
   * more than one summary (e.g. one per wizard step) mounted at once is still correct.
   */
  registerErrorSummary: () => () => void
  /** How many `<FormErrorSummary>` are currently mounted inside this form. */
  errorSummaryCount: number
  /**
   * How many times `<Form confirm>`'s own pre-submit `trigger()` (run before the dialog opens,
   * outside `handleSubmit`) has come back invalid. `submitCount` only increments inside
   * `handleSubmit`, which the confirm path never reaches on a failed validation, so a plain
   * form's `<FormErrorSummary>` (outside a `Wizard`) also treats this as "an attempt failed" —
   * see its `attempted` check.
   */
  failedConfirmAttempt: number
}

export const ErrorSummaryContext = createContext<ErrorSummaryContextValue | null>(null)

// Register-and-unregister pair for the no-<Form> case: registering nothing means there is
// nothing to unregister, so both halves are deliberately empty.
// eslint-disable-next-line @typescript-eslint/no-empty-function
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

/**
 * Whether at least one `<FormErrorSummary>` is mounted inside the enclosing `<Form>`. `Wizard`
 * reads this to suppress its own `trigger(fields, { shouldFocus: true })` on a failed `Next` —
 * the summary moves focus to its heading instead, and hookform's own field-focus can otherwise
 * win the race on a repeat failure (see `Wizard.validateCurrent`'s call site for the full story).
 */
export function useHasErrorSummary(): boolean {
  const ctx = useContext(ErrorSummaryContext)
  return (ctx?.errorSummaryCount ?? 0) > 0
}

/** 0 outside `<Form>` or before any confirm-path validation has failed. */
export function useFailedConfirmAttempt(): number {
  const ctx = useContext(ErrorSummaryContext)
  return ctx?.failedConfirmAttempt ?? 0
}
