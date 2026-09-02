import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { useDefaultProps } from '@mui/material/DefaultPropsProvider'
import { useFormState, type FieldValues, type Path } from 'react-hook-form'
import { useEzFormContext } from '../useEzFormContext'
import { useHasErrorSummary } from '../Form/ErrorSummaryContext'
import {
  WizardContext,
  type WizardContextValue,
  type WizardStepDef,
  type WizardStepStatus,
} from './WizardContext'

export type { WizardStepDef, WizardStepStatus } from './WizardContext'

/**
 * A `FieldError` leaf, recognised by hookform's own shape rather than by any one key: `type`
 * is always a string (`LiteralUnion<keyof RegisterOptions, string>`, never absent), and
 * `message` / `ref` are its discriminating optional siblings — see
 * `node_modules/react-hook-form/dist/types/errors.d.ts`. Checking only `'type' in errors`
 * misfires on a schema field literally named `type`: that field's own nested errors object
 * (e.g. `{ type: { message, ref } }`) would satisfy `'type' in errors` at the *parent* level
 * too, so a bare `'type' in errors` check can't tell "this node is a leaf" from "this node
 * has a child named type".
 */
function isFieldError(node: object): node is { type: string } {
  return 'type' in node && typeof node.type === 'string' && ('message' in node || 'ref' in node)
}

/**
 * The field paths that have an error, in schema order. hookform nests `errors` to mirror
 * the values (`{ address: { city: FieldError } }`), so this walks it down to the
 * `FieldError` leaves and joins the keys back into the dotted paths a step's `fields` are
 * written in.
 */
function errorFieldPaths(errors: unknown, prefix = ''): string[] {
  if (typeof errors !== 'object' || errors === null) return []
  if (isFieldError(errors)) return prefix ? [prefix] : []
  return Object.entries(errors).flatMap(([key, value]) =>
    errorFieldPaths(value, prefix ? `${prefix}.${key}` : key),
  )
}

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
  /**
   * `'steps'` (default): the usual one-step-at-a-time wizard. `'page'`:
   * every `WizardStep` renders at once, in step order, as a page of
   * `FormSection`s — the same content, without the stepper/nav chrome.
   * `WizardStepper` and `WizardNav` render nothing in this layout;
   * `SubmitButton` validates the whole schema, same as always.
   */
  layout?: 'steps' | 'page'
  children: ReactNode
}

/**
 * Multi-step navigation over one `<Form>`. Values live in hookform; the
 * wizard only knows which step is current and which have been visited.
 * Next validates the current step's `fields` with `trigger`; submit (the
 * whole schema) is `<SubmitButton>` on the last step.
 */
