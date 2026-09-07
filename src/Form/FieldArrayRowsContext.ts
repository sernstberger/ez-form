import { createContext, useContext, useEffect, useSyncExternalStore } from 'react'
import { devWarn } from '../devWarn'
import type { FieldArrayRow } from '../FieldArray/FieldArrayRow'

export interface FieldArrayRowsStore {
  /**
   * Publishes the rows of one `<FieldArray name>`. Called from the array's own effect on
   * every render whose `fields` list changed, so the registry tracks appends, removes and
   * moves live.
   *
   * There is deliberately no unregister — see this file's latch ruling.
   */
  register: (name: string, rows: readonly FieldArrayRow[]) => void
  /** The last-published rows of every array this form has ever mounted, keyed by array name. */
  getRows: () => Record<string, readonly FieldArrayRow[]>
  subscribe: (listener: () => void) => () => void
}

/**
 * The registry `<Form>` provides, `<FieldArray>` writes, and `useFieldArrayRows` reads.
 *
 * Ruling: a registry rather than a second `useFieldArray` on the same name (#79) — the
 * obvious implementation, "just call the hook again in the other component", does not work
 * and fails *silently*. Probed against react-hook-form 7.87.0, two `useFieldArray({ name:
 * 'rows' })` instances in one `FormProvider`:
 *
 * 1. **Ids are per-hook-instance.** Each `useFieldArray` mints its own id per row on mount,
 *    so the two instances never agree; the second reader's ids are stable but identify
 *    nothing the owner knows, which defeats the whole point of asking for them.
 * 2. **The second instance never updates.** hookform keeps one field-array subscription slot
 *    per name, and the last-mounted instance wins — the other stops re-rendering. The probe's
 *    reader still showed its original two ids after an append *and* a remove: not merely
 *    mis-keyed, frozen.
 *
 * hookform documents this ("Each `useFieldArray` instance must have a unique name, and
 * multiple instances should not share the same name"), and there is nothing on `control` to
 * read instead: `control._names.array` is a `Set` of registered array *names*, and the ids
 * live in the owning hook's own closure. So the component that already owns the one
 * authoritative `useFieldArray` publishes what it has. Cost if wrong: one more store on
 * `<Form>`, alongside the three already there.
 *
 * A subscription store rather than `useState` on `<Form>`, for the reason recorded once in
 * `FieldFocusContext` — publishing this map as form state would re-render every field of the
 * form on every append/remove. That file also records why these registries stay separate
 * stores rather than sharing a generic one (#126).
 *
 * Ruling: the registry **latches** the last-known rows per array name and never clears on
 * unmount (#79) — the motivating case is cross-*step*. `<WizardStep>` renders `null` for
 * every step but the current one, so the owning `<FieldArray name="coApplicants">` is
 * unmounted at exactly the moment a later Documents step asks for its rows. A registry that
 * cleared on unmount would answer `[]` on the one screen the hook exists for.
 *
 * The latch here is **value-carrying**, where `ErrorSummaryContext`'s is a boolean, so it
 * needs one thing that store does not: while the owner *is* mounted its publication is
 * authoritative and overwrites the latched value on every change. The latch is only what is
 * read once the owner has gone away. That is what makes both halves of the contract true —
 * rows update live when array and reader are mounted together, and freeze at their last value
 * when the array unmounts.
 *
 * **The latch is one-way, for the life of the `<Form>` instance**, exactly as
 * `ErrorSummaryContext`'s is. An array *permanently* removed from the form — behind a prop or
 * a feature flag, not a wizard step — keeps reporting its last rows to a reader that outlives
 * it. This is the intended trade (the alternative is the cross-step case above answering
 * `[]`), and it is cheap to avoid the same way: remount the `<Form>`.
 */
export const FieldArrayRowsContext = createContext<FieldArrayRowsStore | null>(null)

/** Whether two published row lists describe the same rows, in the same order, at the same indices. */
function sameRows(a: readonly FieldArrayRow[], b: readonly FieldArrayRow[]): boolean {
  if (a.length !== b.length) return false
  // `name` is a fresh closure on every render and so is never referentially equal; `id` and
  // `index` are the whole identity of a row, and a row whose index is unchanged builds the
  // same path. Comparing those two is what keeps a re-render that changed nothing from
  // notifying every reader.
  return a.every((row, i) => row.id === b[i]?.id && row.index === b[i]?.index)
}

