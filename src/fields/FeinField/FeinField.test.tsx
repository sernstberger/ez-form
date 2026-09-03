import { createTheme, ThemeProvider } from '@mui/material/styles'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { z } from 'zod'
import { Form } from '../../Form'
import { FeinField } from './FeinField'
import { describeFieldContract } from '../../test/describeFieldContract'
import { expectNoA11yViolations } from '../../test/axe'

const schema = z.object({ ein: z.string() })
// Widens HTMLElement to HTMLInputElement so `.value` / `.selectionStart` are reachable;
// TS 7 needs the assertion, the linter's TS 6 thinks it redundant (see eslint.config.js).
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
const input = () => screen.getByRole('textbox', { name: /EIN/ }) as HTMLInputElement

describeFieldContract({
  componentName: 'FeinField',
  label: 'EIN',
  schema,
  defaultValues: { ein: '' },
  render: (props) => <FeinField name="ein" label="EIN" {...props} />,
  getControl: () => screen.getByRole('textbox', { name: /EIN/ }),
  interact: (user) => user.type(screen.getByRole('textbox', { name: /EIN/ }), '1'),
})

function renderFein(props: Record<string, unknown> = {}, onSubmit = vi.fn()) {
  const utils = render(
    <Form schema={schema} defaultValues={{ ein: '' }} onSubmit={onSubmit}>
      <FeinField name="ein" label="EIN" {...props} />
      <button type="submit">Go</button>
    </Form>,
  )
  return { onSubmit, ...utils }
}

describe('FeinField typing', () => {
  it('formats progressively as digits are typed', async () => {
    const user = userEvent.setup()
    renderFein()
    await user.type(input(), '1')
    expect(input()).toHaveValue('1')
    // A separator only appears once a digit follows it, so nothing dangles.
    await user.type(input(), '2')
    expect(input()).toHaveValue('12')
    await user.type(input(), '3')
    expect(input()).toHaveValue('12-3')
    await user.type(input(), '456789')
    expect(input()).toHaveValue('12-3456789')
  })

  it('stores digits only and submits them', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderFein()
    await user.type(input(), '123456789')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ ein: '123456789' }, expect.anything())
  })

  it('never accepts more digits than the template holds', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderFein()
    await user.type(input(), '1234567899999')
    expect(input()).toHaveValue('12-3456789')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ ein: '123456789' }, expect.anything())
  })

  it('ignores letters and punctuation typed into the field', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderFein()
    await user.type(input(), '1a2b-3c456!789')
    expect(input()).toHaveValue('12-3456789')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ ein: '123456789' }, expect.anything())
  })

  it('formats with a custom template and keeps its digit capacity', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderFein({ format: '##/#######' })
    await user.type(input(), '123456789')
    expect(input()).toHaveValue('12/3456789')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ ein: '123456789' }, expect.anything())
  })
})

describe('FeinField pasting', () => {
  it.each([
    ['12-3456789', '12-3456789', '123456789'],
    ['123456789', '12-3456789', '123456789'],
    ['12 345 6789', '12-3456789', '123456789'],
    ['EIN: 12-3456789', '12-3456789', '123456789'],
    // No country-code convention exists for an EIN, so a 10-digit paste simply truncates.
    ['1234567890', '12-3456789', '123456789'],
  ])('paste %j displays %j and stores %j', async (pasted, display, stored) => {
    const user = userEvent.setup()
    const { onSubmit } = renderFein()
    await user.click(input())
    await user.paste(pasted)
    expect(input()).toHaveValue(display)
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ ein: stored }, expect.anything())
  })
})

