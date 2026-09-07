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
 * **The latch is one-way, for the life of the `<Form>` instance.** Stated plainly because it is
 * observable outside a `Wizard` too: a form that renders a `<FormErrorSummary>` once and then
 * removes it permanently — behind a prop or a feature flag, say — keeps hookform's own
 * first-invalid-field focus suppressed from then on, and a later failed submit moves focus
 * nowhere rather than to the first invalid field. This is the intended trade (the alternative
 * is the #123 bug: unmounting a summary silently re-arms a competing focus call), and it is
 * cheap to avoid — remount the `<Form>`, or leave the summary mounted and let it render null
 * on its own, which is what it already does when there is nothing to show.
 *
 * A subscription store rather than `useState` on `<Form>`, for the reason recorded once in
 * `FieldFocusContext` — a summary mounting must not re-render every field of the form. That
 * file also records why these registries stay separate stores rather than sharing a generic
 * one (#126). What is specific to *this* store is the latch described above.
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
 *
 * This is a render-time snapshot, so it is the right hook for anything that *renders* from the
 * answer or passes it to a call made during an event. A decision made inside an effect that can
 * run in the very commit a summary first mounts must use `useHasErrorSummaryRef` instead — see
 * its doc.
 */
export function useHasErrorSummary(): boolean {
  const ctx = useContext(ErrorSummaryContext)
  const getDeclared = ctx?.store.getDeclared ?? never
  return useSyncExternalStore(ctx?.store.subscribe ?? noopSubscribe, getDeclared, getDeclared)
}

/**
 * The same answer as `useHasErrorSummary`, read *at the moment it is called* rather than
 * captured when the component rendered.
 *
 * A parent effect cannot use the render-time snapshot to decide whether a child that mounts in
 * the same commit has declared a summary. React runs child effects before parent effects, so
 * the summary's `register()` has already flipped the store by the time the parent effect
 * fires — but that effect was scheduled from a render where the snapshot was still `false`, and
 * closures do not update. `<Wizard>`'s failed-submit jump hits this exactly: the jump can be
 * what mounts a step's summary for the first time (a summary living only in a step the user
 * never visited before submitting), and reading the stale `false` there put focus back on the
 * field a macrotask after the summary had taken it.
 *
 * Reading live keeps the whole library at one decision point — the store — instead of adding a
 * second mechanism to paper over the timing.
 */
export function useHasErrorSummaryRef(): () => boolean {
  const ctx = useContext(ErrorSummaryContext)
  return ctx?.store.getDeclared ?? never
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
