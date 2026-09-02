import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import Stack from '@mui/material/Stack'
import { z } from 'zod'
import { Form } from './Form'
import { FormErrorSummary } from './FormErrorSummary'
import { SubmitButton } from '../SubmitButton'
import { TextField } from '../fields/TextField'
import { Checkbox } from '../fields/Checkbox'
import { Wizard, type WizardStepDef } from '../Wizard/Wizard'
import { WizardStep } from '../Wizard/WizardStep'
import { WizardStepper } from '../Wizard/WizardStepper'
import { WizardNav } from '../Wizard/WizardNav'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.email('Invalid email address'),
  tos: z.boolean().refine(Boolean, { error: 'You must accept the terms' }),
})

const onSubmit = fn()

const meta = {
  title: 'Form/ErrorSummary',
  component: FormErrorSummary,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof FormErrorSummary>
export default meta
type Story = StoryObj<typeof meta>

/**
 * Click Submit with the fields empty: the summary appears above the fields, focus moves to its
 * heading, and each link focuses the field it names. Fix a field and its item disappears.
 */
export const Default: Story = {
  render: () => (
    <Form
      schema={schema}
      defaultValues={{ name: '', email: '', tos: false }}
      onSubmit={onSubmit}
      title="Sign up"
    >
      <Stack spacing={2} sx={{ width: 360 }}>
        <FormErrorSummary />
        <TextField name="name" label="Name" required />
        <TextField name="email" label="Email" required />
        <Checkbox name="tos" label="I accept the terms" required />
        <SubmitButton>Create account</SubmitButton>
      </Stack>
    </Form>
  ),
}

export const CustomTitle: Story = {
  render: () => (
    <Form
      schema={schema}
      defaultValues={{ name: '', email: '', tos: false }}
      onSubmit={onSubmit}
      title="Sign up"
    >
      <Stack spacing={2} sx={{ width: 360 }}>
        <FormErrorSummary title="Please fix the following" />
        <TextField name="name" label="Name" required />
        <TextField name="email" label="Email" required />
        <Checkbox name="tos" label="I accept the terms" required />
        <SubmitButton>Create account</SubmitButton>
      </Stack>
    </Form>
  ),
}

const wizardSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.email('Invalid email address'),
  plan: z.string().min(1, 'Pick a plan'),
})
type WizardInput = z.input<typeof wizardSchema>

const wizardSteps = [
  { id: 'account', label: 'Account', fields: ['name', 'email'] },
  { id: 'plan', label: 'Plan', fields: ['plan'] },
] as const satisfies WizardStepDef<WizardInput>[]

/**
 * One `<FormErrorSummary />` per step: Next on an empty Account step lists only that step's
 * two errors, not the Plan step's — which hasn't been attempted yet and shows no summary.
 */
export const InsideAWizard: Story = {
  render: () => (
    <Form
      schema={wizardSchema}
      defaultValues={{ name: '', email: '', plan: '' }}
      onSubmit={onSubmit}
    >
      <Stack spacing={2} sx={{ width: 360 }}>
        <Wizard steps={wizardSteps}>
          <WizardStepper />
          <WizardStep id="account">
            <Stack spacing={2}>
              <FormErrorSummary />
              <TextField name="name" label="Name" required />
              <TextField name="email" label="Email" required />
            </Stack>
          </WizardStep>
          <WizardStep id="plan">
            <Stack spacing={2}>
              <FormErrorSummary />
              <TextField name="plan" label="Plan" required />
            </Stack>
          </WizardStep>
          <WizardNav />
        </Wizard>
      </Stack>
    </Form>
  ),
}