describe('FeinField editing', () => {
  it('keeps the caret with the digit being edited in the middle', async () => {
    const user = userEvent.setup()
    renderFein()
    await user.type(input(), '123456789')
    expect(input()).toHaveValue('12-3456789')

    // Offset 4 is just after the "3" that opens the second group. Typing there
    // inserts the digit at that point and pushes the rest right.
    await user.type(input(), '9', { initialSelectionStart: 4, initialSelectionEnd: 4 })
    expect(input()).toHaveValue('12-3945678')
    // The caret follows the digit it just inserted.
    expect(input().selectionStart).toBe(5)
  })

  it('Backspace over the separator deletes the digit before it', async () => {
    const user = userEvent.setup()
    renderFein()
    await user.type(input(), '12345')
    expect(input()).toHaveValue('12-345')

    // Offset 3 is immediately after the separator. Backspace removes only the
    // separator, which alone would leave the digits untouched and reinsert it —
    // so the field deletes the digit the separator follows (the second "2").
    await user.type(input(), '{Backspace}', { initialSelectionStart: 3, initialSelectionEnd: 3 })
    expect(input()).toHaveValue('13-45')
    // The caret stays put at the deletion point rather than jumping to the end.
    expect(input().selectionStart).toBe(1)
  })

  it('deleting from the end shortens the formatted text', async () => {
    const user = userEvent.setup()
    renderFein()
    await user.type(input(), '123456789')
    await user.type(input(), '{Backspace}{Backspace}{Backspace}{Backspace}')
    expect(input()).toHaveValue('12-345')
    expect(input().selectionStart).toBe(6)
  })

  it('selecting all and retyping replaces the value', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderFein()
    await user.type(input(), '123456789')
    await user.clear(input())
    expect(input()).toHaveValue('')
    await user.type(input(), '987654321')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ ein: '987654321' }, expect.anything())
  })
})

describe('FeinField paste over a selection (PhoneField #16 C1, on this template)', () => {
  it.each([
    ['same length', '987654321', '98-7654321'],
    // Eight digits is deliberately incomplete: it must survive the paste intact
    // and then fail the completeness rule.
    ['shorter', '98765432', '98-765432'],
    ['formatted', '98-7654321', '98-7654321'],
  ])('select-all then paste %s keeps every pasted digit', async (_label, pasted, display) => {
    const user = userEvent.setup()
    renderFein()
    await user.type(input(), '123456789')
    await user.tripleClick(input())
    await user.paste(pasted)
    expect(input()).toHaveValue(display)
  })

  it('pasting over a partial selection replaces only the selected digits', async () => {
    const user = userEvent.setup()
    renderFein()
    await user.type(input(), '123456789')
    // Offsets 3..6 cover "345" in the second group.
    input().setSelectionRange(3, 6)
    await user.paste('00')
    expect(input()).toHaveValue('12-006789')
  })
})

describe('FeinField Delete and Backspace on the separator (PhoneField #16 C2, on this template)', () => {
  it('forward Delete just before the separator removes the digit after it', async () => {
    const user = userEvent.setup()
    renderFein()
    await user.type(input(), '123456789')
    // Caret 2 sits just before the "-"; Delete must take the "3", not a "2".
    await user.type(input(), '{Delete}', { initialSelectionStart: 2, initialSelectionEnd: 2 })
    expect(input()).toHaveValue('12-456789')
  })

  it('forward Delete mid-group removes the digit in front of the caret', async () => {
    const user = userEvent.setup()
    renderFein()
    await user.type(input(), '123456789')
    await user.type(input(), '{Delete}', { initialSelectionStart: 4, initialSelectionEnd: 4 })
    expect(input()).toHaveValue('12-356789')
  })
})

describe('FeinField deleting a selection (PhoneField #16 I2, on this template)', () => {
  it('removes exactly the selected digits and leaves the caret where they were', async () => {
    const user = userEvent.setup()
    renderFein()
    await user.type(input(), '123456789')
    // Offsets 3..6 cover "345": three digits from index 2.
    await user.type(input(), '{Backspace}', { initialSelectionStart: 3, initialSelectionEnd: 6 })
    expect(input()).toHaveValue('12-6789')
    // Caret sits after the 2nd digit, i.e. where the removed run started.
    expect(input().selectionStart).toBe(2)
  })

  it('a selection spanning the separator drops only the digits inside it', async () => {
    const user = userEvent.setup()
    renderFein()
    await user.type(input(), '123456789')
    // Offsets 1..5 cover "2-34".
    await user.type(input(), '{Backspace}', { initialSelectionStart: 1, initialSelectionEnd: 5 })
    expect(input()).toHaveValue('15-6789')
    expect(input().selectionStart).toBe(1)
  })

  it('select-all then Backspace empties the field', async () => {
    const user = userEvent.setup()
    renderFein()
    await user.type(input(), '123456789')
    await user.tripleClick(input())
    await user.type(input(), '{Backspace}', { skipClick: true })
    expect(input()).toHaveValue('')
  })
})

