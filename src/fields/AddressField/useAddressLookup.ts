import { useCallback, useEffect, useRef, useState } from 'react'
import { devWarn } from '../../devWarn'
import type { AddressLookupProvider, AddressSuggestion } from './addressLookup'
import type { AddressValue } from './AddressField'

export interface UseAddressLookupOptions {
  /** Absent → the hook is inert: `search` is a no-op and `options` stays empty. */
  provider: AddressLookupProvider | undefined
  /** The field's `name`, for the dev warning a failed call produces. */
  name: string
  /** How long typing must pause before `search` runs. Default 300ms. */
  debounceMs?: number
  /** Shorter queries clear the list instead of searching. Default 3. */
  minChars?: number
}

export interface AddressLookupState {
  options: AddressSuggestion[]
  /** `true` from the keystroke that scheduled a search until its result (or failure) lands. */
  loading: boolean
  /** Debounced. Empty or below `minChars` clears the list and aborts anything in flight. */
  search: (query: string) => void
  /** Drops the list and aborts anything in flight; the session is kept for the next query. */
  clear: () => void
  /**
   * Resolves a picked row through the provider, then ends the session. Returns
   * `undefined` — after a dev warning — when the provider failed, so the caller
   * leaves the form as it is.
   */
  resolve: (suggestion: AddressSuggestion) => Promise<Partial<AddressValue> | undefined>
}

/** URL- and base64url-safe, the character set a session token has to stay inside. */
const SESSION_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-'

/**
 * A fresh session token. Providers treat it as opaque, but Google bounds it: at
 * most 36 ASCII characters, URL-safe. `randomUUID` (36 chars, hex and dashes) is
 * what Google recommends and what every current runtime has; the fallback for
 * an older embedded WebView is 32 characters from the same safe alphabet.
 *
 * @internal — exported for its test only.
 */
export const newSession = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Array.from(
        { length: 32 },
        () => SESSION_ALPHABET[Math.floor(Math.random() * SESSION_ALPHABET.length)],
      ).join('')

/**
 * The lookup half of `<AddressField lookup>`: debounce, minimum length, the
 * request guard (a newer query aborts the older one *at keystroke time*, so a
 * response arriving inside the debounce window is already dead), the loading
 * flag, and the session token. Exported for a field built on the same seam
 * (a single-input address picker, say); `AddressField` is the only caller here.
 */
export function useAddressLookup({
  provider,
  name,
  debounceMs = 300,
  minChars = 3,
}: UseAddressLookupOptions): AddressLookupState {
  const [options, setOptions] = useState<AddressSuggestion[]>([])
  const [loading, setLoading] = useState(false)

  // Refs, not state: nothing renders from any of these, and as state each
  // would force a render per keystroke just to clear itself.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchAbortRef = useRef<AbortController | null>(null)
  const resolveAbortRef = useRef<AbortController | null>(null)
  const sessionRef = useRef<string | null>(null)

  const cancelSearch = useCallback(() => {
    if (timerRef.current !== null) clearTimeout(timerRef.current)
    timerRef.current = null
    searchAbortRef.current?.abort()
    searchAbortRef.current = null
  }, [])

  // Unmounting mid-flight must not leave a timer to fire or a request to
  // resolve into a setState on a component that is gone.
  useEffect(
    () => () => {
      cancelSearch()
      resolveAbortRef.current?.abort()
    },
    [cancelSearch],
  )

  const clear = useCallback(() => {
    cancelSearch()
    setOptions([])
    setLoading(false)
  }, [cancelSearch])

  const search = useCallback(
    (query: string) => {
      if (!provider) return
      cancelSearch()
      if (query.length < minChars) {
        setOptions([])
        setLoading(false)
        return
      }
      setLoading(true)
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        const controller = new AbortController()
        searchAbortRef.current = controller
        sessionRef.current ??= newSession()
        provider
          .search(query, { signal: controller.signal, session: sessionRef.current })
          .then((results) => {
            if (controller.signal.aborted) return
            setOptions(results)
            setLoading(false)
          })
          .catch((error: unknown) => {
            // An abort is the expected outcome of typing on, not a failure worth
            // reporting. A real failure empties the list so the field degrades to
            // plain typing, and says so once in dev.
            if (controller.signal.aborted) return
            setOptions([])
            setLoading(false)
            devWarn(
              `address-lookup-search:${name}`,
              `ez-form: <AddressField name="${name}"> lookup.search failed: ${String(error)}`,
            )
          })
      }, debounceMs)
    },
    [provider, name, debounceMs, minChars, cancelSearch],
  )

  const resolve = useCallback(
    async (suggestion: AddressSuggestion) => {
      if (!provider) return undefined
      // The list that produced the pick is stale the moment it is picked.
      clear()
      resolveAbortRef.current?.abort()
      const controller = new AbortController()
      resolveAbortRef.current = controller
      const session = sessionRef.current ?? newSession()
      // Ended here, not after the await: a query typed while the resolve is in
      // flight belongs to a new session, and a session must never outlive its pick.
      sessionRef.current = null
      try {
        const parts = await provider.resolve(suggestion, { signal: controller.signal, session })
        return controller.signal.aborted ? undefined : parts
      } catch (error: unknown) {
        if (controller.signal.aborted) return undefined
        devWarn(
          `address-lookup-resolve:${name}`,
          `ez-form: <AddressField name="${name}"> lookup.resolve failed: ${String(error)}`,
        )
        return undefined
      }
    },
    [provider, name, clear],
  )

  return { options, loading, search, clear, resolve }
}
