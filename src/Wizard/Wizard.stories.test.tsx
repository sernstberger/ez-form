import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { composeStories } from '@storybook/react-vite'
import { runStoryPlay } from '../test/runStoryPlay'
import { wizardClasses } from './Wizard'
import * as wizardStories from './Wizard.stories'
import * as wizardRouterStories from './WizardRouter.stories'

/**
 * Regression coverage for #76: every Wizard story that renders a `FormSection`/`WizardStep`
 * legend must sit under the `Form`'s own `h2`, so the page's heading order is h2 → h3
 * (→ h4 for nested sections) with no skip. `Vertical` renders no legend by design (steps
 * are already labelled by the stepper via `aria-labelledby`) and is asserted separately.
 */
const { Horizontal, Vertical, PageLayout, PageLayoutNestedSections, Resume, EnterAdvances } =
  composeStories(wizardStories)
const { OneRoutePerStep, DeepLinkRedirect } = composeStories(wizardRouterStories)

function headingSequence(container: Element) {
  return Array.from(container.querySelectorAll('h1,h2,h3,h4,h5,h6')).map((h) => h.tagName)
}

describe('Wizard stories: heading order (#76)', () => {
  it.each([
    ['Horizontal', Horizontal],
    ['PageLayout', PageLayout],
    ['Resume', Resume],
    ['OneRoutePerStep', OneRoutePerStep],
    ['DeepLinkRedirect', DeepLinkRedirect],
  ] as const)('%s: h2 precedes the step h3, no skip', (_name, Story) => {
    const { container } = render(<Story />)
    const headings = headingSequence(container)
    expect(headings[0]).toBe('H2')
    expect(headings).toContain('H3')
    // No heading level is skipped anywhere in the sequence (e.g. no H2 -> H4 jump).
    for (let i = 1; i < headings.length; i++) {
      const prevTag = headings[i - 1]
      const tag = headings[i]
      if (prevTag == null || tag == null) throw new Error('unreachable')
      expect(Number(tag[1]) - Number(prevTag[1])).toBeLessThanOrEqual(1)
    }
  })

  it('PageLayoutNestedSections: h2 -> h3 -> h4, no skip', () => {
    const { container } = render(<PageLayoutNestedSections />)
    const headings = headingSequence(container)
    expect(headings).toEqual(['H2', 'H3', 'H4', 'H3', 'H3'])
  })

  it('Vertical: renders the Form h2 and no legend heading (unaffected by design)', () => {
    const { container } = render(<Vertical />)
    expect(headingSequence(container)).toEqual(['H2'])
  })
})

/**
 * The router story is a *controlled* wizard whose `onStepChange` navigates instead of setting
 * `step` directly, so the wizard only arrives on the requested step once react-router has
 * re-rendered it. The announcement is gated on that arrival: it must never describe a step
 * the wizard has not reached (#2 review round 1).
 */
describe('Wizard router story: the announcement waits for the controlled wizard to arrive', () => {
  it('OneRoutePerStep: announces the step only once the route is showing it', async () => {
    const user = userEvent.setup()
    render(<OneRoutePerStep />)
    const region = () => document.querySelector(`.${wizardClasses.status}`)
    expect(region()).toBeEmptyDOMElement()

    await user.type(screen.getByRole('textbox', { name: /Name/ }), 'Ada')
    await user.type(screen.getByRole('textbox', { name: /Email/ }), 'ada@x.io')
    await user.click(screen.getByRole('button', { name: 'Next' }))

    // Arrival and announcement agree: the URL is on /signup/plan and the region says so.
    await waitFor(() => expect(screen.getByText('URL: /signup/plan')).toBeInTheDocument())
    await waitFor(() => expect(region()).toHaveTextContent('Step 2 of 3, Plan'))
  })
})

/**
 * #116: Enter on a non-last step advances it. This runs the story's own `play`, which
 * drives the wizard entirely from the keyboard.
 *
 * **This is a jsdom run, not a browser one** — `runStoryPlay` is a stand-in for Storybook's
 * play context built on Testing Library, and vitest's environment here is `jsdom` (see
 * `vite.config.ts`). jsdom fabricates an implicit submit for Enter on a text input even with
 * no submit control present, which a real browser will not do, so "the step changed" is not
 * on its own proof the feature works. What this owns is that the play runs end to end
 * without throwing and that the wired-up handler is reached; the real-browser confirmation
 * is recorded in the ledger. `Wizard.test.tsx`'s `#116` block carries the assertions that
 * distinguish a real `next()` from jsdom's spurious-submit path (`submitCount`).
 */
describe('Wizard EnterAdvances story (#116)', () => {
  it('runs the keyboard-only play to completion', async () => {
    await runStoryPlay(EnterAdvances)
  })
})
