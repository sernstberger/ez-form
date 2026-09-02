import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { z } from 'zod'
import { Form } from '../../Form'
import { DateTimePicker } from './DateTimePicker'
import { describeFieldContract } from '../../test/describeFieldContract'
import { withPickers } from '../../test/pickers'

const schema = z.object({ when: z.date().nullable() })

/** See DatePicker.test.tsx: MUI X 9's hidden input is `aria-hidden`, so query it by name. */
const hiddenInput = (name: string) =>
  document.querySelector<HTMLInputElement>(`input[name="${name}"]`)!
const typeDateTime = (name: string, text: string) =>
  fireEvent.change(hiddenInput(name), { target: { value: text } })

describeFieldContract({
  componentName: 'DateTimePicker',
  label: 'When',
  schema,
  defaultValues: { when: null },
  render: (props) => withPickers(<DateTimePicker name="when" label="When" {...props} />),
  getControl: () => screen.getByRole('group', { name: 'When' }),
  requiredNotAnnounced: true,
  expectDisabled: () => expect(hiddenInput('when')).toBeDisabled(),
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
})