describe('FeinField validation', () => {
  it('rejects an incomplete number with the default invalid message', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderFein()
    await user.type(input(), '12345')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Enter a 9-digit employer identification number',
    )
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('uses a consumer invalidMessage', async () => {
    const user = userEvent.setup()
    renderFein({ invalidMessage: 'That EIN looks short' })
    await user.type(input(), '12345')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('That EIN looks short')
  })

  it('accepts a complete number', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderFein()
    await user.type(input(), '123456789')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(onSubmit).toHaveBeenCalledWith({ ein: '123456789' }, expect.anything())
  })

  it('an empty optional field passes: the completeness rule only guards non-empty values', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderFein()
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ ein: '' }, expect.anything())
  })

  it('empty + required reports the required message, not the invalid one', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderFein({ required: true })
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('EIN is required.')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('runs a consumer validate alongside the built-in completeness rule', async () => {
    const user = userEvent.setup()
    renderFein({
      validate: { notNine: (v: string) => !v.startsWith('9') || 'No 9-prefix EINs' },
    })
    await user.type(input(), '987654321')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No 9-prefix EINs')
  })
})

describe('FeinField input attributes', () => {
  it('sets inputMode="numeric" and autoComplete="off" by default', () => {
    renderFein()
    expect(input()).toHaveAttribute('inputmode', 'numeric')
    expect(input()).toHaveAttribute('autocomplete', 'off')
  })

  it('leaves type as text, so a leading zero is never dropped', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderFein()
    expect(input()).not.toHaveAttribute('type', 'number')
    await user.type(input(), '012345678')
    expect(input()).toHaveValue('01-2345678')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ ein: '012345678' }, expect.anything())
  })

  it("a consumer's autoComplete wins over the default", () => {
    renderFein({ autoComplete: 'organization' })
    expect(input()).toHaveAttribute('autocomplete', 'organization')
  })

  it('keeps inputMode=numeric when a consumer sets an unrelated slotProps.htmlInput key', () => {
    renderFein({ slotProps: { htmlInput: { 'data-testid': 'ein-input' } } })
    expect(input()).toHaveAttribute('inputmode', 'numeric')
    expect(input()).toHaveAttribute('data-testid', 'ein-input')
  })

  it("a consumer's own slotProps.htmlInput.inputMode still wins", () => {
    renderFein({ slotProps: { htmlInput: { inputMode: 'text' } } })
    expect(input()).toHaveAttribute('inputmode', 'text')
  })
})

describe('FeinField a11y', () => {
  it('has no violations in the default state', async () => {
    const { container } = renderFein({ helperText: 'From your IRS determination letter' })
    await expectNoA11yViolations(container)
  })

  it('has no violations while showing the incomplete-number error', async () => {
    const user = userEvent.setup()
    const { container } = renderFein()
    await user.type(input(), '12345')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    await screen.findByRole('alert')
    await expectNoA11yViolations(container)
  })
})

describe('FeinField form integration', () => {
  it('displays a formatted value that arrives from defaultValues', () => {
    render(
      <Form schema={schema} defaultValues={{ ein: '123456789' }} onSubmit={() => {}}>
        <FeinField name="ein" label="EIN" />
      </Form>,
    )
    expect(input()).toHaveValue('12-3456789')
  })

  it('Form requiredIndicator="optional": not-required gets the optional suffix', () => {
    render(
      <Form
        schema={schema}
        defaultValues={{ ein: '' }}
        onSubmit={() => {}}
        requiredIndicator="optional"
      >
        <FeinField name="ein" label="EIN" />
      </Form>,
    )
    expect(screen.getByRole('textbox', { name: 'EIN (optional)' })).toBeInTheDocument()
  })

  it('a consumer onChange sees the normalised digits, not the raw text', async () => {
    const user = userEvent.setup()
    const seen: string[] = []
    renderFein({
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => seen.push(e.target.value),
    })
    await user.click(input())
    await user.paste('12-3456789')
    expect(seen).toEqual(['123456789'])
  })
})

