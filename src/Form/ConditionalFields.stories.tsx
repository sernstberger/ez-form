import Container from '@mui/material/Container'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { useWatch } from 'react-hook-form'
import { z } from 'zod'
import { Form } from './Form'
import { FormSection } from '../FormSection'
import { SubmitButton } from '../SubmitButton'
import { TextField } from '../fields/TextField'
import { Select } from '../fields/Select'
import { RadioGroup } from '../fields/RadioGroup'
import { Checkbox } from '../fields/Checkbox'
import { Switch } from '../fields/Switch'
import { MoneyField } from '../fields/MoneyField'
import { useEzFormContext } from '../useEzFormContext'
import type { Option } from '../fields/Option'

/**
 * `Form/ConditionalFields` (#82): one page, six titled `FormSection`s, one pattern
 * each, all sharing a single `<Form>`/schema so the story doubles as the README's
 * worked example. Every pattern follows the same shape: `useWatch` reads the
 * controlling field, JSX conditionally renders the dependent one(s), and the schema
 * (`superRefine`, or a discriminated union where it reads better) decides what is
 * actually required — never a hookform `required` rule prop on a conditionally
 * required field, since that would win over zod's message when the field is hidden
 * and re-shown (see `FieldRules`'s doc comment, and `Checkout`'s `BillingSection`).
 *
 * No live region announces a reveal/hide: the section legend already names the
 * group, and moving focus on a reveal the user didn't ask to leave would be
 * disorienting (see the README's "Conditional fields" a11y note). Only pattern 5's
 * cascading reset moves a value (never focus) when the parent changes.
 */

const REFERRAL_OPTIONS: readonly Option[] = [
  { value: 'search', label: 'Search engine' },
  { value: 'friend', label: 'Friend or colleague' },
  { value: 'social', label: 'Social media' },
  { value: 'other', label: 'Other' },
]

const CONTACT_METHOD_OPTIONS: readonly Option[] = [
  { value: 'phone', label: 'Phone' },
  { value: 'email', label: 'Email' },
]

const COUNTRY_OPTIONS: readonly Option[] = [
  { value: 'US', label: 'United States' },
  { value: 'CA', label: 'Canada' },
  { value: 'FR', label: 'France' },
]

const US_STATE_OPTIONS: readonly Option[] = [
  { value: 'CA', label: 'California' },
  { value: 'NY', label: 'New York' },
  { value: 'TX', label: 'Texas' },
]

const CA_PROVINCE_OPTIONS: readonly Option[] = [
  { value: 'ON', label: 'Ontario' },
  { value: 'QC', label: 'Quebec' },
  { value: 'BC', label: 'British Columbia' },
]

const INCOME_THRESHOLD = 3000

// Pattern 1: Checkbox reveals fields (Checkout's BillingSection already covers this
// in a real example, so this section stays minimal — a note pointing there, plus its
// own tiny instance so the story is still a complete reference for the pattern).
const contactSchema = z.object({
  differentContact: z.boolean(),
  contactName: z.string(),
  contactPhone: z.string(),
})

// Pattern 2: Select value reveals a field ("Other" -> specify), required only then.
const referralSchema = z.object({
  referralSource: z.string(),
  referralOther: z.string(),
})

// Pattern 3: Switch toggles a whole section.
const coSignerSchema = z.object({
  addCoSigner: z.boolean(),
  coSignerName: z.string(),
  coSignerEmail: z.string(),
})

// Pattern 4: threshold - income below X reveals a note + a required field.
const incomeSchema = z.object({
  monthlyIncome: z.number(),
  coSignerNote: z.string(),
})

// Pattern 5: cascading selects - country -> region options change, value resets.
const addressSchema = z.object({
  country: z.string(),
  region: z.string(),
})

// Pattern 6: mutually exclusive - "Contact by" radio shows phone OR email,
// expressed as a discriminated union because the two branches share no fields.
const contactByPhone = z.object({
  contactBy: z.literal('phone'),
  phone: z.string().min(1, 'Phone number is required'),
})
const contactByEmail = z.object({
  contactBy: z.literal('email'),
  email: z.email('Enter a valid email address'),
})
// A real nested discriminated union (not a manually-revalidated loose object): zod
// validates whichever branch is active as part of the normal object parse, and
// react-hook-form's `Path<Input>` widens across both branches, so `contactBy.phone`
// and `contactBy.email` both typecheck as field names regardless of which branch the
// live value is currently in.
const contactBySchema = z.discriminatedUnion('contactBy', [contactByPhone, contactByEmail])

