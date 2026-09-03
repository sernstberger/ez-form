import { googlePlaces } from './googlePlaces'
import type { AddressLookupContext } from '../fields/AddressField/addressLookup'

const KEY = 'AIza-test-key-000'

/** A minimal `Response` stand-in: the adapter reads only `ok`, `status`, `statusText`, `json()`. */
function jsonResponse(body: unknown, status = 200, statusText = 'OK'): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: () => Promise.resolve(body),
  } as unknown as Response
}

function fetchReturning(...responses: Response[]) {
  const fetch = vi.fn<typeof globalThis.fetch>()
  for (const response of responses) fetch.mockResolvedValueOnce(response)
  return fetch
}

function ctx(overrides: Partial<AddressLookupContext> = {}): AddressLookupContext {
  return { signal: new AbortController().signal, session: 'sess-1234', ...overrides }
}

/** The `[url, init]` of the mock's n-th call, narrowed to what the adapter sends (string URL, string body). */
function callOf(fetch: ReturnType<typeof fetchReturning>, n = 0) {
  const call = fetch.mock.calls[n]
  if (!call) throw new Error(`fetch was not called ${n + 1} time(s)`)
  const [url, init = {}] = call
  if (typeof url !== 'string') throw new Error('the adapter always passes a string URL')
  if (init.body !== undefined && typeof init.body !== 'string') {
    throw new Error('the adapter always passes a string body')
  }
  return { url, init: init as Omit<RequestInit, 'body'> & { body?: string } }
}

const prediction = (placeId: string, main: string, secondary?: string) => ({
  placePrediction: {
    placeId,
    text: { text: secondary ? `${main}, ${secondary}` : main },
    structuredFormat: {
      mainText: { text: main },
      ...(secondary ? { secondaryText: { text: secondary } } : {}),
    },
  },
})

const component = (types: string[], longText: string, shortText = longText) => ({
  longText,
  shortText,
  types,
  languageCode: 'en',
})

const googleplex = [
  component(['street_number'], '1600'),
  component(['route'], 'Amphitheatre Parkway', 'Amphitheatre Pkwy'),
  component(['locality', 'political'], 'Mountain View'),
  component(['administrative_area_level_2', 'political'], 'Santa Clara County'),
  component(['administrative_area_level_1', 'political'], 'California', 'CA'),
  component(['country', 'political'], 'United States', 'US'),
  component(['postal_code'], '94043'),
]

