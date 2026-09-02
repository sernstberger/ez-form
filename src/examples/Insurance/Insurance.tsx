import { useEffect, useMemo, useRef, useState } from 'react'
import Container from '@mui/material/Container'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Button from '@mui/material/Button'
import { z } from 'zod'
import { useWatch } from 'react-hook-form'
import { Form, type FormMethods } from '../../Form'
import { FormError } from '../../FormError'
import { FormErrorSummary } from '../../Form/FormErrorSummary'
import { FormSection } from '../../FormSection'
import { SubmitButton } from '../../SubmitButton'
import { Wizard, type WizardStepDef } from '../../Wizard'
import { WizardStep } from '../../Wizard/WizardStep'
import { WizardStepper } from '../../Wizard/WizardStepper'
import { WizardNav } from '../../Wizard/WizardNav'
import { TextField } from '../../fields/TextField'
import { PhoneField, PHONE_FORMAT, formatTemplate } from '../../fields/PhoneField'
import { AddressField, addressSchema } from '../../fields/AddressField'
import { US_STATES } from '../../fields/StateSelect'
import { EmailField } from '../../fields/EmailField'
import { DateField } from '../../fields/DateField'
import { RadioGroup } from '../../fields/RadioGroup'
import { Slider } from '../../fields/Slider'
import { MoneyField } from '../../fields/MoneyField'
import { Checkbox } from '../../fields/Checkbox'
import { NumberField } from '../../fields/NumberField'
import { TextareaField } from '../../fields/TextareaField'
import { CheckboxGroup } from '../../fields/CheckboxGroup'
import { FileField } from '../../fields/FileField'
import { ReadOnlyField } from '../../fields/ReadOnlyField'
import { resolveAutoComplete } from '../../fields/resolveAutoComplete'
import type { Option } from '../../fields/Option'
import { useAssisted } from '../../Form/AssistedContext'
import { submitApplicationApi } from '../fakeApi'

const COVERAGE_TYPES: readonly Option[] = [
  { value: 'liability', label: 'Liability only' },
  { value: 'collision', label: 'Collision' },
  { value: 'comprehensive', label: 'Comprehensive' },
]

const INCIDENT_OPTIONS: readonly Option[] = [
  { value: 'accident', label: 'At-fault accident' },
  { value: 'ticket', label: 'Moving violation' },
  { value: 'claim', label: 'Prior insurance claim' },
]

/** README-recommended birthday pattern: `disableFuture` + a sane `minDate` (see Profile). */
const MIN_BIRTHDAY = new Date(1900, 0, 1)

const vehicleSchema = z.object({
  make: z.string().min(1, 'Make is required'),
  model: z.string().min(1, 'Model is required'),
  year: z.number('Year is required').min(1980, 'Year must be 1980 or later'),
  plate: z.string().min(1, 'Plate number is required'),
})

// The base object below keeps `vehicle` optional at the zod level (mirrors Checkout's
// `optionalAddressSchema`): its fields are only truly required when `hasVehicle` is true,
// enforced by the `superRefine` below rather than by `vehicleSchema` itself, since the wizard
// always submits a `vehicle` object (empty when the step was never shown) and the whole schema
// is what final submit validates.
const optionalVehicleSchema = z.object({
  make: z.string(),
  model: z.string(),
  year: z.number().nullable(),
  plate: z.string(),
})

export const schema = z
  .object({
    // Applicant
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    birthday: z.date('Birthday is required'),
    // Contact
    // Plain `z.string()`: <EmailField> owns the format rule (HTML's own e-mail grammar).
    email: z.string().min(1, 'Email is required'),
    // No regex: `PhoneField` stores bare digits and owns the "all ten digits" check
    // itself, so zod only asks that something was entered (see README "US fields").
    phone: z.string().min(1, 'Phone is required'),
    // `AddressField`'s five parts, straight from `addressSchema()` rather than restated
    // here; `street2` is hidden below, so the schema drops the key nothing writes.
    address: addressSchema({ street2: false }),
    // Coverage
    coverageType: z.enum(
      COVERAGE_TYPES.map((o) => o.value as string) as [string, ...string[]],
      'Choose a coverage type',
    ),
    deductible: z.number(),
    coverageAmount: z.number('Coverage amount is required').min(1, 'Coverage amount is required'),
    // Vehicle (conditional)
    hasVehicle: z.boolean(),
    vehicle: optionalVehicleSchema,
    // Drivers
    driver: z.object({
      name: z.string().min(1, "Primary driver's name is required"),
      licenseNumber: z.string().min(1, 'License number is required'),
      licenseDate: z.date('License issue date is required'),
    }),
    // History
    claims: z.string().max(500, 'Keep claim history under 500 characters'),
    priorIncidents: z.array(z.string()),
    incidentDetails: z.string(),
    // Documents
    documents: z.array(z.instanceof(File)),
  })
  .superRefine(
    (data, ctx) => {
      // Conditional field (#82): details are required only once an incident is ticked.
      if (data.priorIncidents.length > 0 && data.incidentDetails.trim() === '') {
        ctx.addIssue({
          code: 'custom',
          path: ['incidentDetails'],
          message: 'Describe the incident(s) before continuing',
        })
      }
      if (!data.hasVehicle) return
      const result = vehicleSchema.safeParse(data.vehicle)
      if (result.success) return
      for (const issue of result.error.issues) {
        ctx.addIssue({ ...issue, path: ['vehicle', ...issue.path] })
      }
    },
    // Zod v4 skips object-level refinements once any sibling has a non-continuable issue
    // (the empty `coverageType` enum); `when` keeps this check running. See README "Zod gotcha".
    { when: () => true },
  )

