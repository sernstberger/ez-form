import { Fragment } from 'react'
import Container from '@mui/material/Container'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { z } from 'zod'
import { useWatch } from 'react-hook-form'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { Form } from '../../Form'
import { FormError } from '../../FormError'
import { FormErrorSummary } from '../../Form/FormErrorSummary'
import { FormSection } from '../../FormSection'
import { SubmitButton } from '../../SubmitButton'
import { TextField } from '../../fields/TextField'
import { Select } from '../../fields/Select'
import { MoneyField } from '../../fields/MoneyField'
import { Slider } from '../../fields/Slider'
import { DateField } from '../../fields/DateField'
import { FileField } from '../../fields/FileField'
import { ReadOnlyField } from '../../fields/ReadOnlyField'
import { FieldArray, type FieldArrayRow } from '../../FieldArray'
import { Wizard, type WizardStepDef } from '../../Wizard'
import { WizardStepper } from '../../Wizard/WizardStepper'
import { WizardStep } from '../../Wizard/WizardStep'
import { WizardNav } from '../../Wizard/WizardNav'
import type { Option } from '../../fields/Option'
import { submitLoanApi } from '../fakeApi'

const PURPOSE_OPTIONS: readonly Option[] = [
  { value: 'home', label: 'Home purchase' },
  { value: 'refinance', label: 'Refinance' },
  { value: 'auto', label: 'Auto' },
  { value: 'business', label: 'Business' },
  { value: 'other', label: 'Other' },
]

const RELATIONSHIP_OPTIONS: readonly Option[] = [
  { value: 'spouse', label: 'Spouse' },
  { value: 'partner', label: 'Partner' },
  { value: 'parent', label: 'Parent' },
  { value: 'sibling', label: 'Sibling' },
  { value: 'other', label: 'Other' },
]

const EMPLOYMENT_TYPE_OPTIONS: readonly Option[] = [
  { value: 'full-time', label: 'Full-time' },
  { value: 'part-time', label: 'Part-time' },
  { value: 'self-employed', label: 'Self-employed' },
  { value: 'other', label: 'Other' },
]

const MIN_TERM_MONTHS = 12
const MAX_TERM_MONTHS = 360
// Pattern 4 (#82): applicant income below this reveals a required co-signer note.
const LOW_INCOME_THRESHOLD = 3000

const coApplicantSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  relationship: z.enum(
    RELATIONSHIP_OPTIONS.map((o) => o.value as string) as [string, ...string[]],
    'Choose a relationship',
  ),
  monthlyIncome: z.number().min(0, 'Monthly income cannot be negative'),
  documents: z.array(z.instanceof(File)),
})

const employmentSchema = z.object({
  employer: z.string().min(1, 'Employer is required'),
  status: z.enum(
    EMPLOYMENT_TYPE_OPTIONS.map((o) => o.value as string) as [string, ...string[]],
    'Choose an employment type',
  ),
  // "Other" reveals a free-text field on this row (pattern 2, #82); optional at the
  // zod level, required only when `status === 'other'` via the top-level schema's
  // `superRefine` below (a per-row array index is needed for the issue `path`, which
  // a nested object schema's own `superRefine` doesn't have access to).
  statusOther: z.string(),
  // Nullable at the zod level (a date field starts empty and can't be typed as
  // non-null); `required` on the <DateField> itself (a hookform rule prop, which
  // wins over zod's message for that field per FieldRules's contract) is what
  // actually enforces "must be filled in" — see DateField.test.tsx's own
  // `required` cases for the same pattern.
  from: z.date().nullable(),
  to: z.date().nullable(),
  monthlyIncome: z.number().min(0, 'Monthly income cannot be negative'),
})

const debtSchema = z.object({
  creditor: z.string().min(1, 'Creditor is required'),
  balance: z.number().min(0, 'Balance cannot be negative'),
  monthlyPayment: z.number().min(0, 'Monthly payment cannot be negative'),
})

