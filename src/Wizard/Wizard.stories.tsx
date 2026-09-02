import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { useEffect, useState } from 'react'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useWatch } from 'react-hook-form'
import { z } from 'zod'
import { Form } from '../Form'
import { FormSection } from '../FormSection'
import { SubmitButton } from '../SubmitButton'
import { TextField } from '../fields/TextField'
import { Select } from '../fields/Select'
import { NumberField } from '../fields/NumberField'
import { Checkbox } from '../fields/Checkbox'
import { ReadOnlyField } from '../fields/ReadOnlyField'
import { Wizard, type WizardStepDef } from './Wizard'
import { WizardStep } from './WizardStep'
import { WizardStepper } from './WizardStepper'
import { WizardNav } from './WizardNav'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.email('Invalid email'),
  plan: z.enum(['basic', 'pro'], { error: 'Pick a plan' }),
  seats: z.number().min(1, 'At least one seat'),
  tos: z.boolean().refine(Boolean, { error: 'You must accept the terms' }),
})
type Input = z.input<typeof schema>

const plans = [
  { value: 'basic', label: 'Basic' },
  { value: 'pro', label: 'Pro' },
] as const

export const steps = [
  { id: 'account', label: 'Account', fields: ['name', 'email'] },
  { id: 'plan', label: 'Plan', optional: 'Seats are billed monthly', fields: ['plan', 'seats'] },
  { id: 'review', label: 'Review', fields: ['tos'] },
] as const satisfies WizardStepDef<Input>[]

export const emptyValues = { name: '', email: '', seats: 1, tos: false } as Partial<Input>

export function StepsContent() {
  return (
    <>
      <WizardStep id="account">
        <Stack spacing={2}>
          <TextField name="name" label="Name" required />
          <TextField name="email" label="Email" required />
        </Stack>
      </WizardStep>
      <WizardStep id="plan">
        <Stack spacing={2}>
          <Select name="plan" label="Plan" options={plans} required />
          <NumberField name="seats" label="Seats" min={1} />
        </Stack>
      </WizardStep>
      <WizardStep id="review">
        <Stack spacing={2}>
          <ReadOnlyField name="name" editStep="account" />
          <ReadOnlyField name="email" editStep="account" />
          <ReadOnlyField name="plan" options={plans} editStep="plan" />
          <ReadOnlyField name="seats" editStep="plan" />
          <Checkbox name="tos" label="I accept the terms" required />
        </Stack>
      </WizardStep>
    </>
  )
}

const onSubmit = fn()

/** Watches the whole form and reports every change to the parent, so the parent can persist it
 * without relying on native `FormData` (which loses typed values like booleans and numbers). */
function WatchValues({ onValues }: { onValues: (values: Partial<Input>) => void }) {
  const values = useWatch<Input>() as Partial<Input>
  const json = JSON.stringify(values)
  useEffect(() => {
    onValues(JSON.parse(json) as Partial<Input>)
  }, [json, onValues])
  return null
}

const meta = {
  title: 'Wizard',
  component: Wizard,
  excludeStories: /^(steps|emptyValues|StepsContent)$/,
  parameters: { layout: 'centered' },
  args: { steps, children: null },
  render: (args) => (
    <Form
      schema={schema}
      defaultValues={emptyValues}
      onSubmit={onSubmit}
      confirm={{ title: 'Create account?' }}
    >
      <Stack spacing={3} sx={{ width: 480 }}>
        <Wizard {...args}>
          <WizardStepper />
          <StepsContent />
          <WizardNav submitLabel="Create account" />
        </Wizard>
      </Stack>
    </Form>
  ),
} satisfies Meta<typeof Wizard<Input>>
export default meta
type Story = StoryObj<typeof meta>

export const Horizontal: Story = {}

export const Vertical: Story = { args: { orientation: 'vertical' } }