export type Input = z.input<typeof schema>

export const emptyValues: Input = {
  firstName: '',
  lastName: '',
  birthday: null as unknown as Date,
  email: '',
  phone: '',
  address: { street: '', city: '', state: '', zip: '' },
  coverageType: '',
  deductible: 500,
  coverageAmount: null as unknown as number,
  hasVehicle: false,
  vehicle: { make: '', model: '', year: null, plate: '' },
  driver: { name: '', licenseNumber: '', licenseDate: null as unknown as Date },
  claims: '',
  priorIncidents: [],
  incidentDetails: '',
  documents: [],
}

const STORAGE_KEY = 'ez-form:insurance-resume'

interface SavedState {
  step: string
  visited: string[]
  values: Partial<Input>
}

/**
 * `File`/`File[]` values (only `documents` today, but this walks generically rather than
 * naming that one key) round-trip through `JSON.stringify` as `{}` — every own-enumerable
 * property a `File` exposes (`name`, `size`, `type`, `lastModified`, …) is a getter on its
 * prototype, not an own property `JSON.stringify` would serialize. Reloading that `{}` back
 * in fails `z.instanceof(File)` (`expected File, received object`), which blocks the whole
 * form from ever submitting again, and `ReadOnlyField`/`FileField` render it as an
 * unlabelled `[object Object]` chip. Stripped to an empty array before every write, so a
 * resumed session simply starts Documents empty — uploads never survive a reload; noted on
 * the `Horizontal` story, the one demonstrating resume.
 */
function stripFiles(values: Partial<Input>): Partial<Input> {
  return { ...values, documents: [] }
}

function loadSaved(): SavedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw, (key: string, value: unknown) => {
      if ((key === 'birthday' || key === 'licenseDate') && typeof value === 'string') {
        return new Date(value)
      }
      return value
    }) as SavedState
  } catch {
    return null
  }
}

function saveState(state: SavedState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage unavailable (private mode, quota) — resume simply won't work this session.
  }
}

function clearSaved() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing to clear if storage was never available.
  }
}

/** Every step's own field paths + the review/document steps that own nothing to validate. */
const APPLICANT_FIELDS = ['firstName', 'lastName', 'birthday'] as const
const CONTACT_FIELDS = ['email', 'phone', 'address'] as const
const COVERAGE_FIELDS = ['coverageType', 'deductible', 'coverageAmount'] as const
const HAS_VEHICLE_FIELDS = ['hasVehicle'] as const
const VEHICLE_FIELDS = ['vehicle'] as const
const DRIVERS_FIELDS = ['driver'] as const
const HISTORY_FIELDS = ['claims', 'priorIncidents', 'incidentDetails'] as const
const DOCUMENTS_FIELDS = ['documents'] as const

/**
 * All 9 steps. The vehicle step carries a `when` predicate (#80), so the
 * Wizard itself hides it from navigation, the stepper and page layout while
 * `hasVehicle` is false; its fields are gated in the schema with `superRefine`.
 * `steps` stays a module-level constant — `Wizard.steps` must be a stable
 * reference.
 */
