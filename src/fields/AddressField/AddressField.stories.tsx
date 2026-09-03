import type { Meta, StoryObj } from '@storybook/react-vite'
import { z } from 'zod'
import Alert from '@mui/material/Alert'
import Stack from '@mui/material/Stack'
import type { FormParameters } from '../../../.storybook/preview'
import { AddressField } from './AddressField'
import { addressSchema } from './addressSchema'
import { mockAddressLookup } from '../../test/mockAddressLookup'
import { googlePlaces } from '../../address-lookup/googlePlaces'

const schema = z.object({ address: addressSchema() })
const empty = { address: { street: '', street2: '', city: '', state: '', zip: '' } }

const meta = {
  title: 'Fields/AddressField',
  component: AddressField,
  args: { name: 'address' },
  parameters: { form: { schema, defaultValues: empty } } satisfies FormParameters,
} satisfies Meta<typeof AddressField>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Required: Story = {
  args: { required: true },
  parameters: {
    docs: {
      description: {
        story: '`required` reaches street, city, state and ZIP — never the optional second line.',
      },
    },
  },
}

export const ShippingSection: Story = {
  args: {
    legend: 'Shipping address',
    description: 'Where the order ships.',
    autoCompleteSection: 'shipping',
    required: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          '`legend` wraps the group in a `FormSection` fieldset; `autoCompleteSection` prefixes every autofill token (`shipping street-address`, …) so a browser can fill a shipping and a billing address on the same page separately.',
      },
    },
  },
}

export const WithoutStreet2: Story = {
  args: { street2: false },
  parameters: {
    form: {
      schema: z.object({ address: addressSchema({ street2: false }) }),
      defaultValues: { address: { street: '', city: '', state: '', zip: '' } },
    },
    docs: {
      description: { story: 'Pair `street2={false}` with `addressSchema({ street2: false })`.' },
    },
  },
}

export const WithErrors: Story = {
  args: { legend: 'Shipping address', required: true },
  parameters: {
    docs: {
      description: {
        story: 'Each part shows its own error; the ZIP part also carries its 5-digit rule.',
      },
    },
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText(/ZIP code/), '902')
    await userEvent.click(canvas.getByRole('button', { name: 'Submit' }))
    await canvas.findByText('Street address is required.')
    await canvas.findByText('Enter a 5-digit ZIP code')
  },
}

/**
 * Google's own attribution asset, the one the Maps JS API serves for a results list shown
 * without a map — `on-white` for a light background, `on-non-white` for a dark one, each with
 * its `_hdpi` twin for retina. The 18 px height sits inside Google's 16–19 dp guideline.
 * Stories may style; `src/` may not, which is why the library's own default attribution is the
 * plain text "Powered by Google" and this asset lives here rather than in the adapter.
 */
const GOOGLE_LOGO = 'https://maps.gstatic.com/mapfiles/api-3/images/powered-by-google'

function PoweredByGoogle() {
  return (
    <picture>
      <source
        media="(prefers-color-scheme: dark)"
        srcSet={`${GOOGLE_LOGO}-on-non-white3.png 1x, ${GOOGLE_LOGO}-on-non-white3_hdpi.png 2x`}
      />
      <img
        src={`${GOOGLE_LOGO}-on-white3.png`}
        srcSet={`${GOOGLE_LOGO}-on-white3.png 1x, ${GOOGLE_LOGO}-on-white3_hdpi.png 2x`}
        alt="Powered by Google"
        height={18}
        style={{ display: 'block', margin: '4px 8px' }}
      />
    </picture>
  )
}

/**
 * The key is read once, at module scope, and only ever handed to `googlePlaces` — never
 * rendered, logged or put in a story arg (args are serialized into the docs page and the URL).
 * `import.meta.env` is typed by `src/vite-env.d.ts`; Storybook's Vite loads `.env.local` from
 * the repo root and exposes the `VITE_`-prefixed keys.
 */
const googleApiKey = import.meta.env.VITE_GOOGLE_PLACES_API_KEY

/** Built once so the field's session token, not a new provider, is what changes per entry. */
const googleLookup = googleApiKey
  ? googlePlaces({ apiKey: googleApiKey, attribution: <PoweredByGoogle /> })
  : undefined

/**
 * The real thing: `googlePlaces` against Google's Places API (New), live over the network. It
 * needs a key, so it degrades to the mock provider — with a note — when there isn't one, which
 * is how it runs in CI and in the published Storybook.
 */
export const WithGooglePlaces: Story = {
  args: {
    legend: 'Shipping address',
    required: true,
    lookup: googleLookup ?? mockAddressLookup({ delayMs: 400 }),
  },
  decorators: [
    (Story) => (
      <Stack spacing={2}>
        {!googleLookup && (
          <Alert severity="info">
            Set VITE_GOOGLE_PLACES_API_KEY in .env.local to use live suggestions. Showing the mock
            provider instead.
          </Alert>
        )}
        <Story />
      </Stack>
    ),
  ],
  parameters: {
    docs: {
      description: {
        story:
          'Live Google Places autocomplete. Copy `.env.example` to `.env.local` at the repo root, put a browser key restricted to the Places API (New) in `VITE_GOOGLE_PLACES_API_KEY`, and restart Storybook; the story passes it to `googlePlaces({ apiKey })` and nothing else ever sees it. The attribution under the list is Google\'s own "powered by Google" asset, which the library cannot ship — supply it per provider or via `theme.components.EzGooglePlacesAttribution.defaultProps.children`. Without a key the story falls back to the deterministic mock.',
      },
    },
  },
}

export const WithLookup: Story = {
  args: {
    legend: 'Shipping address',
    required: true,
    // A little latency, so the loading state is visible; tests use 0.
    lookup: mockAddressLookup({ delayMs: 400, attribution: 'Powered by Mock Places' }),
  },
  parameters: {
    docs: {
      description: {
        story:
          "`lookup` turns the street into an address search. Type `160`, `350` or `Infinite`: rows come from the provider's `search`, picking one runs `resolve` and fills every part, and text typed without a pick stays as the street. The `googlePlaces` provider is the real one; this story uses a deterministic mock.",
      },
    },
  },
}
