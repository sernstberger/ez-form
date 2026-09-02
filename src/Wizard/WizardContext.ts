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
}

export type WizardStepStatus = 'current' | 'completed' | 'visited' | 'upcoming'

export interface WizardContextValue {
  /** Stable id prefix for this wizard (`useId`), used for step label ids. */
  id: string
  steps: readonly WizardStepDef[]
  current: WizardStepDef
  index: number
  visited: readonly string[]
  orientation: 'horizontal' | 'vertical'
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
}

export const WizardContext = createContext<WizardContextValue | null>(null)

export const stepLabelId = (wizardId: string, stepId: string) => `${wizardId}-label-${stepId}`
