/**
 * QA breaker probe — throwaway. Confirms: does an unparsable/wrong-format
 * pasted date get REJECTED WITH A MESSAGE, or silently dropped to null with
 * no visible error and no aria-invalid? Checks the DOM in detail (not just
 * role=alert) and compares against a bare MUI DatePicker (no ez-form binding)
 * to see whether this is ez-form's bug or upstream MUI X behavior.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { z } from 'zod'
import { useState } from 'react'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { DatePicker as MuiDatePicker } from '@mui/x-date-pickers/DatePicker'
import { Form } from '../../Form'
import { DatePicker } from '../../fields/DatePicker/DatePicker'

const withPickers = (el: React.ReactElement) => (
  <LocalizationProvider dateAdapter={AdapterDateFns}>{el}</LocalizationProvider>
)

const hiddenInput = (name: string) =>
  document.querySelector<HTMLInputElement>(`input[name="${name}"]`)!
const typeDate = (name: string, text: string) =>
  fireEvent.change(hiddenInput(name), { target: { value: text } })

const schema = z.object({ start: z.date().nullable() })

describe('ez-form DatePicker: unparsable paste gives no visible feedback', () => {
  it('after pasting "March 2, 2024" and submitting, the field shows no error text, no aria-invalid, group looks valid', async () => {
    const onSubmit = vi.fn()
    render(
      withPickers(
        <Form schema={schema} defaultValues={{ start: null }} onSubmit={onSubmit}>
          <DatePicker name="start" label="Start" />
          <button type="submit">Go</button>
        </Form>,
      ),
    )
    typeDate('start', 'March 2, 2024')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Go' }))

    const group = screen.getByRole('group', { name: 'Start' })
    console.log('group aria-invalid:', group.getAttribute('aria-invalid'))
    console.log('any role=alert present:', screen.queryAllByRole('alert').length)
    console.log('submitted value:', JSON.stringify(onSubmit.mock.calls[0]?.[0]))
    console.log('hidden input after submit:', hiddenInput('start').value)
    console.log('form was allowed to "succeed" (onSubmit called) with start=null:', onSubmit.mock.calls.length > 0)
  })

  it('required + unparsable paste: does required catch it, or does it look like an empty-but-valid submit?', async () => {
    const onSubmit = vi.fn()
    render(
      withPickers(
        <Form schema={schema} defaultValues={{ start: null }} onSubmit={onSubmit}>
          <DatePicker name="start" label="Start" required />
          <button type="submit">Go</button>
        </Form>,
      ),
    )
    typeDate('start', 'March 2, 2024')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Go' }))
    console.log('required+unparsable: submitted?', onSubmit.mock.calls.length > 0)
    console.log('required+unparsable: alert text:', screen.queryByRole('alert')?.textContent)
  })
})

describe('Baseline: bare MUI X DatePicker (no ez-form) with the same unparsable string', () => {
  function Harness() {
    const [value, setValue] = useState<Date | null>(null)
    const [error, setError] = useState<string | null>(null)
    return (
      <MuiDatePicker
        label="Start"
        value={value}
        onChange={(v) => setValue(v)}
        onError={(e) => setError(e)}
        slotProps={{ textField: { helperText: error } }}
      />
    )
  }

  it('bare MUI DatePicker: onError callback for "March 2, 2024"', async () => {
    render(withPickers(<Harness />))
    const input = screen.getByRole('textbox', { name: 'Start' })
    fireEvent.change(input, { target: { value: 'March 2, 2024' } })
    // MUI sets helperText from onError synchronously via state; check DOM
    await new Promise((r) => setTimeout(r, 0))
    console.log('bare MUI helperText after unparsable paste:', screen.queryByText(/./)?.textContent)
    const allText = document.body.textContent
    console.log('bare MUI full body text:', allText)
  })
})