export const INSURANCE_STEPS = [
  { id: 'applicant', label: 'Applicant', fields: APPLICANT_FIELDS },
  { id: 'contact', label: 'Contact', fields: CONTACT_FIELDS },
  { id: 'coverage', label: 'Coverage', fields: COVERAGE_FIELDS },
  { id: 'has-vehicle', label: 'Vehicle?', fields: HAS_VEHICLE_FIELDS },
  {
    id: 'vehicle',
    label: 'Vehicle',
    fields: VEHICLE_FIELDS,
    when: (values: Input) => Boolean(values.hasVehicle),
  },
  { id: 'drivers', label: 'Drivers', fields: DRIVERS_FIELDS },
  { id: 'history', label: 'History', fields: HISTORY_FIELDS },
  { id: 'documents', label: 'Documents', fields: DOCUMENTS_FIELDS },
  { id: 'review', label: 'Review' },
] as const satisfies readonly WizardStepDef<Input>[]

/** Watches the whole form so the parent can persist it (localStorage resume). */
function WatchValues({ onValues }: { onValues: (values: Partial<Input>) => void }) {
  const values = useWatch<Input>() as Partial<Input>
  const json = JSON.stringify(values)
  // Keyed on the serialized values, not the object: `useWatch` returns a fresh object every
  // render, so an identity dep would fire on every keystroke's re-render regardless of whether
  // anything changed.
  useEffect(() => {
    onValues(JSON.parse(json) as Partial<Input>)
  }, [json, onValues])
  return null
}

export function ApplicantStep() {
  // These fields' tokens (`given-name`, `family-name`, …) have no `type` a plain `TextField`
  // could derive them from, so — unlike `email`/`tel` below — they are hardcoded here rather
  // than left to a default. `TextField` only suppresses a *default* token under `assisted`,
  // never an explicit one (#65 requirement 2), so this step resolves its own hardcoded tokens
  // against the form's `assisted` flag instead: the Agent story is otherwise the one place in
  // this example a rep filling out someone else's application would still get autofill offers
  // for their own name.
  const assisted = useAssisted()
  return (
    <WizardStep id="applicant">
      <Stack spacing={2}>
        <TextField
          name="firstName"
          label="First name"
          autoComplete={resolveAutoComplete('given-name', assisted)}
          required
        />
        <TextField
          name="lastName"
          label="Last name"
          autoComplete={resolveAutoComplete('family-name', assisted)}
          required
        />
        <DateField name="birthday" label="Birthday" disableFuture minDate={MIN_BIRTHDAY} required />
      </Stack>
    </WizardStep>
  )
}

export function ContactStep() {
  // See ApplicantStep's comment: street/city/ZIP tokens are hardcoded (no `type` derives
  // them), so they route through `resolveAutoComplete` the same way. `email` and `tel` would
  // already be suppressed by `TextField`'s own `type`-derived default — they are hardcoded
  // here only because this form also carries `phone`'s own `pattern` rule, not to opt out of
  // that default, so they get the same explicit treatment for consistency.
  const assisted = useAssisted()
  return (
    <WizardStep id="contact">
      <Stack spacing={3}>
        <EmailField name="email" label="Email" required />
        {/*
          No `pattern` rule: `PhoneField` formats as you type and carries its own
          "all ten digits" check, so the format lives in one place instead of being
          restated as a regex here and again in the schema.
        */}
        <PhoneField name="phone" label="Phone" required />
        {/*
          One `AddressField` in place of the four parts written out by hand. `street2`
          is off — a personal auto policy takes the mailing address, and the schema
          above matches with `addressSchema({ street2: false })`.
        */}
        <AddressField name="address" legend="Address" street2={false} required />
      </Stack>
    </WizardStep>
  )
}

export function CoverageStep() {
  return (
    <WizardStep id="coverage">
      <Stack spacing={3}>
        <RadioGroup name="coverageType" label="Coverage type" options={COVERAGE_TYPES} required />
        <Slider
          name="deductible"
          label="Deductible"
          min={0}
          max={2000}
          step={250}
          marks
          valueLabelDisplay="auto"
        />
        <MoneyField name="coverageAmount" label="Coverage amount" required />
      </Stack>
    </WizardStep>
  )
}

export function HasVehicleStep() {
  return (
    <WizardStep id="has-vehicle">
      <Checkbox name="hasVehicle" label="I want to insure a vehicle" />
    </WizardStep>
  )
}

export function VehicleStep() {
  return (
    <WizardStep id="vehicle">
      <Stack spacing={2}>
        <TextField name="vehicle.make" label="Make" required />
        <TextField name="vehicle.model" label="Model" required />
        <NumberField name="vehicle.year" label="Year" min={1980} max={2100} required />
        <TextField name="vehicle.plate" label="Plate number" required />
      </Stack>
    </WizardStep>
  )
}

export function DriversStep() {
  return (
    <WizardStep id="drivers">
      <FormSection title="Primary driver">
        <Stack spacing={2}>
          <TextField name="driver.name" label="Full name" required />
          <TextField name="driver.licenseNumber" label="License number" required />
          <DateField name="driver.licenseDate" label="License issue date" disableFuture required />
        </Stack>
      </FormSection>
    </WizardStep>
  )
}

