import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { z } from 'zod'
import { Form } from '../../Form'
import { Slider } from './Slider'
import { describeFieldContract } from '../../test/describeFieldContract'
import { expectTargetSize } from '../../test/targetSize'
import { expectNoA11yViolations } from '../../test/axe'

const schema = z.object({ volume: z.number() })

/** jsdom has no pointer layout; MUI's Slider reads `valueAsNumber` from a change event on its input. */
const setSlider = (input: HTMLElement, value: number) =>
  fireEvent.change(input, { target: { value: String(value) } })

describeFieldContract({
  componentName: 'Slider',
  role: 'slider',
  label: 'Volume',
  schema,
  defaultValues: { volume: 10 },
  // Slider has no `required` (HTML gives it no meaning on a range input), so
  // the contract's error case uses a failing `max` instead.
  errorProps: { max: 0 },
  errorMessage: 'Volume must be at most 0.',
  renderNamed: (name) => <Slider name="volume" label="" aria-label={name} />,
  render: (props) => <Slider name="volume" label="Volume" {...props} />,
  renderDescribed: (id, props) => (
    <Slider name="volume" label="Volume" aria-describedby={id} {...props} />
  ),
  getControl: () => screen.getByRole('slider', { name: 'Volume' }),
  expectSubmitted: { volume: 30 },
  interact: async () => {
    setSlider(screen.getByRole('slider', { name: 'Volume' }), 30)
  },
})

describe('Slider', () => {
  it('submits a number', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <Form schema={schema} defaultValues={{ volume: 10 }} onSubmit={onSubmit}>
        <Slider name="volume" label="Volume" />
        <button type="submit">Go</button>
      </Form>,
    )
    const slider = screen.getByRole('slider', { name: 'Volume' })
    expect(slider).toHaveValue('10')
    setSlider(slider, 30)
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ volume: 30 }, expect.anything())
  })

  it('submits a range as a tuple', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    const rangeSchema = z.object({ hours: z.tuple([z.number(), z.number()]) })
    render(
      <Form schema={rangeSchema} defaultValues={{ hours: [9, 17] }} onSubmit={onSubmit}>
        <Slider name="hours" label="Hours" max={24} />
        <button type="submit">Go</button>
      </Form>,
    )
    const [start, end] = screen.getAllByRole('slider', { name: 'Hours' }) as [
      HTMLElement,
      HTMLElement,
    ]
    expect(start).toHaveValue('9')
    expect(end).toHaveValue('17')
    setSlider(end, 18)
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ hours: [9, 18] }, expect.anything())
  })

  /**
   * #129. `getAriaLabel` is MUI's contract for naming the two thumbs of a range
   * slider apart, and it only works if the field stops pointing them at the legend:
   * `aria-labelledby` outranks `aria-label` in accname, so the legend reference
   * would compute the consumer's names and then discard them.
   */
  it('gives each range thumb a distinct name via getAriaLabel', async () => {
    const rangeSchema = z.object({ hours: z.tuple([z.number(), z.number()]) })
    const { container } = render(
      <Form schema={rangeSchema} defaultValues={{ hours: [9, 17] }} onSubmit={() => {}}>
        <Slider
          name="hours"
          label="Hours"
          max={24}
          getAriaLabel={(index) => (index === 0 ? 'Hours minimum' : 'Hours maximum')}
        />
      </Form>,
    )
    expect(screen.getByRole('slider', { name: 'Hours minimum' })).toHaveValue('9')
    expect(screen.getByRole('slider', { name: 'Hours maximum' })).toHaveValue('17')
    // The shared name is gone: neither thumb answers to the legend text alone.
    expect(screen.queryAllByRole('slider', { name: 'Hours' })).toHaveLength(0)
    await expectNoA11yViolations(container)
  })

  /**
   * The inverse of the line above: dropping the legend reference is conditional on
   * `getAriaLabel`, so without it the legend still names both thumbs, as it always
   * has. This is what makes the shared name visible as a deliberate default rather
   * than an accident.
   */
  it('leaves both range thumbs named by the legend without getAriaLabel', () => {
    const rangeSchema = z.object({ hours: z.tuple([z.number(), z.number()]) })
    render(
      <Form schema={rangeSchema} defaultValues={{ hours: [9, 17] }} onSubmit={() => {}}>
        <Slider name="hours" label="Hours" max={24} />
      </Form>,
    )
    expect(screen.getAllByRole('slider', { name: 'Hours' })).toHaveLength(2)
  })

  /**
   * A single-thumb slider takes the same path: `getAriaLabel(0)` names the one thumb
   * and the legend stops naming it, so the consumer's string is what is announced.
   */
  it('names a single-thumb slider by getAriaLabel too', () => {
    render(
      <Form schema={schema} defaultValues={{ volume: 10 }} onSubmit={() => {}}>
        <Slider name="volume" label="Volume" getAriaLabel={() => 'Playback volume'} />
      </Form>,
    )
    expect(screen.getByRole('slider', { name: 'Playback volume' })).toHaveValue('10')
    expect(screen.queryByRole('slider', { name: 'Volume' })).not.toBeInTheDocument()
  })

  it('uses min/max as both the slider bounds and rules', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={{ volume: 150 }} onSubmit={() => {}}>
        <Slider name="volume" label="Volume" min={0} max={{ value: 100, message: 'Too loud' }} />
        <button type="submit">Go</button>
      </Form>,
    )
    const slider = screen.getByRole('slider', { name: 'Volume' })
    expect(slider).toHaveAttribute('min', '0')
    expect(slider).toHaveAttribute('max', '100')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByText('Too loud')).toBeInTheDocument()
  })

  it('calls a consumer onChange with the new value after updating the form', () => {
    const onChange = vi.fn()
    render(
      <Form schema={schema} defaultValues={{ volume: 10 }} onSubmit={() => {}}>
        <Slider name="volume" label="Volume" onChange={onChange} />
      </Form>,
    )
    setSlider(screen.getByRole('slider', { name: 'Volume' }), 40)
    expect(onChange).toHaveBeenCalledWith(expect.anything(), 40, 0)
  })

  it('validates min/max against a range value', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    const rangeSchema = z.object({ hours: z.tuple([z.number(), z.number()]) })
    render(
      <Form schema={rangeSchema} defaultValues={{ hours: [-5, 99] }} onSubmit={onSubmit}>
        <Slider name="hours" label="Hours" min={0} max={24} />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByText('Hours must be at least 0.')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('runs a consumer validate alongside the built-in min/max', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={{ volume: 30 }} onSubmit={() => {}}>
        <Slider name="volume" label="Volume" max={100} validate={(v) => v !== 30 || 'Not 30'} />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByText('Not 30')).toBeInTheDocument()
  })

  it('focuses the slider after a failed submit', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={{ volume: 150 }} onSubmit={() => {}}>
        <Slider name="volume" label="Volume" max={100} />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByText('Volume must be at most 100.')).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: 'Volume' })).toHaveFocus()
  })

  it.each(['medium', 'small'] as const)('%s: the thumb meets 24×24 target size', (size) => {
    render(
      <Form schema={schema} defaultValues={{ volume: 50 }} onSubmit={() => {}}>
        <Slider name="volume" label="Volume" size={size} />
      </Form>,
    )
    expectTargetSize(screen.getByRole('slider', { name: 'Volume' }))
  })
})
