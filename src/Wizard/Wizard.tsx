import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { useDefaultProps } from '@mui/material/DefaultPropsProvider'
import generateUtilityClasses from '@mui/material/generateUtilityClasses'
import { styled } from '@mui/material/styles'
import { useFormState, useWatch, type FieldValues, type Path } from 'react-hook-form'
import { useEzFormContext } from '../useEzFormContext'
import { useHasErrorSummary } from '../Form/ErrorSummaryContext'
import { warnUnmountedStepFields } from '../devWarn'
import { LiveRegion } from '../Form/LiveRegion'
import {
  WizardContext,
  type WizardContextValue,
  type WizardStepDef,
  type WizardStepStatus,
} from './WizardContext'

export type { WizardStepDef, WizardStepStatus } from './WizardContext'

export const wizardClasses = generateUtilityClasses('EzWizard', ['status'])

// The step-change region gets its own EzWizard slot rather than rendering a bare
// LiveRegion, for the same reason `<Form>`'s does: a form can hold several
// `EzLiveRegion-root` nodes at once (the form's own submit status, a FieldArray,
// a PasswordStrength), so that class alone doesn't identify *this* region.
// `wizardClasses.status` is what names it, for a theme and for a test query.
const WizardStatus = styled(LiveRegion, { name: 'EzWizard', slot: 'Status' })({})

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

/**
 * Mounted only when at least one step defines `when` (the caller branches before
 * rendering this), so `useWatch()` — and the subscription it registers on `control` —
 * exists at all only for a wizard that needs live values; a wizard with no `when` never
 * calls `useWatch`, not even with `disabled: true`. `mask` (one `'1'`/`'0'` character per
 * step, "is this step currently visible") is what the step list is memoized on rather
 * than `values` itself: `values` is a new object on every keystroke regardless of
 * whether any `when` predicate's answer changed, and memoizing on it would recompute
 * (and hand out a new array reference for) `steps` — invalidating every context
 * consumer — on every keystroke. Memoizing on `mask` instead means the array keeps its
 * reference until a predicate's answer actually flips.
 *
 * `useEzFormContext` runs first, purely for its guard: a bare `useWatch()` outside
 * `<Form>` throws react-hook-form's own opaque `TypeError` (it reads off a context that
 * doesn't exist) before this ever gets to render `WizardBody`, whose "must be rendered
 * inside <Form>" error is what a consumer of this library should actually see. Calling
 * `useEzFormContext('Wizard')` here means that clear error wins even when the wizard
 * has a `when` and so takes this branch instead of going straight to `WizardBody`.
 */
function WizardWhenBridge<TIn extends FieldValues>({
  allSteps,
  children,
}: {
  allSteps: readonly WizardStepDef<TIn>[]
  children: (steps: readonly WizardStepDef<TIn>[]) => ReactNode
}) {
  // `control` from `useEzFormContext` is untyped (`Control<FieldValues>`): `useWatch` is
  // called with that erased type and the snapshot is restored to `TIn` where a step's
  // `when` reads it, the same erase-and-restore already used for `trigger`'s `fields`
  // argument in `WizardBody` below.
  const { control } = useEzFormContext('Wizard')
  const values = useWatch({ control })
  const mask = allSteps.map((s) => (!s.when || s.when(values as TIn) ? '1' : '0')).join('')
  // `allSteps` is already required to be a stable reference (see `WizardProps.steps`), so
  // including it here costs nothing on the common render and removes the latent stale-
  // closure risk of filtering a *previous* `allSteps` against a *current* `mask` on the
  // rare render where the prop does change.
  const steps = useMemo(() => allSteps.filter((_, i) => mask[i] === '1'), [allSteps, mask])
  return children(steps)
}

