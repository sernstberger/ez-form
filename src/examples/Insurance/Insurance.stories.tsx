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
import { useWatch } from 'react-hook-form'
import { Form } from '../../Form'
import { Wizard } from '../../Wizard'
import { WizardStepper } from '../../Wizard/WizardStepper'
import { WizardNav } from '../../Wizard/WizardNav'
import {
  Insurance,
  schema,
  emptyValues,
  INSURANCE_STEPS,
  ApplicantStep,
  ContactStep,
  CoverageStep,
  HasVehicleStep,
  VehicleStep,
  DriversStep,
  HistoryStep,
  DocumentsStep,
  ReviewStep,
  type Input,
} from './Insurance'

const meta = {
  title: 'Examples/Insurance',
  component: Insurance,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Insurance>

export default meta
type Story = StoryObj<typeof meta>

/**
 * The default: a horizontal stepper, resumable from localStorage. Reload the
 * story after filling a few steps — it lands back where it left off. Uploaded
 * documents do not survive a reload: a `File` serializes to `{}` through
 * `JSON.stringify` (its properties are prototype getters, not own properties),
 * which would otherwise fail schema validation and permanently block submit
 * on the next load — so the Documents step is stripped before every save and
 * always resumes empty.
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

/**
 * Layout route: owns the `Form` and the `Wizard`; the step routes render
 * below through `<Outlet>`. `hasVehicle` is watched here (not read once at
 * mount) so the conditional Vehicle step reacts live to the switch on the
 * `has-vehicle` route, the same as the non-router stories.
 */
function InsuranceLayout() {
  const { step = '' } = useParams()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const steps = INSURANCE_STEPS
  return (
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
  )
}

/**
 * One route per step (like `Wizard/ReactRouter`): the route only renders the
 * step for its own id, reusing the exact same step components as the
 * `Horizontal`/`Vertical`/`Page` stories (`Insurance.tsx`'s exported
 * `*Step` functions) rather than a second copy of the field markup, so the
 * two can't drift apart.
 */
function InsuranceRouteStep() {
  const { step } = useParams()
  // Called unconditionally (not inside the `switch`'s `'review'` case): this component is one
  // instance across every `:step` param change, not remounted per route, so a hook called only
  // for some cases would violate the rules of hooks the moment the route moves off `review`.
  const hasVehicle = Boolean(useWatch<Input, 'hasVehicle'>({ name: 'hasVehicle' }))
  switch (step) {
    case 'applicant':
      return <ApplicantStep />
    case 'contact':
      return <ContactStep />
    case 'coverage':
      return <CoverageStep />
    case 'has-vehicle':
      return <HasVehicleStep />
    case 'vehicle':
      return <VehicleStep />
    case 'drivers':
      return <DriversStep />
    case 'history':
      return <HistoryStep />
    case 'documents':
      return <DocumentsStep />
    case 'review':
      return <ReviewStep hasVehicle={hasVehicle} />
    default:
      return null
  }
}

const routes = [
  {
    path: '/insurance',
    element: (
      <Form
        schema={schema}
        defaultValues={emptyValues}
        title="Auto insurance application"
        onSubmit={() => {}}
      >
        <InsuranceLayout />
      </Form>
    ),
    children: [
      { index: true, element: null },
      { path: ':step', element: <InsuranceRouteStep /> },
    ],
  },
]

/**
 * One route per step, mirroring `Wizard/ReactRouter`: Next / Back / stepper
 * clicks change the URL, so the browser's own back/forward and deep links
 * work against a specific step. The Vehicle step is reachable here too: flip
 * "has vehicle?" on the `has-vehicle` route and Next reveals it, the same
 * conditional behavior as the other stories.
 */
export const ReactRouter: Story = {
  render: () => (
    <RouterProvider
      router={createMemoryRouter(routes, { initialEntries: ['/insurance/applicant'] })}
    />
  ),
}
