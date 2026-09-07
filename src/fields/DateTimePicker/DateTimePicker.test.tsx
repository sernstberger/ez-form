import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { z } from 'zod'
import { Form } from '../../Form'
import { DateTimePicker } from './DateTimePicker'
import { describeFieldContract } from '../../test/describeFieldContract'
import { withPickers, pasteAllText, clearButton } from '../../test/pickers'
import { expectTargetSize } from '../../test/targetSize'

const schema = z.object({ when: z.date().nullable() })

/** See DatePicker.test.tsx: MUI X 9's hidden input is `aria-hidden`, so query it by name. */
const hiddenInput = (name: string) =>
  document.querySelector<HTMLInputElement>(`input[name="${name}"]`)!
const typeDateTime = (name: string, text: string) =>
  fireEvent.change(hiddenInput(name), { target: { value: text } })

describeFieldContract({
  componentName: 'DateTimePicker',
  role: 'group',
  label: 'When',
  schema,
  defaultValues: { when: null },
  renderNamed: (name) =>
    withPickers(<DateTimePicker name="when" slotProps={{ textField: { 'aria-label': name } }} />),
  render: (props) => withPickers(<DateTimePicker name="when" label="When" {...props} />),
  renderDescribed: (id, props) =>
    withPickers(
      <DateTimePicker
        name="when"
        label="When"
        slotProps={{ textField: { 'aria-describedby': id } }}
        {...props}
      />,
    ),
  getControl: () => screen.getByRole('group', { name: 'When' }),
  requiredNotAnnounced: true,
  expectDisabled: () => expect(hiddenInput('when')).toBeDisabled(),
  expectSubmitted: { when: new Date(2030, 0, 15, 9, 30) },
  interact: async () => {
    typeDateTime('when', '01/15/2030 09:30 AM')
  },
})