/**
 * The same `steps` array and `StepsContent` as `Horizontal` / `Vertical`, rendered as one
 * page instead: `WizardStepper` and `WizardNav` render nothing in `layout="page"`, so this
 * story swaps in a plain `SubmitButton` that validates the whole schema at once.
 * `StepsContent`'s review step still passes `editStep` to its `ReadOnlyField`s, but since
 * every field is already visible on the page, `ReadOnlyField` renders no Edit button here —
 * `wizard.go()` would be a no-op in this layout, and a button to nowhere is a dead control.
 */
export const PageLayout: Story = {
  args: { layout: 'page' },
  render: (args) => (
    <Form
      schema={schema}
      defaultValues={emptyValues}
      onSubmit={onSubmit}
      confirm={{ title: 'Create account?' }}
    >
      <Stack spacing={3} sx={{ width: 480 }}>
        <Wizard {...args}>
          <StepsContent />
          <SubmitButton />
        </Wizard>
      </Stack>
    </Form>
  ),
}

/**
 * A step with its own sub-sections: `FormSection` gives each nested legend a deeper heading
 * level automatically (`h3` for the step, `h4` for "Billing contact", `h5` if nested again),
 * so the page keeps a correct heading hierarchy without any `slotProps.legend.component`.
 */
export const PageLayoutNestedSections: Story = {
  args: { layout: 'page' },
  render: (args) => (
    <Form
      schema={schema}
      defaultValues={emptyValues}
      onSubmit={onSubmit}
      confirm={{ title: 'Create account?' }}
    >
      <Stack spacing={3} sx={{ width: 480 }}>
        <Wizard {...args}>
          <WizardStep id="account">
            <Stack spacing={2}>
              <TextField name="name" label="Name" required />
              <FormSection title="Billing contact" description="Who we email invoices to">
                <TextField name="email" label="Email" required />
              </FormSection>
            </Stack>
          </WizardStep>
          <WizardStep id="plan">
            <Stack spacing={2}>
              <Select name="plan" label="Plan" options={plans} required />
              <NumberField name="seats" label="Seats" min={1} />
            </Stack>
          </WizardStep>
          <WizardStep id="review">
            <Stack spacing={2}>
              <ReadOnlyField name="name" editStep="account" />
              <ReadOnlyField name="email" editStep="account" />
              <ReadOnlyField name="plan" options={plans} editStep="plan" />
              <ReadOnlyField name="seats" editStep="plan" />
              <Checkbox name="tos" label="I accept the terms" required />
            </Stack>
          </WizardStep>
          <SubmitButton />
        </Wizard>
      </Stack>
    </Form>
  ),
}

/** Values and visited steps survive a reload through localStorage; clear storage to start over. */
export const Resume: Story = {
  render: (args) => {
    const key = 'ez-form:wizard-resume'
    const saved = (() => {
      try {
        return JSON.parse(localStorage.getItem(key) ?? 'null') as {
          values: Partial<Input>
          visited: string[]
          step: string
        } | null
      } catch {
        return null
      }
    })()
    const [step, setStep] = useState(saved?.step ?? 'account')
    const [visited, setVisited] = useState<readonly string[]>(saved?.visited ?? ['account'])
    const [values, setValues] = useState<Partial<Input>>(saved?.values ?? emptyValues)
    useEffect(() => {
      localStorage.setItem(key, JSON.stringify({ values, visited, step }))
    }, [values, visited, step])
    return (
      <Form
        schema={schema}
        defaultValues={values}
        onSubmit={(v, form) => {
          onSubmit(v)
          localStorage.removeItem(key)
          form.reset(emptyValues)
        }}
      >
        <Stack spacing={3} sx={{ width: 480 }}>
          <Typography variant="body2" color="text.secondary">
            Reload the page: you land back on &ldquo;{step}&rdquo;.
          </Typography>
          <WatchValues onValues={setValues} />
          <Wizard
            {...args}
            step={step}
            onStepChange={(s) => setStep(s.id)}
            visited={visited}
            onVisitedChange={setVisited}
          >
            <WizardStepper />
            <StepsContent />
            <WizardNav submitLabel="Create account" />
          </Wizard>
        </Stack>
      </Form>
    )
  },
}