export function HistoryStep() {
  return (
    <WizardStep id="history">
      <Stack spacing={3}>
        <TextareaField
          name="claims"
          label="Describe any claims in the last 5 years"
          maxLength={500}
        />
        <CheckboxGroup name="priorIncidents" label="Prior incidents" options={INCIDENT_OPTIONS} />
        <IncidentDetails />
      </Stack>
    </WizardStep>
  )
}

/** Conditional field (#82): shown, and required, only once at least one incident is ticked. */
function IncidentDetails() {
  const incidents = useWatch<Input, 'priorIncidents'>({ name: 'priorIncidents' }) ?? []
  if (incidents.length === 0) return null
  return (
    <TextareaField name="incidentDetails" label="Please describe the incident(s)" maxLength={500} />
  )
}

export function DocumentsStep() {
  return (
    <WizardStep id="documents">
      <FileField name="documents" label="Upload documents" multiple />
    </WizardStep>
  )
}

export function ReviewStep({ hasVehicle }: { hasVehicle: boolean }) {
  return (
    <WizardStep id="review">
      <Stack spacing={2}>
        <FormErrorSummary />
        <ReadOnlyField name="firstName" editStep="applicant" />
        <ReadOnlyField name="lastName" editStep="applicant" />
        <ReadOnlyField name="birthday" editStep="applicant" />
        <ReadOnlyField name="email" editStep="contact" />
        {/*
          `PhoneField` stores bare digits, so the raw value would review as
          "5555555555". `formatTemplate` and `PHONE_FORMAT` are the same helper and
          template the field itself displays through — both exported — so the review
          row reads exactly as the input did and cannot drift from it.
        */}
        <ReadOnlyField
          name="phone"
          editStep="contact"
          format={(v) =>
            // `format` wins over `empty`, so an unanswered phone is spelled out here
            // rather than rendering as a blank row.
            typeof v === 'string' && v !== '' ? formatTemplate(v, PHONE_FORMAT) : '—'
          }
        />
        <ReadOnlyField name="address.street" editStep="contact" />
        <ReadOnlyField name="address.city" editStep="contact" />
        {/*
          `ReadOnlyField` has no way to reach a `Select`'s option list on its own, so
          the state row would otherwise print the stored USPS abbreviation. Passing
          `StateSelect`'s own `US_STATES` renders the full name instead — the same
          `options` mechanism the `coverageType` row above uses.
        */}
        <ReadOnlyField name="address.state" options={US_STATES} editStep="contact" />
        <ReadOnlyField name="address.zip" editStep="contact" />
        <ReadOnlyField name="coverageType" options={COVERAGE_TYPES} editStep="coverage" />
        <ReadOnlyField name="deductible" editStep="coverage" />
        <ReadOnlyField
          name="coverageAmount"
          editStep="coverage"
          format={(v) =>
            typeof v === 'number'
              ? v.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
              : String(v)
          }
        />
        <ReadOnlyField name="hasVehicle" editStep="has-vehicle" />
        {hasVehicle && (
          <>
            <ReadOnlyField name="vehicle.make" editStep="vehicle" />
            <ReadOnlyField name="vehicle.model" editStep="vehicle" />
            <ReadOnlyField name="vehicle.year" editStep="vehicle" />
            <ReadOnlyField name="vehicle.plate" editStep="vehicle" />
          </>
        )}
        <ReadOnlyField name="driver.name" editStep="drivers" />
        <ReadOnlyField name="driver.licenseNumber" editStep="drivers" />
        <ReadOnlyField name="driver.licenseDate" editStep="drivers" />
        <ReadOnlyField name="claims" editStep="history" />
        <ReadOnlyField name="priorIncidents" options={INCIDENT_OPTIONS} editStep="history" />
        <ReadOnlyField name="incidentDetails" editStep="history" />
        <ReadOnlyField name="documents" editStep="documents" />
      </Stack>
    </WizardStep>
  )
}

/** Every step's content, shared by the Horizontal/Vertical/Page stories. */
export function InsuranceSteps({ hasVehicle }: { hasVehicle: boolean }) {
  return (
    <>
      <ApplicantStep />
      <ContactStep />
      <CoverageStep />
      <HasVehicleStep />
      <VehicleStep />
      <DriversStep />
      <HistoryStep />
      <DocumentsStep />
      <ReviewStep hasVehicle={hasVehicle} />
    </>
  )
}

