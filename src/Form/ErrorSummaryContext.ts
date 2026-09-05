import { createContext, useContext, useSyncExternalStore } from 'react'

/**
 * Whether this form has a `<FormErrorSummary>` that owns post-submit focus.
 *
 * The question is *declared*, not *currently mounted* (#123). `<WizardStep>` unmounts every
 * step but the current one (`if (current.id !== id) return null`), and a wizard's summary
 * belongs inside a step — that is the documented placement, since a wizard summary scopes to
 * one step's errors. So a summary in an earlier step is simply not mounted while the user is
 * on a later one, and the old "is one mounted" check answered `false` for exactly the submit
 * that needed it to answer `true`: hookform focused the first invalid field, the wizard then
 * jumped back to the errored step, the summary mounted into that failed attempt and focused
 * its own heading, and the two fought over it. Asking whether the form has a summary *at all*
 * makes the answer independent of which step happens to be showing.
 *
 * Latching also settles the related case deliberately: a summary that first mounts *after* the
 * failed submit — this very scenario, and any conditional step — takes focus. Its heading
 * effect keys on `submitCount`/`lastFailed`/`failedConfirmAttempt`, so it focuses itself on
 * mounting into a failed attempt; the point of the feature is that a user navigated somewhere
 * unexpected is told why. Nothing un-declares, so nothing can hand focus back to a field
 * afterwards.
 *
 * Ruling: a subscription store rather than `useState` on `<Form>` — a summary mounting must
 * not re-render every field of the form (the same reason `FieldFocusContext` is a store; its
 * own ruling records that publishing such a map as form state "disturbed the Wizard's
 * failed-submit focus race"). Cost if wrong: a hand-rolled store — ~15 lines — instead of a
 * hook.
 */
export interface ErrorSummaryStore {
  /**
   * Registers a mounted `<FormErrorSummary>`. Returns the unregister callback an effect
   * cleanup needs; it does not un-declare, because nothing about this form stops having a
   * summary just because the step showing it went away — see this interface's doc.
   */
  register: () => () => void
  /** Whether a `<FormErrorSummary>` has ever mounted in this form. Never goes back to false. */
  getDeclared: () => boolean
  subscribe: (listener: () => void) => () => void
}

export function createErrorSummaryStore(): ErrorSummaryStore {
  let declared = false
  const listeners = new Set<() => void>()

  return {
    register() {
      if (!declared) {
        declared = true
        for (const listener of listeners) listener()
      }
      // Unregistering is a no-op: the flag latches. Returned anyway so the call site stays an
      // ordinary `useEffect(() => register(), [register])` with a cleanup, and so the contract
      // survives if a future reader ever does need the un-declare.
      return () => undefined
    },
    getDeclared: () => declared,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

export interface ErrorSummaryContextValue {
  /** See `ErrorSummaryStore`. */
  store: ErrorSummaryStore
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
// eslint-disable-next-line @typescript-eslint/no-empty-function
const noopSubscribe = () => () => {}
// Outside <Form> there is no summary and nothing that could declare one.
const never = () => false

/**
 * The raw registration callback, to call from an effect. No-op outside `<Form>` —
 * `<FormErrorSummary>` itself still guards via `useEzFormContext`.
 */
export function useRegisterErrorSummary(): () => () => void {
  const ctx = useContext(ErrorSummaryContext)
  return ctx ? ctx.store.register : noopRegister
}

/**
 * Whether this form has a `<FormErrorSummary>` that owns post-submit focus — true from the
 * moment one first mounts, and true thereafter even while it is unmounted, because
 * `<WizardStep>` unmounts every non-current step. See `ErrorSummaryStore` for why the question
 * is "declared" and not "mounted".
 *
 * Every focus decision in the library reads this one answer, so exactly one thing moves focus
 * after a failed validation attempt:
 *
 * - `<Form>` passes `shouldFocusError: !hasErrorSummary` to `useForm`, suppressing hookform's
 *   own first-invalid-field focus inside `handleSubmit`.
 * - `<Wizard>` passes `shouldFocus: !hasErrorSummary` to its per-step `trigger()` on a failed
 *   `Next`, and skips the `setFocus()` that would otherwise follow its failed-submit jump.
 *
 * …leaving `<FormErrorSummary>`'s own heading effect as the only remaining mover.
 */
export function useHasErrorSummary(): boolean {
  const ctx = useContext(ErrorSummaryContext)
  const getDeclared = ctx?.store.getDeclared ?? never
  return useSyncExternalStore(ctx?.store.subscribe ?? noopSubscribe, getDeclared, getDeclared)
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
