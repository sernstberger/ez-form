import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { z } from 'zod'
import { Form, type FormMethods } from '../../Form'
import { DateField } from './DateField'
import { describeFieldContract } from '../../test/describeFieldContract'
import { withPickers } from '../../test/pickers'

const schema = z.object({ birthday: z.date().nullable() })

/**
 * `DateField` renders its own hidden text input the same way `DatePicker`
 * does (MUI's documented test seam, `aria-hidden` in MUI X 9), found by
 * `name` rather than role + accessible name.
 */
const hiddenInput = (name: string) =>
  document.querySelector<HTMLInputElement>(`input[name="${name}"]`)!
const typeDate = (name: string, text: string) =>
  fireEvent.change(hiddenInput(name), { target: { value: text } })

describeFieldContract({
  componentName: 'DateField',
  label: 'Birthday',
  schema,
  defaultValues: { birthday: null },
  render: (props) => withPickers(<DateField name="birthday" label="Birthday" {...props} />),
  getControl: () => screen.getByRole('group', { name: 'Birthday' }),
  requiredNotAnnounced: true,
  expectDisabled: () => expect(hiddenInput('birthday')).toBeDisabled(),
  interact: async () => {
    typeDate('birthday', '03/02/1985')
  },
})

describe('DateField', () => {
  it('submits a Date under the date-fns adapter for a typed past date', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      withPickers(
        <Form schema={schema} defaultValues={{ birthday: null }} onSubmit={onSubmit}>
          <DateField name="birthday" label="Birthday" disableFuture />
          <button type="submit">Go</button>
        </Form>,
      ),
    )
    typeDate('birthday', '03/02/1985')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ birthday: new Date(1985, 2, 2) }, expect.anything())
  })

  it('reflects a default Date in the hidden input', () => {
    render(
      withPickers(
        <Form
          schema={schema}
          defaultValues={{ birthday: new Date(1990, 5, 1) }}
          onSubmit={() => {}}
        >
          <DateField name="birthday" label="Birthday" />
        </Form>,
      ),
    )
    expect(hiddenInput('birthday')).toHaveValue('06/01/1990')
  })

  it('shows the mapped disableFuture message and blocks submit for a future date', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      withPickers(
        <Form schema={schema} defaultValues={{ birthday: null }} onSubmit={onSubmit}>
          <DateField name="birthday" label="Birthday" disableFuture />
          <button type="submit">Go</button>
        </Form>,
      ),
    )
    typeDate('birthday', '01/01/2999')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Birthday must be in the past.')
    expect(screen.getByRole('group', { name: 'Birthday' })).toHaveAttribute('aria-invalid', 'true')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('lets errorMessages override a code', async () => {
    const user = userEvent.setup()
    render(
      withPickers(
        <Form schema={schema} defaultValues={{ birthday: null }} onSubmit={() => {}}>
          <DateField
            name="birthday"
            label="Birthday"
            disableFuture
            errorMessages={{ disableFuture: 'No time travel' }}
          />
          <button type="submit">Go</button>
        </Form>,
      ),
    )
    typeDate('birthday', '01/01/2999')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByText('No time travel')).toBeInTheDocument()
  })

  it('shows the minDate error through the field and blocks submit', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      withPickers(
        <Form schema={schema} defaultValues={{ birthday: null }} onSubmit={onSubmit}>
          <DateField name="birthday" label="Birthday" minDate={new Date(1900, 0, 1)} />
          <button type="submit">Go</button>
        </Form>,
      ),
    )
    typeDate('birthday', '01/01/1899')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Birthday is too early.')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('keeps a consumer validate alongside the picker rule', async () => {
    const user = userEvent.setup()
    render(
      withPickers(
        <Form schema={schema} defaultValues={{ birthday: null }} onSubmit={() => {}}>
          <DateField
            name="birthday"
            label="Birthday"
            validate={(d) => (d instanceof Date && d.getDay() !== 0) || 'Not a Sunday'}
          />
          <button type="submit">Go</button>
        </Form>,
      ),
    )
    typeDate('birthday', '01/06/2030') // a Sunday
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByText('Not a Sunday')).toBeInTheDocument()
  })

  it('keeps the error announced when a consumer passes nested textField slotProps', async () => {
    const user = userEvent.setup()
    render(
      withPickers(
        <Form schema={schema} defaultValues={{ birthday: null }} onSubmit={() => {}}>
          <DateField
            name="birthday"
            label="Birthday"
            required
            slotProps={{ textField: { slotProps: { htmlInput: { className: 'consumer-input' } } } }}
          />
          <button type="submit">Go</button>
        </Form>,
      ),
    )
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Birthday is required.')
    // …and the consumer's own nested slot survives the merge.
    expect(document.querySelector('.consumer-input')).toBeInTheDocument()
  })

  it('runs a consumer onBlur after the form handler', async () => {
    const user = userEvent.setup()
    // The form's handler must run first; `touchedFields` is set synchronously by
    // it, so reading it from inside the consumer's onBlur proves the ordering.
    const order: string[] = []
    let form: FormMethods<z.input<typeof schema>, z.output<typeof schema>> | null = null
    const onBlur = vi.fn(() => {
      order.push(form?.getFieldState('birthday').isTouched ? 'form-first' : 'consumer-first')
    })
    render(
      withPickers(
        <Form
          schema={schema}
          defaultValues={{ birthday: null }}
          onSubmit={() => {}}
          ref={(methods) => {
            form = methods
          }}
        >
          <DateField name="birthday" label="Birthday" onBlur={onBlur} />
          <button type="submit">Go</button>
        </Form>,
      ),
    )
    await user.click(screen.getByRole('group', { name: 'Birthday' }))
    await user.tab()
    expect(onBlur).toHaveBeenCalledTimes(1)
    expect(order).toEqual(['form-first'])
  })

  it('clears the picker error once the value comes back in range', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      withPickers(
        <Form schema={schema} defaultValues={{ birthday: null }} onSubmit={onSubmit}>
          <DateField name="birthday" label="Birthday" minDate={new Date(1900, 0, 1)} />
          <button type="submit">Go</button>
        </Form>,
      ),
    )
    typeDate('birthday', '01/01/1899')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Birthday is too early.')
    expect(onSubmit).not.toHaveBeenCalled()

    typeDate('birthday', '03/02/1985')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('calls consumer onChange and onError after the form', async () => {
    const onChange = vi.fn()
    const onError = vi.fn()
    render(
      withPickers(
        <Form schema={schema} defaultValues={{ birthday: null }} onSubmit={() => {}}>
          <DateField
            name="birthday"
            label="Birthday"
            minDate={new Date(1900, 0, 1)}
            onChange={onChange}
            onError={onError}
          />
        </Form>,
      ),
    )
    typeDate('birthday', '01/01/1899')
    expect(onChange).toHaveBeenCalledWith(
      new Date(1899, 0, 1),
      expect.objectContaining({ validationError: 'minDate' }),
    )
    expect(onError).toHaveBeenCalledWith('minDate', expect.any(Date))
  })
})
