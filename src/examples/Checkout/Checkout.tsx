import Container from '@mui/material/Container'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { z } from 'zod'
import { useWatch } from 'react-hook-form'
import { Form } from '../../Form'
import { FormError } from '../../FormError'
import { FormSection } from '../../FormSection'
import { SubmitButton } from '../../SubmitButton'
import { TextField } from '../../fields/TextField'
import { Select } from '../../fields/Select'
import { Checkbox } from '../../fields/Checkbox'
import { PasswordField } from '../../fields/PasswordField'
import { MoneyField } from '../../fields/MoneyField'
import { ReadOnlyField } from '../../fields/ReadOnlyField'
import type { Option } from '../../fields/Option'
import { placeOrderApi } from '../fakeApi'

const COUNTRY_OPTIONS: readonly Option[] = [
  { value: 'US', label: 'United States' },
  { value: 'CA', label: 'Canada' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'AU', label: 'Australia' },
]

// A fixed cart for the example: the summary's subtotal is constant, only the tip varies.
const SUBTOTAL = 84.97

const addressSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  street: z.string().min(1, 'Street address is required'),
  city: z.string().min(1, 'City is required'),
  country: z.enum(
    COUNTRY_OPTIONS.map((o) => o.value as string) as [string, ...string[]],
    'Choose a country',
  ),
  state: z.string().min(1, 'State / region is required'),
  postalCode: z.string().min(1, 'Postal code is required'),
})

// Billing mirrors shipping's shape but every field is optional at the zod level;
// `superRefine` below requires each one only when "same as shipping" is unchecked.
const optionalAddressSchema = z.object({
  name: z.string(),
  street: z.string(),
  city: z.string(),
  country: z.string(),
  state: z.string(),
  postalCode: z.string(),
})

const schema = z
  .object({
    shipping: addressSchema,
    sameAsShipping: z.boolean(),
    billing: optionalAddressSchema,
    // Format checks (16 digits, MM/YY, 3-4 digits) live on each field's `pattern` rule
    // prop below instead of here: a rule error always wins over zod's for that field
    // (see `FieldRules`'s doc comment), so a zod-level regex here would be dead code.
    cardNumber: z.string().min(1, 'Card number is required'),
    expiry: z.string().min(1, 'Expiry is required'),
    cvc: z.string().min(1, 'CVC is required'),
    tip: z.number().min(0, 'Tip cannot be negative'),
  })
  .superRefine((data, ctx) => {
    if (data.sameAsShipping) return
    const required: (keyof z.infer<typeof optionalAddressSchema>)[] = [
      'name',
      'street',
      'city',
      'country',
      'state',
      'postalCode',
    ]
    for (const key of required) {
      if (!data.billing[key]) {
        ctx.addIssue({
          code: 'custom',
          message: `Billing ${key === 'postalCode' ? 'postal code' : key} is required`,
          path: ['billing', key] as const,
        })
      }
    }
  })

type Input = z.input<typeof schema>

const emptyAddress = { name: '', street: '', city: '', country: '', state: '', postalCode: '' }

const defaultValues: Input = {
  shipping: { ...emptyAddress },
  sameAsShipping: true,
  billing: { ...emptyAddress },
  cardNumber: '',
  expiry: '',
  cvc: '',
  tip: 0,
}

export type BillingAddress = z.infer<typeof optionalAddressSchema>

export interface CheckoutProps {
  /**
   * Called with the fake API's result and the billing address actually sent
   * (shipping, copied over, when "same as shipping" is checked) once the
   * order is placed.
   */
  onSuccess?: (result: { orderId: string }, billing: BillingAddress) => void
}

function OrderSummary() {
  const tip = useWatch<Input, 'tip'>({ name: 'tip' }) ?? 0
  const total = SUBTOTAL + (Number.isFinite(tip) ? tip : 0)
  const format = (value: unknown): string =>
    typeof value === 'number'
      ? value.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
      : String(value)
  // Spread (rather than a literal `component="p"` prop) so TS resolves Typography's
  // polymorphic-component overload the same way Form/FormSection's own slot defaults do.
  const totalProps = { variant: 'subtitle1', component: 'p', fontWeight: 'bold' } as const

  return (
    <FormSection title="Order summary">
      <Stack spacing={1}>
        <Typography variant="body2" color="text.secondary">
          Subtotal: {format(SUBTOTAL)}
        </Typography>
        <ReadOnlyField name="tip" label="Tip amount" format={format} />
        <Typography {...totalProps}>Total: {format(total)}</Typography>
      </Stack>
    </FormSection>
  )
}