export function Wizard<TIn extends FieldValues>(inProps: WizardProps<TIn>) {
  // `useDefaultProps` is untyped in `TIn` (it only cares about `layout`/
  // `orientation`, neither of which mentions the field type), so the cast
  // erases `TIn` for this call only and restores it on the result.
  const {
    steps,
    step,
    onStepChange,
    visited: visitedProp,
    onVisitedChange,
    orientation = 'horizontal',
    layout = 'steps',
    children,
  } = useDefaultProps({
    props: inProps as WizardProps<FieldValues>,
    name: 'EzWizard',
  }) as WizardProps<TIn>
  const { trigger, control, setFocus } = useEzFormContext('Wizard')
  const { errors, submitCount } = useFormState({ control })
  // A mounted <FormErrorSummary> moves focus to its own heading on a failed Next; letting
  // hookform also focus the first invalid field here would fight it — same principle as
  // <Form>'s own shouldFocusError suppression, applied to this step-local trigger() call.
  const hasErrorSummary = useHasErrorSummary()
  const id = useId()
  // `steps` is required and a wizard with no steps has nothing to render;
  // every index below is derived from it and clamped to its range, so the
  // non-null assertions here are the shape of the data, not a guess.
  const firstId = steps[0]!.id
  const [stepState, setStepState] = useState(firstId)
  const [visitedState, setVisitedState] = useState<readonly string[]>([firstId])
  const [pending, setPending] = useState(false)
  const [contentEl, setContentEl] = useState<HTMLElement | null>(null)
  const [lastFailed, setLastFailed] = useState<readonly string[] | null>(null)

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
      // `lastFailed` scopes a step's own last failed validation; leaving the step (forward
      // after a pass — already null from validateCurrent — or backward without validating)
      // must not leak it onto whichever step becomes current next.
      setLastFailed(null)
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
      const valid = await trigger(fields as unknown as Path<FieldValues>[], {
        shouldFocus: !hasErrorSummary,
      })
      // A fresh array on every failure, even a repeat failure of the same step with the same
      // `fields` — `FormErrorSummary` re-focuses its heading keyed on this reference, and two
      // consecutive failed `Next` clicks (nothing fixed in between) must still move focus back
      // to the heading the second time, which a reused `current.fields` reference would not do.
      setLastFailed(valid ? null : (fields.slice() as readonly string[]))
      return valid
    } finally {
      setPending(false)
    }
  }, [current, trigger, hasErrorSummary])

  // In `page` layout every step is already visible at once, so Next/Prev/go
  // have nothing to do — the whole schema is validated by `<SubmitButton>`
  // instead, same as the last step of a `steps` wizard.
  const next = useCallback(async () => {
    if (layout === 'page') return false
    if (index >= steps.length - 1) return false
    if (!(await validateCurrent())) return false
    move(index + 1)
    return true
  }, [layout, index, steps.length, validateCurrent, move])

  const prev = useCallback(() => {
    if (layout === 'page') return
    if (index > 0) move(index - 1)
  }, [layout, index, move])

  const go = useCallback(
    async (id: string) => {
      if (layout === 'page') return false
      const to = indexOf(id)
      if (to === -1 || to === index) return false
      const allowed = visited.includes(id) || to === lastVisitedIndex + 1
      if (!allowed) return false
      if (to > index && !(await validateCurrent())) return false
      move(to)
      return true
    },
    [layout, indexOf, index, visited, lastVisitedIndex, validateCurrent, move],
  )

  const errorPaths = useMemo(() => errorFieldPaths(errors), [errors])

  // The step that owns an error path: the one listing the path itself or a prefix of it
  // (`address` owns `address.city`), and the last step for a path no step lists — so an
  // error on a field the wizard never mounts is still reported and navigated to.
  const ownerIndex = useCallback(
    (path: string) => {
      const owner = steps.findIndex((s) =>
        (s.fields ?? []).some((f) => path === f || path.startsWith(`${f}.`)),
      )
      return owner === -1 ? steps.length - 1 : owner
    },
    [steps],
  )

  const stepStatus = useCallback(
    (id: string): WizardStepStatus => {
      if (id === current.id) return 'current'
      if (!visited.includes(id)) return 'upcoming'
      const to = indexOf(id)
      if (to === -1) return 'completed'
      return errorPaths.some((p) => ownerIndex(p) === to) ? 'visited' : 'completed'
    },
    [current.id, visited, indexOf, errorPaths, ownerIndex],
  )

  // A failed submit: `submitCount` went up and left errors behind. hookform focused the
  // first errored field, which does nothing when that field is on another step or on no
  // step at all — so the wizard navigates to the step that owns it and focuses it there
  // once it mounts. The ref makes this fire once per submit rather than on every render
  // that follows one (and never on mount, where submitCount is already 0).
  const handledSubmit = useRef(submitCount)
  const [focusTarget, setFocusTarget] = useState<{ id: string; path: string } | null>(null)

  useEffect(() => {
    if (submitCount === handledSubmit.current) return
    // hookform's `reset` sets `submitCount` back to 0 unless `keepSubmitCount` — which a
    // `<Form resetOptions={{ keepErrors: true }} values={…}>` re-sync does on every value
    // change, failed submit or not. Only a genuine increase is a new submit to react to; a
    // decrease just needs the ref resynced so the *next* real submit is still detected as
    // an increase from wherever the count landed.
    if (submitCount <= handledSubmit.current) {
      handledSubmit.current = submitCount
      return
    }
    handledSubmit.current = submitCount
    // `page` layout has every step mounted at once already — hookform's own submit-time
    // focus lands on the right field without the wizard steering anything, and `current`
    // stays the first step by contract.
    if (layout === 'page') return
    if (!errorPaths.length) return
    // The earliest owning step wins; among that step's errors, the first in schema order.
    const owned = errorPaths.map((path) => ({ path, to: ownerIndex(path) }))
    const to = Math.min(...owned.map((o) => o.to))
    if (to === index) return
    move(to)
    setFocusTarget({ id: steps[to]!.id, path: owned.find((o) => o.to === to)!.path })
  }, [submitCount, errorPaths, ownerIndex, index, move, steps, layout])

  useEffect(() => {
    if (!focusTarget) return
    if (focusTarget.id !== current.id) {
      // A controlled wizard (`step`/`onStepChange`) can decline the move `move()` requested
      // for this target: `current.id` then changes to something else entirely (or never
      // leaves where it was) instead of becoming `focusTarget.id`. Left set, the target is
      // inert until a later, unrelated arrival at that step — via the consumer's own
      // navigation, long after the failed submit — would wrongly focus a stale field on
      // mount. Any `current.id` change that isn't the requested step means the move didn't
      // happen (or was superseded); either way the target is stale and gets dropped.
      setFocusTarget(null)
      return
    }
    setFocusTarget(null)
    setFocus(focusTarget.path)
  }, [focusTarget, current.id, setFocus])

  const value = useMemo<WizardContextValue>(
    () => ({
      id,
      // The context is deliberately untyped in `TIn`: WizardStepper / WizardNav / useWizard
      // consume it without knowing the form's field type, so these casts erase `TIn` on purpose.
      steps: steps as readonly WizardStepDef[],
      current: current as WizardStepDef,
      index,
      visited,
      orientation,
      layout,
      isFirst: index === 0,
      isLast: index === steps.length - 1,
      pending,
      lastFailed,
      next,
      prev,
      go,
      stepStatus,
      contentEl,
      setContentEl,
    }),
    [
      id,
      steps,
      current,
      index,
      visited,
      layout,
      orientation,
      pending,
      lastFailed,
      next,
      prev,
      go,
      stepStatus,
      contentEl,
    ],
  )

  return <WizardContext.Provider value={value}>{children}</WizardContext.Provider>
}
