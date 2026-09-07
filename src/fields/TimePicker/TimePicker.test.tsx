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
  role: 'group',
  label: 'At',
  schema,
  defaultValues: { at: null },
  renderNamed: (name) =>
    withPickers(<TimePicker name="at" slotProps={{ textField: { 'aria-label': name } }} />),
  render: (props) => withPickers(<TimePicker name="at" label="At" {...props} />),
  renderDescribed: (id, props) =>
    withPickers(
      <TimePicker
        name="at"
        label="At"
        slotProps={{ textField: { 'aria-describedby': id } }}
        {...props}
      />,
    ),
  getControl: () => screen.getByRole('group', { name: 'At' }),
  requiredNotAnnounced: true,
  exempt: {
    // The visible assertion is unreachable in jsdom. MUI X registers an `aria-hidden`,
    // `tabindex="-1"` proxy input as the field's hookform `ref` (its own documented test
    // seam), so `shouldFocusError` calls `.focus()` on that and jsdom's
    // `document.activeElement` bookkeeping reports it — while a real browser redirects
    // real focus to the visible `role="spinbutton"` section instead. Two Playwright
    // passes confirmed the visible section takes focus, named and with a focus ring:
    // `docs/superpowers/reviews/2026-09-04-qa-sweep-pickers.md` §2b (#105, #122).
    // Asserting on the proxy would be a green test over a question jsdom cannot answer.
    focusesFirstInvalid:
      "jsdom reports focus on MUI X's aria-hidden proxy input; the real browser puts it " +
      'on the visible spinbutton section — docs/superpowers/reviews/2026-09-04-qa-sweep-pickers.md ' +
      '\u00a72b (#105).',
  },
  expectDisabled: () => expect(hiddenInput('at')).toBeDisabled(),
  // A time-only field parses against *today* under date-fns, so the expected date is
  // built the same way rather than hard-coded — the field stores a full `Date`.
  expectSubmitted: {
    at: (() => {
      const d = new Date()
      d.setHours(9, 30, 0, 0)
      return d
    })(),
  },
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

/**
 * #127: the picker family joins the #104 contract — the binding owns
 * `role="alert"` on the helper text and a consumer's own `role` cannot displace
 * it. The picker's twist is that it takes that ordering *without* the hook's id
 * pin: MUI X derives this `<p>`'s id from the field id (`${fieldId}-helper-text`),
 * so pinning `helperTextId` on the slot would give the `<input>` and the `<p>` the
 * same id. Both halves are asserted here.
 */
describe('TimePicker helper-text role cannot be displaced by a consumer (#127)', () => {
  it('announces the error even when a consumer sets a formHelperText role', async () => {
    const user = userEvent.setup()
    render(
      withPickers(
        <Form schema={schema} defaultValues={{ at: null }} onSubmit={() => {}}>
          <TimePicker
            name="at"
            label="At"
            required
            slotProps={{ textField: { slotProps: { formHelperText: { role: 'note' } } } }}
          />
          <button type="submit">Go</button>
        </Form>,
      ),
    )
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('At is required')
  })

  it('honours a consumer helper-text role while there is no error to announce', () => {
    render(
      withPickers(
        <Form schema={schema} defaultValues={{ at: null }} onSubmit={() => {}}>
          <TimePicker
            name="at"
            label="At"
            helperText="Any date will do"
            slotProps={{ textField: { slotProps: { formHelperText: { role: 'note' } } } }}
          />
        </Form>,
      ),
    )
    expect(screen.getByText('Any date will do')).toHaveAttribute('role', 'note')
  })

  it('keeps the input id and the helper-text id distinct', async () => {
    const user = userEvent.setup()
    render(
      withPickers(
        <Form schema={schema} defaultValues={{ at: null }} onSubmit={() => {}}>
          <TimePicker name="at" label="At" required />
          <button type="submit">Go</button>
        </Form>,
      ),
    )
    await user.click(screen.getByRole('button', { name: 'Go' }))
    const helper = await screen.findByRole('alert')
    const input = hiddenInput('at')
    expect(helper.id).toBeTruthy()
    expect(input.id).toBeTruthy()
    expect(helper.id).not.toBe(input.id)
    // MUI X derives the helper id from the field id; the group points at it.
    expect(helper.id).toBe(`${input.id}-helper-text`)
    expect(screen.getByRole('group', { name: 'At' })).toHaveAttribute('aria-describedby', helper.id)
  })
})
