import type { Meta, StoryObj } from '@storybook/react-vite'
import { z } from 'zod'
import type { FormParameters } from '../../../.storybook/preview'
import { PercentField } from './PercentField'

const schema = z.object({ rate: z.number().nullable() })

const meta = {
  title: 'Fields/PercentField',
  component: PercentField,
  args: { name: 'rate', label: 'Rate' },
  parameters: { form: { schema, defaultValues: { rate: 12.5 } } } satisfies FormParameters,
} satisfies Meta<typeof PercentField>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

// Per-story override: only `defaultValues` is stated; the meta's `schema` is inherited
// (Storybook deep-merges `parameters`; see FormParameters in .storybook/preview.tsx).
export const Required: Story = {
  parameters: { form: { defaultValues: { rate: null } } } satisfies FormParameters,
  args: { required: true },
}

export const NarrowedBounds: Story = {
  args: { min: 5, max: 50, step: 5, helperText: '5% to 50%, in steps of 5' },
}

export const Fraction: Story = {
  parameters: {
    form: { defaultValues: { rate: 0.125 } },
    docs: {
      description: {
        story:
          'The stored value is the fraction (`0.125`) while the field still shows and accepts percentage points (`12.5%`). `min`/`max`/`step` stay in percentage points either way.',
      },
    },
  } satisfies FormParameters,
  args: { scale: 'fraction' },
}

export const OverTheBound: Story = {
  parameters: { form: { defaultValues: { rate: null } } } satisfies FormParameters,
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText('Rate'), '150')
    await userEvent.click(canvas.getByRole('button', { name: 'Submit' }))
    await canvas.findByText('Rate must be at most 100.')
  },
}
