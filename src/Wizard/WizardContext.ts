import { createContext, type ReactNode } from 'react'
import type { FieldValues, Path } from 'react-hook-form'

export interface WizardStepDef<TIn extends FieldValues = FieldValues> {
  id: string
  label: ReactNode
  /** Field paths validated by Next. Omit for steps with nothing to validate (a review step). */
  fields?: readonly Path<TIn>[]
  /** Secondary text under the label (`StepLabel optional`). */
  optional?: ReactNode
}

export type WizardStepStatus = 'current' | 'completed' | 'visited' | 'upcoming'

export interface WizardContextValue {
  steps: readonly WizardStepDef[]
  current: WizardStepDef
  index: number
  visited: readonly string[]
  orientation: 'horizontal' | 'vertical'
  isFirst: boolean
  isLast: boolean
  /** True while `next()` / a forward `go()` is validating. */
  pending: boolean
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
