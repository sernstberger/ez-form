import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { createTheme, ThemeProvider } from '@mui/material/styles'
import { z } from 'zod'
import { Form } from '../Form'
import { SubmitButton } from '../SubmitButton'
import { TextField } from './TextField'
import { Select } from './Select'
import { Checkbox } from './Checkbox'
import { RadioGroup } from './RadioGroup'
import { NumberField } from './NumberField'
import type { LabelPlacement } from './LabelPlacementContext'

/**
 * `labelPlacement` (#9, #66) is its own axis, orthogonal to MUI's `variant`:
 * `variant` picks the *box* (outlined, filled, standard), `labelPlacement` picks
 * where the label sits relative to it. MUI's `TextFieldVariants` is a closed union
 * with no augmentation interface, so a fourth variant would not even typecheck —
 * and placement is a different question from box style anyway.
 *
 * Set it once on `<Form>` (or in `theme.components.EzForm.defaultProps`, which
 * flips a whole app); a single row that must differ passes its own prop.
 * `createEzFormTheme()` defaults to `'stacked'`.
 */
const schema = z.object({
  email: z.string().min(1, 'Email is required'),
  plan: z.string(),
  seats: z.number().nullable(),
  billing: z.string(),
  newsletter: z.boolean(),
})

const defaultValues = {
  email: '',
  plan: '',
  seats: null,
  billing: 'monthly',
  newsletter: false,
}

const onSubmit = fn()

/** One representative from each family, so a placement can be judged on real rows. */
function SettingsFields() {
  return (
    <>
      <TextField name="email" label="Email address" helperText="Where receipts are sent" />
      <Select
        name="plan"
        label="Plan"
        options={[
          { value: 'free', label: 'Free' },
          { value: 'pro', label: 'Pro' },
        ]}
      />
      <NumberField name="seats" label="Seats" min={1} />
      <RadioGroup
        name="billing"
        label="Billing period"
        options={[
          { value: 'monthly', label: 'Monthly' },
          { value: 'yearly', label: 'Yearly' },
        ]}
      />
      <Checkbox name="newsletter" label="Send me product news" />
    </>
  )
}

function PlacementForm({
  labelPlacement,
  ...formProps
}: { labelPlacement?: LabelPlacement } & Record<string, unknown>) {
  return (
    <Form
      schema={schema}
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      labelPlacement={labelPlacement}
      {...formProps}
    >
      {/* Stories may style freely (PHILOSOPHY rule 2); `src/` may not. */}
      <Stack spacing={2} sx={{ maxWidth: 560 }}>
        <SettingsFields />
        <SubmitButton />
      </Stack>
    </Form>
  )
}

const meta = {
  title: 'Fields/Label placement',
  component: PlacementForm,
  // No `parameters.form`: these stories own their own `<Form>` so each can set a
  // different `labelPlacement` on it.
  parameters: {
    viewport: {
      options: {
        desktop: { name: 'Desktop', styles: { width: '1024px', height: '900px' }, type: 'desktop' },
        // Under `sm` (600px), which is where `start` falls back to `stacked`.
        mobile: { name: 'Mobile', styles: { width: '390px', height: '844px' }, type: 'mobile' },
      },
    },
  },
  globals: { viewport: { value: 'desktop', isRotated: false } },
} satisfies Meta<typeof PlacementForm>

export default meta
type Story = StoryObj<typeof meta>

/** MUI's own: the label floats over the input and notches the outline on focus or fill. */
export const Floating: Story = {
  args: { labelPlacement: 'floating' },
}

/**
 * The label above the control, in normal flow: no motion, no notch, helper text
 * flush left. `createEzFormTheme()`'s default, and DESIGN.md's house style.
 */
export const Stacked: Story = {
  args: { labelPlacement: 'stacked' },
}

/**
 * The settings-form layout: a label column beside the control.
 *
 * **Switch the viewport toolbar to Mobile** — below `theme.breakpoints.down('sm')`
 * the label column disappears and the fields stack, because a 390px phone has no
 * room for two columns. The breakpoint is `labelPlacementBreakpoint` and the
 * column width is `labelWidth`.
 */
export const Start: Story = {
  args: { labelPlacement: 'start' },
}

/** A wider label column, for longer labels. */
export const StartWideLabels: Story = {
  args: { labelPlacement: 'start', labelWidth: '18rem' },
}

/** Columns kept down to `md` (900px) instead of `sm`. Try both viewports. */
export const StartCollapsingAtMd: Story = {
  args: { labelPlacement: 'start', labelPlacementBreakpoint: 'md' },
}

/**
 * The escape hatch: the form says `start`, one row says otherwise. Rare — placement
 * is a form-wide convention — but a field whose control is unusually wide sometimes
 * needs the whole width.
 */
export const PerFieldOverride: Story = {
  render: () => (
    <Form schema={schema} defaultValues={defaultValues} onSubmit={onSubmit} labelPlacement="start">
      <Stack spacing={2} sx={{ maxWidth: 560 }}>
        <TextField name="email" label="Email address" helperText="Follows the form: start" />
        <TextField
          name="plan"
          label="Plan"
          labelPlacement="stacked"
          helperText="Overrides it: stacked"
        />
        <SubmitButton />
      </Stack>
    </Form>
  ),
}

/**
 * `theme.components.EzForm.defaultProps.labelPlacement` — one line that flips every
 * form in an app, with no per-form and no per-field props. This is how a consumer
 * adopts a placement, and how `createEzFormTheme()` sets `stacked`.
 */
export const ViaThemeDefaultProps: Story = {
  render: () => (
    <ThemeProvider
      theme={createTheme({ components: { EzForm: { defaultProps: { labelPlacement: 'start' } } } })}
    >
      <Stack spacing={2}>
        <Typography variant="body2">
          Neither the form nor any field sets <code>labelPlacement</code>; the theme does.
        </Typography>
        <PlacementForm />
      </Stack>
    </ThemeProvider>
  ),
}

/**
 * The three side by side, so the axis is one glance rather than three clicks.
 * Every one of these fields is programmatically labelled the same way — the markup
 * is identical and only the CSS differs, which is what keeps `getByLabelText`,
 * `aria-describedby` and the required marker working under all three.
 */
export const AllThree: Story = {
  render: () => (
    <Stack spacing={4}>
      {(['floating', 'stacked', 'start'] as const).map((placement) => (
        <Stack key={placement} spacing={1}>
          <Typography variant="h6">{placement}</Typography>
          <PlacementForm labelPlacement={placement} />
        </Stack>
      ))}
    </Stack>
  ),
}
