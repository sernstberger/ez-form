import type { Meta, StoryObj } from '@storybook/react-vite'
import { createTheme, ThemeProvider } from '@mui/material/styles'
import { z } from 'zod'
import type { FormParameters } from '../../../.storybook/preview'
import { TextareaField } from './TextareaField'

const schema = z.object({ bio: z.string() })

const meta = {
  title: 'Fields/TextareaField',
  component: TextareaField,
  args: { name: 'bio', label: 'Bio' },
  parameters: { form: { schema, defaultValues: { bio: '' } } } satisfies FormParameters,
} satisfies Meta<typeof TextareaField>

export default meta
type Story = StoryObj<typeof meta>

/** `multiline` fixed on, with the taller default: `minRows: 4`, `maxRows: 12`, autogrowing in between. */
export const Default: Story = {}

const maxSchema = z.object({ bio: z.string().max(500) })

/** The length meter (`n / max`) tracks the `maxLength` rule and turns into the validation error past it. */
export const WithMax: Story = {
  parameters: { form: { schema: maxSchema, defaultValues: { bio: '' } } },
  args: { maxLength: 500, helperText: 'Tell us about yourself' },
}

/** `theme.components.EzTextareaField.defaultProps.minRows` raises the default height. */
export const Themed: Story = {
  decorators: [
    (Story) => (
      <ThemeProvider
        theme={createTheme({ components: { EzTextareaField: { defaultProps: { minRows: 6 } } } })}
      >
        <Story />
      </ThemeProvider>
    ),
  ],
}