const schema = z
  .object({
    contact: contactSchema,
    referral: referralSchema,
    coSigner: coSignerSchema,
    income: incomeSchema,
    address: addressSchema,
    contactBy: contactBySchema,
  })
  .superRefine(
    (data, ctx) => {
      // Pattern 1
      if (data.contact.differentContact) {
        if (!data.contact.contactName) {
          ctx.addIssue({
            code: 'custom',
            message: 'Name is required',
            path: ['contact', 'contactName'],
          })
        }
        if (!data.contact.contactPhone) {
          ctx.addIssue({
            code: 'custom',
            message: 'Phone is required',
            path: ['contact', 'contactPhone'],
          })
        }
      }
      // Pattern 2
      if (data.referral.referralSource === 'other' && !data.referral.referralOther) {
        ctx.addIssue({
          code: 'custom',
          message: 'Please specify',
          path: ['referral', 'referralOther'],
        })
      }
      // Pattern 3
      if (data.coSigner.addCoSigner) {
        if (!data.coSigner.coSignerName) {
          ctx.addIssue({
            code: 'custom',
            message: 'Co-signer name is required',
            path: ['coSigner', 'coSignerName'],
          })
        }
        if (!data.coSigner.coSignerEmail) {
          ctx.addIssue({
            code: 'custom',
            message: 'Co-signer email is required',
            path: ['coSigner', 'coSignerEmail'],
          })
        }
      }
      // Pattern 4
      if (data.income.monthlyIncome < INCOME_THRESHOLD && !data.income.coSignerNote) {
        ctx.addIssue({
          code: 'custom',
          message: 'A co-signer note is required for income below the threshold',
          path: ['income', 'coSignerNote'],
        })
      }
      // Pattern 5: required only when the country has a real region list (US/CA) --
      // a country with no list (the free-text fallback) leaves region optional, so the
      // test proves conditional requirement rather than an unconditional one.
      if (
        (data.address.country === 'US' || data.address.country === 'CA') &&
        !data.address.region
      ) {
        ctx.addIssue({
          code: 'custom',
          message: 'Region is required',
          path: ['address', 'region'],
        })
      }
      // Pattern 6 needs no check here: `contactBy` is a real `z.discriminatedUnion`
      // nested field (see below), so zod validates its own phone/email branch as part
      // of the normal object parse -- no manual re-validation required.
    },
    // Zod skips a `superRefine` once any other issue in the object is "non-continuable"
    // (an enum's/discriminated union's `invalid_value`, among others) --
    // `contactBy.contactBy` is a discriminated union tag, so an invalid value there
    // would otherwise silently swallow every check above. `when: () => true` forces
    // this refinement to always run regardless.
    { when: () => true },
  )

type Input = z.input<typeof schema>

const defaultValues: Input = {
  contact: { differentContact: false, contactName: '', contactPhone: '' },
  referral: { referralSource: '', referralOther: '' },
  coSigner: { addCoSigner: false, coSignerName: '', coSignerEmail: '' },
  income: { monthlyIncome: 5000, coSignerNote: '' },
  address: { country: 'US', region: '' },
  contactBy: { contactBy: 'email', email: '' },
}

const onSubmit = fn()

function CheckboxRevealSection() {
  const differentContact = useWatch<Input, 'contact.differentContact'>({
    name: 'contact.differentContact',
  })
  return (
    <FormSection
      title="1. Checkbox reveals fields"
      description={
        '"I have a different contact" reveals name + phone, required only then. ' +
        'Checkout\'s "Same as shipping address" is the same pattern on a full address.'
      }
    >
      <Stack spacing={2}>
        <Checkbox name="contact.differentContact" label="I have a different contact" />
        {differentContact && (
          <>
            <TextField name="contact.contactName" label="Contact name" />
            <TextField name="contact.contactPhone" label="Contact phone" />
          </>
        )}
      </Stack>
    </FormSection>
  )
}