export interface WizardProps<TIn extends FieldValues> {
  /**
   * The steps, in order, including any hidden by `when` — pass the full list rather than
   * filtering it yourself; `Wizard` derives the effective (visible) list internally. Must
   * be a stable reference — a module-level `const` (with `satisfies WizardStepDef<Input>[]`
   * so `fields` autocompletes) or a `useMemo` keyed on nothing that changes per render. An
   * array literal written inline in JSX is a new array every render, which re-creates the
   * wizard context and re-renders every consumer.
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
  /**
   * What to announce when the step changes. Called with the new step's position in the
   * *effective* (conditional `when`-filtered) step list, so a wizard whose step 2 is hidden
   * announces "Step 2 of 3" for what is really `steps[2]` — the counts a user can see in the
   * stepper. Default `` ({ index, count, label }) => `Step ${index + 1} of ${count}${label ? `, ${label}` : ''}` ``;
   * `false` announces nothing. Ignored in `layout="page"`, which never changes step.
   *
   * Like `steps`, prefer a stable reference (a module-level `const`, or a `useMemo`/
   * `useCallback`): an arrow written inline in JSX is a new function every render, which
   * re-creates the wizard context and re-renders every consumer. Correctness is unaffected
   * either way.
   */
  stepAnnouncement?: ((info: WizardStepAnnouncementInfo) => ReactNode) | false
  children: ReactNode
}

/** What `WizardProps.stepAnnouncement` is called with. */
export interface WizardStepAnnouncementInfo {
  /** Zero-based position in the effective step list. */
  index: number
  /** How many steps are currently visible. */
  count: number
  /** The step's `label` from `steps`. */
  label: ReactNode
  /** The whole step definition, for an announcement that needs more than the label. */
  step: WizardStepDef
}

/*
 * The label is only appended when it is a string or number. `label` is a `ReactNode`, so a
 * step titled with an element would otherwise interpolate as "[object Object]" — and this
 * string is what a screen reader announces on every step change. A non-text label degrades to
 * the position alone ("Step 2 of 5"), which is accurate rather than wrong.
 */
const defaultStepAnnouncement = ({
  index,
  count,
  label,
}: WizardStepAnnouncementInfo): ReactNode => {
  const text = typeof label === 'string' || typeof label === 'number' ? String(label) : ''
  return `Step ${index + 1} of ${count}${text ? `, ${text}` : ''}`
}

/**
 * Multi-step navigation over one `<Form>`. Values live in hookform; the
 * wizard only knows which step is current and which have been visited.
 * Next validates the current step's `fields` with `trigger`; submit (the
 * whole schema) is `<SubmitButton>` on the last step.
 *
 * A step's `when` needs live form values; a wizard with no `when` anywhere needs none of
 * that. `hasWhen` decides, once per render, which of two children `WizardBody` gets:
 * with no `when`, `allSteps` is passed straight through as `steps` and `WizardWhenBridge`
 * — the only thing that calls `useWatch()` — is never mounted at all, so a plain wizard
 * carries no subscription of any kind. Only a wizard with at least one `when` mounts the
 * bridge, which is what actually derives the effective step list.
 */
export function Wizard<TIn extends FieldValues>(inProps: WizardProps<TIn>) {
  // `useDefaultProps` is untyped in `TIn` (it only cares about `layout`/
  // `orientation`, neither of which mentions the field type), so the cast
  // erases `TIn` for this call only and restores it on the result.
  const props = useDefaultProps({
    props: inProps as WizardProps<FieldValues>,
    name: 'EzWizard',
  }) as WizardProps<TIn>
  const allSteps = props.steps
  const hasWhen = allSteps.some((s) => s.when)
  if (!hasWhen) return <WizardBody {...props} steps={allSteps} allSteps={allSteps} />
  return (
    <WizardWhenBridge allSteps={allSteps}>
      {(steps) => <WizardBody {...props} steps={steps} allSteps={allSteps} />}
    </WizardWhenBridge>
  )
}