export interface InsuranceProps {
  orientation?: 'horizontal' | 'vertical'
  layout?: 'steps' | 'page'
  /** Called once the fake API resolves with the submitted application. */
  onSuccess?: (result: { applicationId: string }) => void
  /**
   * `<Form assisted>` (#65): an internal agent filling this out on behalf of
   * someone else doesn't get their own autofill offered, and isn't slowed by
   * a confirm dialog (`confirm`/`guard` are also off). Renders as a single
   * `layout="page"` form.
   */
  agentMode?: boolean
}

/**
 * Fifth rung of the example ladder (#56): a 9-step wizard with a conditional
 * step (Vehicle, shown only when "has vehicle?" is Yes), resumable from
 * localStorage, and a Review step with per-field Edit links. Documentation
 * only — not exported from the package (see `tsconfig.build.json`'s
 * `src/examples` exclusion).
 */
export function Insurance({
  orientation = 'horizontal',
  layout: layoutProp = 'steps',
  onSuccess,
  agentMode = false,
}: InsuranceProps) {
  // #65's "pairs with Wizard layout=page" acceptance bullet: agent mode always renders as
  // one page, regardless of `layout`.
  const layout = agentMode ? 'page' : layoutProp
  const saved = useMemo(() => (agentMode ? null : loadSaved()), [agentMode])
  const [step, setStep] = useState(saved?.step ?? 'applicant')
  const [visited, setVisited] = useState<readonly string[]>(saved?.visited ?? ['applicant'])
  const [values, setValues] = useState<Partial<Input>>(saved?.values ?? emptyValues)
  const hasVehicle = Boolean(values.hasVehicle)
  const steps = INSURANCE_STEPS
  // `defaultValues` only seeds hookform once, at mount; "Start over" needs the already-mounted
  // form to actually reset, so it goes through the form methods (see Profile's own `form` ref
  // for the same reasoning) rather than relying on this state change alone.
  const form = useRef<FormMethods<Input, z.output<typeof schema>>>(null)
  // A pristine session (still on the first step, nothing visited beyond it, no value changed
  // from `emptyValues`) has no progress worth resuming — treating it as "nothing to save"
  // rather than always persisting means "Start over" (which produces exactly this state) never
  // races its own `clearSaved()` against this effect's next run; see `form.reset` below, which
  // triggers one more `WatchValues` → `setValues` cycle after the state setters here already
  // fired, so a ref-based "skip the next save" flag can't reliably target the right run.
  const isPristine =
    step === 'applicant' &&
    visited.length === 1 &&
    visited[0] === 'applicant' &&
    JSON.stringify(values) === JSON.stringify(emptyValues)

  useEffect(() => {
    if (agentMode) return
    if (isPristine) {
      clearSaved()
      return
    }
    saveState({ step, visited: [...visited], values: stripFiles(values) })
  }, [agentMode, isPristine, step, visited, values])

  function startOver() {
    setStep('applicant')
    setVisited(['applicant'])
    setValues(emptyValues)
    form.current?.reset(emptyValues)
  }

  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Paper variant="outlined" sx={{ p: 4 }}>
        <Form
          ref={form}
          schema={schema}
          defaultValues={values}
          assisted={agentMode}
          title="Auto insurance application"
          confirm={agentMode ? undefined : { title: 'Submit application?' }}
          guard={!agentMode}
          mode={agentMode ? 'onSubmit' : undefined}
          onSubmit={async (submitted, form) => {
            try {
              const result = await submitApplicationApi(submitted)
              form.clearErrors('root.server')
              clearSaved()
              onSuccess?.(result)
            } catch (error) {
              form.setError('root.server', {
                message: error instanceof Error ? error.message : 'Submission failed',
              })
            }
          }}
        >
          <Stack spacing={3}>
            <FormError />
            <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
              <Button type="button" variant="text" onClick={startOver}>
                Start over
              </Button>
            </Stack>
            <WatchValues onValues={setValues} />
            {layout === 'page' ? (
              <Wizard steps={steps} layout="page">
                <InsuranceSteps hasVehicle={hasVehicle} />
                <SubmitButton>Submit application</SubmitButton>
              </Wizard>
            ) : (
              <Wizard
                steps={steps}
                orientation={orientation}
                step={step}
                onStepChange={(s) => setStep(s.id)}
                visited={visited}
                onVisitedChange={setVisited}
              >
                <WizardStepper />
                <InsuranceSteps hasVehicle={hasVehicle} />
                <WizardNav submitLabel="Submit application" />
              </Wizard>
            )}
          </Stack>
        </Form>
      </Paper>
    </Container>
  )
}
