import { createTheme, ThemeProvider } from '@mui/material/styles'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { z } from 'zod'
import { Form } from '../../Form'
import { PhoneField } from './PhoneField'
import { describeFieldContract } from '../../test/describeFieldContract'
import { expectNoA11yViolations } from '../../test/axe'

const schema = z.object({ phone: z.string() })
// Widens HTMLElement to HTMLInputElement so `.selectionStart` / `.setSelectionRange` are
// reachable; TS 7 needs it.
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
const input = () => screen.getByRole('textbox', { name: /Phone/ }) as HTMLInputElement

describeFieldContract({
  componentName: 'PhoneField',
  label: 'Phone',
  schema,
  defaultValues: { phone: '' },
  render: (props) => <PhoneField name="phone" label="Phone" {...props} />,
  getControl: () => screen.getByRole('textbox', { name: /Phone/ }),
  interact: (user) => user.type(screen.getByRole('textbox', { name: /Phone/ }), '5'),
})

function renderPhone(props: Record<string, unknown> = {}, onSubmit = vi.fn()) {
  const utils = render(
    <Form schema={schema} defaultValues={{ phone: '' }} onSubmit={onSubmit}>
      <PhoneField name="phone" label="Phone" {...props} />
      <button type="submit">Go</button>
    </Form>,
  )
  return { onSubmit, ...utils }
}

describe('PhoneField typing', () => {
  it('formats progressively as digits are typed', async () => {
    const user = userEvent.setup()
    renderPhone()
    await user.type(input(), '5')
    expect(input()).toHaveValue('5')
    await user.type(input(), '55')
    expect(input()).toHaveValue('555')
    // A separator only appears once a digit follows it, so nothing dangles.
    await user.type(input(), '55')
    expect(input()).toHaveValue('555-55')
    await user.type(input(), '55555')
    expect(input()).toHaveValue('555-555-5555')
  })

  it('stores digits only and submits them', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderPhone()
    await user.type(input(), '5551234567')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ phone: '5551234567' }, expect.anything())
  })

  it('never accepts more digits than the template holds', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderPhone()
    await user.type(input(), '55512345679999')
    expect(input()).toHaveValue('555-123-4567')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ phone: '5551234567' }, expect.anything())
  })

  it('ignores letters and punctuation typed into the field', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderPhone()
    await user.type(input(), '5a5b5-c123!4567')
    expect(input()).toHaveValue('555-123-4567')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ phone: '5551234567' }, expect.anything())
  })

  it('formats with a custom template and keeps its digit capacity', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderPhone({ format: '(###) ###-####' })
    await user.type(input(), '5')
    expect(input()).toHaveValue('(5')
    await user.type(input(), '551234567')
    expect(input()).toHaveValue('(555) 123-4567')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ phone: '5551234567' }, expect.anything())
  })
})

describe('PhoneField pasting', () => {
  it.each([
    ['(555) 555-5555', '555-555-5555', '5555555555'],
    ['+1 555 555 5555', '555-555-5555', '5555555555'],
    ['555.555.5555', '555-555-5555', '5555555555'],
    ['5555555555', '555-555-5555', '5555555555'],
    // 11 digits with no leading 1 is not a country code, so it truncates instead.
    ['25555555555', '255-555-5555', '2555555555'],
  ])('paste %j displays %j and stores %j', async (pasted, display, stored) => {
    const user = userEvent.setup()
    const { onSubmit } = renderPhone()
    await user.click(input())
    await user.paste(pasted)
    expect(input()).toHaveValue(display)
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ phone: stored }, expect.anything())
  })
})

