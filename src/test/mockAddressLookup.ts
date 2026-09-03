import type { ReactNode } from 'react'
import type {
  AddressLookupContext,
  AddressLookupProvider,
  AddressSuggestion,
} from '../fields/AddressField/addressLookup'
import type { AddressValue } from '../fields/AddressField/AddressField'

/**
 * Three real US addresses, so a story and a test agree on what a pick fills in.
 * Only the second has a unit line: a provider returns the parts it knows and
 * nothing else, and the field is what turns a missing `street2` into `''`.
 */
export const mockAddresses: readonly { suggestion: AddressSuggestion; value: AddressValue }[] = [
  {
    suggestion: { id: 'mock-1', label: '1600 Pennsylvania Ave NW', secondary: 'Washington, DC' },
    value: { street: '1600 Pennsylvania Ave NW', city: 'Washington', state: 'DC', zip: '20500' },
  },
  {
    suggestion: { id: 'mock-2', label: '350 5th Ave', secondary: 'New York, NY' },
    value: {
      street: '350 5th Ave',
      street2: 'Floor 86',
      city: 'New York',
      state: 'NY',
      zip: '10118',
    },
  },
  {
    suggestion: { id: 'mock-3', label: '1 Infinite Loop', secondary: 'Cupertino, CA' },
    value: { street: '1 Infinite Loop', city: 'Cupertino', state: 'CA', zip: '95014' },
  },
]

export interface MockAddressLookupOptions {
  /** Simulated latency per call. Default 0 (still asynchronous). */
  delayMs?: number
  attribution?: ReactNode
}

/** Rejects the way `fetch` does when its signal aborts. */
const abortError = () => new DOMException('The operation was aborted.', 'AbortError')

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(abortError())
      return
    }
    const timer = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(abortError())
    })
  })

/**
 * A deterministic `AddressLookupProvider` over `mockAddresses`: `search` is a
 * case-insensitive substring match on the label and the locality, `resolve`
 * returns the fixture's full value. Every call is recorded on `calls`, with its
 * context, so a test can assert on session tokens and abort signals.
 */
export function mockAddressLookup({ delayMs = 0, attribution }: MockAddressLookupOptions = {}) {
  const calls: { kind: 'search' | 'resolve'; query: string; ctx: AddressLookupContext }[] = []
  const provider: AddressLookupProvider & { calls: typeof calls } = {
    calls,
    async search(query, ctx) {
      calls.push({ kind: 'search', query, ctx })
      await wait(delayMs, ctx.signal)
      const q = query.toLowerCase()
      return mockAddresses
        .filter(
          ({ suggestion }) =>
            suggestion.label.toLowerCase().includes(q) ||
            suggestion.secondary?.toLowerCase().includes(q),
        )
        .map(({ suggestion }) => suggestion)
    },
    async resolve(suggestion, ctx) {
      calls.push({ kind: 'resolve', query: suggestion.id, ctx })
      await wait(delayMs, ctx.signal)
      const hit = mockAddresses.find((a) => a.suggestion.id === suggestion.id)
      if (!hit) throw new Error(`Unknown place ${suggestion.id}`)
      return { ...hit.value }
    },
  }
  if (attribution !== undefined) provider.attribution = attribution
  return provider
}
