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

const theme = createTheme()

/**
 * Story parameters understood by the Form decorator below. Field stories set
 * `parameters.form` at meta level (and override it per story where the schema differs);
 * stories that render their own `<Form>` — `Form.stories.tsx` — leave it unset. Extends
 * Storybook's own `Parameters` (rather than just declaring `form`) so a story's
 * `parameters` object can also carry Storybook's own keys — `docs.description.component`,
 * for one — under a single `satisfies FormParameters`, with no per-key narrowing.
 */
export interface FormParameters extends Parameters {
  form?: {
    schema: z.ZodType
    defaultValues: Record<string, unknown>
  }
}

const onSubmit = fn()

const preview: Preview = {
  decorators: [
    (Story, { parameters }) => {
      const form = (parameters as FormParameters).form
      if (!form) return <Story />
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
    (Story) => (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <Story />
        </LocalizationProvider>
      </ThemeProvider>
    ),
  ],
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
