import type { Meta, StoryObj } from '@storybook/react-vite'
import { z } from 'zod'
import type { FormParameters } from '../../../.storybook/preview'
import { EmailListField, type EmailOption } from './EmailListField'

const schema = z.object({ to: z.array(z.string()).min(1, 'Add at least one recipient') })

const meta = {
  title: 'Fields/EmailListField',
  component: EmailListField,
  args: { name: 'to', label: 'To' },
  parameters: { form: { schema, defaultValues: { to: [] } } } satisfies FormParameters,
} satisfies Meta<typeof EmailListField>

export default meta
type Story = StoryObj<typeof meta>

export const FreeEntry: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'No lookup: every address is typed. Enter, comma, semicolon and a space after a complete address all commit, blur commits what is left in the box, and pasting `a@x.com, b@y.com; c@z.com` makes three chips at once.',
      },
    },
  },
  args: { helperText: 'Separate addresses with a comma' },
}

export const WithDefaultValue: Story = {
  parameters: {
    form: {
      schema,
      defaultValues: { to: ['ada@example.com', 'grace@example.com'] },
    },
  } satisfies FormParameters,
}

export const Invalid: Story = {
  parameters: {
    form: { schema, defaultValues: { to: ['ada@example.com', 'not-an-email'] } },
    docs: {
      description: {
        story:
          'An address that fails validation stays as a chip in its error state rather than vanishing, so it can be seen and fixed; the field errors and submit is blocked until it is.',
      },
    },
  } satisfies FormParameters,
}

export const Disabled: Story = {
  parameters: {
    form: { schema, defaultValues: { to: ['ada@example.com'] } },
  } satisfies FormParameters,
  args: { disabled: true },
}

// ---- Async lookup, shaped like a directory / contacts API ----

const people = [
  { name: 'Ada Lovelace', email: 'ada@example.com' },
  { name: 'Grace Hopper', email: 'grace@example.com' },
  { name: 'Katherine Johnson', email: 'katherine@example.com' },
  { name: 'Alan Turing', email: 'alan@example.com' },
  { name: 'Barbara Liskov', email: 'barbara@example.com' },
]

/** A fake directory: 400ms, and honours the abort signal the field hands it. */
function fakeDirectory(query: string, signal: AbortSignal): Promise<EmailOption[]> {
  const q = query.toLowerCase()
  const hits = people
    .filter((p) => p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q))
    .map((p) => ({ value: p.email, label: `${p.name} <${p.email}>`, name: p.name }))
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(hits), 400)
    signal.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(signal.reason)
    })
  })
}

export const WithLookup: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Typing runs `loadOptions` after a 250ms pause, cancelling the request already in flight. A chip picked from the results reads as `Name <email>`; only the address is stored. A typed address the directory does not know is still accepted, because `allowNew` defaults to `true`.',
      },
    },
  },
  args: { loadOptions: fakeDirectory, helperText: 'Search your team, or type any address' },
}

export const LookupOnly: Story = {
  parameters: {
    docs: {
      description: {
        story:
          '`allowNew={false}` turns the field into a picker over the lookup results: a well-formed address nobody in the directory has is rejected with `invalidMessage`.',
      },
    },
  },
  args: {
    loadOptions: fakeDirectory,
    allowNew: false,
    helperText: 'Only people in the directory can be added',
  },
}