describe('PhoneField editing', () => {
  it('keeps the caret with the digit being edited in the middle', async () => {
    const user = userEvent.setup()
    renderPhone()
    await user.type(input(), '5551234567')
    expect(input()).toHaveValue('555-123-4567')

    // Offset 5 is just after the "1" that opens the middle group. Typing there
    // inserts the digit at that point and pushes the rest right, rather than
    // appending at the end of the field.
    await user.type(input(), '9', { initialSelectionStart: 5, initialSelectionEnd: 5 })
    expect(input()).toHaveValue('555-19' + '2-3456')
    // The caret follows the digit it just inserted, so the next keystroke
    // continues where the user is looking.
    expect(input().selectionStart).toBe(6)
  })

  it('Backspace over a separator deletes the digit before it', async () => {
    const user = userEvent.setup()
    renderPhone()
    await user.type(input(), '5551234')
    expect(input()).toHaveValue('555-123-4')

    // Caret at offset 8, i.e. immediately after the second separator. Backspace
    // removes only the separator, which alone would leave the digits untouched
    // and reinsert it — so the field deletes the digit that separator follows
    // (the "3") instead, and the key does what the user meant.
    await user.type(input(), '{Backspace}', { initialSelectionStart: 8, initialSelectionEnd: 8 })
    expect(input()).toHaveValue('555-124')
    // The caret stays put at the deletion point rather than jumping to the end.
    expect(input().selectionStart).toBe(6)
  })

  it('deleting from the end shortens the formatted text', async () => {
    const user = userEvent.setup()
    renderPhone()
    await user.type(input(), '5551234567')
    await user.type(input(), '{Backspace}{Backspace}{Backspace}{Backspace}')
    expect(input()).toHaveValue('555-123')
    expect(input().selectionStart).toBe(7)
  })

  it('selecting all and retyping replaces the value', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderPhone()
    await user.type(input(), '5551234567')
    await user.clear(input())
    expect(input()).toHaveValue('')
    await user.type(input(), '2125550000')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ phone: '2125550000' }, expect.anything())
  })
})

describe('PhoneField paste over a selection (#16 C1)', () => {
  // Every earlier paste case starts from an empty field, so none of them could
  // catch a replacement edit destroying a digit. These all start from a value.
  it.each([
    ['same length', '5551234567', '555-123-4567'],
    // Nine digits is deliberately incomplete: it must survive the paste intact
    // (the bug truncated it further), and then fail the completeness rule.
    ['shorter', '212555000', '212-555-000'],
    ['longer than the current value', '2125550000', '212-555-0000'],
    ['formatted', '(212) 555-0000', '212-555-0000'],
  ])('select-all then paste %s keeps every pasted digit', async (_label, pasted, display) => {
    const user = userEvent.setup()
    renderPhone()
    await user.type(input(), '5551234567')
    await user.tripleClick(input())
    await user.paste(pasted)
    expect(input()).toHaveValue(display)
  })

  it('a complete pasted number submits as digits', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderPhone()
    await user.type(input(), '5551234567')
    await user.tripleClick(input())
    await user.paste('(212) 555-0000')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ phone: '2125550000' }, expect.anything())
  })

  it('pasting over a partial selection replaces only the selected digits', async () => {
    const user = userEvent.setup()
    renderPhone()
    await user.type(input(), '5551234567')
    // Offsets 4..7 cover the middle group's "123".
    input().setSelectionRange(4, 7)
    await user.paste('99')
    expect(input()).toHaveValue('555-994-567')
  })
})

describe('PhoneField Delete and Backspace on a separator (#16 C2)', () => {
  it('forward Delete just before a separator removes the digit after it', async () => {
    const user = userEvent.setup()
    renderPhone()
    await user.type(input(), '5551234567')
    // Caret 3 sits just before the first "-"; Delete must take the "1", not a "5".
    await user.type(input(), '{Delete}', { initialSelectionStart: 3, initialSelectionEnd: 3 })
    expect(input()).toHaveValue('555-234-567')
  })

  it('forward Delete mid-group removes the digit in front of the caret', async () => {
    const user = userEvent.setup()
    renderPhone()
    await user.type(input(), '5551234567')
    await user.type(input(), '{Delete}', { initialSelectionStart: 5, initialSelectionEnd: 5 })
    expect(input()).toHaveValue('555-134-567')
  })

  it('Backspace just after a separator removes the digit before it, on "(###) ###-####"', async () => {
    const user = userEvent.setup()
    renderPhone({ format: '(###) ###-####' })
    await user.type(input(), '5551234567')
    expect(input()).toHaveValue('(555) 123-4567')
    // Offset 6 is just after the ") "; the digit before it is the third "5".
    await user.type(input(), '{Backspace}', { initialSelectionStart: 6, initialSelectionEnd: 6 })
    expect(input()).toHaveValue('(551) 234-567')
  })

  it('forward Delete before a separator on "(###) ###-####"', async () => {
    const user = userEvent.setup()
    renderPhone({ format: '(###) ###-####' })
    await user.type(input(), '5551234567')
    // Offset 4 is just before the ")"; Delete takes the "1" across it.
    await user.type(input(), '{Delete}', { initialSelectionStart: 4, initialSelectionEnd: 4 })
    expect(input()).toHaveValue('(555) 234-567')
  })
})

