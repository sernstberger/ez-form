import { createContext, useCallback, useContext } from 'react'

export interface FormErrorFocusStore {
  /**
   * Records the element `<FormError>` renders, so `<Form>`'s post-submit focus step can send
   * a keyboard/screen-reader user to it when a submit left a root-level error behind. Called
   * from `<FormError>`'s own ref, so it fires on mount, unmount (`element === null`), and
   * every re-attach — and since `<FormError>` renders nothing at all when there is no root
   * error, "registered" and "there is an alert on screen" are the same fact.
   */
  register: (element: HTMLElement | null) => void
  /** The most recently registered `<FormError>` element, or `null` when none is mounted. */
  get: () => HTMLElement | null
}

/**
 * The registry `<Form>` provides and `<FormError>` writes to (#124).
 *
 * Ruling: a store handed through context rather than a DOM query for `[role="alert"]` — an
 * `Alert` is not the only thing in a form with that role (every field's own error text is a
 * `role="alert"` live region, and a consumer may render alerts of their own), so a query
 * would focus whichever happened to come first in document order. `<FormError>` naming
 * itself is unambiguous and costs one ref. Cost if wrong: a consumer who surfaces
 * `errors.root` with their own component instead of `<FormError>` registers nothing, and
 * `<Form>` falls back to focusing the first invalid field — the behaviour they had before.
 *
 * Ruling: a mutable store rather than `useState` on `<Form>` — the element is only ever read
 * imperatively, inside the submit handler, so publishing it as state would re-render the
 * whole form on every mount/unmount of the alert for no reader's benefit. This mirrors
 * `FieldFocusContext`'s reasoning; it does not even need that one's subscription half, since
 * nothing renders from this value. Cost if wrong: a stale element if `<FormError>` unmounted
 * without its ref detaching, which React does not do.
 */
export const FormErrorFocusContext = createContext<FormErrorFocusStore | null>(null)

export function createFormErrorFocusStore(): FormErrorFocusStore {
  let element: HTMLElement | null = null
  return {
    register(next) {
      element = next
    },
    get: () => element,
  }
}

/**
 * The registration callback, to use directly as `<FormError>`'s own `ref`. No-op outside
 * `<Form>` — `<FormError>` itself still guards via `useEzFormContext`.
 *
 * Ruling: a ref callback, not an effect on a state-held element. React runs ref callbacks
 * during the commit itself, before any effect in that commit; an effect would need the
 * element in state first, which costs an extra render — so on the commit where `<Form>`'s own
 * post-submit focus effect runs, the store would still be empty and focus would fall through
 * to the field branch. That is not a theoretical ordering worry: it is what the first draft
 * did, and what made the alert-focus assertions fail. Cost if wrong: none — a ref callback is
 * what `FieldFocusContext.register` already is, for the same reason.
 */
export function useRegisterFormError(): (element: HTMLElement | null) => void {
  const store = useContext(FormErrorFocusContext)
  return useCallback(
    (element: HTMLElement | null) => {
      store?.register(element)
    },
    [store],
  )
}
