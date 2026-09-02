import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { z } from 'zod'
import { Form } from '../../Form'
import { Rating } from './Rating'
import { describeFieldContract } from '../../test/describeFieldContract'

const schema = z.object({ stars: z.number().nullable() })

/**
 * jsdom never lays out elements, so `getBoundingClientRect()` on MUI Rating's
 * root is always zero-sized and every synthetic pointer event reports
 * `clientX/clientY: 0`. MUI's hover-preview math divides by the root's width
 * to find which star the pointer is over, so under jsdom that division is
 * `0 / 0`, and the resulting `NaN` "hover" value silently overrides the
 * value `userEvent.click` actually sets on the target radio. Blocking the
 * `mousemove` userEvent fires before every click stops MUI's hover tracking
 * from ever engaging, which sidesteps the bad math without touching Rating's
 * own value/onChange handling. Real browsers lay elements out for real, so
 * hover preview is unaffected outside this test file.
 */
beforeEach(() => {
  document.addEventListener('mousemove', stopEvent, true)
})
afterEach(() => {
  document.removeEventListener('mousemove', stopEvent, true)
})
function stopEvent(e: Event) {
  e.stopPropagation()
}

describeFieldContract({
  componentName: 'Rating',
  label: 'Stars',
  schema,
  defaultValues: { stars: null },
  render: (props) => <Rating name="stars" label="Stars" {...props} />,
  getControl: () => screen.getByRole('radiogroup', { name: 'Stars' }),
  expectDisabled: () => expect(screen.getByRole('radio', { name: '3 Stars' })).toBeDisabled(),
  interact: (user) => user.click(screen.getByRole('radio', { name: '3 Stars' })),
})

describe('Rating', () => {
  it('submits the chosen number', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <Form schema={schema} defaultValues={{ stars: null }} onSubmit={onSubmit}>
        <Rating name="stars" label="Stars" />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.click(screen.getByRole('radio', { name: '4 Stars' }))
    expect(screen.getByRole('radio', { name: '4 Stars' })).toBeChecked()
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ stars: 4 }, expect.anything())
  })

  it('reflects a default value and clears to null when the same star is clicked', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <Form schema={schema} defaultValues={{ stars: 2 }} onSubmit={onSubmit}>
        <Rating name="stars" label="Stars" />
        <button type="submit">Go</button>
      </Form>,
    )
    expect(screen.getByRole('radio', { name: '2 Stars' })).toBeChecked()
    // MUI's clear-on-reclick only fires for a `click` with nonzero
    // clientX/clientY (its guard against a keyboard-triggered click, see
    // https://github.com/react/react/issues/7407); jsdom's synthetic clicks
    // report `(0, 0)` unless coordinates are given explicitly, so a plain
    // `user.click` never triggers the clear here. `user.pointer` with
    // explicit `coords` is the same click, with real coordinates attached.
    const star2 = screen.getByRole('radio', { name: '2 Stars' })
    await user.pointer([
      { target: star2, coords: { clientX: 1, clientY: 1 } },
      { keys: '[MouseLeft]', target: star2, coords: { clientX: 1, clientY: 1 } },
    ])
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ stars: null }, expect.anything())
  })

  it('fails required on null and focuses a radio', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={{ stars: null }} onSubmit={() => {}}>
        <Rating name="stars" label="Stars" required />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByText('Stars is required.')).toBeInTheDocument()
    expect(screen.getByRole('radiogroup', { name: 'Stars' })).toContainElement(
      document.activeElement as HTMLElement,
    )
  })

  it('calls a consumer onChange with the number after updating the form', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <Form schema={schema} defaultValues={{ stars: null }} onSubmit={() => {}}>
        <Rating name="stars" label="Stars" onChange={onChange} />
      </Form>,
    )
    await user.click(screen.getByRole('radio', { name: '5 Stars' }))
    expect(onChange).toHaveBeenCalledWith(expect.anything(), 5)
  })
})
