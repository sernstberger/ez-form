import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { z } from 'zod'
import type { FormParameters } from '../../../.storybook/preview'
import { Autocomplete } from './Autocomplete'

const schema = z.object({ role: z.enum(['admin', 'user', 'viewer'], { error: 'Pick a role' }) })

const roles = [
  { value: 'admin', label: 'Admin' },
  { value: 'user', label: 'User' },
  { value: 'viewer', label: 'Viewer' },
]

const meta = {
  title: 'Fields/Autocomplete',
  component: Autocomplete,
  args: { name: 'role', label: 'Role', options: roles },
  parameters: { form: { schema, defaultValues: {} } } satisfies FormParameters,
} satisfies Meta<typeof Autocomplete>

export default meta
type Story = StoryObj<typeof meta>

export const Single: Story = {}
export const Required: Story = { args: { required: true } }
export const Disabled: Story = { args: { disabled: true } }

const multiSchema = z.object({ roles: z.array(z.string()).min(1, 'Pick at least one') })

export const Multiple: Story = {
  parameters: {
    form: { schema: multiSchema, defaultValues: { roles: [] } },
  } satisfies FormParameters,
  args: { name: 'roles', label: 'Roles', multiple: true },
}

const freeSchema = z.object({ role: z.string().min(1, 'Type or pick a role') })

export const FreeSolo: Story = {
  parameters: {
    form: { schema: freeSchema, defaultValues: { role: '' } },
    docs: {
      description: {
        story: 'Typed text is stored as-is; `autoSelect` commits it on blur as well as on Enter.',
      },
    },
  },
  args: { freeSolo: true, autoSelect: true },
}

const objectSchema = z.object({ role: z.object({ value: z.string(), label: z.string() }) })

export const ObjectValue: Story = {
  parameters: {
    form: { schema: objectSchema, defaultValues: {} },
    docs: {
      description: {
        story: '`getOptionValue={(o) => o}` stores the whole option; the schema is a `z.object`.',
      },
    },
  },
  args: { getOptionValue: (o) => o },
}

// ---- Async options, shaped like a Google Places lookup ----

interface Prediction {
  value: string
  label: string
  placeId: string
}

const streets = ['Main St', 'Oak Ave', 'Maple Dr', 'Elm St', 'Pine Rd', 'Cedar Ln']
const cities = ['Springfield', 'Portland', 'Riverside', 'Franklin', 'Greenville']

function fakePredict(query: string): Promise<Prediction[]> {
  const q = query.toLowerCase()
  const hits = streets
    .flatMap((s) => cities.map((c) => `${Math.floor(Math.random() * 900) + 100} ${s}, ${c}`))
    .filter((a) => a.toLowerCase().includes(q))
    .slice(0, 5)
    .map((a) => ({ value: a, label: a, placeId: `place_${a.replace(/\W+/g, '_')}` }))
  return new Promise((resolve) => setTimeout(() => resolve(hits), 400))
}

const onPlace = fn()
const addressSchema = z.object({ address: z.string().min(1, 'Enter an address') })

function AddressField() {
  const [options, setOptions] = useState<Prediction[]>([])
  const [loading, setLoading] = useState(false)
  return (
    <Autocomplete
      name="address"
      label="Address"
      freeSolo
      autoSelect
      options={options}
      loading={loading}
      filterOptions={(x) => x}
      onInputChange={async (_e, query, reason) => {
        if (reason !== 'input' || query.length < 2) return
        setLoading(true)
        setOptions(await fakePredict(query))
        setLoading(false)
      }}
      onChange={(_e, value) => onPlace(typeof value === 'object' && value ? value.placeId : value)}
      helperText="Start typing a street name"
    />
  )
}

export const AsyncOptions: Story = {
  parameters: {
    form: { schema: addressSchema, defaultValues: { address: '' } },
    docs: {
      description: {
        story:
          'Options are fetched as you type (400ms fake API), the way a Places lookup works. The form stores the address string; `placeId` reaches the consumer `onChange` for side effects (open the Actions panel).',
      },
    },
  },
  render: () => <AddressField />,
}
