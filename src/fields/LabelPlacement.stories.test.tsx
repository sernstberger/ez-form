import { render, screen } from '@testing-library/react'
import { composeStories } from '@storybook/react-vite'
import * as stories from './LabelPlacement.stories'
import { fieldLayoutClasses } from './LabelPlacementContext'
import { expectNoA11yViolations } from '../test/axe'

/**
 * The stories are the only place a human sees the two placements side by side,
 * so they need the same guarantee the fields have: every one renders, every field
 * is placed, every control is still found by its label, and axe is clean.
 *
 * `composeStories` rather than a browser, because a Storybook instance is not part
 * of the test gate — the point is that a story cannot rot silently between sweeps.
 */
const composed = composeStories(stories)

describe('Label placement stories', () => {
  it.each(Object.entries(composed))('%s renders, is labelled, and is axe-clean', async (_n, S) => {
    const { container } = render(<S />)
    // Every field box carries a placement class; a family that missed the wiring
    // would leave a `root` with no placement.
    const placed = (['top', 'start'] as const).reduce(
      (n, p) => n + container.querySelectorAll(`.${fieldLayoutClasses[p]}`).length,
      0,
    )
    expect(placed).toBe(container.querySelectorAll(`.${fieldLayoutClasses.root}`).length)
    expect(placed).toBeGreaterThan(0)
    // The claim the whole design rests on: placement is CSS, so `<label for>` never
    // moves and the control is still found by its visible label.
    expect(screen.getAllByLabelText(/email address/i).length).toBeGreaterThan(0)
    await expectNoA11yViolations(container)
  })

  it('Start places the label column at the width the story asks for', () => {
    render(<composed.StartWideLabels />)
    // Read off the emitted rule, not the element: the label column lives inside a
    // `@media (min-width…)` block (#130), and jsdom evaluates no media queries, so
    // `getComputedStyle` here would report MUI's own box and never the grid.
    const css = [...document.querySelectorAll('style')].map((s) => s.textContent ?? '').join('\n')
    expect(css).toContain('grid-template-columns:18rem 1fr')
    expect(css).toContain(fieldLayoutClasses.start)
  })

  it('PerFieldOverride really shows two different placements in one form', () => {
    const { container } = render(<composed.PerFieldOverride />)
    expect(container.querySelectorAll(`.${fieldLayoutClasses.start}`)).toHaveLength(1)
    expect(container.querySelectorAll(`.${fieldLayoutClasses.top}`)).toHaveLength(1)
  })

  it('ViaThemeDefaultProps sets the placement with no props at all', () => {
    const { container } = render(<composed.ViaThemeDefaultProps />)
    expect(container.querySelectorAll(`.${fieldLayoutClasses.start}`).length).toBeGreaterThan(0)
  })
})
