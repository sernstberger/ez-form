import { composeStories } from '@storybook/react-vite'
import { runStoryPlay } from '../../test/runStoryPlay'
import * as stories from './SignUp.stories'

/**
 * Regression coverage for #77: `MismatchedPasswords`, `WrongCode`, and `Verified` all looked
 * up the password field with `getByLabelText(/^password/i)`, which also matched
 * `PasswordStrength`'s `aria-label="Password strength"` meter and threw `Found multiple
 * elements` before any scripted step ran. The story's own `play` now excludes that meter
 * (`/^password(?! strength)/i`), matching what `SignUp.test.tsx`'s own unit tests already do.
 */
const { MismatchedPasswords, WrongCode, Verified } = composeStories(stories)

describe('Sign-up stories: play (#77)', () => {
  it('MismatchedPasswords: play runs to completion without an ambiguous label match', async () => {
    const { canvas } = await runStoryPlay(MismatchedPasswords)
    expect(await canvas.findByText(/passwords do not match/i)).toBeInTheDocument()
  })

  it('WrongCode: play runs to completion without an ambiguous label match', async () => {
    const { canvas } = await runStoryPlay(WrongCode)
    expect(await canvas.findByRole('alert')).toBeInTheDocument()
  })

  it('Verified: play runs to completion without an ambiguous label match', async () => {
    await runStoryPlay(Verified)
  })
})
