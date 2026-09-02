import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { z } from 'zod'
import { Form, type FormMethods } from '../../Form'
import { DatePicker } from './DatePicker'
import { describeFieldContract } from '../../test/describeFieldContract'
import { withPickers } from '../../test/pickers'

const schema = z.object({ start: z.date().nullable() })

/**
 * The picker's hidden text input parses a formatted string (MUI's documented
 * test seam). MUI X 9 marks it `aria-hidden`, so it is outside the a11y tree
 * and has to be found by its `name` rather than by role + accessible name.
 */
const hiddenInput = (name: string) =>
  document.querySelector<HTMLInputElement>(`input[name="${name}"]`)!
const typeDate = (name: string, text: string) =>
  fireEvent.change(hiddenInput(name), { target: { value: text } })

describeFieldContract({
  componentName: 'DatePicker',
  label: 'Start',
  schema,
  defaultValues: { start: null },
  render: (props) => withPickers(<DatePicker name="start" label="Start" {...props} />),
  getControl: () => screen.getByRole('group', { name: 'Start' }),
  expectDisabled: () => expect(hiddenInput('start')).toBeDisabled(),
  interact: async () => {
    typeDate('start', '01/15/2030')
  },
})

describe('DatePicker', () => {
  it('submits a Date under the date-fns adapter', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      withPickers(
        <Form schema={schema} defaultValues={{ start: null }} onSubmit={onSubmit}>
          <DatePicker name="start" label="Start" />
          <button type="submit">Go</button>
        </Form>,
      ),
    )
    typeDate('start', '01/15/2030')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ start: new Date(2030, 0, 15) }, expect.anything())
  })

  it('reflects a default Date in the hidden input', () => {
    render(
      withPickers(
        <Form schema={schema} defaultValues={{ start: new Date(2030, 5, 1) }} onSubmit={() => {}}>
          <DatePicker name="start" label="Start" />
        </Form>,
      ),
    )
    expect(hiddenInput('start')).toHaveValue('06/01/2030')
  })

  it("shows the picker's minDate error through the field and blocks submit", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      withPickers(
        <Form schema={schema} defaultValues={{ start: null }} onSubmit={onSubmit}>
          <DatePicker name="start" label="Start" minDate={new Date(2030, 0, 1)} />
          <button type="submit">Go</button>
        </Form>,
      ),
    )
    typeDate('start', '12/31/2029')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Start is too early.')
    expect(screen.getByRole('group', { name: 'Start' })).toHaveAttribute('aria-invalid', 'true')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('lets errorMessages override a code', async () => {
    const user = userEvent.setup()
    render(
      withPickers(
        <Form schema={schema} defaultValues={{ start: null }} onSubmit={() => {}}>
          <DatePicker
            name="start"
            label="Start"
            disablePast
            errorMessages={{ disablePast: 'No time travel' }}
          />
          <button type="submit">Go</button>
        </Form>,
      ),
    )
    typeDate('start', '01/01/2000')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByText('No time travel')).toBeInTheDocument()
  })

  it('keeps a consumer validate alongside the picker rule', async () => {
    const user = userEvent.setup()
    render(
      withPickers(
        <Form schema={schema} defaultValues={{ start: null }} onSubmit={() => {}}>
          <DatePicker
            name="start"
            label="Start"
            validate={(d) => (d instanceof Date && d.getDay() !== 0) || 'Not a Sunday'}
          />
          <button type="submit">Go</button>
        </Form>,
      ),
    )
    typeDate('start', '01/06/2030') // a Sunday
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByText('Not a Sunday')).toBeInTheDocument()
  })

  it('keeps the error announced when a consumer passes nested textField slotProps', async () => {
    const user = userEvent.setup()
    render(
      withPickers(
        <Form schema={schema} defaultValues={{ start: null }} onSubmit={() => {}}>
          <DatePicker
            name="start"
            label="Start"
            required
            slotProps={{ textField: { slotProps: { input: { className: 'consumer-input' } } } }}
          />
          <button type="submit">Go</button>
        </Form>,
      ),
    )
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Start is required.')
    // …and the consumer's own nested slot survives the merge.
    expect(document.querySelector('.consumer-input')).toBeInTheDocument()
  })

  it('runs a consumer textField onBlur after the form handler', async () => {
    const user = userEvent.setup()
    // The form's handler must run first; `touchedFields` is set synchronously by
    // it, so reading it from inside the consumer's onBlur proves the ordering.
    const order: string[] = []
    let form: FormMethods<z.input<typeof schema>, z.output<typeof schema>> | null = null
    const onBlur = vi.fn(() => {
      order.push(form?.getFieldState('start').isTouched ? 'form-first' : 'consumer-first')
    })
    render(
      withPickers(
        <Form
          schema={schema}
          defaultValues={{ start: null }}
          onSubmit={() => {}}
          ref={(methods) => {
            form = methods
          }}
        >
          <DatePicker name="start" label="Start" slotProps={{ textField: { onBlur } }} />
          <button type="submit">Go</button>
        </Form>,
      ),
    )
    await user.click(screen.getByRole('group', { name: 'Start' }))
    await user.tab()
    expect(onBlur).toHaveBeenCalledTimes(1)
    expect(order).toEqual(['form-first'])
  })

  it('clears the picker error once the value comes back in range', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      withPickers(
        <Form schema={schema} defaultValues={{ start: null }} onSubmit={onSubmit}>
          <DatePicker name="start" label="Start" minDate={new Date(2030, 0, 1)} />
          <button type="submit">Go</button>
        </Form>,
      ),
    )
    typeDate('start', '12/31/2029')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Start is too early.')
    expect(onSubmit).not.toHaveBeenCalled()

    typeDate('start', '01/15/2030')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('calls consumer onChange and onError after the form', async () => {
    const onChange = vi.fn()
    const onError = vi.fn()
    render(
      withPickers(
        <Form schema={schema} defaultValues={{ start: null }} onSubmit={() => {}}>
          <DatePicker
            name="start"
            label="Start"
            minDate={new Date(2030, 0, 1)}
            onChange={onChange}
            onError={onError}
          />
        </Form>,
      ),
    )
    typeDate('start', '12/31/2029')
    expect(onChange).toHaveBeenCalledWith(
      new Date(2029, 11, 31),
      expect.objectContaining({ validationError: 'minDate' }),
    )
    expect(onError).toHaveBeenCalledWith('minDate', expect.any(Date))
  })
})
