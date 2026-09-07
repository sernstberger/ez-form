import { render } from '@testing-library/react'
import { composeStories } from '@storybook/react-vite'
import * as stories from './Variants.stories'
import preview from '../../.storybook/preview'
import { expectNoA11yViolations } from '../test/axe'

/**
 * The variants page is the only place a human sees all nineteen box inputs under all
 * four variants at once, so it needs the same guarantee the fields have: both stories
 * render, every cell really is there, and axe is clean.
 *
 * `composeStories` rather than a browser, because a Storybook instance is not part of
 * the test gate — the point is that the page cannot rot silently between sweeps. The
 * cell counts are what a missing row or a dropped column would show up as; the
 * per-variant *behaviour* is `src/fields/variants.test.tsx`'s.
 */
// `preview` as the second argument, the way `src/test/stories.nesting.test.tsx` does:
// the pickers' `LocalizationProvider` lives in the project decorators, and without it
// `DateField` throws "Can not find the date and time pickers localization context."
const composed = composeStories(stories, preview)

/** 19 box inputs × 4 variants. Written out so a lost row fails here rather than adapting. */
const CELLS = 19 * 4

describe('Variants stories', () => {
  it.each(Object.entries(composed))(
    '%s renders every cell and is axe-clean',
    async (_n, S) => {
      const { container } = render(<S />)
      // Every cell is one field, and every field renders exactly one `InputBase` root —
      // MUI's for the fifteen material families, MUI X's for the four pickers.
      const boxes = container.querySelectorAll('.MuiInputBase-root, .MuiPickersInputBase-root')
      expect(boxes).toHaveLength(CELLS)
      await expectNoA11yViolations(container)
    },
    30_000,
  )
})
