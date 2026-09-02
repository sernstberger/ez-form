import { createContext, type ReactNode } from 'react'
import type { FieldValues, Path } from 'react-hook-form'

export interface WizardStepDef<TIn extends FieldValues = FieldValues> {
  id: string
  label: ReactNode
  /** Field paths validated by Next. Omit for steps with nothing to validate (a review step).
   * Every field in the schema should appear in exactly one step's `fields`. A field listed
   * in no step is validated only on final submit, and its error belongs to the last step:
   * that step is marked in the stepper and is where a failed submit navigates. */
  fields?: readonly Path<TIn>[]
  /** Secondary text under the label (`StepLabel optional`). */
  optional?: ReactNode
  /**
   * Whether this step is currently part of the wizard. Omit for a step that's always
   * shown. Read live off the form's values: `Wizard` calls `useWatch()` — and only
   * `useWatch()`, no `disabled` flag — exclusively when at least one step defines
   * `when`, so a wizard with no `when` anywhere carries no subscription at all. A
   * wizard that does have one re-renders on every value change (unavoidable — it has
   * to re-evaluate the predicates), but the effective step list itself keeps its array
   * reference across a change that doesn't flip any predicate's answer, so consumers
   * memoized on it don't re-run on every keystroke, only on an actual show/hide.
   *
   * A hidden step is absent from the stepper and from `next`/`prev`/`go` navigation and
   * page layout, and its `fields` are skipped by `next`; final submit still validates
   * the whole schema, so gate a hidden step's fields in the schema itself (`superRefine`
   * or a discriminated union) the way a step that's always shown does not need to. If a
   * hidden step's field fails final submit anyway (a schema that isn't actually gating
   * it), the error is attributed to the last step — same as a field listed in no step's
   * `fields` — and since the field was never mounted there, there is no input for
   * `setFocus` to land on.
   * `visited` keeps a hidden step's id — it still counts as reached if the predicate
   * turns true again later.
   */
  when?: (values: TIn) => boolean
}

export type WizardStepStatus = 'current' | 'completed' | 'visited' | 'upcoming'

export interface WizardContextValue {
  /** Stable id prefix for this wizard (`useId`), used for step label ids. */
  id: string
  /** The effective steps: every entry in `steps` whose `when` is absent or true. */
  steps: readonly WizardStepDef[]
  /** Every step passed to `Wizard`, including ones currently hidden by `when`. */
  allSteps: readonly WizardStepDef[]
  current: WizardStepDef
  index: number
  visited: readonly string[]
  orientation: 'horizontal' | 'vertical'
  /**
   * `'steps'` (default): one step visible at a time, navigated by
   * `next`/`prev`/`go`. `'page'`: every step renders at once, in order, as a
   * page of `FormSection`s; `WizardStepper` and `WizardNav` render nothing,
   * `current` is always the first step, and `next`/`prev`/`go` are no-ops.
   */
  layout: 'steps' | 'page'
  isFirst: boolean
  isLast: boolean
  /** True while `next()` / a forward `go()` is validating. */
  pending: boolean
  /**
   * The current step's field paths from its last failed `trigger` (a `next()`/`go()` that
   * validated and found errors), so a summary rendered inside the step can scope itself to
   * just this step's problems. `null` before any failure, and cleared back to `null` by any
   * step change — a successful `next()`/`go()`, or `prev()` — so it never leaks onto the step
   * that becomes current next.
   */
  lastFailed: readonly string[] | null
  /** Validates the current step's fields; on success moves forward. Resolves to whether it moved. */
  next: () => Promise<boolean>
  /** Moves back without validating. */
  prev: () => void
  /** Moves to a visited step (or the one right after the last visited, validating first). Resolves to whether it moved. */
  go: (id: string) => Promise<boolean>
  stepStatus: (id: string) => WizardStepStatus
  /** Vertical orientation: where the active step's content is portaled (set by `WizardStepper`). */
  contentEl: HTMLElement | null
  setContentEl: (el: HTMLElement | null) => void
  /**
   * The step a `next`/`prev`/`go` just navigated to, and a counter bumped once per such
   * navigation — the signal a `WizardStep` watches to move focus to its own heading. A
   * counter rather than a boolean because two navigations can land on the same step (forward,
   * back, forward again) and each still has to re-focus; `seq: 0` with a `null` `stepId` is
   * the resting value the wizard mounts with, which is what keeps initial mount from stealing
   * focus. `stepId` keeps a *controlled* wizard honest: `onStepChange` may decline the move,
   * and only the step whose id matches acts on the request.
   *
   * Deliberately *not* raised by the failed-final-submit jump: `FormErrorSummary` focuses its
   * own heading there, and a step heading grabbing focus in the same commit would fight it.
   */
  focusRequest: { stepId: string | null; seq: number }
}

export const WizardContext = createContext<WizardContextValue | null>(null)

export const stepLabelId = (wizardId: string, stepId: string) => `${wizardId}-label-${stepId}`
