import type { Meta, StoryObj } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { Checkout } from './Checkout'
import { DECLINED_CARD_NUMBER } from '../fakeApi'

const meta = {
  title: 'Examples/Checkout',
  component: Checkout,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Checkout>

export default meta
type Story = StoryObj<typeof meta>

type PlayContext = Parameters<NonNullable<Story['play']>>[0]

async function fillShipping({ canvas, userEvent }: PlayContext) {
  await userEvent.type(canvas.getByLabelText(/full name/i), 'Ada Lovelace')
  await userEvent.type(canvas.getByLabelText(/street address/i), '1 Analytical Way')
  await userEvent.type(canvas.getByLabelText(/^city/i), 'London')
  await userEvent.click(canvas.getByRole('combobox', { name: /country/i }))
  // The Select's option list, like the confirm dialog, portals to `document.body`.
  await userEvent.click(await screen.findByRole('option', { name: 'United Kingdom' }))
  await userEvent.type(canvas.getByLabelText(/state \/ region/i), 'Greater London')
  await userEvent.type(canvas.getByLabelText(/postal code/i), 'SW1A 1AA')
}

async function fillPayment({ canvas, userEvent }: PlayContext, cardNumber = '4111111111111111') {
  await userEvent.type(canvas.getByLabelText(/card number/i), cardNumber)
  await userEvent.type(canvas.getByLabelText(/expiry/i), '04/29')
  await userEvent.type(canvas.getByLabelText(/^cvc/i), '123')
}

/** The confirm dialog portals to `document.body`, outside the story root, so it is queried through the global `screen`/`within` rather than `canvas`. */
async function confirmOrder({ canvas, userEvent }: PlayContext) {
  await userEvent.click(canvas.getByRole('button', { name: /place order/i }))
  const dialog = await screen.findByRole('alertdialog', { name: /place order\?/i })
  await userEvent.click(within(dialog).getByRole('button', { name: /^confirm$/i }))
}

export const Default: Story = {}

export const BillingAddressRevealed: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Unchecking "Same as shipping address" reveals a separate billing FormSection, required only in this state.',
      },
    },
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('checkbox', { name: /same as shipping/i }))
  },
}

export const CascadingRegionOptions: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Country picks the region field's shape (#82): United States renders `StateSelect` (all 50 + DC), Canada lists provinces from this example's own array, and any other country falls back to a free-text field. Changing the country resets the region value.",
      },
    },
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('combobox', { name: /^country/i }))
    await userEvent.click(await screen.findByRole('option', { name: 'United States' }))
    await userEvent.click(canvas.getByRole('combobox', { name: /state \/ region/i }))
    await userEvent.click(await screen.findByRole('option', { name: 'California' }))

    await userEvent.click(canvas.getByRole('combobox', { name: /^country/i }))
    await userEvent.click(await screen.findByRole('option', { name: 'Canada' }))
    await userEvent.click(canvas.getByRole('combobox', { name: /state \/ region/i }))
    await userEvent.click(await screen.findByRole('option', { name: 'Ontario' }))
  },
}

export const DeclinedCard: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Confirms and submits with a known-declined card number: placeOrderApi rejects, and the form-level error appears through FormError.',
      },
    },
  },
  play: async (ctx) => {
    await fillShipping(ctx)
    await fillPayment(ctx, DECLINED_CARD_NUMBER)
    await confirmOrder(ctx)
    await ctx.canvas.findByRole('alert')
  },
}

export const OrderPlaced: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Confirms and submits with a valid card: the fake API resolves after a short delay.',
      },
    },
  },
  play: async (ctx) => {
    await fillShipping(ctx)
    await fillPayment(ctx)
    await confirmOrder(ctx)
  },
}
