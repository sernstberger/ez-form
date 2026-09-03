import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { z } from 'zod'
import { Form } from '../../Form'
import { TimePicker } from './TimePicker'
import { describeFieldContract } from '../../test/describeFieldContract'
import { withPickers, pasteAllText, clearButton } from '../../test/pickers'
import { expectTargetSize } from '../../test/targetSize'

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
  // shares `usePickerField` with the other three): a real paste (not
  // per-section typing) of an unparsable string is what silently dropped to
  // `null` — see DateField.test.tsx for the full root cause and why
  // `pasteAllText` (Ctrl/Cmd+A then paste, matching what a real paste
  // actually does) is required over a `fireEvent.change` on the hidden
  // input, which a real paste never touches.
  it('pasting a parseable time round-trips to a Date (control, proves the paste simulation is faithful)', async () => {
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
    await pasteAllText(screen.getByRole('group', { name: 'At' }), '09:30 AM')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    const at = onSubmit.mock.calls[0]?.[0].at as Date
    expect(at.getHours()).toBe(9)
    expect(at.getMinutes()).toBe(30)
  })

  it('pasting an unparsable time shows an invalid-date error and blocks submit', async () => {
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
    await pasteAllText(screen.getByRole('group', { name: 'At' }), 'half past nine')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('At is invalid.')
    expect(screen.getByRole('group', { name: 'At' })).toHaveAttribute('aria-invalid', 'true')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('pasting an empty selection still submits null with no error (genuine clear)', async () => {
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
    await pasteAllText(screen.getByRole('group', { name: 'At' }), '')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ at: null }, expect.anything()))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('Form requiredIndicator="optional": required stays required with no label asterisk', () => {
    const { container } = render(
      withPickers(
        <Form
          schema={schema}
          defaultValues={{ at: null }}
          onSubmit={() => {}}
          requiredIndicator="optional"
        >
          <TimePicker name="at" label="At" required />
        </Form>,
      ),
    )
    expect(hiddenInput('at')).toBeRequired()
    expect(container.querySelector('[class*="asterisk"]')).toBeNull()
  })

  it('Form requiredIndicator="optional": not-required gets the optional suffix in its label', () => {
    render(
      withPickers(
        <Form
          schema={schema}
          defaultValues={{ at: null }}
          onSubmit={() => {}}
          requiredIndicator="optional"
        >
          <TimePicker name="at" label="At" />
        </Form>,
      ),
    )
    expect(screen.getByRole('group', { name: 'At (optional)' })).toBeInTheDocument()
  })

  it.each(['medium', 'small'] as const)('%s: the clock button meets 24×24 target size', (size) => {
    render(
      withPickers(
        <Form schema={schema} defaultValues={{ at: null }} onSubmit={() => {}}>
          <TimePicker name="at" label="At" slotProps={{ textField: { size } }} />
        </Form>,
      ),
    )
    expectTargetSize(screen.getByRole('button', { name: 'Choose time' }))
  })

  /** Separate render: MUI X swaps the open button out for the clear button. */
  it.each(['medium', 'small'] as const)('%s: the clear button meets 24×24 target size', (size) => {
    render(
      withPickers(
        <Form schema={schema} defaultValues={{ at: new Date(2030, 5, 1, 9) }} onSubmit={() => {}}>
          <TimePicker
            name="at"
            label="At"
            slotProps={{ field: { clearable: true }, textField: { size } }}
          />
        </Form>,
      ),
    )
    expectTargetSize(clearButton(screen.getByRole('group', { name: 'At' })))
  })
})