describe('PhoneField deleting a selection (#16 I2)', () => {
  it('removes exactly the selected digits and leaves the caret where they were', async () => {
    const user = userEvent.setup()
    renderPhone()
    await user.type(input(), '5551234567')
    // Offsets 4..7 cover "123": three digits from index 3.
    await user.type(input(), '{Backspace}', { initialSelectionStart: 4, initialSelectionEnd: 7 })
    expect(input()).toHaveValue('555-456-7')
    // Caret sits after the 3rd digit, i.e. where the removed run started.
    expect(input().selectionStart).toBe(3)
  })

  it('a selection spanning a separator drops only the digits inside it', async () => {
    const user = userEvent.setup()
    renderPhone()
    await user.type(input(), '5551234567')
    // Offsets 2..9 cover "5-123-4".
    await user.type(input(), '{Backspace}', { initialSelectionStart: 2, initialSelectionEnd: 9 })
    expect(input()).toHaveValue('555-67')
    expect(input().selectionStart).toBe(2)
  })

  it('select-all then Backspace empties the field', async () => {
    const user = userEvent.setup()
    renderPhone()
    await user.type(input(), '5551234567')
    await user.tripleClick(input())
    await user.type(input(), '{Backspace}', { skipClick: true })
    expect(input()).toHaveValue('')
  })
})

describe('PhoneField validation', () => {
  it('rejects an incomplete number with the default invalid message', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderPhone()
    await user.type(input(), '55512')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a 10-digit phone number')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('derives the default message digit count from a custom template', async () => {
    const user = userEvent.setup()
    renderPhone({ format: '###-####' })
    await user.type(input(), '555')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a 7-digit phone number')
  })

  it('uses a consumer invalidMessage', async () => {
    const user = userEvent.setup()
    renderPhone({ invalidMessage: 'That phone number looks short' })
    await user.type(input(), '55512')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('That phone number looks short')
  })

  it('accepts a complete number', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderPhone()
    await user.type(input(), '5551234567')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(onSubmit).toHaveBeenCalledWith({ phone: '5551234567' }, expect.anything())
  })

  it('an empty optional field passes: the completeness rule only guards non-empty values', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderPhone()
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ phone: '' }, expect.anything())
  })

  it('empty + required reports the required message, not the invalid one', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderPhone({ required: true })
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Phone is required.')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('runs a consumer validate alongside the built-in completeness rule', async () => {
    const user = userEvent.setup()
    renderPhone({
      validate: { notFiveFive: (v: string) => !v.startsWith('555') || 'No 555 numbers' },
    })
    await user.type(input(), '5551234567')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No 555 numbers')
  })
})

describe('PhoneField input attributes', () => {
  it('sets type, inputMode and the tel autoComplete default', () => {
    renderPhone()
    expect(input()).toHaveAttribute('type', 'tel')
    expect(input()).toHaveAttribute('inputmode', 'tel')
    expect(input()).toHaveAttribute('autocomplete', 'tel')
  })

  it("a consumer's autoComplete wins over the default", () => {
    renderPhone({ autoComplete: 'shipping tel' })
    expect(input()).toHaveAttribute('autocomplete', 'shipping tel')
  })

  it('keeps inputMode=tel when a consumer sets an unrelated slotProps.htmlInput key', () => {
    // PhoneField sets `inputMode` itself through `mergeSlotProps`, rather than
    // leaning on TextField's `type="tel"` fallback (which agrees, but is a
    // different code path). Merging a sibling key must not drop it.
    renderPhone({ slotProps: { htmlInput: { 'data-testid': 'phone-input' } } })
    expect(input()).toHaveAttribute('inputmode', 'tel')
    expect(input()).toHaveAttribute('data-testid', 'phone-input')
  })

  it("a consumer's own slotProps.htmlInput.inputMode still wins", () => {
    renderPhone({ slotProps: { htmlInput: { inputMode: 'numeric' } } })
    expect(input()).toHaveAttribute('inputmode', 'numeric')
  })
})

describe('PhoneField under <Form assisted> (#65)', () => {
  it('emits autoComplete="off" instead of the tel default', () => {
    render(
      <Form schema={schema} defaultValues={{ phone: '' }} onSubmit={vi.fn()} assisted>
        <PhoneField name="phone" label="Phone" />
      </Form>,
    )
    expect(input()).toHaveAttribute('autocomplete', 'off')
  })

  it('a consumer autoComplete still wins under assisted', () => {
    render(
      <Form schema={schema} defaultValues={{ phone: '' }} onSubmit={vi.fn()} assisted>
        <PhoneField name="phone" label="Phone" autoComplete="shipping tel" />
      </Form>,
    )
    expect(input()).toHaveAttribute('autocomplete', 'shipping tel')
  })
})

