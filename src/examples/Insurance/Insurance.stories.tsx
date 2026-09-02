import type { Meta, StoryObj } from '@storybook/react-vite'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import {
  Outlet,
  RouterProvider,
  createMemoryRouter,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router'
import { Form } from '../../Form'
import { Wizard } from '../../Wizard'
import { WizardStep } from '../../Wizard/WizardStep'
import { WizardStepper } from '../../Wizard/WizardStepper'
import { WizardNav } from '../../Wizard/WizardNav'
import { TextField } from '../../fields/TextField'
import { DateField } from '../../fields/DateField'
import { RadioGroup } from '../../fields/RadioGroup'
import { Slider } from '../../fields/Slider'
import { MoneyField } from '../../fields/MoneyField'
import { Switch } from '../../fields/Switch'
import { NumberField } from '../../fields/NumberField'
import { TextareaField } from '../../fields/TextareaField'
import { CheckboxGroup } from '../../fields/CheckboxGroup'
import { FileField } from '../../fields/FileField'
import { ReadOnlyField } from '../../fields/ReadOnlyField'
import { Insurance, schema, emptyValues, useInsuranceSteps } from './Insurance'

const meta = {
  title: 'Examples/Insurance',
  component: Insurance,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Insurance>

export default meta
type Story = StoryObj<typeof meta>

/**
 * The default: a horizontal stepper, resumable from localStorage. Reload the
 * story after filling a few steps — it lands back where it left off.
 */
export const Horizontal: Story = {}

export const Vertical: Story = { args: { orientation: 'vertical' } }

/**
 * `layout="page"` (#64): the same 9-step `steps` array as `Horizontal` /
 * `Vertical`, rendered as one long page instead — every step is a
 * `FormSection` in order, with no stepper or Back/Next chrome.
 * `ReadOnlyField`'s Edit buttons on the Review step render nothing here,
 * since every field is already on the page (see `ReadOnlyField`'s own
 * `editable` doc). This is the #56 acceptance for #64.
 */
export const Page: Story = { args: { layout: 'page' } }

/**
 * The manual precursor of #65 (assisted mode — not built): a single-page
 * form with `autoComplete="off"` (no autofill for the person filling this
 * out, since it's on someone else's behalf), `confirm` and `guard` off, and
 * every validation error shown after one submit attempt rather than
 * per-step. This is what an internal agent's UI looks like today, by hand;
 * #65 would make it a `Form` preset.
 */
export const Agent: Story = {
  args: { agentMode: true },
  parameters: {
    docs: {
      description: {
        story:
          'autoComplete="off" on the form, no confirm dialog, no unsaved-changes guard, one page, every error shown at once.',
      },
    },
  },
}

const routeSteps = [
  'applicant',
  'contact',
  'coverage',
  'has-vehicle',
  'vehicle',
  'drivers',
  'history',
  'documents',
  'review',
] as const
type RouteStep = (typeof routeSteps)[number]

const coverageTypes = [
  { value: 'liability', label: 'Liability only' },
  { value: 'collision', label: 'Collision' },
  { value: 'comprehensive', label: 'Comprehensive' },
]
const incidentOptions = [
  { value: 'accident', label: 'At-fault accident' },
  { value: 'ticket', label: 'Moving violation' },
  { value: 'claim', label: 'Prior insurance claim' },
]

/** Layout route: owns the Form and the Wizard; the step routes render below through <Outlet>. */
function InsuranceLayout() {
  const { step = '' } = useParams()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const steps = useInsuranceSteps(false)
  return (
    <Form
      schema={schema}
      defaultValues={emptyValues}
      title="Auto insurance application"
      onSubmit={() => {}}
    >
      <Stack spacing={3} sx={{ width: 480, mx: 'auto', my: 4 }}>
        <Typography variant="body2" color="text.secondary">
          URL: {pathname}
        </Typography>
        <Wizard steps={steps} step={step} onStepChange={(s) => void navigate(`/insurance/${s.id}`)}>
          <WizardStepper />
          <Outlet />
          <WizardNav submitLabel="Submit application" />
        </Wizard>
      </Stack>
    </Form>
  )
}

/** One route per step (like `Wizard/ReactRouter`): the route only renders the `WizardStep` for its own id. */
function InsuranceRouteStep() {
  const { step } = useParams<{ step: RouteStep }>()
  switch (step) {
    case 'applicant':
      return (
        <WizardStep id="applicant">
          <Stack spacing={2}>
            <TextField name="firstName" label="First name" required />
            <TextField name="lastName" label="Last name" required />
            <DateField name="birthday" label="Birthday" disableFuture required />
          </Stack>
        </WizardStep>
      )
    case 'contact':
      return (
        <WizardStep id="contact">
          <Stack spacing={2}>
            <TextField name="email" label="Email" required />
            <TextField name="phone" label="Phone" required />
          </Stack>
        </WizardStep>
      )
    case 'coverage':
      return (
        <WizardStep id="coverage">
          <Stack spacing={2}>
            <RadioGroup
              name="coverageType"
              label="Coverage type"
              options={coverageTypes}
              required
            />
            <Slider name="deductible" label="Deductible" min={0} max={2000} step={250} />
            <MoneyField name="coverageAmount" label="Coverage amount" required />
          </Stack>
        </WizardStep>
      )
    case 'has-vehicle':
      return (
        <WizardStep id="has-vehicle">
          <Switch name="hasVehicle" label="Do you want to insure a vehicle?" />
        </WizardStep>
      )
    case 'vehicle':
      return (
        <WizardStep id="vehicle">
          <Stack spacing={2}>
            <TextField name="vehicle.make" label="Make" required />
            <TextField name="vehicle.model" label="Model" required />
            <NumberField name="vehicle.year" label="Year" required />
            <TextField name="vehicle.plate" label="Plate number" required />
          </Stack>
        </WizardStep>
      )
    case 'drivers':
      return (
        <WizardStep id="drivers">
          <Stack spacing={2}>
            <TextField name="driver.name" label="Full name" required />
            <TextField name="driver.licenseNumber" label="License number" required />
            <DateField
              name="driver.licenseDate"
              label="License issue date"
              disableFuture
              required
            />
          </Stack>
        </WizardStep>
      )
    case 'history':
      return (
        <WizardStep id="history">
          <Stack spacing={2}>
            <TextareaField name="claims" label="Claims in the last 5 years" maxLength={500} />
            <CheckboxGroup
              name="priorIncidents"
              label="Prior incidents"
              options={incidentOptions}
            />
          </Stack>
        </WizardStep>
      )
    case 'documents':
      return (
        <WizardStep id="documents">
          <FileField name="documents" label="Upload documents" multiple />
        </WizardStep>
      )
    case 'review':
      return (
        <WizardStep id="review">
          <Stack spacing={2}>
            <ReadOnlyField name="firstName" editStep="applicant" />
            <ReadOnlyField name="email" editStep="contact" />
            <ReadOnlyField name="coverageType" options={coverageTypes} editStep="coverage" />
          </Stack>
        </WizardStep>
      )
    default:
      return null
  }
}

const routes = [
  {
    path: '/insurance',
    element: <InsuranceLayout />,
    children: [
      { index: true, element: null },
      { path: ':step', element: <InsuranceRouteStep /> },
    ],
  },
]

/**
 * One route per step, mirroring `Wizard/ReactRouter`: Next / Back / stepper
 * clicks change the URL, so the browser's own back/forward and deep links
 * work against a specific step.
 */
export const ReactRouter: Story = {
  render: () => (
    <RouterProvider
      router={createMemoryRouter(routes, { initialEntries: ['/insurance/applicant'] })}
    />
  ),
}
