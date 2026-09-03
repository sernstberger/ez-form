import type { Parameters, Preview } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import CssBaseline from '@mui/material/CssBaseline'
import Stack from '@mui/material/Stack'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import type { z } from 'zod'
import { Form } from '../src/Form'
import { SubmitButton } from '../src/SubmitButton'
import { createEzFormTheme } from '../src/theme/ezFormTheme'

/**
 * The "Theme" toolbar toggle. `modern` is `createEzFormTheme()` — the opt-in
 * taste in `src/theme/ezFormTheme.ts` / `DESIGN.md`; `modernDark` is the same
 * theme with its dark colour scheme as the default; `stockMui` is MUI's plain
 * `createTheme()`, which is what a consumer who never opts in sees. Built once
 * each: a theme is a big immutable object and the decorator runs per story.
 */
const themes = {
  // Each pinned to one scheme: an unpinned `createEzFormTheme()` follows the OS,
  // and a toolbar item that changed with the machine's setting would be no toggle.
  modern: createEzFormTheme({ defaultColorScheme: 'light' }),
  modernDark: createEzFormTheme({ defaultColorScheme: 'dark' }),
  stockMui: createTheme(),
}
type ThemeChoice = keyof typeof themes

/**
 * Story parameters understood by the Form decorator below. Field stories set
 * `parameters.form` at meta level; stories that render their own `<Form>` —
 * `Form.stories.tsx` — leave it unset. Extends Storybook's own `Parameters` (rather than
 * just declaring `form`) so a story's `parameters` object can also carry Storybook's own
 * keys — `docs.description.story`, for one — under a single `satisfies FormParameters`,
 * with no per-key narrowing.
 *
 * **Per-story overrides** follow Storybook's parameter inheritance (project → meta → story,
 * plain objects deep-merged, everything else replaced by the more specific level), which is
 * why both keys are optional here — a story states only what differs:
 *
 * - `schema` is a zod instance, not a plain object, so a story's schema **replaces** the
 *   meta's whole. It is still required once the merge is done: a meta that sets `form`
 *   without a `schema` fails the story with an explicit error rather than a blank form.
 * - `defaultValues` is a plain object, so a story's defaults are **deep-merged** over the
 *   meta's: `{ rate: null }` overrides `rate` and keeps every other meta default. A key
 *   cannot be unset from a story (`undefined` is skipped by the merge); a story whose schema
 *   has a different shape inherits the meta's defaults for the old keys, which a non-strict
 *   `z.object` strips on submit. Arrays and class instances (`Date`) replace whole.
 *
 * See `PercentField.stories.tsx` for defaults-only overrides and `Autocomplete.stories.tsx`
 * for schema swaps; `PercentField.stories.test.tsx` pins the merge.
 */
export interface FormParameters extends Parameters {
  form?: {
    /** Required on the meta; a story sets it only to swap the schema (replaced whole). */
    schema?: z.ZodType
    /** Deep-merged over the meta's by Storybook: a story states only the keys that differ. */
    defaultValues?: Record<string, unknown>
  }
}

const onSubmit = fn()

const preview: Preview = {
  decorators: [
    (Story, { parameters }) => {
      const form = (parameters as FormParameters).form
      if (!form) return <Story />
      if (!form.schema) {
        throw new Error(
          '`parameters.form` is set without a `schema`. Set `form.schema` on the meta; a story overrides only what differs (see FormParameters in .storybook/preview.tsx).',
        )
      }
      // `z.ZodType` keeps the parameter declaration simple in story files; Form wants the
      // schema's output typed as a FieldValues object, which every story schema is.
      const schema = form.schema as z.ZodType<Record<string, unknown>, Record<string, unknown>>
      return (
        <Form schema={schema} defaultValues={form.defaultValues} onSubmit={onSubmit}>
          <Stack spacing={2} sx={{ width: 360 }}>
            <Story />
            <SubmitButton />
          </Stack>
        </Form>
      )
    },
    (Story, { globals }) => {
      const choice = globals.theme as ThemeChoice | undefined
      const theme = themes[choice ?? 'modern'] ?? themes.modern
      return (
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <Story />
          </LocalizationProvider>
        </ThemeProvider>
      )
    },
  ],
  globalTypes: {
    theme: {
      description: 'Theme',
      toolbar: {
        title: 'Theme',
        icon: 'paintbrush',
        items: [
          { value: 'modern', title: 'Modern' },
          { value: 'modernDark', title: 'Modern (dark)' },
          { value: 'stockMui', title: 'Stock MUI' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: 'modern' },
  parameters: {
    controls: { expanded: true },
    options: {
      storySort: {
        order: ['Introduction'],
      },
    },
  },
}

export default preview
