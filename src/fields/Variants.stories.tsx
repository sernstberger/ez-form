import type { ReactElement, ReactNode } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { createTheme, ThemeProvider } from '@mui/material/styles'
import { z } from 'zod'
import { Form } from '../Form'
import { createEzFormTheme } from '../theme/ezFormTheme'
import { TextField } from './TextField'
import { NumberField } from './NumberField'
import { MoneyField } from './MoneyField'
import { PercentField } from './PercentField'
import { Select } from './Select'
import { StateSelect } from './StateSelect'
import { Autocomplete } from './Autocomplete'
import { EmailField } from './EmailField'
import { EmailListField } from './EmailListField'
import { PhoneField } from './PhoneField'
import { SsnField } from './SsnField'
import { FeinField } from './FeinField'
import { ZipField } from './ZipField'
import { TextareaField } from './TextareaField'
import { PasswordField } from './PasswordField'
import { DateField } from './DateField'
import { DatePicker } from './DatePicker'
import { TimePicker } from './TimePicker'
import { DateTimePicker } from './DateTimePicker'
import type { EzTextFieldVariants } from './textFieldVariants'

/**
 * `variant` accepts MUI's three plus `'stacked'`; under `createEzFormTheme()` `stacked`
 * is the default; add your own with `declare module '@mui/material/TextField' {
 * interface TextFieldPropsVariantOverrides { dashed: true } }`.
 *
 * Every input with an input box takes it as a **top-level prop** — the whole grid below
 * sets it that way, one column per variant and one row per field, so the four looks can
 * be compared across all nineteen families at once. `AllInputs` renders under
 * `createEzFormTheme()` (where `stacked` is the house style: static label, no float, no
 * notch); `StockTheme` renders the identical grid under a stock `createTheme()`, where
 * `stacked` is only a variant MUI does not know and falls back to its outlined box.
 *
 * No `dashed` augmentation is declared in `src/`: a module augmentation is global, so a
 * demo one would leak into every file in the library.
 */

/** The four columns. `stacked` first because it is the preset's default. */
const variants = ['stacked', 'outlined', 'standard', 'filled'] as const

/** One row per box input, in the order the README's component table lists them. */
const rows = [
  ['TextField', 'text', (n, v) => <TextField name={n} label="TextField" variant={v} />],
  ['NumberField', 'num', (n, v) => <NumberField name={n} label="NumberField" variant={v} />],
  ['MoneyField', 'num', (n, v) => <MoneyField name={n} label="MoneyField" variant={v} />],
  ['PercentField', 'num', (n, v) => <PercentField name={n} label="PercentField" variant={v} />],
  [
    'Select',
    'text',
    (n, v) => (
      <Select
        name={n}
        label="Select"
        variant={v}
        options={[
          { value: 'free', label: 'Free' },
          { value: 'pro', label: 'Pro' },
        ]}
      />
    ),
  ],
  ['StateSelect', 'text', (n, v) => <StateSelect name={n} label="StateSelect" variant={v} />],
  [
    'Autocomplete',
    'text',
    (n, v) => (
      <Autocomplete
        name={n}
        label="Autocomplete"
        variant={v}
        options={[
          { value: 'ada', label: 'Ada' },
          { value: 'grace', label: 'Grace' },
        ]}
      />
    ),
  ],
  ['EmailField', 'text', (n, v) => <EmailField name={n} label="EmailField" variant={v} />],
  [
    'EmailListField',
    'list',
    (n, v) => <EmailListField name={n} label="EmailListField" variant={v} />,
  ],
  ['PhoneField', 'text', (n, v) => <PhoneField name={n} label="PhoneField" variant={v} />],
  ['SsnField', 'text', (n, v) => <SsnField name={n} label="SsnField" variant={v} />],
  ['FeinField', 'text', (n, v) => <FeinField name={n} label="FeinField" variant={v} />],
  ['ZipField', 'text', (n, v) => <ZipField name={n} label="ZipField" variant={v} />],
  ['TextareaField', 'text', (n, v) => <TextareaField name={n} label="TextareaField" variant={v} />],
  ['PasswordField', 'text', (n, v) => <PasswordField name={n} label="PasswordField" variant={v} />],
  ['DateField', 'date', (n, v) => <DateField name={n} label="DateField" variant={v} />],
  ['DatePicker', 'date', (n, v) => <DatePicker name={n} label="DatePicker" variant={v} />],
  ['TimePicker', 'date', (n, v) => <TimePicker name={n} label="TimePicker" variant={v} />],
  [
    'DateTimePicker',
    'date',
    (n, v) => <DateTimePicker name={n} label="DateTimePicker" variant={v} />,
  ],
] as const satisfies readonly (readonly [
  string,
  'text' | 'num' | 'list' | 'date',
  (name: string, variant: EzTextFieldVariants) => ReactElement,
])[]

