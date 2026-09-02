import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { z } from 'zod'
import { Form } from '../../Form'
import { TimePicker } from './TimePicker'
import { describeFieldContract } from '../../test/describeFieldContract'
import { withPickers } from '../../test/pickers'

const schema = z.object({ at: z.date().nullable() })

/** See DatePicker.test.tsx: MUI X 9's hidden input is `aria-hidden`, so query it by name. */
const hiddenInput = (name: string) =>
  document.querySelector<HTMLInputElement>(`input[name="${name}"]`)!
const typeTime = (name: string, text: string) =>
  fireEvent.change(hiddenInput(name), { target: { value: text } })

describeFieldContract({
  componentName: 'TimePicker',
  label: 'At',
  schema,
  defaultValues: { at: null },
  render: (props) => withPickers(<TimePicker name="at" label="At" {...props} />),
  getControl: () => screen.getByRole('group', { name: 'At' }),
  requiredNotAnnounced: true,
  expectDisabled: () => expect(hiddenInput('at')).toBeDisabled(),
  interact: async () => {
    typeTime('at', '09:30 AM')
  },
})

describe('TimePicker', () => {
  it('submits a Date carrying the time', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      withPickers(
        <Form schema={schema} defaultValues={{ at: null }} onSubmit={onSubmit}>
          <TimePicker name="at" label="At" />
          <button type="submit">Go</button>
        </Form>,
      ),
    )
    typeTime('at', '09:30 AM')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    const at = onSubmit.mock.calls[0]?.[0].at as Date
    expect(at.getHours()).toBe(9)
    expect(at.getMinutes()).toBe(30)
  })

  it("shows the picker's minTime error through the field", async () => {
    const user = userEvent.setup()
    render(
      withPickers(
        <Form schema={schema} defaultValues={{ at: null }} onSubmit={() => {}}>
          <TimePicker name="at" label="At" minTime={new Date(2030, 0, 1, 12, 0)} />
          <button type="submit">Go</button>
        </Form>,
      ),
    )
    typeTime('at', '09:30 AM')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('At is too early.')
  })

  // QA #73 (noted "not in scope" as unconfirmed for TimePicker specifically,
  // shares `usePickerField` with the other three): see DateField.test.tsx for
  // the root cause (MUI X collapses an unparsable string to `(null, {
  // validationError: null })`, identical to a genuine clear); `usePickerField`
  // tells them apart via the hidden input's raw text.
  it('shows an invalid-date error and blocks submit for an unparsable time', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      withPickers(
        <Form schema={schema} defaultValues={{ at: null }} onSubmit={onSubmit}>
          <TimePicker name="at" label="At" />
          <button type="submit">Go</button>
        </Form>,
      ),
    )
    typeTime('at', 'half past nine')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('At is invalid.')
    expect(screen.getByRole('group', { name: 'At' })).toHaveAttribute('aria-invalid', 'true')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('still submits null with no error once cleared back to genuinely empty', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      withPickers(
        <Form
          schema={schema}
          defaultValues={{ at: new Date(2030, 5, 1, 9, 30) }}
          onSubmit={onSubmit}
        >
          <TimePicker name="at" label="At" />
          <button type="submit">Go</button>
        </Form>,
      ),
    )
    typeTime('at', '')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ at: null }, expect.anything()))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
