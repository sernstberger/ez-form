import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
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
import { z } from 'zod'
import { Form } from '../Form'
import { Wizard } from './Wizard'
import { WizardStep } from './WizardStep'
import { WizardStepper } from './WizardStepper'
import { WizardNav } from './WizardNav'
import { TextField } from '../fields/TextField'
import { Select } from '../fields/Select'
import { NumberField } from '../fields/NumberField'
import { Checkbox } from '../fields/Checkbox'
import { ReadOnlyField } from '../fields/ReadOnlyField'
import { steps, emptyValues } from './Wizard.stories'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.email('Invalid email'),
  plan: z.enum(['basic', 'pro'], { error: 'Pick a plan' }),
  seats: z.number().min(1, 'At least one seat'),
  tos: z.boolean().refine(Boolean, { error: 'You must accept the terms' }),
})

const plans = [
  { value: 'basic', label: 'Basic' },
  { value: 'pro', label: 'Pro' },
] as const

const onSubmit = fn()

/** Layout route: owns the Form and the Wizard; the step routes render below through <Outlet>. */
function SignupLayout() {
  const { step = '' } = useParams()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  return (
    <Form
      schema={schema}
      defaultValues={emptyValues}
      onSubmit={onSubmit}
      title="Create your account"
    >
      <Stack spacing={3} sx={{ width: 480 }}>
        <Typography variant="body2" color="text.secondary">
          URL: {pathname}
        </Typography>
        <Wizard steps={steps} step={step} onStepChange={(s) => void navigate(`/signup/${s.id}`)}>
          <WizardStepper />
          <Outlet />
          <WizardNav submitLabel="Create account" />
        </Wizard>
      </Stack>
    </Form>
  )
}

/** One route per step. The route only renders the WizardStep for its own id. */
function SignupStep() {
  const { step } = useParams()
  switch (step) {
    case 'account':
      return (
        <WizardStep id="account">
          <Stack spacing={2}>
            <TextField name="name" label="Name" required />
            <TextField name="email" label="Email" required />
          </Stack>
        </WizardStep>
      )
    case 'plan':
      return (
        <WizardStep id="plan">
          <Stack spacing={2}>
            <Select name="plan" label="Plan" options={plans} required />
            <NumberField name="seats" label="Seats" min={1} />
          </Stack>
        </WizardStep>
      )
    case 'review':
      return (
        <WizardStep id="review">
          <Stack spacing={2}>
            <ReadOnlyField name="name" editStep="account" />
            <ReadOnlyField name="email" editStep="account" />
            <ReadOnlyField name="plan" options={plans} editStep="plan" />
            <ReadOnlyField name="seats" editStep="plan" />
            <Checkbox name="tos" label="I accept the terms" required />
          </Stack>
        </WizardStep>
      )
    default:
      return null
  }
}

const routes = [
  {
    path: '/signup',
    element: <SignupLayout />,
    children: [
      { index: true, element: null },
      { path: ':step', element: <SignupStep /> },
    ],
  },
]

const meta = {
  title: 'Wizard/ReactRouter',
  parameters: { layout: 'centered' },
} satisfies Meta
export default meta

/** Starts at /signup/account. Next / Back / stepper clicks change the URL. */
export const OneRoutePerStep: StoryObj<typeof meta> = {
  render: () => (
    <RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/signup/account'] })} />
  ),
}

/** Deep link to /signup/review with nothing visited: the wizard asks the router for the last visited step (account). */
export const DeepLinkRedirect: StoryObj<typeof meta> = {
  render: () => (
    <RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/signup/review'] })} />
  ),
}
