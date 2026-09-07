import { useEffect } from 'react'
import type { Parameters, Preview } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { CacheProvider } from '@emotion/react'
import createCache from '@emotion/cache'
import { prefixer } from 'stylis'
import rtlPlugin from '@mui/stylis-plugin-rtl'
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
 * The "Theme" toolbar toggle, built once per (theme, direction) pair. `modern` is
 * `createEzFormTheme()` — the opt-in taste in `src/theme/ezFormTheme.ts` /
 * `DESIGN.md`; `modernDark` is the same theme with its dark colour scheme as the
 * default; `stockMui` is MUI's plain `createTheme()`, which is what a consumer who
 * never opts in sees. Built eagerly: a theme is a big immutable object and the
 * decorator runs per story.
 *
 * `direction` is baked into the theme rather than layered on top because MUI reads
 * `theme.direction` in component styles (Drawer's anchor, Slide, the Select icon,
 * `TextField`'s adornment spacing), and no provider can retrofit it — the second
 * of MUI's three RTL steps (#108).
 */
const buildThemes = (direction: 'ltr' | 'rtl') => ({
  // Each pinned to one scheme: an unpinned `createEzFormTheme()` follows the OS,
  // and a toolbar item that changed with the machine's setting would be no toggle.
  modern: createEzFormTheme({ defaultColorScheme: 'light', direction }),
  modernDark: createEzFormTheme({ defaultColorScheme: 'dark', direction }),
  stockMui: createTheme({ direction }),
})
const themes = { ltr: buildThemes('ltr'), rtl: buildThemes('rtl') }
type ThemeChoice = keyof (typeof themes)['ltr']
type DirectionChoice = keyof typeof themes

/**
 * The RTL half of MUI's three-step setup (Context7, MUI v9 "Right-to-left support"):
 * `dir` on the document, `direction` on the theme, and a stylis plugin that flips the
 * physical CSS properties MUI still emits — v9 has not moved to logical properties
 * (`marginInlineStart` appears in exactly one component), so without the plugin an RTL
 * theme mirrors the layout while every `margin-left` stays put.
 *
 * Two caches, not one, and both created eagerly: emotion keys its `<style>` tags by
 * `key`, so an LTR and an RTL cache under the same key would overwrite each other's
 * rules. Swapping the `CacheProvider` value swaps which set of tags a story's styles
 * come from.
 *
 * `prefixer` is included explicitly because passing `stylisPlugins` *replaces*
 * emotion's default plugin list rather than extending it; drop it and vendor
 * prefixing disappears along with it.
 *
 * **`stylis` is pinned to 4.2.0 in `package.json`, and must stay pinned.**
 * `@emotion/cache` depends on exactly `stylis@4.2.0`, so a caret range here installs a
 * *second* copy (4.4.0) — this `prefixer` then comes from one copy while the cache's
 * serializer runs the other, and their element objects are not interchangeable. The
 * symptom is not a subtle style bug: every RTL story fails to render with
 * `TypeError: Cannot read properties of undefined (reading 'push')` from stylis's
 * `append`. Verified in the browser, before and after the pin.
 */
const caches = {
  ltr: createCache({ key: 'ez-ltr' }),
  rtl: createCache({ key: 'ez-rtl', stylisPlugins: [prefixer, rtlPlugin] }),
}

/**
 * Step one: `dir` on `<html>`, not on a wrapper element.
 *
 * MUI's own docs call this out — a component rendered through a React portal (every
 * `Select` menu, `Menu`, `Dialog`, `Tooltip` and date picker popper here) mounts into
 * `document.body`, outside whatever the decorator wraps, so it inherits nothing from a
 * `<div dir="rtl">`. Setting it on the document element is the only placement that
 * reaches them. `lang` moves with it: an `<html>` whose text runs right-to-left but
 * still claims `lang="en"` is the sort of mismatch the a11y panel is there to catch,
 * and Arabic is the direction's honest stand-in.
 */
function useDocumentDirection(direction: DirectionChoice) {
  useEffect(() => {
    const root = document.documentElement
    const previousDir = root.getAttribute('dir')
    const previousLang = root.getAttribute('lang')
    root.setAttribute('dir', direction)
    root.setAttribute('lang', direction === 'rtl' ? 'ar' : 'en')
    return () => {
      // Restored rather than left set: the toolbar can switch back, and Storybook's own
      // chrome shares this document in a docs page.
      if (previousDir === null) root.removeAttribute('dir')
      else root.setAttribute('dir', previousDir)
      if (previousLang === null) root.removeAttribute('lang')
      else root.setAttribute('lang', previousLang)
    }
  }, [direction])
}

/**
 * The `<Form>` the decorator below builds for a story that doesn't render its own.
 * Both keys are optional because a story states only what differs from its meta; see
 * `FormParameters` for how the two levels merge.
 */
interface FormConfig {
  /** Required on the meta; a story sets it only to swap the schema (replaced whole). */
  schema?: z.ZodType
  /** Deep-merged over the meta's by Storybook: a story states only the keys that differ. */
  defaultValues?: Record<string, unknown>
}

/**
 * Story parameters understood by the Form decorator below. Field stories set
 * `parameters.form` at meta level; stories that render their own `<Form>` —
 * `Form.stories.tsx` — leave it unset. Extends Storybook's own `Parameters` (rather than
 * just declaring `form`) so a story's `parameters` object can also carry Storybook's own
 * keys — `docs.description.story`, for one — under a single `satisfies FormParameters`,
 * with no per-key narrowing.
 *
 * **Opting a single story out** — a story under a meta that sets `form`, but which renders its
 * own `<Form>` (`Switch`'s `ImmediateEffect`, `FormSection`'s `TwoSections`) — is
 * `parameters: { form: false }`. It **cannot** be `form: undefined`: Storybook's merge
 * documents that "parameters are merged, so keys are only ever overwritten and never dropped",
 * and its `combineParameters` implements that by skipping `undefined` values outright, so
 * `{ form: undefined }` leaves the meta's `form` in place and the decorator wraps the story in a
 * second `<Form>` — a real `<form>` nested in a `<form>`. That silent no-op shipped twice (#120,
 * #128); `false` is a value the merge carries through, and the union below makes `undefined`
 * unable to express an opt-out at all. `src/test/stories.nesting.test.tsx` renders every story in
 * the repo and fails on a second `<form>`, so the next copy of the broken idiom is caught here
 * rather than in a browser console.
 *
 * **Per-story overrides** follow Storybook's parameter inheritance (project → meta → story,
 * plain objects deep-merged, everything else replaced by the more specific level), which is
 * why both `FormConfig` keys are optional — a story states only what differs:
 *
 * - `schema` is a zod instance, not a plain object, so a story's schema **replaces** the
 *   meta's whole. It is still required once the merge is done: a meta that sets `form`
 *   without a `schema` fails the story with an explicit error rather than a blank form.
 * - `defaultValues` is a plain object, so a story's defaults are **deep-merged** over the
 *   meta's: `{ rate: null }` overrides `rate` and keeps every other meta default. A key
 *   cannot be unset from a story (`undefined` is skipped by the merge, as above); a story whose
 *   schema has a different shape inherits the meta's defaults for the old keys, which a
 *   non-strict `z.object` strips on submit. Arrays and class instances (`Date`) replace whole.
 *
 * See `PercentField.stories.tsx` for defaults-only overrides and `Autocomplete.stories.tsx`
 * for schema swaps; `PercentField.stories.test.tsx` pins the merge.
 */
export interface FormParameters extends Parameters {
  form?: FormConfig | false
}

const onSubmit = fn()

const preview: Preview = {
  decorators: [
    (Story, { parameters }) => {
      const form = (parameters as FormParameters).form
      // Two ways to get no wrapper, spelled out rather than collapsed to `!form`: `false` is a
      // story's deliberate opt-out (it renders its own `<Form>`), absent means the meta never
      // asked for one. The comparison is `=== false` so that a future `form: undefined` — which
      // Storybook's merge silently drops, and which therefore never reaches here as an opt-out —
      // cannot be mistaken for one (#128).
      if (form === false || form === undefined) return <Story />
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
      const direction = (globals.direction as DirectionChoice | undefined) ?? 'ltr'
      const dir = themes[direction] ? direction : 'ltr'
      const theme = themes[dir][choice ?? 'modern'] ?? themes[dir].modern
      // A decorator is a component, so a hook is legal here.
      useDocumentDirection(dir)
      return (
        <CacheProvider value={caches[dir]}>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <Story />
            </LocalizationProvider>
          </ThemeProvider>
        </CacheProvider>
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
    /**
     * The "Direction" toggle (#108). RTL had no way to be exercised in the browser at
     * all, so the QA sweep's `direction: 'rtl'` checklist line could only ever be
     * skipped; this makes it one click for every story and every future sweep.
     */
    direction: {
      description: 'Text direction',
      toolbar: {
        title: 'Direction',
        icon: 'transfer',
        items: [
          { value: 'ltr', title: 'LTR' },
          { value: 'rtl', title: 'RTL' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: 'modern', direction: 'ltr' },
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
