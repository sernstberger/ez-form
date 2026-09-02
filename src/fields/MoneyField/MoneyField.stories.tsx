import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import Stack from '@mui/material/Stack'
import { z } from 'zod'
import { Form } from '../../Form'
import { SubmitButton } from '../../SubmitButton'
import { MoneyField } from './MoneyField'

const schema = z.object({ price: z.number().min(0) })

const onSubmit = fn()

/**
 * One <Form> per story: the meta decorator reads the schema and defaults from
 * `parameters.form`, so stories never add a second (nested) Form decorator.
 */
const meta = {
  title: 'Fields/MoneyField',
  component: MoneyField,
  args: { name: 'price', label: 'Price' },
  parameters: { form: { schema, defaultValues: { price: 19.99 } } },
  decorators: [
    (Story, { parameters }) => (
      <Form
        schema={parameters.form.schema}
        defaultValues={parameters.form.defaultValues}
        onSubmit={onSubmit}
      >
        <Stack spacing={2} sx={{ width: 360 }}>
          <Story />
          <SubmitButton />
        </Stack>
      </Form>
    ),
  ],
} satisfies Meta<typeof MoneyField>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Required: Story = {
  parameters: { form: { schema, defaultValues: {} } },
  args: { required: true },
}
export const MinMax: Story = {
  args: { min: 0, max: 10000, helperText: '$0 to $10,000' },
}
