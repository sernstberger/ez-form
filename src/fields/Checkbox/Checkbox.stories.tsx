import type { Meta, StoryObj } from '@storybook/react-vite'
import Stack from '@mui/material/Stack'
import { z } from 'zod'
import type { FormParameters } from '../../../.storybook/preview'
import { Checkbox } from './Checkbox'

const schema = z.object({
  tos: z.boolean().refine(Boolean, { error: 'You must accept the terms' }),
})

const meta = {
  title: 'Fields/Checkbox',
  component: Checkbox,
  args: { name: 'tos', label: 'I accept the terms' },
  parameters: {
    form: { schema, defaultValues: { tos: false } },
    docs: {
      description: {
        component:
          'A yes/no answer or opt-in recorded when the form is submitted — "I accept the terms", "Same as shipping", "Insure a vehicle" — or one of several independent options (`CheckboxGroup`). If the page has a Submit button, this is almost always the right control; see README "Checkbox vs Switch" for the full rule. Prefer `Switch` only for a setting that takes effect immediately, with no submit step.',
      },
    },
  } satisfies FormParameters,
} satisfies Meta<typeof Checkbox>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const WithHelperText: Story = { args: { helperText: 'Required to continue' } }
export const Required: Story = { args: { required: true } }
export const Disabled: Story = { args: { disabled: true } }

/**
 * MUI's own `FormControlLabel.labelPlacement` (#139): where the label sits relative to the
 * box. `'end'` is MUI's default and the one you get by leaving the prop off; the other three
 * are here so the four can be compared side by side.
 *
 * Not to be confused with `<Form labelPlacement>`, which is a different axis for a different
 * shape of field — a `Checkbox` puts its label inside the click target, so it opts out of
 * that one entirely (`fieldLayoutClasses.selfLabelled`, #133).
 */
export const LabelPlacement: Story = {
  parameters: {
    form: {
      schema: z.object({
        end: z.boolean(),
        start: z.boolean(),
        top: z.boolean(),
        bottom: z.boolean(),
      }),
      defaultValues: { end: false, start: false, top: false, bottom: false },
    },
  } satisfies FormParameters,
  render: () => (
    // Stories may style (PHILOSOPHY rule 2); `src/` may not.
    <Stack direction="row" spacing={4} sx={{ alignItems: 'flex-start' }}>
      {(['end', 'start', 'top', 'bottom'] as const).map((placement) => (
        <Checkbox
          key={placement}
          name={placement}
          label={`labelPlacement="${placement}"`}
          labelPlacement={placement}
        />
      ))}
    </Stack>
  ),
}
