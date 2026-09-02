import Stack from '@mui/material/Stack'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { z } from 'zod'
import type { FormParameters } from '../../.storybook/preview'
import { Form } from '../Form'
import { SubmitButton } from '../SubmitButton'
import { TextField } from '../fields/TextField'
import { FormSection } from './FormSection'

const schema = z.object({
  street: z.string(),
  city: z.string(),
  cardNumber: z.string(),
  expiry: z.string(),
})

const meta = {
  title: 'FormSection',
  component: FormSection,
  args: { title: 'Address', description: 'Where we ship your order' },
  parameters: {
    form: {
      schema,
      defaultValues: { street: '', city: '', cardNumber: '', expiry: '' },
    },
  } satisfies FormParameters,
} satisfies Meta<typeof FormSection>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => (
    <FormSection {...args}>
      <Stack spacing={2}>
        <TextField name="street" label="Street" />
        <TextField name="city" label="City" />
      </Stack>
    </FormSection>
  ),
}

export const Disabled: Story = {
  args: { disabled: true },
  render: (args) => (
    <FormSection {...args}>
      <Stack spacing={2}>
        <TextField name="street" label="Street" />
        <TextField name="city" label="City" />
      </Stack>
    </FormSection>
  ),
}

// Renders its own `<Form title>`: the `FormParameters` decorator has no way to
// set a Form-level title, and this story is specifically about two sections
// living inside a titled form.
export const TwoSections: Story = {
  render: () => (
    <Form
      schema={schema}
      defaultValues={{ street: '', city: '', cardNumber: '', expiry: '' }}
      onSubmit={fn()}
      title="Checkout"
    >
      <Stack spacing={3}>
        <FormSection title="Address" description="Where we ship your order">
          <Stack spacing={2}>
            <TextField name="street" label="Street" />
            <TextField name="city" label="City" />
          </Stack>
        </FormSection>
        <FormSection title="Payment" description="Billed at checkout">
          <Stack spacing={2}>
            <TextField name="cardNumber" label="Card number" />
            <TextField name="expiry" label="Expiry" />
          </Stack>
        </FormSection>
        <SubmitButton />
      </Stack>
    </Form>
  ),
}
