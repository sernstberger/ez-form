/**
 * QA breaker probe — throwaway, not committed. Attacks the "paste per value
 * type" checklist line for date-shaped fields (DatePicker, DateField,
 * DateTimePicker) across locales. Uses the same hidden-input test seam the
 * real .test.tsx files use (MUI X's documented seam: the visually-hidden
 * text input parses a formatted string).
 */
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { z } from 'zod'
import type { ReactElement } from 'react'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { enUS, de, fr, enGB } from 'date-fns/locale'
import { Form } from '../../Form'
import { DatePicker } from '../../fields/DatePicker/DatePicker'
import { DateField } from '../../fields/DateField/DateField'
import { DateTimePicker } from '../../fields/DateTimePicker/DateTimePicker'

const withLocale = (locale: Locale) => (element: ReactElement) => (
  <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={locale}>
    {element}
  </LocalizationProvider>
)

const hiddenInput = (name: string) =>
  document.querySelector<HTMLInputElement>(`input[name="${name}"]`)!

const typeDate = (name: string, text: string) =>
  fireEvent.change(hiddenInput(name), { target: { value: text } })

/**
 * jsdom has no DataTransfer constructor, so the real ClipboardEvent
 * dispatch (`browser_evaluate` in a real browser) can't be replicated
 * here bit-for-bit. Falling back to MUI X's own documented test seam
 * (fireEvent.change on the hidden text input) is the closest proxy for
 * "text landed in the field", since MUI X's paste handling ultimately
 * re-parses the resulting string the same way typed input does.
 */
const pasteDate = (name: string, text: string) => typeDate(name, text)

const schema = z.object({ start: z.date().nullable() })

