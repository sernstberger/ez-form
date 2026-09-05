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
  /**
   * Reports that a validation attempt run *outside* `handleSubmit` — `<Wizard>`'s per-step
   * `trigger(step.fields)` on a failed `Next`, or `<Form confirm>`'s own pre-submit
   * `trigger()` — came back invalid, so `<Form>` can start re-validating on change.
   *
   * react-hook-form only consults `reValidateMode` once `formState.isSubmitted` is true, and
   * `isSubmitted` is set in exactly one place: inside `handleSubmit`. `trigger()` never sets
   * it. So an error raised by one of these out-of-band calls sits in a form still governed by
   * `mode` (`'onSubmit'` by default), where `skipValidation` skips every change event and the
   * error cannot clear until something calls `trigger()` again — the user fixes the value and
   * the alert, `aria-invalid`, and the `<FormErrorSummary>` entry all stay stale (#115).
   * Telling `<Form>` an attempt failed is what lets it engage hookform's own change-time
   * re-validation for the rest of the form's life, which is what a plain field already gets
   * after its first failed submit.
   */
  reportFailedValidationAttempt: () => void
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

// Nothing to report to outside `<Form>`: there is no form whose validation mode could change.
// eslint-disable-next-line @typescript-eslint/no-empty-function
const noopReport = () => {}

/**
 * `<Wizard>` calls this when a step's own `trigger()` comes back invalid, so the enclosing
 * `<Form>` starts re-validating on change — see `reportFailedValidationAttempt` for why
 * hookform does not do this on its own for a `trigger()`-raised error. No-op outside
 * `<Form>`; `<Wizard>` itself still guards via `useEzFormContext`.
 */
export function useReportFailedValidationAttempt(): () => void {
  const ctx = useContext(ErrorSummaryContext)
  return ctx ? ctx.reportFailedValidationAttempt : noopReport
}
