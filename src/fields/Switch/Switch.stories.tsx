import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { z } from 'zod'
import type { FormParameters } from '../../../.storybook/preview'
import { Form } from '../../Form'
import { Switch } from './Switch'

const schema = z.object({ darkMode: z.boolean() })

const meta = {
  title: 'Fields/Switch',
  component: Switch,
  args: { name: 'darkMode', label: 'Dark mode' },
  parameters: {
    form: { schema, defaultValues: { darkMode: false } },
    docs: {
      description: {
        component:
          'A setting that takes effect immediately, with no submit step — dark mode, notifications on a settings page that autosaves, a UI mode toggle whose `onChange` does the work. `role="switch"` makes assistive tech announce "on/off", correct here but wrong for an answer only recorded on submit. If the page has a Submit button, use `Checkbox` instead; see README "Checkbox vs Switch" for the full rule.',
      },
    },
  } satisfies FormParameters,
} satisfies Meta<typeof Switch>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const WithHelperText: Story = { args: { helperText: 'Easier on the eyes' } }
export const Required: Story = { args: { required: true } }
export const Disabled: Story = { args: { disabled: true } }

/**
 * The realistic case for `Switch`: no Submit button, no form to save — flipping it takes
 * effect immediately, the way a settings-page toggle would. Contrast with the Checkbox
 * stories' "I accept the terms", which is only recorded once the surrounding form submits.
 */
export const ImmediateEffect: Story = {
  parameters: { form: undefined },
  render: () => {
    const [dark, setDark] = useState(false)
    return (
      <Form schema={z.object({ dark: z.boolean() })} defaultValues={{ dark }} onSubmit={() => {}}>
        <Paper
          variant="outlined"
          sx={{
            p: 2,
            width: 360,
            bgcolor: dark ? 'grey.900' : 'background.paper',
            color: dark ? 'grey.100' : 'text.primary',
          }}
        >
          <Stack spacing={2}>
            <Typography variant="body2">
              This toggle has no Submit button — flipping it changes the preview below immediately,
              the same as a real settings page.
            </Typography>
            <Switch name="dark" label="Dark mode" onChange={(_e, checked) => setDark(checked)} />
          </Stack>
        </Paper>
      </Form>
    )
  },
}