/**
 * `${field}_${variant}` — 19 × 4 = 76 distinct names, generated rather than written out.
 * Every cell binds into the same RHF form, and a shared name means shared registration:
 * four cells on one name would fight over one value instead of showing four variants.
 */
const fieldName = (field: string, variant: string) => `${field}_${variant}`

/** The value shape each row's family stores, so the schema and defaults follow the row. */
const valueTypes = {
  text: [z.string().optional(), ''],
  num: [z.number().nullable().optional(), null],
  list: [z.array(z.string()).optional(), []],
  date: [z.date().nullable().optional(), null],
} satisfies Record<string, readonly [z.ZodType, unknown]>

const entries = rows.flatMap(([field, kind]) =>
  variants.map((variant) => [fieldName(field, variant), kind] as const),
)

const schema = z.object(
  Object.fromEntries(entries.map(([name, kind]) => [name, valueTypes[kind][0]])),
)

const defaultValues = Object.fromEntries(entries.map(([name, kind]) => [name, valueTypes[kind][1]]))

const onSubmit = fn()

/**
 * The grid. Stories may style freely (PHILOSOPHY rule 2); `src/` may not.
 *
 * `minmax(0, 1fr)` rather than `1fr`: a grid track's default `min-width: auto` is the
 * content's intrinsic size, and an `Autocomplete` or a `DateTimePicker` is wide enough
 * to blow the four columns past the viewport without it.
 */
function VariantGrid() {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: `10rem repeat(${variants.length}, minmax(0, 1fr))`,
        columnGap: 2,
        rowGap: 3,
        alignItems: 'start',
      }}
    >
      <Box />
      {variants.map((variant) => (
        <Typography key={variant} variant="subtitle2" component="h3">
          {variant}
          {variant === 'stacked' ? ' (preset default)' : ''}
        </Typography>
      ))}
      {rows.map(([field, , renderCell]) => (
        <Box key={field} sx={{ display: 'contents' }}>
          <Typography variant="body2" sx={{ pt: 1, fontFamily: 'monospace' }}>
            {field}
          </Typography>
          {variants.map((variant) => (
            <Box key={variant}>{renderCell(fieldName(field, variant), variant)}</Box>
          ))}
        </Box>
      ))}
    </Box>
  )
}

/**
 * One `<Form>` over all 76 names, wrapped in the theme the story is demonstrating.
 *
 * These stories own their own `<Form>` — no `parameters.form` on the meta at all — for
 * two reasons: the preview decorator's wrapper is 360px wide and this page needs the
 * full viewport for four columns, and each story pins its own theme so the comparison
 * survives whatever the Theme toolbar is set to (the same reason
 * `LabelPlacement.stories.tsx` wraps its sections).
 */
function VariantPage({
  theme,
  title,
}: {
  theme: Parameters<typeof ThemeProvider>[0]['theme']
  title: ReactNode
}) {
  return (
    <ThemeProvider theme={theme}>
      <Stack spacing={2}>
        <Typography variant="h6" component="h2">
          {title}
        </Typography>
        <Form schema={schema} defaultValues={defaultValues} onSubmit={onSubmit}>
          <VariantGrid />
        </Form>
      </Stack>
    </ThemeProvider>
  )
}

// Built once: a theme is a large immutable object and a story re-renders.
const presetTheme = createEzFormTheme()
const stockTheme = createTheme()

const meta = {
  title: 'Fields/Variants',
  component: VariantPage,
  parameters: {
    viewport: {
      options: {
        wide: { name: 'Wide', styles: { width: '1600px', height: '1400px' }, type: 'desktop' },
      },
    },
  },
  globals: { viewport: { value: 'wide', isRotated: false } },
} satisfies Meta<typeof VariantPage>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Every box input, every variant, under `createEzFormTheme()`.
 *
 * `stacked` is the preset's default, so the first column is what a field with no
 * `variant` prop at all renders as: label above the box, no float, no notch. The other
 * three are MUI's own, reached per field — that is the opt-out.
 */
export const AllInputs: Story = {
  args: { theme: presetTheme, title: 'createEzFormTheme() — stacked is the default' },
}

/**
 * The identical grid under a stock `createTheme()`, so the preset's contribution is
 * visible as the difference between the two pages.
 *
 * `stacked` here is only a variant MUI does not know: the shim renders it as
 * `OutlinedInput` with the notch permanently closed and MUI's own floating label, which
 * is what a consumer who augments `TextFieldPropsVariantOverrides` and writes no theme
 * rules gets. The three built-ins are unchanged — the shim never touches them.
 */
export const StockTheme: Story = {
  args: {
    theme: stockTheme,
    title: 'stock createTheme() — stacked falls back to the outlined box',
  },
}
