import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { z } from 'zod'
import { Form } from '../../Form'
import { Slider } from './Slider'
import { describeFieldContract } from '../../test/describeFieldContract'

const schema = z.object({ volume: z.number() })

/** jsdom has no pointer layout; MUI's Slider reads `valueAsNumber` from a change event on its input. */
const setSlider = (input: HTMLElement, value: number) =>
  fireEvent.change(input, { target: { value: String(value) } })

describeFieldContract({
  componentName: 'Slider',
  label: 'Volume',
  schema,
  defaultValues: {},
  render: (props) => <Slider name="volume" label="Volume" {...props} />,
  getControl: () => screen.getByRole('slider', { name: 'Volume' }),
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
    const [start, end] = screen.getAllByRole('slider', { name: 'Hours' }) as [HTMLElement, HTMLElement]
    expect(start).toHaveValue('9')
    expect(end).toHaveValue('17')
    setSlider(end, 18)
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ hours: [9, 18] }, expect.anything())
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

  it('focuses the slider after a failed submit', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={{}} onSubmit={() => {}}>
        <Slider name="volume" label="Volume" required />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByText('Volume is required.')).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: 'Volume' })).toHaveFocus()
  })
})
