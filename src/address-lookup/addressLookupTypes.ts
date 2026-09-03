import type { ReactNode } from 'react'
import type { AddressValue } from '../fields/AddressField'

// Lane B's standalone copy of the #21 lookup seam. Lane A (feat/issue-21-field) owns the
// canonical file at `src/fields/AddressField/addressLookup.ts`, with these exact declarations;
// when the two branches merge, this file is deleted and `googlePlaces.ts` re-points its import
// there. Keep every declaration identical to the brief so that swap is a one-line change.

/** One row in the lookup listbox: `label` is the street line, `secondary` the rest. */
export interface AddressSuggestion {
  id: string
  label: string
  secondary?: string
}

/**
 * Per-call context the field supplies. `session` is an opaque string the field owns — created
 * on the first keystroke, sent with every search and the final resolve, then discarded — so a
 * billing-session-aware provider stays stateless. A newer query aborts the older `signal`.
 */
export interface AddressLookupContext {
  signal: AbortSignal
  session: string
}

export interface AddressLookupProvider {
  search(query: string, ctx: AddressLookupContext): Promise<AddressSuggestion[]>
  resolve(suggestion: AddressSuggestion, ctx: AddressLookupContext): Promise<Partial<AddressValue>>
  /** Rendered under the listbox; Google's terms require "Powered by Google" when no map is shown. */
  attribution?: ReactNode
}
