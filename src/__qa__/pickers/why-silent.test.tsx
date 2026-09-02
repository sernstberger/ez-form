/**
 * QA breaker probe — throwaway. usePickerField's `picker` validate rule
 * reads `pickerError.current`, set inside `onChange`'s callback. Question:
 * does MUI X's onChange even fire (with validationError: 'invalidDate') for
 * an unparsable string, or does it just never call onChange at all (leaving
 * pickerError.current stuck at its initial null, so `validate.picker` always
 * passes)?
 */
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { z } from 'zod'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
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

it('does onChange/onError fire at all for an unparsable paste, and in what order relative to submit validation?', async () => {
  const onSubmit = vi.fn()
  const changes: unknown[] = []
  const errors: unknown[] = []
  render(
    withPickers(
      <Form schema={schema} defaultValues={{ start: null }} onSubmit={onSubmit}>
        <DatePicker
          name="start"
          label="Start"
          onChange={(v, ctx) => changes.push({ v, validationError: ctx.validationError })}
          onError={(e, v) => errors.push({ e, v })}
        />
        <button type="submit">Go</button>
      </Form>,
    ),
  )
  typeDate('start', 'March 2, 2024')
  console.log('onChange calls:', JSON.stringify(changes))
  console.log('onError calls:', JSON.stringify(errors))
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Go' }))
  console.log('after submit, onChange calls:', JSON.stringify(changes))
  console.log('after submit, onError calls:', JSON.stringify(errors))
  console.log('submitted:', JSON.stringify(onSubmit.mock.calls[0]?.[0]))
})

it('typing a garbage string with no date-like structure at all ("zzz")', async () => {
  const onSubmit = vi.fn()
  const changes: unknown[] = []
  render(
    withPickers(
      <Form schema={schema} defaultValues={{ start: null }} onSubmit={onSubmit}>
        <DatePicker
          name="start"
          label="Start"
          onChange={(v, ctx) => changes.push({ v, validationError: ctx.validationError })}
        />
        <button type="submit">Go</button>
      </Form>,
    ),
  )
  typeDate('start', 'zzz')
  console.log('onChange calls for "zzz":', JSON.stringify(changes))
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Go' }))
  console.log('submitted for "zzz":', JSON.stringify(onSubmit.mock.calls[0]?.[0]))
  console.log('alert for zzz:', screen.queryByRole('alert')?.textContent)
})
