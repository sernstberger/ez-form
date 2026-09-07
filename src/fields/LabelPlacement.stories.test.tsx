import { render, screen } from '@testing-library/react'
import { composeStories } from '@storybook/react-vite'
import * as stories from './LabelPlacement.stories'
import { fieldLayoutClasses } from './LabelPlacementContext'
import { expectNoA11yViolations } from '../test/axe'

/**
 * The stories are the only place a human sees the three placements side by side,
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
    const placed = ['floating', 'stacked', 'start'].reduce(
      (n, p) => n + container.querySelectorAll(`.${fieldLayoutClasses[p as 'floating']}`).length,
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
    const { container } = render(<composed.StartWideLabels />)
    const box = container.querySelector(`.${fieldLayoutClasses.start}`)!
    expect(getComputedStyle(box).gridTemplateColumns).toBe('18rem 1fr')
  })

  it('PerFieldOverride really shows two different placements in one form', () => {
    const { container } = render(<composed.PerFieldOverride />)
    expect(container.querySelectorAll(`.${fieldLayoutClasses.start}`)).toHaveLength(1)
    expect(container.querySelectorAll(`.${fieldLayoutClasses.stacked}`)).toHaveLength(1)
  })

  it('ViaThemeDefaultProps sets the placement with no props at all', () => {
    const { container } = render(<composed.ViaThemeDefaultProps />)
    expect(container.querySelectorAll(`.${fieldLayoutClasses.start}`).length).toBeGreaterThan(0)
  })
})
