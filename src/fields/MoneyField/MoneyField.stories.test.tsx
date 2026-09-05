import { render, screen } from '@testing-library/react'
import { composeStories } from '@storybook/react-vite'
import preview from '../../../.storybook/preview'
import { runStoryPlay } from '../../test/runStoryPlay'
import * as stories from './MoneyField.stories'

/**
 * Regression coverage for #113: `Required` used to state `parameters.form.defaultValues: {}`
 * against a meta that set `{ price: 19.99 }`. Storybook deep-merges story params over the
 * meta's and skips `undefined`, so a story cannot unset a key it inherits (see FormParameters
 * in `.storybook/preview.tsx`) — the story rendered prefilled and never showed the empty
 * required state it exists to demonstrate. The prefill now lives on the stories that want it,
 * so `Required` inherits an empty baseline. `preview` is passed as project annotations so the
 * `<Form>` decorator runs here as it does in Storybook.
 */
const { Default, Required, MinMax } = composeStories(stories, preview)
const metaForm = stories.default.parameters.form

describe('MoneyField stories: the Required story renders empty (#113)', () => {
  it('the meta baseline is empty, so Required inherits no price', () => {
    expect(metaForm.defaultValues).toEqual({})
    expect(Required.parameters.form).toEqual({ schema: metaForm.schema, defaultValues: {} })
    expect(Required.parameters.form.schema).toBe(metaForm.schema)
  })

  it('the stories that want the prefill state it themselves', () => {
    expect(Default.parameters.form.defaultValues).toEqual({ price: 19.99 })
    expect(MinMax.parameters.form.defaultValues).toEqual({ price: 19.99 })
    expect(Default.parameters.form.schema).toBe(metaForm.schema)
  })

  it('Default renders the prefilled amount and Required renders empty', () => {
    const { unmount } = render(<Default />)
    expect(screen.getByLabelText('Price')).toHaveValue('$19.99')
    unmount()

    render(<Required />)
    expect(screen.getByLabelText(/Price/)).toHaveValue('')
  })

  it('Required: submitting the empty field shows the required message', async () => {
    const { canvas } = await runStoryPlay(Required)
    expect(await canvas.findByText('Price is required.')).toBeInTheDocument()
  })
})
