import type { Meta, StoryObj } from '@storybook/react-vite'
import { z } from 'zod'
import type { FormParameters } from '../../../.storybook/preview'
import { AddressField } from './AddressField'
import { addressSchema } from './addressSchema'

const schema = z.object({ address: addressSchema() })
const empty = { address: { street: '', street2: '', city: '', state: '', zip: '' } }

const meta = {
  title: 'Fields/AddressField',
  component: AddressField,
  args: { name: 'address' },
  parameters: { form: { schema, defaultValues: empty } } satisfies FormParameters,
} satisfies Meta<typeof AddressField>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Required: Story = {
  args: { required: true },
  parameters: {
    docs: {
      description: {
        story: '`required` reaches street, city, state and ZIP — never the optional second line.',
      },
    },
  },
}

export const ShippingSection: Story = {
  args: {
    legend: 'Shipping address',
    description: 'Where the order ships.',
    autoCompleteSection: 'shipping',
    required: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          '`legend` wraps the group in a `FormSection` fieldset; `autoCompleteSection` prefixes every autofill token (`shipping street-address`, …) so a browser can fill a shipping and a billing address on the same page separately.',
      },
    },
  },
}

export const WithoutStreet2: Story = {
  args: { street2: false },
  parameters: {
    form: {
      schema: z.object({ address: addressSchema({ street2: false }) }),
      defaultValues: { address: { street: '', city: '', state: '', zip: '' } },
    },
    docs: {
      description: { story: 'Pair `street2={false}` with `addressSchema({ street2: false })`.' },
    },
  },
}

export const WithErrors: Story = {
  args: { legend: 'Shipping address', required: true },
  parameters: {
    docs: {
      description: {
        story: 'Each part shows its own error; the ZIP part also carries its 5-digit rule.',
      },
    },
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText(/ZIP code/), '902')
    await userEvent.click(canvas.getByRole('button', { name: 'Submit' }))
    await canvas.findByText('Street address is required.')
    await canvas.findByText('Enter a 5-digit ZIP code')
  },
}
