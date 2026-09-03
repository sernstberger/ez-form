import { createElement } from 'react'
import type { AddressValue } from '../fields/AddressField'
import type {
  AddressLookupContext,
  AddressLookupProvider,
  AddressSuggestion,
} from './addressLookupTypes'
import { GooglePlacesAttribution } from './GooglePlacesAttribution'

const PLACES_ORIGIN = 'https://places.googleapis.com/v1'

export interface GooglePlacesOptions {
  /**
   * A browser API key with the Places API (New) enabled. It travels in the `X-Goog-Api-Key`
   * header of every request the user's browser makes, so restrict it by HTTP referrer in the
   * Google Cloud console; the adapter never writes it to an error or a log.
   */
  apiKey: string
  /**
   * `includedRegionCodes` for the autocomplete request: up to 15 two-letter CLDR region codes.
   * Defaults to the US, matching the field's US-only parts.
   */
  regionCodes?: readonly string[]
  /** `languageCode` (BCP-47) for predictions and place details. Google defaults to `en-US`. */
  languageCode?: string
  /**
   * `includedPrimaryTypes` for the autocomplete request (up to five place types). Unset by
   * default so Google returns every kind of prediction; a consumer who only wants street
   * addresses restricts here.
   */
  includedPrimaryTypes?: readonly string[]
  /** The attribution node rendered under the listbox; defaults to "Powered by Google". */
  attribution?: AddressLookupProvider['attribution']
  /** The `fetch` to use; injectable for tests and for non-browser runtimes. */
  fetch?: typeof globalThis.fetch
}

/** The subset of Google's Autocomplete (New) response this adapter reads. */
interface AutocompleteResponse {
  suggestions?: {
    placePrediction?: {
      placeId?: string
      text?: { text?: string }
      structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } }
    }
  }[]
}

/** One entry of Place Details (New) `addressComponents`. */
interface AddressComponent {
  longText?: string
  shortText?: string
  types?: string[]
}

interface PlaceDetailsResponse {
  addressComponents?: AddressComponent[]
}

interface GoogleErrorBody {
  error?: { message?: string }
}

/**
 * Turns a non-2xx Google response into an `Error` carrying the status and Google's own
 * `error.message`. The key is scrubbed defensively should it ever be echoed back.
 */
async function toError(response: Response, apiKey: string): Promise<Error> {
  let message = response.statusText
  try {
    const body = (await response.json()) as GoogleErrorBody
    if (typeof body.error?.message === 'string') message = body.error.message
  } catch {
    // A non-JSON body (a proxy's HTML error page, say): the status text is all there is.
  }
  const safe = apiKey ? message.split(apiKey).join('[redacted]') : message
  return new Error(`Google Places ${response.status}: ${safe}`)
}

function componentsToAddress(components: readonly AddressComponent[]): Partial<AddressValue> {
  const find = (type: string) => components.find((c) => c.types?.includes(type))
  const long = (type: string) => find(type)?.longText ?? ''

  const out: Partial<AddressValue> = {}

  const street = `${long('street_number')} ${long('route')}`.trim()
  if (street) out.street = street

  const street2 = long('subpremise')
  if (street2) out.street2 = street2

  // `locality` is the city; Google omits it for some addresses and gives a sublocality (a New
  // York borough) or, in the UK, a `postal_town` instead.
  const city = long('locality') || long('sublocality_level_1') || long('postal_town')
  if (city) out.city = city

  // The short form is the USPS abbreviation `StateSelect` stores ("CA", not "California").
  const state = find('administrative_area_level_1')?.shortText ?? ''
  if (state) out.state = state

  const zip = long('postal_code')
  if (zip) out.zip = zip

  return out
}

/**
 * An `AddressLookupProvider` over Google's Places API (New) REST endpoints: Autocomplete (New)
 * for the suggestion list and Place Details (New), field-masked to `addressComponents`, for the
 * pick. Both calls carry the field's session token so Google bills the keystrokes and the
 * details as one session. Stateless and dependency-free: the consumer passes the key.
 *
 * ```tsx
 * <AddressField name="shipping" lookup={googlePlaces({ apiKey })} />
 * ```
 */
export function googlePlaces(options: GooglePlacesOptions): AddressLookupProvider {
  const {
    apiKey,
    regionCodes = ['us'],
    languageCode,
    includedPrimaryTypes,
    attribution = createElement(GooglePlacesAttribution),
  } = options
  // Resolved per call rather than at construction so a test's or a polyfill's later assignment
  // to `globalThis.fetch` still wins.
  const doFetch: typeof globalThis.fetch = (input, init) =>
    (options.fetch ?? globalThis.fetch)(input, init)

  async function search(query: string, ctx: AddressLookupContext): Promise<AddressSuggestion[]> {
    const input = query.trim()
    if (!input) return []

    const response = await doFetch(`${PLACES_ORIGIN}/places:autocomplete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey },
      body: JSON.stringify({
        input,
        sessionToken: ctx.session,
        includedRegionCodes: regionCodes,
        ...(includedPrimaryTypes ? { includedPrimaryTypes } : {}),
        ...(languageCode ? { languageCode } : {}),
      }),
      signal: ctx.signal,
    })
    if (!response.ok) throw await toError(response, apiKey)

    const body = (await response.json()) as AutocompleteResponse
    const suggestions: AddressSuggestion[] = []
    for (const { placePrediction } of body.suggestions ?? []) {
      // Query predictions (search phrases, not places) have no `placePrediction`; skip them.
      if (!placePrediction?.placeId) continue
      const label =
        placePrediction.structuredFormat?.mainText?.text ?? placePrediction.text?.text ?? ''
      const secondary = placePrediction.structuredFormat?.secondaryText?.text
      suggestions.push({
        id: placePrediction.placeId,
        label,
        ...(secondary ? { secondary } : {}),
      })
    }
    return suggestions
  }

  async function resolve(
    suggestion: AddressSuggestion,
    ctx: AddressLookupContext,
  ): Promise<Partial<AddressValue>> {
    const params = new URLSearchParams({ sessionToken: ctx.session })
    if (languageCode) params.set('languageCode', languageCode)

    const response = await doFetch(
      `${PLACES_ORIGIN}/places/${encodeURIComponent(suggestion.id)}?${params.toString()}`,
      {
        method: 'GET',
        headers: { 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': 'addressComponents' },
        signal: ctx.signal,
      },
    )
    if (!response.ok) throw await toError(response, apiKey)

    const body = (await response.json()) as PlaceDetailsResponse
    return componentsToAddress(body.addressComponents ?? [])
  }

  return { search, resolve, attribution }
}
