import type { ReactNode } from 'react'
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
import { FileField } from './FileField'
import { createEzFormTheme } from '../theme/ezFormTheme'
import type { LabelPlacement } from './LabelPlacementContext'

/**
 * `labelPlacement` (#9, #66, #139) takes MUI's own vocabulary — `'top' | 'start'`,
 * from `FormControlLabel` — and says only *where* the label sits. It is orthogonal
 * to MUI's `variant`, which picks the *box* (outlined, filled, standard); MUI's
 * `TextFieldVariants` is a closed union with no augmentation interface, so a fourth
 * variant would not even typecheck, and placement is a different question anyway.
 *
 * **Whether a `top` label floats is the theme's, not this prop's.** That is
 * `InputLabel`'s `shrink` / `disableAnimation` plus `OutlinedInput`'s `notched`,
 * exactly as in vanilla MUI: the `Top` story below shows the same form under stock
 * `createTheme()` (floating) and under `createEzFormTheme()` (static). `top` itself
 * emits no CSS at all.
 *
 * Set it once on `<Form>` (or in `theme.components.EzForm.defaultProps`, which
 * flips a whole app); a single row that must differ passes its own prop.
 */
const schema = z.object({
  email: z.string().min(1, 'Email is required'),
  plan: z.string(),
  seats: z.number().nullable(),
  billing: z.string(),
  newsletter: z.boolean(),
  logo: z.instanceof(File).nullable(),
})

const defaultValues = {
  email: '',
  plan: '',
  seats: null,
  billing: 'monthly',
  newsletter: false,
  logo: null,
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
      {/* Self-labelled like the checkbox: the button is the label, so under `start`
          it sits flush left rather than beside an empty label column (#133). */}
      <FileField name="logo" label="Company logo" accept="image/*" />
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

/**
 * Pins one section to a stock `createTheme()`, whatever the Theme toolbar says.
 *
 * This is what makes the float visible at all. The preset the toolbar defaults to
 * (`createEzFormTheme()`, see `DESIGN.md`) ships `MuiInputLabel: { shrink,
 * disableAnimation }` and `MuiOutlinedInput: { notched: false }` theme-wide — that
 * *is* the static-label look, and it reaches a consumer's own bare `<MuiTextField>`
 * outside any `<Form>` too. Under it a `top` field has no label to float and no
 * notch to open, so without this wrapper the two halves of the `Top` story would
 * render identically and the comparison would document nothing (#131, #139).
 *
 * A provider inside the story rather than a `parameters.theme` opt-out in the preview:
 * the preview picks the theme from the `theme` **toolbar global**, which every other
 * story in the repo obeys, and a competing story-level parameter would mean the toolbar
 * silently does not apply to some stories. Wrapping one section is ordinary story
 * styling, which PHILOSOPHY rule 2 permits (`src/` may not style; stories may).
 */
function StockTheme({ children }: { children: ReactNode }) {
  return <ThemeProvider theme={stockTheme}>{children}</ThemeProvider>
}

// Built once: a theme is a large immutable object and a story re-renders.
const stockTheme = createTheme()
const presetTheme = createEzFormTheme()

const meta = {
  title: 'Fields/Label placement',
  component: PlacementForm,
  // No `parameters.form`: these stories own their own `<Form>` so each can set a
  // different `labelPlacement` on it.
  parameters: {
    viewport: {
      options: {
        desktop: { name: 'Desktop', styles: { width: '1024px', height: '900px' }, type: 'desktop' },
        // Under `sm` (600px), which is where `start` falls back to `top`.
        mobile: { name: 'Mobile', styles: { width: '390px', height: '844px' }, type: 'mobile' },
      },
    },
  },
  globals: { viewport: { value: 'desktop', isRotated: false } },
} satisfies Meta<typeof PlacementForm>

export default meta
type Story = StoryObj<typeof meta>

/**
 * `top` — the label above the control, which is MUI's own arrangement and the
 * default. The placement itself emits **no CSS**; the same form is rendered twice
 * here to show that whether the label floats is entirely the theme's (#139).
 *
 * - **Stock `createTheme()`**: the label floats over the input and notches the
 *   outline on focus or fill. MUI untouched.
 * - **`createEzFormTheme()`**: the label stands still above the input, no motion,
 *   no notch, helper text flush left — DESIGN.md's house style, reached through
 *   `MuiInputLabel: { shrink, disableAnimation }` and `MuiOutlinedInput: { notched:
 *   false }`. Three theme lines, the same three a vanilla MUI consumer writes.
 *
 * Both sections pin their own theme so the contrast survives whatever the Theme
 * toolbar is set to.
 */
export const Top: Story = {
  args: { labelPlacement: 'top' },
  render: (args) => (
    <Stack spacing={4}>
      <Stack spacing={1}>
        <Typography variant="h6">top, stock createTheme() — the label floats</Typography>
        <StockTheme>
          <PlacementForm {...args} />
        </StockTheme>
      </Stack>
      <Stack spacing={1}>
        <Typography variant="h6">top, createEzFormTheme() — the label is static</Typography>
        <ThemeProvider theme={presetTheme}>
          <PlacementForm {...args} />
        </ThemeProvider>
      </Stack>
    </Stack>
  ),
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
        <TextField name="plan" label="Plan" labelPlacement="top" helperText="Overrides it: top" />
        <SubmitButton />
      </Stack>
    </Form>
  ),
}

/**
 * `theme.components.EzForm.defaultProps.labelPlacement` — one line that flips every
 * form in an app, with no per-form and no per-field props. This is how a consumer
 * adopts a placement. `createEzFormTheme()` deliberately sets none: its opinion is
 * that labels are *static*, which is `MuiInputLabel`'s business, not this axis's.
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
 * Both placements side by side, so the axis is one glance rather than two clicks.
 * Every one of these fields is programmatically labelled the same way — the markup
 * is identical and only the CSS differs, which is what keeps `getByLabelText`,
 * `aria-describedby` and the required marker working under either.
 *
 * Left on whatever the Theme toolbar selects, deliberately: floating-vs-static is
 * the theme's question and `Top` above is where it is shown. What this story is for
 * is the *placement* difference, which is the same under either theme.
 *
 * Two sibling `<form>`s — one per placement, none nested inside another.
 */
export const Both: Story = {
  render: () => (
    <Stack spacing={4}>
      {(['top', 'start'] as const).map((placement) => (
        <Stack key={placement} spacing={1}>
          <Typography variant="h6">{placement}</Typography>
          <PlacementForm labelPlacement={placement} />
        </Stack>
      ))}
    </Stack>
  ),
}
