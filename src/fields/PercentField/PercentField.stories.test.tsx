import { render, screen } from '@testing-library/react'
import { composeStories } from '@storybook/react-vite'
import preview from '../../../.storybook/preview'
import { expectNoA11yViolations } from '../../test/axe'
import * as stories from './PercentField.stories'

/**
 * Pins the per-story `parameters.form` override contract (#25): a story states only the
 * keys that differ, Storybook deep-merges them over the meta's `form`, and the decorator
 * in `.storybook/preview.tsx` wraps the story in a `<Form>` built from the merged result.
 * `preview` is passed as project annotations so the decorator runs here as it does in
 * Storybook.
 */
const { Default, Required, Fraction } = composeStories(stories, preview)
const metaForm = stories.default.parameters.form

describe('PercentField stories: per-story parameters.form overrides (#25)', () => {
  it('a story that sets only defaultValues inherits the meta schema', () => {
    expect(Required.parameters.form).toEqual({
      schema: metaForm.schema,
      defaultValues: { rate: null },
    })
    expect(Required.parameters.form.schema).toBe(metaForm.schema)
    expect(Default.parameters.form).toEqual(metaForm)
  })

  it('a form override and docs.description.story sit side by side on one story', () => {
    expect(Fraction.parameters.form.defaultValues).toEqual({ rate: 0.125 })
    expect(Fraction.parameters.form.schema).toBe(metaForm.schema)
    expect(Fraction.parameters.docs.description.story).toMatch(/fraction/)
  })

  it('the decorator renders the merged form: meta defaults for Default, the override for Required', async () => {
    const { container, unmount } = render(<Default />)
    expect(screen.getByLabelText('Rate')).toHaveValue('12.5%')
    await expectNoA11yViolations(container)
    unmount()

    render(<Required />)
    expect(screen.getByLabelText(/Rate/)).toHaveValue('')
  })
})
