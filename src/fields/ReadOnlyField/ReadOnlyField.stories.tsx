import Stack from '@mui/material/Stack'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useWatch } from 'react-hook-form'
import { z } from 'zod'
import type { FormParameters } from '../../../.storybook/preview'
import { TextField } from '../TextField'
import { MoneyField } from '../MoneyField'
import { ReadOnlyField } from './ReadOnlyField'

const schema = z.object({
  name: z.string(),
  role: z.string(),
  tags: z.array(z.string()),
  tos: z.boolean(),
  cardNumber: z.string(),
})

const money = (value: unknown): string =>
  typeof value === 'number'
    ? value.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
    : String(value)

const roles = [
  { value: 'admin', label: 'Administrator' },
  { value: 'user', label: 'User' },
]

const meta = {
  title: 'Fields/ReadOnlyField',
  component: ReadOnlyField,
  args: { name: 'name', label: 'Name' },
  parameters: {
    form: {
      schema,
      defaultValues: {
        name: 'Ada Lovelace',
        role: 'admin',
        tags: ['math', 'engines'],
        tos: true,
        cardNumber: '',
      },
    },
  } satisfies FormParameters,
} satisfies Meta<typeof ReadOnlyField>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Summary: Story = {
  render: () => (
    <Stack spacing={2}>
      <TextField name="name" label="Edit name (live)" />
      <ReadOnlyField name="name" />
      <ReadOnlyField name="role" options={roles} />
      <ReadOnlyField name="tags" />
      <ReadOnlyField name="tos" label="Accepted terms" />
      <ReadOnlyField name="cardNumber" />
      <ReadOnlyField
        name="tags"
        label="Tag count"
        format={(v) => `${(v as string[]).length} tags`}
      />
    </Stack>
  ),
}

const cartSchema = z.object({ price: z.number(), tip: z.number() })

function ComputedTotal() {
  const price = useWatch<{ price: number; tip: number }, 'price'>({ name: 'price' }) ?? 0
  const tip = useWatch<{ price: number; tip: number }, 'tip'>({ name: 'tip' }) ?? 0
  const total = (Number.isFinite(price) ? price : 0) + (Number.isFinite(tip) ? tip : 0)
  return <ReadOnlyField value={total} label="Total" format={money} />
}

/**
 * `value` mode (#68): a total derived from two watched `MoneyField`s, fed to
 * `ReadOnlyField` as a plain `value` rather than a form path. The field never
 * calls `useWatch` itself here — the caller derives the number with its own
 * `useWatch` (see `Checkout`'s `OrderSummary`) and hands it over already computed.
 */
export const Computed: Story = {
  args: { name: 'name', label: 'Name' },
  parameters: {
    form: { schema: cartSchema, defaultValues: { price: 19.99, tip: 0 } },
  } satisfies FormParameters,
  render: () => (
    <Stack spacing={2}>
      <MoneyField name="price" label="Price" />
      <MoneyField name="tip" label="Tip" />
      <ComputedTotal />
    </Stack>
  ),
}
