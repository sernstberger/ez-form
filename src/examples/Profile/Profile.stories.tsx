import type { Meta, StoryObj } from '@storybook/react-vite'
import { Profile } from './Profile'
import { PROFILE_LOAD_FAILS_FOR } from '../fakeApi'

const meta = {
  title: 'Examples/Profile',
  component: Profile,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Profile>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Async `defaultValues` simulates a fetch (~300ms): the form renders disabled, then fills in once it resolves. Birthday uses the README-recommended pattern for far-away dates: `DateField` with `disableFuture` and a 1900 `minDate`.',
      },
    },
  },
  play: async ({ canvas }) => {
    await canvas.findByDisplayValue('Ada Lovelace')
  },
}

export const LoadFails: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The initial fetch rejects: `onDefaultValuesError` reports it through `form.setError`, and `FormError` renders the message. The form still re-enables (with empty fields) rather than staying stuck loading.',
      },
    },
  },
  args: { loadSeed: { displayName: PROFILE_LOAD_FAILS_FOR } },
  play: async ({ canvas }) => {
    await canvas.findByRole('alert')
  },
}

export const ReloadWhileDirty: Story = {
  parameters: {
    docs: {
      description: {
        story:
          '"Reload from server" re-fetches and passes the result through the `values` prop while the form is dirty. With `resetOptions={{ keepDirtyValues: true }}`, the display name (edited here) keeps the local edit, while every untouched field re-syncs to whatever the reload returned.',
      },
    },
  },
  play: async ({ canvas, userEvent }) => {
    await canvas.findByDisplayValue('Ada Lovelace')
    const displayName = canvas.getByLabelText(/display name/i)
    await userEvent.clear(displayName)
    await userEvent.type(displayName, 'My Local Edit')
    await userEvent.click(canvas.getByRole('button', { name: /reload from server/i }))
    await canvas.findByDisplayValue('My Local Edit')
  },
}