describe('googlePlaces', () => {
  describe('search', () => {
    it('posts to Autocomplete (New) with the key header, session token and region default', async () => {
      const fetch = fetchReturning(jsonResponse({ suggestions: [] }))
      const provider = googlePlaces({ apiKey: KEY, fetch })
      const signal = new AbortController().signal

      await provider.search('1600 Amph', ctx({ signal }))

      const { url, init } = callOf(fetch)
      expect(url).toBe('https://places.googleapis.com/v1/places:autocomplete')
      expect(init.method).toBe('POST')
      expect(init.headers).toEqual({
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': KEY,
      })
      expect(init.signal).toBe(signal)
      expect(JSON.parse(init.body ?? '')).toEqual({
        input: '1600 Amph',
        sessionToken: 'sess-1234',
        includedRegionCodes: ['us'],
      })
    })

    it('passes regionCodes, languageCode and includedPrimaryTypes through', async () => {
      const fetch = fetchReturning(jsonResponse({ suggestions: [] }))
      const provider = googlePlaces({
        apiKey: KEY,
        fetch,
        regionCodes: ['us', 'ca'],
        languageCode: 'es',
        includedPrimaryTypes: ['street_address'],
      })

      await provider.search('Calle', ctx())

      expect(JSON.parse(callOf(fetch).init.body ?? '')).toEqual({
        input: 'Calle',
        sessionToken: 'sess-1234',
        includedRegionCodes: ['us', 'ca'],
        includedPrimaryTypes: ['street_address'],
        languageCode: 'es',
      })
    })

    it('maps place predictions to id / label / secondary and skips query predictions', async () => {
      const fetch = fetchReturning(
        jsonResponse({
          suggestions: [
            prediction('ChIJ-googleplex', '1600 Amphitheatre Parkway', 'Mountain View, CA, USA'),
            { queryPrediction: { text: { text: 'amphitheatre near me' } } },
            prediction('ChIJ-no-secondary', 'Amphitheatre'),
          ],
        }),
      )
      const provider = googlePlaces({ apiKey: KEY, fetch })

      await expect(provider.search('1600 Amph', ctx())).resolves.toEqual([
        {
          id: 'ChIJ-googleplex',
          label: '1600 Amphitheatre Parkway',
          secondary: 'Mountain View, CA, USA',
        },
        { id: 'ChIJ-no-secondary', label: 'Amphitheatre' },
      ])
    })

    it('returns [] for an empty suggestions list and for a body without one', async () => {
      const fetch = fetchReturning(jsonResponse({ suggestions: [] }), jsonResponse({}))
      const provider = googlePlaces({ apiKey: KEY, fetch })

      await expect(provider.search('zzz', ctx())).resolves.toEqual([])
      await expect(provider.search('zzz', ctx())).resolves.toEqual([])
    })

    it('does not call Google for a blank query', async () => {
      const fetch = fetchReturning()
      const provider = googlePlaces({ apiKey: KEY, fetch })

      await expect(provider.search('   ', ctx())).resolves.toEqual([])
      expect(fetch).not.toHaveBeenCalled()
    })

    it("throws the status and Google's error.message on a non-2xx, never the key", async () => {
      const fetch = fetchReturning(
        jsonResponse(
          {
            error: {
              code: 403,
              message: `Requests from referer <empty> are blocked. Key ${KEY}`,
              status: 'PERMISSION_DENIED',
            },
          },
          403,
          'Forbidden',
        ),
      )
      const provider = googlePlaces({ apiKey: KEY, fetch })

      const error = await provider.search('1600', ctx()).catch((e: unknown) => e)
      expect(error).toBeInstanceOf(Error)
      const message = (error as Error).message
      expect(message).toBe(
        'Google Places 403: Requests from referer <empty> are blocked. Key [redacted]',
      )
      expect(message).not.toContain(KEY)
    })

    it('falls back to the status text when the error body is not JSON', async () => {
      const broken = {
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
        json: () => Promise.reject(new SyntaxError('Unexpected token <')),
      } as unknown as Response
      const provider = googlePlaces({ apiKey: KEY, fetch: fetchReturning(broken) })

      await expect(provider.search('1600', ctx())).rejects.toThrow('Google Places 502: Bad Gateway')
    })

    it('propagates an abort from the injected fetch untouched', async () => {
      const abort = new DOMException('The operation was aborted.', 'AbortError')
      const fetch = vi.fn<typeof globalThis.fetch>().mockRejectedValueOnce(abort)
      const provider = googlePlaces({ apiKey: KEY, fetch })

      await expect(provider.search('1600', ctx())).rejects.toBe(abort)
    })
  })

  describe('resolve', () => {
    it('gets Place Details (New) with the addressComponents field mask and session token', async () => {
      const fetch = fetchReturning(jsonResponse({ addressComponents: googleplex }))
      const provider = googlePlaces({ apiKey: KEY, fetch })
      const signal = new AbortController().signal

      await provider.resolve({ id: 'ChIJ/needs encoding', label: 'x' }, ctx({ signal }))

      const { url, init } = callOf(fetch)
      expect(url).toBe(
        'https://places.googleapis.com/v1/places/ChIJ%2Fneeds%20encoding?sessionToken=sess-1234',
      )
      expect(init.method).toBe('GET')
      expect(init.headers).toEqual({
        'X-Goog-Api-Key': KEY,
        'X-Goog-FieldMask': 'addressComponents',
      })
      expect(init.signal).toBe(signal)
      expect(init.body).toBeUndefined()
    })

    it('adds languageCode to the details query when set', async () => {
      const fetch = fetchReturning(jsonResponse({ addressComponents: [] }))
      const provider = googlePlaces({ apiKey: KEY, fetch, languageCode: 'es' })

      await provider.resolve({ id: 'abc', label: 'x' }, ctx())

      expect(callOf(fetch).url).toBe(
        'https://places.googleapis.com/v1/places/abc?sessionToken=sess-1234&languageCode=es',
      )
    })

    it('maps components to the address parts, omitting street2 when there is no subpremise', async () => {
      const fetch = fetchReturning(jsonResponse({ addressComponents: googleplex }))
      const provider = googlePlaces({ apiKey: KEY, fetch })

      await expect(provider.resolve({ id: 'g', label: 'x' }, ctx())).resolves.toEqual({
        street: '1600 Amphitheatre Parkway',
        city: 'Mountain View',
        state: 'CA',
        zip: '94043',
      })
    })

    it('maps a subpremise to street2 and falls back to sublocality_level_1 for the city', async () => {
      const fetch = fetchReturning(
        jsonResponse({
          addressComponents: [
            component(['subpremise'], 'Apt 4B'),
            component(['street_number'], '350'),
            component(['route'], '5th Avenue', '5th Ave'),
            component(['sublocality_level_1', 'sublocality', 'political'], 'Manhattan'),
            component(['administrative_area_level_1', 'political'], 'New York', 'NY'),
            component(['postal_code'], '10118'),
          ],
        }),
      )
      const provider = googlePlaces({ apiKey: KEY, fetch })

      await expect(provider.resolve({ id: 'esb', label: 'x' }, ctx())).resolves.toEqual({
        street: '350 5th Avenue',
        street2: 'Apt 4B',
        city: 'Manhattan',
        state: 'NY',
        zip: '10118',
      })
    })

    it('prefers locality over the fallbacks and uses postal_town when neither locality exists', async () => {
      const fetch = fetchReturning(
        jsonResponse({
          addressComponents: [
            component(['locality', 'political'], 'Brooklyn'),
            component(['sublocality_level_1', 'political'], 'Williamsburg'),
          ],
        }),
        jsonResponse({
          addressComponents: [
            component(['route'], 'Downing Street'),
            component(['postal_town'], 'London'),
          ],
        }),
      )
      const provider = googlePlaces({ apiKey: KEY, fetch })

      await expect(provider.resolve({ id: 'a', label: 'x' }, ctx())).resolves.toEqual({
        city: 'Brooklyn',
      })
      await expect(provider.resolve({ id: 'b', label: 'x' }, ctx())).resolves.toEqual({
        street: 'Downing Street',
        city: 'London',
      })
    })

    it('returns {} when Google sends no components', async () => {
      const provider = googlePlaces({ apiKey: KEY, fetch: fetchReturning(jsonResponse({})) })

      await expect(provider.resolve({ id: 'a', label: 'x' }, ctx())).resolves.toEqual({})
    })

    it('throws the status and message on a non-2xx without the key', async () => {
      const fetch = fetchReturning(
        jsonResponse(
          { error: { code: 404, message: 'Place not found', status: 'NOT_FOUND' } },
          404,
        ),
      )
      const provider = googlePlaces({ apiKey: KEY, fetch })

      const error = await provider
        .resolve({ id: 'gone', label: 'x' }, ctx())
        .catch((e: unknown) => e)
      expect((error as Error).message).toBe('Google Places 404: Place not found')
      expect((error as Error).message).not.toContain(KEY)
    })
  })

  describe('options', () => {
    it('uses globalThis.fetch when none is injected, read at call time', async () => {
      const original = globalThis.fetch
      const fetch = fetchReturning(jsonResponse({ suggestions: [] }))
      const provider = googlePlaces({ apiKey: KEY })
      globalThis.fetch = fetch
      try {
        await provider.search('1600', ctx())
        expect(fetch).toHaveBeenCalledTimes(1)
      } finally {
        globalThis.fetch = original
      }
    })

    it('exposes the default attribution and lets a consumer replace it', () => {
      expect(googlePlaces({ apiKey: KEY }).attribution).toBeTruthy()
      expect(googlePlaces({ apiKey: KEY, attribution: 'custom' }).attribution).toBe('custom')
    })
  })
})
