import { createContext, useCallback, useContext, useEffect, useSyncExternalStore } from 'react'
import { warnUnknownFieldArrayName } from '../devWarn'
import { useEzFormContext } from '../useEzFormContext'
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
 * `ErrorSummaryContext`'s is, and it has two costs worth naming:
 *
 * - An array *permanently* removed from the form — behind a prop or a feature flag, not a
 *   wizard step — keeps reporting its last rows to a reader that outlives it.
 * - A `reset()` (or a `values` prop change) while the owning array is unmounted replaces the
 *   array's values without anything re-publishing, so a reader keeps the pre-reset row count
 *   and paths until that array mounts again and publishes afresh. On a wizard this resolves
 *   the moment the user visits the step; for a reader that must be right immediately after a
 *   reset, read the values with `useWatch` instead.
 *
 * Both are the intended trade — the alternative is the cross-step case above answering `[]` —
 * and both are cheap to avoid the same way: remount the `<Form>`.
 *
 * **Ids are stable per `<FieldArray>` mount, not for the life of the form.** They are
 * hookform's, and hookform mints them when the hook mounts and re-mints on array-level
 * replacement (`replace`, a `reset`), so an array whose step unmounts and mounts again hands
 * out a new set. Within one mount they are stable across append/remove/move, which is what
 * makes them the right React `key`; across a remount a reader keyed by them re-mounts its
 * rows, which for per-row content on another step is invisible, and for a persistent side
 * panel means its rows' own component state resets when the owning step is revisited. Do not
 * persist an id or send it to a server as a row identifier.
 *
 * Ruling: this stays a separate store rather than the generic `createSyncStore<T>` #126
 * anticipates, even though it is the fourth with `FieldFocusContext`'s shape and #14's
 * cell-labels registry will be the fifth — two lanes are editing `Form.tsx` right now, and an
 * extraction is worth doing once, against all five real call sites, rather than twice against
 * four and then five. Tracked in #134. Cost if wrong: the seven lines of `Set` +
 * subscribe/unsubscribe boilerplate are duplicated one more time until that lands.
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

// One shared empty array, so the snapshot for a name nothing has published is referentially
// stable across renders — `useSyncExternalStore` compares snapshots and a fresh `[]` each time
// would re-render forever.
const noRows: readonly FieldArrayRow[] = []
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
  const { control } = useEzFormContext('useFieldArrayRows')

  // Selects *this* name out of the map rather than snapshotting the whole thing, so a reader
  // of one array is not re-rendered by every other array's appends. `?? noRows` inside the
  // selector keeps the snapshot referentially stable for a name nothing has published:
  // `useSyncExternalStore` re-reads on every render and would loop on a fresh `[]`.
  const getSnapshot = useCallback(() => store?.getRows()[name] ?? noRows, [store, name])
  const rows = useSyncExternalStore(store?.subscribe ?? noopSubscribe, getSnapshot, getSnapshot)

  // Asks whether the *name* is one this form knows (#108), not whether an array has published
  // rows for it yet — see `warnUnknownFieldArrayName` for why those differ and why only the
  // first is answerable here. The schema keys behind it are fixed when the resolver is built,
  // before anything registers, so a plain effect is early enough and no deferral is needed.
  useEffect(() => {
    warnUnknownFieldArrayName(name, control)
  }, [name, control])

  return rows
}