export function createFieldArrayRowsStore(): FieldArrayRowsStore {
  let rows: Record<string, readonly FieldArrayRow[]> = {}
  const listeners = new Set<() => void>()

  return {
    register(name, next) {
      const current = rows[name]
      if (current && sameRows(current, next)) return
      rows = { ...rows, [name]: next }
      for (const listener of listeners) listener()
    },
    getRows: () => rows,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

// Publishing rows outside <Form> is not an error: <FieldArray> itself already throws from
// `useEzFormContext`, so nothing can reach this path with real rows to publish.
const noopRegister = () => undefined

/**
 * The raw publication callback, to call from `<FieldArray>`'s effect. No-op outside `<Form>`.
 */
export function useRegisterFieldArrayRows(): FieldArrayRowsStore['register'] {
  return useContext(FieldArrayRowsContext)?.register ?? noopRegister
}

// A shared empty result, so an unregistered name returns a referentially stable value and a
// reader of one does not re-render whenever some *other* array in the form changes.
const noRows: readonly FieldArrayRow[] = []
const noRowsMap: Record<string, readonly FieldArrayRow[]> = {}
// eslint-disable-next-line @typescript-eslint/no-empty-function
const noopSubscribe = () => () => {}

/**
 * The rows of a `<FieldArray>` elsewhere in this form — `{ index, id, name }` per row, the
 * same shape the array's own `children` render prop receives.
 *
 * This is the supported way to render content *per existing row* of an array you do not own:
 * one upload field per co-applicant on a later wizard step, a per-row summary line, a
 * side-panel entry. It is read-only — add, remove and reorder stay with the `<FieldArray>`
 * that declares the array.
 *
 * Key your rows by `row.id` and build every field path with `row.name(field)`. Keying by
 * array index instead is the bug this hook exists to remove: an index-keyed path is only
 * correct until someone removes or reorders a row, after which `` `coApplicants.2.documents` ``
 * silently addresses a different person's row.
 *
 * Rows update live while the owning array is mounted. When it unmounts — which a `<Wizard>`
 * does to every step but the current one — the last-known rows are latched and keep being
 * returned, which is what makes the cross-step case work at all; see `FieldArrayRowsContext`
 * for the full ruling and its one-way trade.
 *
 * Ruling: an array this form has never mounted returns `[]` and warns in development, rather
 * than throwing or returning `undefined` (#79) — a reader on a conditional step can
 * legitimately render before its array has ever existed, so throwing would take down a form
 * for a recoverable state, and `undefined` pushes a null check onto every call site for that
 * same case. `[]` renders nothing, which is the correct output; the dev warning is what tells
 * a consumer they typo'd the name. Cost if wrong: a genuine typo renders an empty section
 * silently in production, where the dev build warned.
 *
 * ```tsx
 * function DocumentUploads() {
 *   const coApplicants = useFieldArrayRows('coApplicants')
 *   return coApplicants.map((row) => (
 *     <FileField key={row.id} name={row.name('documents')} label={`Documents ${row.index + 1}`} />
 *   ))
 * }
 * ```
 */
export function useFieldArrayRows(name: string): readonly FieldArrayRow[] {
  const store = useContext(FieldArrayRowsContext)
  const getRows = store?.getRows ?? (() => noRowsMap)
  const rows = useSyncExternalStore(store?.subscribe ?? noopSubscribe, getRows, getRows)[name]

  // The check runs after a commit *and* a macrotask, not during render, and asks the store
  // again rather than trusting the `rows` this render read.
  //
  // Two things make a render-time check wrong. On a form's first render neither this reader
  // nor the `<FieldArray>` that owns the name has committed, so the registry is still empty
  // and every correctly-spelled array would warn. Deferring to an effect fixes only half of
  // that: React runs effects in tree order, so a reader rendered *above* its array still runs
  // first and still sees nothing. The timeout drops the check past the whole commit's effects,
  // where "no array has ever registered this name" is finally the same statement as "nothing
  // in this form owns it".
  //
  // Dev-only, so the timer exists only in a build that can warn. The check is written inline
  // rather than imported from `devWarn.ts` (which keeps its own `isDev` private) for the
  // reason that file records: `process.env.NODE_ENV` is the substitution every bundler makes
  // before dead-code elimination, so this whole effect body drops from a production build.
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return
    const timer = setTimeout(() => {
      if (store?.getRows()[name] !== undefined) return
      devWarn(
        `field-array-rows:${name}`,
        `ez-form: useFieldArrayRows("${name}") — this form has no <FieldArray name="${name}">. ` +
          'It renders nothing. Check the name against the array that owns those rows; the ' +
          'array does not have to be mounted right now, but it must belong to the same <Form>.',
      )
    }, 0)
    return () => clearTimeout(timer)
  }, [store, name])

  return rows ?? noRows
}