const schema = z
  .object({
    amount: z.number().min(1000, 'Enter an amount of at least $1,000'),
    purpose: z.enum(
      PURPOSE_OPTIONS.map((o) => o.value as string) as [string, ...string[]],
      'Choose a purpose',
    ),
    termMonths: z.number().min(MIN_TERM_MONTHS).max(MAX_TERM_MONTHS),
    applicantName: z.string().min(1, 'Name is required'),
    applicantEmail: z.email('Invalid email address'),
    // See employmentSchema's `from` comment: `required` on <DateField> enforces this.
    applicantBirthday: z.date().nullable(),
    applicantIncome: z.number().min(0, 'Monthly income cannot be negative'),
    // Pattern 4 (#82): required only when `applicantIncome` is below the threshold,
    // enforced below rather than with a rule prop on the field (see the README's
    // Validation rules section on rule-prop-vs-zod precedence).
    coSignerNote: z.string(),
    applicantDocuments: z.array(z.instanceof(File)),
    coApplicants: z.array(coApplicantSchema).max(3, 'Add at most 3 co-applicants'),
    employment: z.array(employmentSchema).min(1, 'Add at least one employer'),
    debts: z.array(debtSchema),
  })
  .superRefine(
    (data, ctx) => {
      if (data.applicantIncome < LOW_INCOME_THRESHOLD && !data.coSignerNote) {
        ctx.addIssue({
          code: 'custom',
          message: 'A co-signer note is required for income below the threshold',
          path: ['coSignerNote'],
        })
      }
      data.employment.forEach((row, index) => {
        if (row.status === 'other' && !row.statusOther) {
          ctx.addIssue({
            code: 'custom',
            message: 'Please specify',
            path: ['employment', index, 'statusOther'],
          })
        }
      })
    },
    // Zod skips a `superRefine` once any other issue in the object is "non-continuable"
    // (an enum's `invalid_value`, among others) — an empty `purpose`/`status` elsewhere
    // in this form would otherwise silently swallow the two checks above. `when: () =>
    // true` forces this refinement to run regardless of what else in the object failed.
    { when: () => true },
  )

type Input = z.input<typeof schema>
type Output = z.infer<typeof schema>

const emptyCoApplicant = () => ({ name: '', relationship: '', monthlyIncome: 0, documents: [] })
const emptyEmployment = () => ({
  employer: '',
  status: '',
  statusOther: '',
  from: null,
  to: null,
  monthlyIncome: 0,
})
const emptyDebt = () => ({ creditor: '', balance: 0, monthlyPayment: 0 })

const defaultValues: Input = {
  amount: 25000,
  purpose: '',
  termMonths: 60,
  applicantName: '',
  applicantEmail: '',
  applicantBirthday: null,
  applicantIncome: 0,
  coSignerNote: '',
  applicantDocuments: [],
  coApplicants: [],
  employment: [emptyEmployment()],
  debts: [],
}

const steps = [
  { id: 'loan', label: 'Loan', fields: ['amount', 'purpose', 'termMonths'] },
  {
    id: 'applicant',
    label: 'Applicant',
    fields: [
      'applicantName',
      'applicantEmail',
      'applicantBirthday',
      'applicantIncome',
      'coSignerNote',
    ],
  },
  { id: 'coApplicants', label: 'Co-applicants', fields: ['coApplicants'] },
  { id: 'employment', label: 'Employment', fields: ['employment'] },
  { id: 'debts', label: 'Debts', fields: ['debts'] },
  { id: 'documents', label: 'Documents', fields: ['applicantDocuments'] },
  { id: 'review', label: 'Review' },
] as const satisfies WizardStepDef<Input>[]

const money = (value: unknown): string =>
  typeof value === 'number'
    ? value.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
    : String(value)

const months = (value: unknown): string =>
  typeof value === 'number' ? `${value} months` : String(value)

/** Sums a numeric field across every row of an array, ignoring rows where it isn't a finite number. */
function sumField<T extends Record<string, unknown>>(rows: readonly T[], key: keyof T): number {
  return rows.reduce((total, row) => {
    const value = row[key]
    return total + (typeof value === 'number' && Number.isFinite(value) ? value : 0)
  }, 0)
}