describe('PhoneField a11y', () => {
  it('has no violations in the default state', async () => {
    const { container } = renderPhone({ helperText: 'We only call about your claim' })
    await expectNoA11yViolations(container)
  })

  it('has no violations while showing the incomplete-number error', async () => {
    const user = userEvent.setup()
    const { container } = renderPhone()
    await user.type(input(), '55512')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    await screen.findByRole('alert')
    await expectNoA11yViolations(container)
  })
})

describe('PhoneField form integration', () => {
  it('displays a formatted value that arrives from defaultValues', () => {
    render(
      <Form schema={schema} defaultValues={{ phone: '5551234567' }} onSubmit={() => {}}>
        <PhoneField name="phone" label="Phone" />
      </Form>,
    )
    expect(input()).toHaveValue('555-123-4567')
  })

  it('Form requiredIndicator="optional": not-required gets the optional suffix', () => {
    render(
      <Form
        schema={schema}
        defaultValues={{ phone: '' }}
        onSubmit={() => {}}
        requiredIndicator="optional"
      >
        <PhoneField name="phone" label="Phone" />
      </Form>,
    )
    expect(screen.getByRole('textbox', { name: 'Phone (optional)' })).toBeInTheDocument()
  })
})

describe('PhoneField theming', () => {
  it('takes format and invalidMessage from theme defaultProps', async () => {
    const user = userEvent.setup()
    const theme = createTheme({
      components: {
        EzPhoneField: {
          defaultProps: { format: '(###) ###-####', invalidMessage: 'Whole number please' },
        },
      },
    })
    render(
      <ThemeProvider theme={theme}>
        <Form schema={schema} defaultValues={{ phone: '' }} onSubmit={() => {}}>
          <PhoneField name="phone" label="Phone" />
          <button type="submit">Go</button>
        </Form>
      </ThemeProvider>,
    )
    await user.type(input(), '55512')
    expect(input()).toHaveValue('(555) 12')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Whole number please')
  })

  it("a prop on the element still wins over the theme's default", async () => {
    const user = userEvent.setup()
    const theme = createTheme({
      components: { EzPhoneField: { defaultProps: { format: '(###) ###-####' } } },
    })
    render(
      <ThemeProvider theme={theme}>
        <Form schema={schema} defaultValues={{ phone: '' }} onSubmit={() => {}}>
          <PhoneField name="phone" label="Phone" format="###.###.####" />
        </Form>
      </ThemeProvider>,
    )
    await user.type(input(), '5551234567')
    expect(input()).toHaveValue('555.123.4567')
  })
})

describe('PhoneField edge cases', () => {
  it('replacing a full selection by typing over it works', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderPhone()
    await user.type(input(), '5551234567')
    expect(input()).toHaveValue('555-123-4567')
    // `skipClick`, because `type`'s own click would collapse the selection the
    // triple-click just made — this is the select-all-then-retype path.
    await user.tripleClick(input())
    await user.type(input(), '2125550000', { skipClick: true })
    expect(input()).toHaveValue('212-555-0000')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ phone: '2125550000' }, expect.anything())
  })

  it('a long paste is normalised rather than clipped: no maxLength caps the input', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderPhone()
    await user.click(input())
    // Longer than the rendered template, so a `maxLength` on the input would
    // have truncated the tail before this field ever saw it.
    await user.paste('tel: +1 (555) 123-4567 ext')
    expect(input()).toHaveValue('555-123-4567')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ phone: '5551234567' }, expect.anything())
  })

  it('pasting over a full value replaces it', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderPhone()
    await user.type(input(), '5551234567')
    await user.tripleClick(input())
    await user.paste('(212) 555-0000')
    expect(input()).toHaveValue('212-555-0000')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ phone: '2125550000' }, expect.anything())
  })

  it('a consumer onChange sees the normalised digits, not the raw text', async () => {
    const user = userEvent.setup()
    const seen: string[] = []
    renderPhone({
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => seen.push(e.target.value),
    })
    await user.click(input())
    await user.paste('(555) 123-4567')
    expect(seen).toEqual(['5551234567'])
  })
})