describe('DateTimePicker', () => {
  it('submits a Date with date and time', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      withPickers(
        <Form schema={schema} defaultValues={{ when: null }} onSubmit={onSubmit}>
          <DateTimePicker name="when" label="When" />
          <button type="submit">Go</button>
        </Form>,
      ),
    )
    typeDateTime('when', '01/15/2030 09:30 AM')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ when: new Date(2030, 0, 15, 9, 30) }, expect.anything())
  })

  it("shows the picker's disableFuture error through the field", async () => {
    const user = userEvent.setup()
    render(
      withPickers(
        <Form schema={schema} defaultValues={{ when: null }} onSubmit={() => {}}>
          <DateTimePicker name="when" label="When" disableFuture />
          <button type="submit">Go</button>
        </Form>,
      ),
    )
    typeDateTime('when', '01/15/2099 09:30 AM')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('When must be in the past.')
  })

  // QA #73: a real paste (not per-section typing) of an unparsable string is
  // what silently dropped to `null` — see DateField.test.tsx for the full
  // root cause and why `pasteAllText` (Ctrl/Cmd+A then paste, matching what a
  // real paste actually does) is required over a `fireEvent.change` on the
  // hidden input, which a real paste never touches.
  it('pasting a parseable datetime round-trips to a Date (control, proves the paste simulation is faithful)', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      withPickers(
        <Form schema={schema} defaultValues={{ when: null }} onSubmit={onSubmit}>
          <DateTimePicker name="when" label="When" />
          <button type="submit">Go</button>
        </Form>,
      ),
    )
    await pasteAllText(screen.getByRole('group', { name: 'When' }), '01/15/2030 09:30 AM')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ when: new Date(2030, 0, 15, 9, 30) }, expect.anything())
  })

  it('pasting an unparsable ISO datetime shows an invalid-date error and blocks submit', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      withPickers(
        <Form schema={schema} defaultValues={{ when: null }} onSubmit={onSubmit}>
          <DateTimePicker name="when" label="When" />
          <button type="submit">Go</button>
        </Form>,
      ),
    )
    await pasteAllText(screen.getByRole('group', { name: 'When' }), '2024-03-02T10:00:00Z')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('When is invalid.')
    expect(screen.getByRole('group', { name: 'When' })).toHaveAttribute('aria-invalid', 'true')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('pasting an empty selection still submits null with no error (genuine clear)', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      withPickers(
        <Form
          schema={schema}
          defaultValues={{ when: new Date(2030, 5, 1, 9, 30) }}
          onSubmit={onSubmit}
        >
          <DateTimePicker name="when" label="When" />
          <button type="submit">Go</button>
        </Form>,
      ),
    )
    await pasteAllText(screen.getByRole('group', { name: 'When' }), '')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ when: null }, expect.anything()))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('Form requiredIndicator="optional": required stays required with no label asterisk', () => {
    const { container } = render(
      withPickers(
        <Form
          schema={schema}
          defaultValues={{ when: null }}
          onSubmit={() => {}}
          requiredIndicator="optional"
        >
          <DateTimePicker name="when" label="When" required />
        </Form>,
      ),
    )
    expect(hiddenInput('when')).toBeRequired()
    expect(container.querySelector('[class*="asterisk"]')).toBeNull()
  })

  it('Form requiredIndicator="optional": not-required gets the optional suffix in its label', () => {
    render(
      withPickers(
        <Form
          schema={schema}
          defaultValues={{ when: null }}
          onSubmit={() => {}}
          requiredIndicator="optional"
        >
          <DateTimePicker name="when" label="When" />
        </Form>,
      ),
    )
    expect(screen.getByRole('group', { name: 'When (optional)' })).toBeInTheDocument()
  })

  it.each(['medium', 'small'] as const)('%s: the picker button meets 24×24 target size', (size) => {
    render(
      withPickers(
        <Form schema={schema} defaultValues={{ when: null }} onSubmit={() => {}}>
          <DateTimePicker name="when" label="When" slotProps={{ textField: { size } }} />
        </Form>,
      ),
    )
    expectTargetSize(screen.getByRole('button', { name: 'Choose date' }))
  })

  /** Separate render: MUI X swaps the open button out for the clear button. */
  it.each(['medium', 'small'] as const)('%s: the clear button meets 24×24 target size', (size) => {
    render(
      withPickers(
        <Form schema={schema} defaultValues={{ when: new Date(2030, 5, 1, 9) }} onSubmit={() => {}}>
          <DateTimePicker
            name="when"
            label="When"
            slotProps={{ field: { clearable: true }, textField: { size } }}
          />
        </Form>,
      ),
    )
    expectTargetSize(clearButton(screen.getByRole('group', { name: 'When' })))
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
describe('DateTimePicker helper-text role cannot be displaced by a consumer (#127)', () => {
  it('announces the error even when a consumer sets a formHelperText role', async () => {
    const user = userEvent.setup()
    render(
      withPickers(
        <Form schema={schema} defaultValues={{ when: null }} onSubmit={() => {}}>
          <DateTimePicker
            name="when"
            label="When"
            required
            slotProps={{ textField: { slotProps: { formHelperText: { role: 'note' } } } }}
          />
          <button type="submit">Go</button>
        </Form>,
      ),
    )
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('When is required')
  })

  it('honours a consumer helper-text role while there is no error to announce', () => {
    render(
      withPickers(
        <Form schema={schema} defaultValues={{ when: null }} onSubmit={() => {}}>
          <DateTimePicker
            name="when"
            label="When"
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
        <Form schema={schema} defaultValues={{ when: null }} onSubmit={() => {}}>
          <DateTimePicker name="when" label="When" required />
          <button type="submit">Go</button>
        </Form>,
      ),
    )
    await user.click(screen.getByRole('button', { name: 'Go' }))
    const helper = await screen.findByRole('alert')
    const input = hiddenInput('when')
    expect(helper.id).toBeTruthy()
    expect(input.id).toBeTruthy()
    expect(helper.id).not.toBe(input.id)
    // MUI X derives the helper id from the field id; the group points at it.
    expect(helper.id).toBe(`${input.id}-helper-text`)
    expect(screen.getByRole('group', { name: 'When' })).toHaveAttribute(
      'aria-describedby',
      helper.id,
    )
  })
})
