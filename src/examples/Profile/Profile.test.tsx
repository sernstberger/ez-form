import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Profile } from './Profile'
import { PROFILE_LOAD_FAILS_FOR } from '../fakeApi'
import { expectNoA11yViolations } from '../../test/axe'
import { withPickers } from '../../test/pickers'

const hiddenDateInput = () => document.querySelector<HTMLInputElement>('input[name="birthday"]')!

async function waitForLoaded() {
  await waitFor(() => expect(screen.getByLabelText(/display name/i)).toBeEnabled())
}

describe('Profile', () => {
  it('has an accessible form name "Your profile"', async () => {
    render(withPickers(<Profile />))
    expect(screen.getByRole('form', { name: 'Your profile' })).toBeInTheDocument()
    await waitForLoaded()
  })

  it('groups fields under Identity, Preferences, and Avatar fieldsets', async () => {
    render(withPickers(<Profile />))
    await waitForLoaded()

    const identity = screen.getByRole('group', { name: 'Identity' })
    expect(within(identity).getByLabelText(/display name/i)).toBeInTheDocument()
    expect(within(identity).getByLabelText(/^bio/i)).toBeInTheDocument()
    expect(within(identity).getByRole('group', { name: 'Birthday' })).toBeInTheDocument()

    const preferences = screen.getByRole('group', { name: 'Preferences' })
    expect(within(preferences).getByLabelText(/country/i)).toBeInTheDocument()
    expect(
      within(preferences).getByRole('switch', { name: /marketing emails/i }),
    ).toBeInTheDocument()
    expect(within(preferences).getByLabelText(/language/i)).toBeInTheDocument()

    const avatar = screen.getByRole('group', { name: 'Avatar' })
    expect(within(avatar).getByLabelText(/upload avatar/i)).toBeInTheDocument()
  })

  it('disables fields while the simulated fetch is pending, then fills them in once it resolves', async () => {
    render(withPickers(<Profile />))
    // Still loading: fields start disabled (async defaultValues), so nothing has a value yet.
    expect(screen.getByLabelText(/display name/i)).toBeDisabled()
    expect(screen.getByLabelText(/display name/i)).toHaveValue('')

    await waitForLoaded()
    expect(screen.getByLabelText(/display name/i)).toHaveValue('Ada Lovelace')
    expect(screen.getByRole('button', { name: /save profile/i })).toBeEnabled()
  })

  it('saves and reports success with the current form values', async () => {
    const user = userEvent.setup()
    const onSuccess = vi.fn()
    render(withPickers(<Profile onSuccess={onSuccess} />))
    await waitForLoaded()

    const displayName = screen.getByLabelText(/display name/i)
    await user.clear(displayName)
    await user.type(displayName, 'Grace Hopper')
    await user.click(screen.getByRole('button', { name: /save profile/i }))

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
    expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({ displayName: 'Grace Hopper' }))
  })

  it('shows the mapped disableFuture message for a birthday in the future', async () => {
    const user = userEvent.setup()
    render(withPickers(<Profile />))
    await waitForLoaded()

    fireEvent.change(hiddenDateInput(), { target: { value: '01/01/2999' } })
    await user.click(screen.getByRole('button', { name: /save profile/i }))
    expect(await screen.findByText(/birthday must be in the past/i)).toBeInTheDocument()
  })

  it('shows a bio counter as "n / 280"', async () => {
    const user = userEvent.setup()
    render(withPickers(<Profile />))
    await waitForLoaded()

    const bio = screen.getByLabelText(/^bio/i)
    const priorLength = (bio as HTMLTextAreaElement).value.length
    expect(screen.getByText(`${priorLength} / 280`)).toBeInTheDocument()

    await user.clear(bio)
    await user.type(bio, 'Hello')
    expect(screen.getByText('5 / 280')).toBeInTheDocument()
  })

  it('re-syncing values while dirty keeps the dirty field and updates the pristine one', async () => {
    const user = userEvent.setup()
    render(withPickers(<Profile />))
    await waitForLoaded()

    const bio = screen.getByLabelText(/^bio/i)
    const bioBeforeReload = (bio as HTMLTextAreaElement).value

    const displayName = screen.getByLabelText(/display name/i)
    await user.clear(displayName)
    await user.type(displayName, 'My Local Edit')

    await user.click(screen.getByRole('button', { name: /reload from server/i }))

    // Dirty field keeps the user's edit...
    await waitFor(() => expect(displayName).toHaveValue('My Local Edit'))
    // ...while a pristine field (bio, untouched) re-syncs to whatever the reload
    // returned. The reload seeds a fresh bio each time (see Profile.tsx's
    // reloadCount), so this proves the re-sync actually ran rather than the
    // field just happening to already hold the same value as the first load.
    await waitFor(() => expect(bio).toHaveValue('Reloaded from the server (reload #1).'))
    expect(bio).not.toHaveValue(bioBeforeReload)
  })

  it('is accessible once loaded', async () => {
    const { container } = render(withPickers(<Profile />))
    await waitForLoaded()
    await expectNoA11yViolations(container)
  })

  it('is accessible when the initial load fails', async () => {
    const { container } = render(
      withPickers(<Profile loadSeed={{ displayName: PROFILE_LOAD_FAILS_FOR }} />),
    )
    await screen.findByRole('alert')
    await expectNoA11yViolations(container)
  })

  it('shows a FormError alert when the initial load fails', async () => {
    render(withPickers(<Profile loadSeed={{ displayName: PROFILE_LOAD_FAILS_FOR }} />))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/could not load your profile/i)
    // The form re-enables with empty fields rather than being stuck disabled.
    await waitFor(() => expect(screen.getByLabelText(/display name/i)).toBeEnabled())
  })
})