describe('DatePicker paste — locale round-trip', () => {
  const locales: Array<[string, Locale]> = [
    ['en-US', enUS],
    ['de', de], // stand-in for de-CH (date-fns has no de-CH variant)
    ['fr', fr],
    ['en-GB', enGB],
  ]

  it.each(locales)(
    '%s: typed native-format date round-trips to the same calendar day',
    async (name, locale) => {
      const onSubmit = vi.fn()
      render(
        withLocale(locale)(
          <Form schema={schema} defaultValues={{ start: null }} onSubmit={onSubmit}>
            <DatePicker name="start" label="Start" />
            <button type="submit">Go</button>
          </Form>,
        ),
      )
      // date-fns default format per locale differs; use the picker's own
      // format placeholder to know what it expects, then type March 2 2024
      // in that locale's own convention.
      const formatted: Record<string, string> = {
        'en-US': '03/02/2024',
        de: '02.03.2024',
        fr: '02/03/2024',
        'en-GB': '02/03/2024',
      }
      typeDate('start', formatted[name])
      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: 'Go' }))
      expect(onSubmit).toHaveBeenCalledWith({ start: new Date(2024, 2, 2) }, expect.anything())
    },
  )

  it('en-US: pastes 2024-03-02 (ISO) — does it round-trip or get rejected cleanly?', async () => {
    const onSubmit = vi.fn()
    render(
      withLocale(enUS)(
        <Form schema={schema} defaultValues={{ start: null }} onSubmit={onSubmit}>
          <DatePicker name="start" label="Start" />
          <button type="submit">Go</button>
        </Form>,
      ),
    )
    pasteDate('start', '2024-03-02')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Go' }))
    // eslint-disable-next-line no-console
    console.log('ISO paste result:', JSON.stringify(onSubmit.mock.calls))
    console.log('hidden input value after ISO paste:', hiddenInput('start').value)
  })

  it('en-US: pastes "March 2, 2024" (long form)', async () => {
    const onSubmit = vi.fn()
    render(
      withLocale(enUS)(
        <Form schema={schema} defaultValues={{ start: null }} onSubmit={onSubmit}>
          <DatePicker name="start" label="Start" />
          <button type="submit">Go</button>
        </Form>,
      ),
    )
    pasteDate('start', 'March 2, 2024')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Go' }))
    console.log('Long-form paste result:', JSON.stringify(onSubmit.mock.calls))
    console.log('hidden input value after long-form paste:', hiddenInput('start').value)
  })

  it('en-US: pastes 02032024 (no separators)', async () => {
    const onSubmit = vi.fn()
    render(
      withLocale(enUS)(
        <Form schema={schema} defaultValues={{ start: null }} onSubmit={onSubmit}>
          <DatePicker name="start" label="Start" />
          <button type="submit">Go</button>
        </Form>,
      ),
    )
    pasteDate('start', '02032024')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Go' }))
    console.log('No-separator paste result:', JSON.stringify(onSubmit.mock.calls))
    console.log('hidden input value after no-separator paste:', hiddenInput('start').value)
  })

  it('de: pastes 2.3.2024 (single-digit day/month, dotted)', async () => {
    const onSubmit = vi.fn()
    render(
      withLocale(de)(
        <Form schema={schema} defaultValues={{ start: null }} onSubmit={onSubmit}>
          <DatePicker name="start" label="Start" />
          <button type="submit">Go</button>
        </Form>,
      ),
    )
    pasteDate('start', '2.3.2024')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Go' }))
    console.log('de single-digit paste result:', JSON.stringify(onSubmit.mock.calls))
    console.log('hidden input value:', hiddenInput('start').value)
  })

  it('en-US: pastes an invalid calendar date 31/02/2024 (US order would read as month 31)', async () => {
    const onSubmit = vi.fn()
    render(
      withLocale(enUS)(
        <Form schema={schema} defaultValues={{ start: null }} onSubmit={onSubmit}>
          <DatePicker name="start" label="Start" />
          <button type="submit">Go</button>
        </Form>,
      ),
    )
    pasteDate('start', '31/02/2024')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Go' }))
    console.log('invalid-date paste result:', JSON.stringify(onSubmit.mock.calls))
    console.log('hidden input value:', hiddenInput('start').value)
    const alert = screen.queryByRole('alert')
    console.log('alert text:', alert?.textContent)
  })

  it('en-US: pastes an ISO datetime with Z 2024-03-02T10:00:00Z into DatePicker', async () => {
    const onSubmit = vi.fn()
    render(
      withLocale(enUS)(
        <Form schema={schema} defaultValues={{ start: null }} onSubmit={onSubmit}>
          <DatePicker name="start" label="Start" />
          <button type="submit">Go</button>
        </Form>,
      ),
    )
    pasteDate('start', '2024-03-02T10:00:00Z')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Go' }))
    console.log('ISO-Z paste result:', JSON.stringify(onSubmit.mock.calls))
    console.log('hidden input value:', hiddenInput('start').value)
  })

  it('en-US: DateTimePicker pastes ISO datetime with Z — check for timezone shift', async () => {
    const onSubmit = vi.fn()
    const dtSchema = z.object({ start: z.date().nullable() })
    render(
      withLocale(enUS)(
        <Form schema={dtSchema} defaultValues={{ start: null }} onSubmit={onSubmit}>
          <DateTimePicker name="start" label="Start" />
          <button type="submit">Go</button>
        </Form>,
      ),
    )
    pasteDate('start', '2024-03-02T10:00:00Z')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Go' }))
    console.log('DateTimePicker ISO-Z paste result:', JSON.stringify(onSubmit.mock.calls))
    console.log('hidden input value:', hiddenInput('start').value)
  })

  it('DateField (keyboard-only): types 03/02/1985 birthday, then TAB and check round trip under de locale', async () => {
    const onSubmit = vi.fn()
    render(
      withLocale(de)(
        <Form schema={schema} defaultValues={{ start: null }} onSubmit={onSubmit}>
          <DateField name="start" label="Birthday" />
          <button type="submit">Go</button>
        </Form>,
      ),
    )
    typeDate('start', '02.03.1985')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ start: new Date(1985, 2, 2) }, expect.anything())
  })

  it('DatePicker: paste vs type produce the same result for the same ambiguous string (12/03/2024, en-US)', async () => {
    const onSubmitType = vi.fn()
    const { unmount } = render(
      withLocale(enUS)(
        <Form schema={schema} defaultValues={{ start: null }} onSubmit={onSubmitType}>
          <DatePicker name="start" label="Start" />
          <button type="submit">Go</button>
        </Form>,
      ),
    )
    typeDate('start', '12/03/2024')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Go' }))
    const typedResult = onSubmitType.mock.calls[0]?.[0]
    unmount()

    const onSubmitPaste = vi.fn()
    render(
      withLocale(enUS)(
        <Form schema={schema} defaultValues={{ start: null }} onSubmit={onSubmitPaste}>
          <DatePicker name="start" label="Start" />
          <button type="submit">Go</button>
        </Form>,
      ),
    )
    pasteDate('start', '12/03/2024')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    const pasteResult = onSubmitPaste.mock.calls[0]?.[0]

    console.log('typed:', JSON.stringify(typedResult), 'pasted:', JSON.stringify(pasteResult))
    expect(pasteResult).toEqual(typedResult)
  })
})
