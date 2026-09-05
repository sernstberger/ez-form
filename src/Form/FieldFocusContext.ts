import { createContext, useContext, useSyncExternalStore } from 'react'

export interface FieldFocusStore {
  /**
   * Records the element a field hands react-hook-form as its focus target, keyed by the
   * field's `name`, assigning the element a generated `id` when it has none. Called from
   * `useEzField`'s forked `field.ref`, so it fires on mount, on unmount (`element === null`)
   * and on every re-attach, exactly when the ref itself does.
   */
  register: (name: string, element: HTMLElement | null) => void
  /** The `id` of each registered field's focus target, keyed by field name. */
  getIds: () => Record<string, string>
  subscribe: (listener: () => void) => () => void
}

/**
 * The registry `<Form>` provides and `<FormErrorSummary>` reads.
 *
 * Ruling: the summary reads a registry keyed by field name rather than querying
 * `document.querySelector('[name=…]')` (#98) — the DOM query found the *hidden* input for
 * every field whose `name` lives on one (Base UI's NumberField/OtpField, MUI's
 * Slider/Checkbox/Switch), the *first option* of a group (RadioGroup/CheckboxGroup), or
 * nothing at all (ToggleButtonGroup/EmailListField, which put `name` on no element), none of
 * which is the element focus should land on and most of which carry no `id`; nine of sixteen
 * field types therefore rendered a summary item with no `href` — no `link` role, no tab stop,
 * mouse-only. Every ez-form field already hands hookform its real focus target through
 * `field.ref`, the one mechanism they all share, so forking that ref covers all of them
 * without touching a single field file. Cost if wrong: a field that never calls its `ref`
 * renders an item with no `href`, which is exactly the behaviour it had before.
 *
 * Ruling: a subscription store rather than `useState` on `<Form>` — publishing the map as
 * form state re-renders every field on each registration, which is both wasteful and *not
 * inert*: it re-ran `Autocomplete`'s option list mid-interaction (AddressField's "folds the
 * locality" test picked the wrong row) and disturbed the Wizard's failed-submit focus race.
 * `useSyncExternalStore` confines the re-render to the one component that reads the ids.
 * Cost if wrong: a hand-rolled store — 20 lines — instead of a hook.
 */
export const FieldFocusContext = createContext<FieldFocusStore | null>(null)

/**
 * `idPrefix` comes from `<Form>`'s own `useId`, so two forms on a page generate distinct ids
 * for the same field name.
 */
export function createFieldFocusStore(idPrefix: string): FieldFocusStore {
  let ids: Record<string, string> = {}
  const listeners = new Set<() => void>()

  return {
    register(name, element) {
      if (element === null) {
        // A ref callback runs *during* commit, and React detaches (`null`) then immediately
        // re-attaches any ref whose prop is not referentially stable across renders — `Rating`
        // passes an inline arrow, so it does that on every render. The generated id below is
        // derived from the field name, so the re-attach restores the identical entry; the
        // equality check below then finds nothing changed and notifies nobody. Without that,
        // each detach/attach pair would notify, re-render, and detach again — an infinite loop.
        if (!(name in ids)) return
        const { [name]: _removed, ...rest } = ids
        ids = rest
      } else {
        // Assign an id only when the element has none of its own: MUI generates one for every
        // TextField-family input, and a consumer may have passed `id` explicitly. Overwriting
        // either would break the `htmlFor` / `aria-describedby` wiring already pointing at it.
        if (!element.id) {
          element.id = `${idPrefix}${name}`
        }
        if (ids[name] === element.id) return
        ids = { ...ids, [name]: element.id }
      }
      for (const listener of listeners) listener()
    },
    getIds: () => ids,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

// Registering nothing outside <Form> is not an error: a field there already throws from
// `useEzFormContext`, and an unbound control (`NumberFieldControl` and friends) has no name.
const noopRegister = () => undefined
const noIds: Record<string, string> = {}
// eslint-disable-next-line @typescript-eslint/no-empty-function
const noopSubscribe = () => () => {}

/**
 * The raw registration callback, to call from a ref. No-op outside `<Form>`.
 */
export function useRegisterFocusTarget(): FieldFocusStore['register'] {
  return useContext(FieldFocusContext)?.register ?? noopRegister
}

/**
 * The `id` of every mounted field's focus target, keyed by field name. `<FormErrorSummary>`
 * reads this to build each item's `href`; only the components calling this hook re-render
 * when a field registers.
 */
export function useFocusTargetIds(): Record<string, string> {
  const store = useContext(FieldFocusContext)
  return useSyncExternalStore(
    store?.subscribe ?? noopSubscribe,
    store?.getIds ?? (() => noIds),
    store?.getIds ?? (() => noIds),
  )
}
