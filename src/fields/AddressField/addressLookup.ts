import type { ReactNode } from 'react'
import type { AddressValue } from './AddressField'

/** One row the lookup offers: `label` is the main line (the street), `secondary` the locality. */
export interface AddressSuggestion {
  id: string
  label: string
  secondary?: string
}

/**
 * Passed to every provider call. `signal` aborts when a newer query supersedes
 * this one (or the field unmounts); `session` is an opaque string the field
 * owns — created on the first keystroke, shared by every `search` and the
 * `resolve` that ends it, then discarded — so a billed-per-session backend
 * (Google Places) sees one session per picked address.
 */
export interface AddressLookupContext {
  signal: AbortSignal
  session: string
}

/**
 * What `<AddressField lookup>` talks to. Stateless: everything per-query lives
 * in the `ctx`. `search` returns rows for the typed text; `resolve` turns a
 * picked row into the address parts it knows — only those, no empty strings —
 * and the field writes every part: the supplied ones to their values, the rest
 * to `''`, so nothing from an earlier pick survives.
 */
export interface AddressLookupProvider {
  search(query: string, ctx: AddressLookupContext): Promise<AddressSuggestion[]>
  resolve(suggestion: AddressSuggestion, ctx: AddressLookupContext): Promise<Partial<AddressValue>>
  /**
   * Rendered under the listbox. Google's policy requires its logo (or, failing
   * that, attribution) whenever no Google map is shown; the `googlePlaces`
   * provider supplies a default.
   */
  attribution?: ReactNode
}
