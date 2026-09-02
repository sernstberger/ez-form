import { composeStories } from '@storybook/react-vite'
import { runStoryPlay } from '../../test/runStoryPlay'
import * as stories from './Login.stories'

/**
 * Regression coverage for #77: `WrongPassword` and `SignedIn` both looked up the password
 * field with `getByLabelText(/password/i)`, which also matched the reveal toggle's
 * `aria-label="Show password"` and threw `Found multiple elements` before any scripted step
 * ran. The story's own `play` now anchors the query (`/^password/i`), which the toggle's
 * label ("Show password") doesn't match.
 */
const { WrongPassword, SignedIn } = composeStories(stories)

describe('Login stories: play (#77)', () => {
  it('WrongPassword: play runs to completion without an ambiguous label match', async () => {
    const { canvas } = await runStoryPlay(WrongPassword)
    expect(await canvas.findByRole('alert')).toBeInTheDocument()
  })

  it('SignedIn: play runs to completion without an ambiguous label match', async () => {
    await runStoryPlay(SignedIn)
  })
})
