import type { Meta, StoryObj } from '@storybook/react-vite'
import Stack from '@mui/material/Stack'
import { z } from 'zod'
import { ClearButton } from './ClearButton'
import { TextField } from '../fields/TextField'
import { NumberField } from '../fields/NumberField'
import { Checkbox } from '../fields/Checkbox'
import type { FormParameters } from '../../.storybook/preview'

const schema = z.object({ name: z.string(), seats: z.number().nullable(), tos: z.boolean() })

const meta = {
  title: 'ClearButton',
  component: ClearButton,
  parameters: {
    layout: 'centered',
    form: { schema, defaultValues: { name: 'Ada', seats: 2, tos: true } },
  } satisfies FormParameters & Record<string, unknown>,
  render: (args) => (
    <Stack spacing={2}>
      <TextField name="name" label="Name" />
      <NumberField name="seats" label="Seats" />
      <Checkbox name="tos" label="Accept terms" />
      <ClearButton {...args} />
    </Stack>
  ),
} satisfies Meta<typeof ClearButton>
export default meta
type Story = StoryObj<typeof meta>

export const ToDefaults: Story = {}
export const ToEmpty: Story = { args: { to: 'empty' } }
export const WithConfirm: Story = { args: { confirm: true } }