/**
 * Derived totals for the Review step: total monthly income (applicant +
 * co-applicants + every employment row), total monthly debt payment, and the
 * DTI ratio. Rendered with plain `Typography` rather than `ReadOnlyField`
 * because these are computed values, not a form path — `ReadOnlyField` only
 * supports `useWatch({ name })` today. See #68 (ReadOnlyField computed mode),
 * filed while building this example; once it lands this block becomes a
 * `format`-less `ReadOnlyField` fed by `compute`.
 */
function Totals() {
  const applicantIncome = useWatch<Input, 'applicantIncome'>({ name: 'applicantIncome' }) ?? 0
  const coApplicants = useWatch<Input, 'coApplicants'>({ name: 'coApplicants' }) ?? []
  const employment = useWatch<Input, 'employment'>({ name: 'employment' }) ?? []
  const debts = useWatch<Input, 'debts'>({ name: 'debts' }) ?? []

  const totalMonthlyIncome =
    (typeof applicantIncome === 'number' ? applicantIncome : 0) +
    sumField(coApplicants as Record<string, unknown>[], 'monthlyIncome') +
    sumField(employment as Record<string, unknown>[], 'monthlyIncome')
  const totalMonthlyDebt = sumField(debts as Record<string, unknown>[], 'monthlyPayment')
  const dti = totalMonthlyIncome > 0 ? totalMonthlyDebt / totalMonthlyIncome : 1
  // Spread (rather than a literal `component="p"` prop) so TS resolves Typography's
  // polymorphic-component overload the same way Checkout's OrderSummary does.
  const dtiProps = { variant: 'subtitle1', component: 'p', fontWeight: 'bold' } as const

  return (
    <FormSection title="Totals">
      <Stack spacing={1}>
        <Typography variant="body2">Total monthly income: {money(totalMonthlyIncome)}</Typography>
        <Typography variant="body2">
          Total monthly debt payment: {money(totalMonthlyDebt)}
        </Typography>
        <Typography {...dtiProps}>Debt-to-income ratio: {(dti * 100).toFixed(1)}%</Typography>
      </Stack>
    </FormSection>
  )
}

/**
 * Pattern 2 (#82) inside a `FieldArray` row: the row's own employment-type `Select`
 * controls whether this row's "Please specify" field shows, so the watch is on the
 * row's own path (`employment.<index>.status`) rather than the whole array.
 */
function EmploymentOtherField({ row }: { row: FieldArrayRow }) {
  const status = useWatch({ name: row.name('status') }) as string | undefined
  if (status !== 'other') return null
  return <TextField name={row.name('statusOther')} label="Please specify" />
}

/** Pattern 4 (#82): income below the threshold reveals a note + a required field. */
function LowIncomeCoSignerNote() {
  const applicantIncome = useWatch<Input, 'applicantIncome'>({ name: 'applicantIncome' })
  if (typeof applicantIncome !== 'number' || applicantIncome >= LOW_INCOME_THRESHOLD) return null
  return (
    <>
      <Typography variant="body2" color="text.secondary" role="note">
        A co-signer is required for income below the threshold.
      </Typography>
      <TextField name="coSignerNote" label="Co-signer note" />
    </>
  )
}

export interface LoanProps {
  /** Called with the fake API's result once the application is submitted. */
  onSuccess?: (result: { applicationId: string }) => void
}

/**
 * Sixth and hardest rung of the example ladder (#57): a horizontal wizard
 * over field arrays for co-applicants, employment history, and debts, a
 * per-applicant document upload step, and a review step with computed
 * debt-to-income totals. Documentation only — not exported from the package
 * (see `tsconfig.build.json`'s `src/examples` exclusion).
 */
