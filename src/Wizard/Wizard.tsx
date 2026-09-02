import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { get, useFormState, type FieldValues, type Path } from 'react-hook-form'
import { useEzFormContext } from '../useEzFormContext'
import {
  WizardContext,
  type WizardContextValue,
  type WizardStepDef,
  type WizardStepStatus,
} from './WizardContext'

export type { WizardStepDef, WizardStepStatus } from './WizardContext'

export interface WizardProps<TIn extends FieldValues> {
  /**
   * The steps, in order. Must be a stable reference — a module-level `const`
   * (with `satisfies WizardStepDef<Input>[]` so `fields` autocompletes) or a
   * `useMemo`. An array literal written inline in JSX is a new array every
   * render, which re-creates the wizard context and re-renders every consumer.
   */
  steps: readonly WizardStepDef<TIn>[]
  /** Controlled current step id. Omit for internal state. */
  step?: string
  /**
   * Called with the step the wizard wants to show: after Next / Prev / a
   * stepper click, and when a controlled `step` is unknown or not yet
   * reachable (it then asks for the last visited step). A controlled wizard
   * does not move until the consumer feeds the new `step` back.
   */
  onStepChange?: (step: WizardStepDef<TIn>) => void
  /**
   * Controlled list of step ids the user has reached: which stepper steps are
   * clickable and where an unreachable `step` redirects. Omit for internal
   * state. Save it with draft values so a returning user resumes where they
   * left off. Ids that no longer match a step are ignored; if none match, the
   * wizard starts at the first step.
   */
  visited?: readonly string[]
  onVisitedChange?: (ids: readonly string[]) => void
  orientation?: 'horizontal' | 'vertical'
  children: ReactNode
}

/**
 * Multi-step navigation over one `<Form>`. Values live in hookform; the
 * wizard only knows which step is current and which have been visited.
 * Next validates the current step's `fields` with `trigger`; submit (the
 * whole schema) is `<SubmitButton>` on the last step.
 */
export function Wizard<TIn extends FieldValues>({
  steps,
  step,
  onStepChange,
  visited: visitedProp,
  onVisitedChange,
  orientation = 'horizontal',
  children,
}: WizardProps<TIn>) {
  const { trigger, control } = useEzFormContext('Wizard')
  const { errors } = useFormState({ control })
  // `steps` is required and a wizard with no steps has nothing to render;
  // every index below is derived from it and clamped to its range, so the
  // non-null assertions here are the shape of the data, not a guess.
  const firstId = steps[0]!.id
  const [stepState, setStepState] = useState(firstId)
  const [visitedState, setVisitedState] = useState<readonly string[]>([firstId])
  const [pending, setPending] = useState(false)
  const [contentEl, setContentEl] = useState<HTMLElement | null>(null)

  const visited = visitedProp ?? visitedState
  const requestedId = step ?? stepState
  const indexOf = useCallback((id: string) => steps.findIndex((s) => s.id === id), [steps])
  // Stale ids (a renamed step id after a localStorage resume) resolve to -1 from `indexOf`.
  // Filter them out before Math.max so the fallback to step 0 only happens when nothing in
  // `visited` matches a step, not as a side effect of -1 losing to the 0 floor.
  const visitedIndexes = visited.map(indexOf).filter((i) => i !== -1)
  const lastVisitedIndex = visitedIndexes.length ? Math.max(...visitedIndexes) : 0
  // A controlled `step` that is unknown or not yet visited is shown as the last visited step
  // while the effect below asks the consumer to move there.
  const reachable = indexOf(requestedId) !== -1 && visited.includes(requestedId)
  const index = reachable ? indexOf(requestedId) : lastVisitedIndex
  const current = steps[index]!

  const markVisited = useCallback(
    (id: string) => {
      if (visited.includes(id)) return
      const nextVisited = [...visited, id]
      if (visitedProp === undefined) setVisitedState(nextVisited)
      onVisitedChange?.(nextVisited)
    },
    [visited, visitedProp, onVisitedChange],
  )

  const move = useCallback(
    (to: number) => {
      const target = steps[to]!
      markVisited(target.id)
      if (step === undefined) setStepState(target.id)
      onStepChange?.(target)
    },
    [steps, markVisited, step, onStepChange],
  )

  useEffect(() => {
    if (step === undefined) return
    if (!reachable) onStepChange?.(steps[lastVisitedIndex]!)
  }, [step, reachable, steps, lastVisitedIndex, onStepChange])

  const validateCurrent = useCallback(async () => {
    const fields = current.fields as readonly Path<TIn>[] | undefined
    if (!fields?.length) return true
    setPending(true)
    try {
      return await trigger(fields as unknown as Path<FieldValues>[], { shouldFocus: true })
    } finally {
      setPending(false)
    }
  }, [current, trigger])

  const next = useCallback(async () => {
    if (index >= steps.length - 1) return false
    if (!(await validateCurrent())) return false
    move(index + 1)
    return true
  }, [index, steps.length, validateCurrent, move])

  const prev = useCallback(() => {
    if (index > 0) move(index - 1)
  }, [index, move])

  const go = useCallback(
    async (id: string) => {
      const to = indexOf(id)
      if (to === -1 || to === index) return false
      const allowed = visited.includes(id) || to === lastVisitedIndex + 1
      if (!allowed) return false
      if (to > index && !(await validateCurrent())) return false
      move(to)
      return true
    },
    [indexOf, index, visited, lastVisitedIndex, validateCurrent, move],
  )

  const hasError = useCallback(
    (def: WizardStepDef) => (def.fields ?? []).some((f) => get(errors, f) !== undefined),
    [errors],
  )

  const stepStatus = useCallback(
    (id: string): WizardStepStatus => {
      if (id === current.id) return 'current'
      if (!visited.includes(id)) return 'upcoming'
      const def = steps[indexOf(id)]
      return def && hasError(def) ? 'visited' : 'completed'
    },
    [current.id, visited, steps, indexOf, hasError],
  )

  const value = useMemo<WizardContextValue>(
    () => ({
      // The context is deliberately untyped in `TIn`: WizardStepper / WizardNav / useWizard
      // consume it without knowing the form's field type, so these casts erase `TIn` on purpose.
      steps: steps as readonly WizardStepDef[],
      current: current as WizardStepDef,
      index,
      visited,
      orientation,
      isFirst: index === 0,
      isLast: index === steps.length - 1,
      pending,
      next,
      prev,
      go,
      stepStatus,
      contentEl,
      setContentEl,
    }),
    [steps, current, index, visited, orientation, pending, next, prev, go, stepStatus, contentEl],
  )

  return <WizardContext.Provider value={value}>{children}</WizardContext.Provider>
}