interface WizardBodyProps<TIn extends FieldValues> extends WizardProps<TIn> {
  /** The effective (visible) steps — `allSteps` itself when no step has `when`. */
  steps: readonly WizardStepDef<TIn>[]
  allSteps: readonly WizardStepDef<TIn>[]
}

function WizardBody<TIn extends FieldValues>({
  steps,
  allSteps,
  step,
  onStepChange,
  visited: visitedProp,
  onVisitedChange,
  orientation = 'horizontal',
  layout = 'steps',
  stepAnnouncement = defaultStepAnnouncement,
  children,
}: WizardBodyProps<TIn>) {
  const { trigger, control, setFocus, getValues } = useEzFormContext('Wizard')
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
  // The step-change announcement and the focus request are one piece of state so a single
  // navigation produces exactly one commit for both, and `seq` serves as `LiveRegion`'s
  // `announcementKey` (two Nexts landing on the same label must both be heard) *and* as the
  // `focusRequest` a `WizardStep` watches. `seq: 0` with no `stepId` is the resting value the
  // wizard mounts with — that is what keeps initial mount from announcing or stealing focus,
  // while the region itself is still in the DOM from the first render, which is what makes
  // the first real announcement audible.
  const [stepChange, setStepChange] = useState<{
    stepId: string | null
    text: ReactNode
    seq: number
  }>({ stepId: null, text: null, seq: 0 })

  const visited = visitedProp ?? visitedState
  const requestedId = step ?? stepState
  // `indexOf` (and hence every navigation/status computation below) resolves against the
  // *effective* `steps`, so a hidden step's id behaves exactly like a stale one already does:
  // -1, filtered out of `visitedIndexes`, falling back to the nearest still-visible visited
  // step (or the first, if none match) via the same `lastVisitedIndex`/redirect machinery that
  // already exists for a renamed step id after a localStorage resume.
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
    (to: number, userInitiated = true) => {
      const target = steps[to]!
      markVisited(target.id)
      // Ruling: raise the announcement and the focus request here, in the same state batch as
      // the step change itself, rather than from an effect watching the rendered `current.id`.
      // An effect would need its own extra commit before `WizardStep` ever sees the request,
      // so focus would land a render *after* the new step's content — visible to a consumer
      // only as flakiness (a test that finds the new step's field still has to await another
      // tick before focus arrives) and to a screen reader as a gap. Batching it here makes the
      // step change and its focus one commit.
      //
      // `stepId` is the *requested* step, not necessarily the one that ends up current: a
      // controlled wizard's `onStepChange` may decline the move. Both halves of the request
      // are therefore gated on arrival — `WizardStep` focuses only when its own id matches,
      // and the live region's `message` is read through `announcement` below, which resolves
      // to nothing until the effective `current.id` is the requested step.
      //
      // `userInitiated: false` is the failed-submit jump: `<FormErrorSummary>` focuses its own
      // heading on the step it lands on, and both an announcement and a competing heading
      // focus would fight it.
      if (userInitiated) {
        // Computed here rather than inside the updater: a `setState` updater must be pure and
        // may be re-invoked (StrictMode, a replayed render), and `stepAnnouncement` is a
        // consumer's function — calling it once per navigation, outside the updater, is the
        // only way to promise that.
        //
        // No `layout === 'page'` guard: `next`/`prev`/`go` all return before reaching `move()`
        // in that layout, and so does the failed-submit effect, so a page wizard never
        // navigates and this is unreachable there.
        const text = stepAnnouncement
          ? stepAnnouncement({
              index: to,
              count: steps.length,
              label: target.label,
              step: target as WizardStepDef,
            })
          : null
        setStepChange((prev) => ({ stepId: target.id, text, seq: prev.seq + 1 }))
      }
      // `lastFailed` scopes a step's own last failed validation; leaving the step (forward
      // after a pass — already null from validateCurrent — or backward without validating)
      // must not leak it onto whichever step becomes current next.
      setLastFailed(null)
      if (step === undefined) setStepState(target.id)
      onStepChange?.(target)
    },
    [steps, markVisited, step, onStepChange, stepAnnouncement],
  )

  useEffect(() => {
    if (step === undefined) return
    if (!reachable) onStepChange?.(steps[lastVisitedIndex]!)
  }, [step, reachable, steps, lastVisitedIndex, onStepChange])

  /*
   * The four assertions in this callback are reported as unnecessary by
   * `no-unnecessary-type-assertion` and are load-bearing to the compiler. That is not a
   * contradiction: the linter type-checks with the TS 6 API (see eslint.config.js) while
   * `pnpm typecheck` runs TS 7, and the two infer `current.fields` differently across this
   * generic boundary — dropping them fails `tsc`. The compiler is the authority, so the
   * assertions stay and the rule is switched off for the callback. Revisit when
   * typescript-eslint supports TS 7 and both agree.
   */
  /* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
  const validateCurrent = useCallback(async () => {
    const fields = current.fields as readonly Path<TIn>[] | undefined
    if (!fields?.length) return true
    // Dev-only. `_names` (hookform's registered-name sets) plus the current values answer
    // "does the form know this name at all" — see `warnUnmountedStepFields` for why
    // mount-only is the wrong question here.
    warnUnmountedStepFields(current.id, fields as readonly string[], control._names, getValues)
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
  }, [current, trigger, control, getValues, hasErrorSummary])
  /* eslint-enable @typescript-eslint/no-unnecessary-type-assertion */

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
    /* Navigating to the first errored step after a failed submit. `handledSubmit.current`
       above makes this run once per `submitCount`, and `to === index` stops it once the move
       has landed.

       `false`: this jump is not user navigation — `<FormErrorSummary>` focuses its own
       heading on arrival, and the step-change announcement would talk over it. */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    move(to, false)
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
      //
      // Both this clear and the one below consume a one-shot target rather than deriving
      // state from props: `if (!focusTarget) return` makes the render either schedules a
      // no-op, so the effect settles in one extra pass instead of cascading.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFocusTarget(null)
      return
    }
    // Clearing the one-shot focus target now that it has been used.
    setFocusTarget(null)
    setFocus(focusTarget.path)
  }, [focusTarget, current.id, setFocus])

  // Memoized separately from `stepChange` so the context object below keeps its identity on a
  // render where only the announcement `text` changed.
  const focusRequest = useMemo(
    () => ({ stepId: stepChange.stepId, seq: stepChange.seq }),
    [stepChange.stepId, stepChange.seq],
  )

  // The announcement is held back until the wizard has actually arrived: a controlled wizard
  // can decline the move `move()` requested (its `onStepChange` need not feed the new `step`
  // back), and announcing "Step 2 of 3, Plan" while the user is still on step 1 is worse than
  // saying nothing. Same gate as `WizardStep`'s focus check, so the two never disagree.
  const announcement = stepChange.stepId === current.id ? stepChange.text : null

  const value = useMemo<WizardContextValue>(
    () => ({
      id,
      // The context is deliberately untyped in `TIn`: WizardStepper / WizardNav / useWizard
      // consume it without knowing the form's field type, so these casts erase `TIn` on purpose.
      steps: steps as readonly WizardStepDef[],
      allSteps: allSteps as readonly WizardStepDef[],
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
      focusRequest,
    }),
    [
      id,
      steps,
      allSteps,
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
      focusRequest,
    ],
  )

  return (
    <WizardContext.Provider value={value}>
      {children}
      {/*
        Rendered unconditionally, empty at rest: a live region has to be in the DOM before
        its text arrives, or assistive tech has no prior content to observe changing and the
        first announcement is missed. After `children` so it is the wizard's last node — it
        is visually hidden, so document order is all that is at stake.
      */}
      <WizardStatus
        message={announcement}
        announcementKey={stepChange.seq}
        className={wizardClasses.status}
      />
    </WizardContext.Provider>
  )
}