describe('FeinField theming', () => {
  it('takes format and invalidMessage from theme defaultProps', async () => {
    const user = userEvent.setup()
    const theme = createTheme({
      components: {
        EzFeinField: {
          defaultProps: { format: '##/#######', invalidMessage: 'Whole EIN please' },
        },
      },
    })
    render(
      <ThemeProvider theme={theme}>
        <Form schema={schema} defaultValues={{ ein: '' }} onSubmit={() => {}}>
          <FeinField name="ein" label="EIN" />
          <button type="submit">Go</button>
        </Form>
      </ThemeProvider>,
    )
    await user.type(input(), '12345')
    expect(input()).toHaveValue('12/345')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Whole EIN please')
  })

  it("a prop on the element still wins over the theme's default", async () => {
    const user = userEvent.setup()
    const theme = createTheme({
      components: { EzFeinField: { defaultProps: { format: '##/#######' } } },
    })
    render(
      <ThemeProvider theme={theme}>
        <Form schema={schema} defaultValues={{ ein: '' }} onSubmit={() => {}}>
          <FeinField name="ein" label="EIN" format="##.#######" />
        </Form>
      </ThemeProvider>,
    )
    await user.type(input(), '123456789')
    expect(input()).toHaveValue('12.3456789')
  })
})

describe('FeinField assisted mode (#65)', () => {
  it('under <Form assisted> still emits autoComplete="off" (its default already is)', () => {
    render(
      <Form schema={schema} defaultValues={{ ein: '' }} onSubmit={() => {}} assisted>
        <FeinField name="ein" label="EIN" />
      </Form>,
    )
    expect(input()).toHaveAttribute('autoComplete', 'off')
  })

  it('a consumer autoComplete still wins under assisted', () => {
    render(
      <Form schema={schema} defaultValues={{ ein: '' }} onSubmit={() => {}} assisted>
        <FeinField name="ein" label="EIN" autoComplete="organization" />
      </Form>,
    )
    expect(input()).toHaveAttribute('autoComplete', 'organization')
  })
})

describe('FeinField consumer ref composition', () => {
  it('honours a consumer slotProps.htmlInput.ref without losing caret restoration', async () => {
    const user = userEvent.setup()
    const consumerRef = { current: null as HTMLInputElement | null }
    renderFein({ slotProps: { htmlInput: { ref: consumerRef } } })

    // The consumer's ref is populated: it was composed with the hook's, not dropped.
    expect(consumerRef.current).toBe(input())

    // And the hook's own ref still works — caret restoration is what it drives.
    await user.type(input(), '123456789')
    expect(input()).toHaveValue('12-3456789')
    await user.type(input(), '9', { initialSelectionStart: 4, initialSelectionEnd: 4 })
    expect(input()).toHaveValue('12-3945678')
    expect(input().selectionStart).toBe(5)
  })

  it('honours a consumer ref from the callback form of slotProps.htmlInput (#92)', async () => {
    const user = userEvent.setup()
    const consumerRef = { current: null as HTMLInputElement | null }
    // MUI also accepts `htmlInput: (ownerState) => props`. The ref (and every
    // other prop the callback returns) must survive exactly as the object form's.
    renderFein({
      slotProps: { htmlInput: () => ({ ref: consumerRef, 'data-consumer': 'yes' }) },
    })

    expect(consumerRef.current).toBe(input())
    expect(input()).toHaveAttribute('data-consumer', 'yes')

    await user.type(input(), '123456789')
    expect(input()).toHaveValue('12-3456789')
    await user.type(input(), '9', { initialSelectionStart: 4, initialSelectionEnd: 4 })
    expect(input()).toHaveValue('12-3945678')
    expect(input().selectionStart).toBe(5)
  })
})