/**
 * Fourth rung of the example ladder (#55): shipping + billing addresses (a
 * "same as shipping" toggle that hides and mirrors billing), a payment
 * section, and a confirm dialog before the fake API is called. Documentation
 * only — not exported from the package (see `tsconfig.build.json`'s
 * `src/examples` exclusion).
 */
export function Checkout({ onSuccess }: CheckoutProps) {
  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Paper variant="outlined" sx={{ p: 4 }}>
        <Form
          schema={schema}
          defaultValues={defaultValues}
          title="Checkout"
          description="Review your shipping, billing, and payment details before placing the order."
          confirm={{ title: 'Place order?', message: 'This charges your card immediately.' }}
          onSubmit={async (values, form) => {
            const billing: BillingAddress = values.sameAsShipping ? values.shipping : values.billing
            try {
              const result = await placeOrderApi({
                cardNumber: values.cardNumber,
                total: SUBTOTAL + values.tip,
              })
              form.clearErrors('root.server')
              onSuccess?.(result, billing)
            } catch (error) {
              form.setError('root.server', {
                message: error instanceof Error ? error.message : 'Payment failed',
              })
            }
          }}
        >
          <Stack spacing={3}>
            <FormError />
            <FormSection title="Shipping address">
              <Stack spacing={2}>
                <TextField
                  name="shipping.name"
                  label="Full name"
                  autoComplete="shipping name"
                  required
                />
                <TextField
                  name="shipping.street"
                  label="Street address"
                  autoComplete="shipping street-address"
                  required
                />
                <TextField
                  name="shipping.city"
                  label="City"
                  autoComplete="shipping address-level2"
                  required
                />
                <Select
                  name="shipping.country"
                  label="Country"
                  options={COUNTRY_OPTIONS}
                  autoComplete="shipping country"
                  required
                />
                <TextField
                  name="shipping.state"
                  label="State / region"
                  autoComplete="shipping address-level1"
                  required
                />
                <TextField
                  name="shipping.postalCode"
                  label="Postal code"
                  autoComplete="shipping postal-code"
                  pattern={{ value: /^[A-Za-z0-9 -]{3,10}$/, message: 'Enter a valid postal code' }}
                  required
                />
              </Stack>
            </FormSection>

            <BillingSection />

            <FormSection title="Payment">
              <Stack spacing={2}>
                <TextField
                  name="cardNumber"
                  label="Card number"
                  autoComplete="cc-number"
                  inputMode="numeric"
                  pattern={{ value: /^\d{16}$/, message: 'Enter a 16-digit card number' }}
                  required
                />
                <TextField
                  name="expiry"
                  label="Expiry (MM/YY)"
                  autoComplete="cc-exp"
                  pattern={{ value: /^(0[1-9]|1[0-2])\/\d{2}$/, message: 'Use MM/YY' }}
                  required
                />
                <PasswordField
                  name="cvc"
                  label="CVC"
                  autoComplete="cc-csc"
                  revealable={false}
                  pattern={{ value: /^\d{3,4}$/, message: 'Enter a 3- or 4-digit CVC' }}
                  required
                />
                <MoneyField name="tip" label="Tip" />
              </Stack>
            </FormSection>

            <OrderSummary />

            <SubmitButton>Place order</SubmitButton>
          </Stack>
        </Form>
      </Paper>
    </Container>
  )
}

function BillingSection() {
  const sameAsShipping = useWatch<Input, 'sameAsShipping'>({ name: 'sameAsShipping' })

  return (
    <FormSection title="Billing address">
      <Stack spacing={2}>
        <Checkbox name="sameAsShipping" label="Same as shipping address" />
        {!sameAsShipping && (
          <>
            {/*
              No `required` rule prop here: "required" is conditional (only when
              unchecked), so it's expressed once in the schema's `superRefine` below
              rather than as a hookform rule, which would otherwise win over zod's
              message for the same field (see `FieldRules`'s doc comment).
            */}
            <TextField name="billing.name" label="Full name" autoComplete="billing name" />
            <TextField
              name="billing.street"
              label="Street address"
              autoComplete="billing street-address"
            />
            <TextField name="billing.city" label="City" autoComplete="billing address-level2" />
            <Select
              name="billing.country"
              label="Country"
              options={COUNTRY_OPTIONS}
              autoComplete="billing country"
            />
            <TextField
              name="billing.state"
              label="State / region"
              autoComplete="billing address-level1"
            />
            <TextField
              name="billing.postalCode"
              label="Postal code"
              autoComplete="billing postal-code"
            />
          </>
        )}
      </Stack>
    </FormSection>
  )
}