function SelectRevealSection() {
  const referralSource = useWatch<Input, 'referral.referralSource'>({
    name: 'referral.referralSource',
  })
  return (
    <FormSection
      title="2. Select value reveals a field"
      description={
        '"How did you hear about us?" → choosing "Other" shows "Please specify", required only then.'
      }
    >
      <Stack spacing={2}>
        <Select
          name="referral.referralSource"
          label="How did you hear about us?"
          options={REFERRAL_OPTIONS}
        />
        {referralSource === 'other' && (
          <TextField name="referral.referralOther" label="Please specify" />
        )}
      </Stack>
    </FormSection>
  )
}

function SwitchSection() {
  const addCoSigner = useWatch<Input, 'coSigner.addCoSigner'>({ name: 'coSigner.addCoSigner' })
  return (
    <FormSection
      title="3. Switch toggles a whole section"
      description="Add a co-signer reveals its own fields, required only while the switch is on."
    >
      <Stack spacing={2}>
        <Switch name="coSigner.addCoSigner" label="Add a co-signer" />
        {addCoSigner && (
          <>
            <TextField name="coSigner.coSignerName" label="Co-signer name" />
            <TextField name="coSigner.coSignerEmail" label="Co-signer email" />
          </>
        )}
      </Stack>
    </FormSection>
  )
}

function ThresholdSection() {
  const monthlyIncome = useWatch<Input, 'income.monthlyIncome'>({ name: 'income.monthlyIncome' })
  const belowThreshold = typeof monthlyIncome === 'number' && monthlyIncome < INCOME_THRESHOLD
  return (
    <FormSection
      title="4. Threshold reveals a note + field"
      description={`Income below $${INCOME_THRESHOLD.toLocaleString()}/mo reveals a co-signer note, required only then.`}
    >
      <Stack spacing={2}>
        <MoneyField name="income.monthlyIncome" label="Monthly income" min={0} />
        {belowThreshold && (
          <>
            <Typography variant="body2" color="text.secondary" role="note">
              A co-signer is required for income below the threshold.
            </Typography>
            <TextField name="income.coSignerNote" label="Co-signer note" />
          </>
        )}
      </Stack>
    </FormSection>
  )
}

function CascadingSelectSection() {
  const { resetField } = useEzFormContext('ConditionalFields')
  const country = useWatch<Input, 'address.country'>({ name: 'address.country' })
  const regionOptions =
    country === 'US' ? US_STATE_OPTIONS : country === 'CA' ? CA_PROVINCE_OPTIONS : null

  return (
    <FormSection
      title="5. Cascading selects"
      description="Country changes the region options; the region value resets whenever the country changes."
    >
      <Stack spacing={2}>
        <Select
          name="address.country"
          label="Country"
          options={COUNTRY_OPTIONS}
          onChange={() => resetField('address.region', { defaultValue: '' })}
        />
        {regionOptions ? (
          <Select name="address.region" label="State / province" options={regionOptions} />
        ) : (
          <TextField name="address.region" label="Region" />
        )}
      </Stack>
    </FormSection>
  )
}

function MutuallyExclusiveSection() {
  const contactBy = useWatch<Input, 'contactBy.contactBy'>({ name: 'contactBy.contactBy' })
  return (
    <FormSection
      title="6. Mutually exclusive fields"
      description='"Contact by" shows the phone field OR the email field, never both — modeled as a discriminated union.'
    >
      <Stack spacing={2}>
        <RadioGroup
          name="contactBy.contactBy"
          label="Contact by"
          options={CONTACT_METHOD_OPTIONS}
        />
        {contactBy === 'phone' ? (
          <TextField name="contactBy.phone" label="Phone" />
        ) : (
          <TextField name="contactBy.email" label="Email" />
        )}
      </Stack>
    </FormSection>
  )
}

const meta = {
  title: 'Form/ConditionalFields',
  parameters: { layout: 'fullscreen' },
  render: () => (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Paper variant="outlined" sx={{ p: 4 }}>
        <Form
          schema={schema}
          defaultValues={defaultValues}
          title="Conditional fields"
          description="Six patterns for showing, hiding, and requiring fields based on other values."
          onSubmit={onSubmit}
        >
          <Stack spacing={3}>
            <CheckboxRevealSection />
            <SelectRevealSection />
            <SwitchSection />
            <ThresholdSection />
            <CascadingSelectSection />
            <MutuallyExclusiveSection />
            <SubmitButton>Submit</SubmitButton>
          </Stack>
        </Form>
      </Paper>
    </Container>
  ),
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