export function Loan({ onSuccess }: LoanProps) {
  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Container maxWidth="md" sx={{ py: 6 }}>
        <Paper variant="outlined" sx={{ p: 4 }}>
          <Form<Input, Output>
            schema={schema}
            defaultValues={defaultValues}
            title="Loan application"
            description="Fields marked with * are required. You can go back to any earlier step at any time."
            confirm={{
              title: 'Submit application?',
              message: 'This submits your application for review.',
            }}
            onSubmit={async (values, form) => {
              const totalMonthlyIncome =
                values.applicantIncome +
                sumField(values.coApplicants, 'monthlyIncome') +
                sumField(values.employment, 'monthlyIncome')
              const totalMonthlyDebt = sumField(values.debts, 'monthlyPayment')
              try {
                const result = await submitLoanApi({ totalMonthlyIncome, totalMonthlyDebt })
                form.clearErrors('root.server')
                onSuccess?.(result)
              } catch (error) {
                form.setError('root.server', {
                  message: error instanceof Error ? error.message : 'Application failed',
                })
              }
            }}
          >
            <Stack spacing={2}>
              <FormError />
              <Wizard steps={steps}>
                {/*
                  Inside <Wizard>, not above it: FormErrorSummary scopes itself to the
                  wizard's current step via context (`useOptionalWizard().lastFailed`),
                  which only exists for a descendant of <Wizard> — a summary outside it
                  would see no wizard at all and fall back to showing every error in the
                  form. One instance here (rather than one per WizardStep, as the plain
                  multi-summary pattern in FormErrorSummary.stories.tsx does) still scopes
                  correctly: it re-renders with the new step's `lastFailed` on every Next.
                */}
                <FormErrorSummary />
                <WizardStepper />

                <WizardStep id="loan">
                  <Stack spacing={2}>
                    <MoneyField name="amount" label="Loan amount" min={1000} required />
                    <Select name="purpose" label="Purpose" options={PURPOSE_OPTIONS} required />
                    <Slider
                      name="termMonths"
                      label="Term (months)"
                      min={MIN_TERM_MONTHS}
                      max={MAX_TERM_MONTHS}
                      step={12}
                      valueLabelDisplay="on"
                    />
                  </Stack>
                </WizardStep>

                <WizardStep id="applicant">
                  <Stack spacing={2}>
                    <TextField
                      name="applicantName"
                      label="Full name"
                      autoComplete="name"
                      required
                    />
                    <TextField name="applicantEmail" label="Email" autoComplete="email" required />
                    <DateField
                      name="applicantBirthday"
                      label="Birthday"
                      disableFuture
                      minDate={new Date(1900, 0, 1)}
                      required
                    />
                    <MoneyField name="applicantIncome" label="Monthly income" min={0} required />
                    <LowIncomeCoSignerNote />
                  </Stack>
                </WizardStep>

                <WizardStep id="coApplicants" title={null}>
                  <FieldArray
                    name="coApplicants"
                    label="Co-applicants"
                    emptyRow={emptyCoApplicant}
                    minRows={0}
                    maxRows={3}
                  >
                    {(row) => (
                      <Stack spacing={2}>
                        <TextField name={row.name('name')} label="Name" required />
                        <Select
                          name={row.name('relationship')}
                          label="Relationship"
                          options={RELATIONSHIP_OPTIONS}
                          required
                        />
                        <MoneyField
                          name={row.name('monthlyIncome')}
                          label="Monthly income"
                          min={0}
                          required
                        />
                      </Stack>
                    )}
                  </FieldArray>
                </WizardStep>

                <WizardStep id="employment" title={null}>
                  <FieldArray
                    name="employment"
                    label="Employment history"
                    singular="Employer"
                    emptyRow={emptyEmployment}
                    minRows={1}
                    reorder
                  >
                    {(row) => (
                      <Stack spacing={2}>
                        <TextField name={row.name('employer')} label="Employer" required />
                        <Select
                          name={row.name('status')}
                          label="Employment type"
                          options={EMPLOYMENT_TYPE_OPTIONS}
                          required
                        />
                        <EmploymentOtherField row={row} />
                        <DateField name={row.name('from')} label="From" disableFuture required />
                        <DateField name={row.name('to')} label="To" disableFuture />
                        <MoneyField
                          name={row.name('monthlyIncome')}
                          label="Monthly income"
                          min={0}
                          required
                        />
                      </Stack>
                    )}
                  </FieldArray>
                </WizardStep>

                <WizardStep id="debts" title={null}>
                  <FieldArray
                    name="debts"
                    label="Existing debts"
                    singular="Debt"
                    emptyRow={emptyDebt}
                    minRows={0}
                  >
                    {(row) => (
                      <Stack spacing={2}>
                        <TextField name={row.name('creditor')} label="Creditor" required />
                        <MoneyField name={row.name('balance')} label="Balance" min={0} required />
                        <MoneyField
                          name={row.name('monthlyPayment')}
                          label="Monthly payment"
                          min={0}
                          required
                        />
                      </Stack>
                    )}
                  </FieldArray>
                </WizardStep>

                <WizardStep id="documents">
                  <DocumentUploads />
                </WizardStep>

                <WizardStep id="review">
                  <Stack spacing={3}>
                    <FormSection title="Loan">
                      <Stack spacing={1}>
                        <ReadOnlyField
                          name="amount"
                          label="Loan amount"
                          format={money}
                          editStep="loan"
                        />
                        <ReadOnlyField
                          name="purpose"
                          label="Purpose"
                          options={PURPOSE_OPTIONS}
                          editStep="loan"
                        />
                        <ReadOnlyField
                          name="termMonths"
                          label="Term"
                          format={months}
                          editStep="loan"
                        />
                      </Stack>
                    </FormSection>
                    <FormSection title="Applicant">
                      <Stack spacing={1}>
                        <ReadOnlyField
                          name="applicantName"
                          label="Full name"
                          editStep="applicant"
                        />
                        <ReadOnlyField name="applicantEmail" label="Email" editStep="applicant" />
                        <ReadOnlyField
                          name="applicantIncome"
                          label="Monthly income"
                          format={money}
                          editStep="applicant"
                        />
                      </Stack>
                    </FormSection>
                    <ReadOnlyField
                      name="coApplicants"
                      label="Co-applicants"
                      format={(value) =>
                        Array.isArray(value) && value.length > 0
                          ? value.map((c: { name: string }) => c.name).join(', ')
                          : 'None'
                      }
                      editStep="coApplicants"
                    />
                    <ReadOnlyField
                      name="employment"
                      label="Employers"
                      format={(value) =>
                        Array.isArray(value)
                          ? value.map((e: { employer: string }) => e.employer).join(', ')
                          : ''
                      }
                      editStep="employment"
                    />
                    <ReadOnlyField
                      name="debts"
                      label="Debts"
                      format={(value) =>
                        Array.isArray(value) && value.length > 0
                          ? value.map((d: { creditor: string }) => d.creditor).join(', ')
                          : 'None'
                      }
                      editStep="debts"
                    />
                    <Totals />
                  </Stack>
                </WizardStep>

                <WizardNav submitLabel="Submit application" />
              </Wizard>
            </Stack>
          </Form>
        </Paper>
      </Container>
    </LocalizationProvider>
  )
}

/**
 * One `FileField` for the primary applicant plus one per co-applicant row, named over the
 * watched array so a row added/removed on the earlier Co-applicants step is reflected here
 * without its own FieldArray. Keyed by array index rather than a stable id: a plain
 * `useWatch` never sees hookform's field-array `field.id`s, only the current values, so
 * there is no stable id to key on here — see #79 (filed while building this step) for the
 * gap and its caveat (removing/reordering co-applicants after documents are attached here
 * can point a later upload at the wrong row's field name).
 */
function DocumentUploads() {
  const coApplicants = useWatch<Input, 'coApplicants'>({ name: 'coApplicants' }) ?? []

  return (
    <Stack spacing={3}>
      <FileField name="applicantDocuments" label="Upload applicant documents" multiple />
      {coApplicants.map((coApplicant, index) => (
        <Fragment key={index}>
          <FileField
            name={`coApplicants.${index}.documents`}
            label={`Upload documents for ${coApplicant.name || `Co-applicant ${index + 1}`}`}
            multiple
          />
        </Fragment>
      ))}
    </Stack>
  )
}
