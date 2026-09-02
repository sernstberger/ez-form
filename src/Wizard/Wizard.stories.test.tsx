import { render } from '@testing-library/react'
import { composeStories } from '@storybook/react-vite'
import * as wizardStories from './Wizard.stories'
import * as wizardRouterStories from './WizardRouter.stories'

/**
 * Regression coverage for #76: every Wizard story that renders a `FormSection`/`WizardStep`
 * legend must sit under the `Form`'s own `h2`, so the page's heading order is h2 → h3
 * (→ h4 for nested sections) with no skip. `Vertical` renders no legend by design (steps
 * are already labelled by the stepper via `aria-labelledby`) and is asserted separately.
 */
const { Horizontal, Vertical, PageLayout, PageLayoutNestedSections, Resume } =
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
