import { createTheme, ThemeProvider } from '@mui/material/styles'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { z } from 'zod'
import { Form } from '../../Form'
import { SsnField, ssnFieldClasses } from './SsnField'
import { describeFieldContract } from '../../test/describeFieldContract'
import { expectNoA11yViolations } from '../../test/axe'
import { expectTargetSize } from '../../test/targetSize'

const schema = z.object({ ssn: z.string() })
// Hidden by default, and a password input exposes no `textbox` role, so the
// element has to be reached by name rather than by role.
const input = () => document.querySelector('input[name="ssn"]') as HTMLInputElement
const showToggle = () => screen.getByRole('button', { name: 'Show Social Security number' })
const hideToggle = () => screen.getByRole('button', { name: 'Hide Social Security number' })

describeFieldContract({
  componentName: 'SsnField',
  label: 'SSN',
  schema,
  defaultValues: { ssn: '' },
  render: (props) => <SsnField name="ssn" label="SSN" {...props} />,
  getControl: input,
  interact: (user) => user.type(input(), '1'),
})

function renderSsn(props: Record<string, unknown> = {}, onSubmit = vi.fn()) {
  const utils = render(
    <Form schema={schema} defaultValues={{ ssn: '' }} onSubmit={onSubmit}>
      <SsnField name="ssn" label="SSN" {...props} />
      <button type="submit">Go</button>
    </Form>,
  )
  return { onSubmit, ...utils }
}

describe('SsnField reveal', () => {
  it('is hidden by default: the input is type="password"', () => {
    renderSsn()
    expect(input()).toHaveAttribute('type', 'password')
  })

  it('renders a toggle labelled "Show Social Security number" with aria-pressed false', () => {
    renderSsn()
    expect(showToggle()).toHaveAttribute('aria-pressed', 'false')
    // Never submits the form it sits in.
    expect(showToggle()).toHaveAttribute('type', 'button')
  })

  it('reveals the formatted number as type="text" when the toggle is pressed', async () => {
    const user = userEvent.setup()
    renderSsn()
    await user.type(input(), '123456789')
    await user.click(showToggle())
    expect(input()).toHaveAttribute('type', 'text')
    // The same formatted text was there all along — `type` only decides whether
    // the browser masks it.
    expect(input()).toHaveValue('123-45-6789')
    expect(hideToggle()).toHaveAttribute('aria-pressed', 'true')
  })

  it('hides again when the toggle is pressed a second time', async () => {
    const user = userEvent.setup()
    renderSsn()
    await user.type(input(), '123456789')
    await user.click(showToggle())
    await user.click(hideToggle())
    expect(input()).toHaveAttribute('type', 'password')
    expect(input()).toHaveValue('123-45-6789')
    expect(showToggle()).toHaveAttribute('aria-pressed', 'false')
  })

  it('renders no toggle when reveal={false}, and stays hidden', () => {
    renderSsn({ reveal: false })
    expect(screen.queryByRole('button', { name: /Social Security number/ })).not.toBeInTheDocument()
    expect(input()).toHaveAttribute('type', 'password')
  })

  it('disables the toggle when the form is disabled', () => {
    render(
      <Form schema={schema} defaultValues={{ ssn: '' }} onSubmit={() => {}} disabled>
        <SsnField name="ssn" label="SSN" />
      </Form>,
    )
    expect(showToggle()).toBeDisabled()
  })

  it('takes custom toggle labels', async () => {
    const user = userEvent.setup()
    renderSsn({ showLabel: 'Reveal SSN', hideLabel: 'Conceal SSN' })
    const toggle = screen.getByRole('button', { name: 'Reveal SSN' })
    await user.click(toggle)
    expect(screen.getByRole('button', { name: 'Conceal SSN' })).toBeInTheDocument()
  })

  it('renders custom icons per toggle state', async () => {
    const user = userEvent.setup()
    renderSsn({
      icons: { show: <span data-testid="show-icon" />, hide: <span data-testid="hide-icon" /> },
    })
    expect(screen.getByTestId('show-icon')).toBeInTheDocument()
    expect(screen.queryByTestId('hide-icon')).not.toBeInTheDocument()
    await user.click(showToggle())
    expect(screen.getByTestId('hide-icon')).toBeInTheDocument()
    expect(screen.queryByTestId('show-icon')).not.toBeInTheDocument()
  })

  it('the toggle is focusable via Tab and meets 24×24', async () => {
    const user = userEvent.setup()
    renderSsn()
    await user.click(input())
    await user.tab()
    expect(showToggle()).toHaveFocus()
    expectTargetSize(showToggle())
  })

  it('resets to hidden on unmount (a remount starts hidden again)', async () => {
    const user = userEvent.setup()
    const { unmount } = renderSsn()
    await user.click(showToggle())
    expect(input()).toHaveAttribute('type', 'text')
    unmount()
    renderSsn()
    expect(input()).toHaveAttribute('type', 'password')
  })
})

describe('SsnField typing', () => {
  it('formats progressively into ###-##-####', async () => {
    const user = userEvent.setup()
    renderSsn()
    await user.type(input(), '1')
    expect(input()).toHaveValue('1')
    await user.type(input(), '23')
    expect(input()).toHaveValue('123')
    // A separator only appears once a digit follows it, so nothing dangles.
    await user.type(input(), '4')
    expect(input()).toHaveValue('123-4')
    await user.type(input(), '56789')
    expect(input()).toHaveValue('123-45-6789')
  })

  it('stores digits only and submits them', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderSsn()
    await user.type(input(), '123456789')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ ssn: '123456789' }, expect.anything())
  })

  it('never accepts more than nine digits', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderSsn()
    await user.type(input(), '1234567890000')
    expect(input()).toHaveValue('123-45-6789')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ ssn: '123456789' }, expect.anything())
  })

  it('ignores letters and punctuation typed into the field', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderSsn()
    await user.type(input(), '1a2b3-c45!6789')
    expect(input()).toHaveValue('123-45-6789')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ ssn: '123456789' }, expect.anything())
  })

  it('does not drop a leading 1 the way PhoneField drops a country code', async () => {
    // Ten digits starting with 1 is simply an over-long entry here: there is no
    // country-code convention for an SSN, so it truncates rather than shifting.
    const user = userEvent.setup()
    const { onSubmit } = renderSsn()
    await user.click(input())
    await user.paste('1234567890')
    expect(input()).toHaveValue('123-45-6789')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ ssn: '123456789' }, expect.anything())
  })
})

describe('SsnField pasting', () => {
  it.each([
    ['123-45-6789', '123-45-6789', '123456789'],
    ['123456789', '123-45-6789', '123456789'],
    ['123 45 6789', '123-45-6789', '123456789'],
    ['SSN: 123.45.6789', '123-45-6789', '123456789'],
  ])('paste %j displays %j and stores %j', async (pasted, display, stored) => {
    const user = userEvent.setup()
    const { onSubmit } = renderSsn()
    await user.click(input())
    await user.paste(pasted)
    expect(input()).toHaveValue(display)
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ ssn: stored }, expect.anything())
  })

  it('pasting over a select-all keeps every pasted digit', async () => {
    const user = userEvent.setup()
    renderSsn()
    await user.type(input(), '123456789')
    await user.tripleClick(input())
    await user.paste('987-65-4321')
    expect(input()).toHaveValue('987-65-4321')
  })

  it('pasting over a partial selection replaces only the selected digits', async () => {
    const user = userEvent.setup()
    renderSsn()
    await user.type(input(), '123456789')
    // Offsets 4..6 cover the middle group's "45".
    input().setSelectionRange(4, 6)
    await user.paste('00')
    expect(input()).toHaveValue('123-00-6789')
  })
})

describe('SsnField editing', () => {
  it('keeps the caret with the digit being edited in the middle', async () => {
    const user = userEvent.setup()
    renderSsn()
    await user.type(input(), '12345678')
    expect(input()).toHaveValue('123-45-678')
    // Offset 4 is just after the first separator, i.e. before the "4".
    await user.type(input(), '9', { initialSelectionStart: 4, initialSelectionEnd: 4 })
    expect(input()).toHaveValue('123-94-5678')
    expect(input().selectionStart).toBe(5)
  })

  it('Backspace over a separator deletes the digit before it', async () => {
    const user = userEvent.setup()
    renderSsn()
    await user.type(input(), '123456789')
    // Offset 7 is immediately after the second separator; the digit it follows
    // is the "5". Backspace alone would only remove the separator, which the
    // reformat would put straight back.
    await user.type(input(), '{Backspace}', { initialSelectionStart: 7, initialSelectionEnd: 7 })
    expect(input()).toHaveValue('123-46-789')
    expect(input().selectionStart).toBe(5)
  })

  it('forward Delete just before a separator removes the digit after it', async () => {
    const user = userEvent.setup()
    renderSsn()
    await user.type(input(), '123456789')
    // Caret 3 sits just before the first "-"; Delete must take the "4".
    await user.type(input(), '{Delete}', { initialSelectionStart: 3, initialSelectionEnd: 3 })
    expect(input()).toHaveValue('123-56-789')
  })

  it('deleting a selection removes exactly the selected digits', async () => {
    const user = userEvent.setup()
    renderSsn()
    await user.type(input(), '123456789')
    // Offsets 4..6 cover "45".
    await user.type(input(), '{Backspace}', { initialSelectionStart: 4, initialSelectionEnd: 6 })
    expect(input()).toHaveValue('123-67-89')
    expect(input().selectionStart).toBe(3)
  })

  it('deleting from the end shortens the formatted text', async () => {
    const user = userEvent.setup()
    renderSsn()
    await user.type(input(), '123456789')
    await user.type(input(), '{Backspace}{Backspace}{Backspace}')
    expect(input()).toHaveValue('123-45-6')
  })

  it('clearing and retyping replaces the value', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderSsn()
    await user.type(input(), '123456789')
    await user.clear(input())
    expect(input()).toHaveValue('')
    await user.type(input(), '987654321')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ ssn: '987654321' }, expect.anything())
  })
})

describe('SsnField validation', () => {
  it('rejects an incomplete number with the default invalid message', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderSsn()
    await user.type(input(), '12345')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Enter a 9-digit Social Security number',
    )
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('uses a consumer invalidMessage', async () => {
    const user = userEvent.setup()
    renderSsn({ invalidMessage: 'That SSN looks short' })
    await user.type(input(), '12345')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('That SSN looks short')
  })

  it('accepts a complete number', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderSsn()
    await user.type(input(), '123456789')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(onSubmit).toHaveBeenCalledWith({ ssn: '123456789' }, expect.anything())
  })

  it('an empty optional field passes: the completeness rule only guards non-empty values', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderSsn()
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ ssn: '' }, expect.anything())
  })

  it('empty + required reports the required message, not the invalid one', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderSsn({ required: true })
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('SSN is required.')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('runs a consumer validate alongside the built-in completeness rule', async () => {
    const user = userEvent.setup()
    renderSsn({
      validate: { notAllOnes: (v: string) => v !== '111111111' || 'Not a real SSN' },
    })
    await user.type(input(), '111111111')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Not a real SSN')
  })
})

describe('SsnField input attributes', () => {
  it('sets inputMode="numeric" and autoComplete="off"', () => {
    renderSsn()
    expect(input()).toHaveAttribute('inputmode', 'numeric')
    expect(input()).toHaveAttribute('autocomplete', 'off')
  })

  it('keeps inputMode=numeric when a consumer sets an unrelated slotProps.htmlInput key', () => {
    renderSsn({ slotProps: { htmlInput: { 'data-testid': 'ssn-input' } } })
    expect(input()).toHaveAttribute('inputmode', 'numeric')
    expect(input()).toHaveAttribute('data-testid', 'ssn-input')
  })

  it('keeps the toggle even when slotProps.input sets other options', () => {
    renderSsn({ slotProps: { input: { readOnly: true } } })
    expect(showToggle()).toBeInTheDocument()
    expect(input()).toHaveAttribute('readonly')
  })
})

describe('SsnField a11y', () => {
  it('has no violations while hidden', async () => {
    const { container } = renderSsn({ helperText: 'We only use this to verify your identity' })
    await expectNoA11yViolations(container)
  })

  it('has no violations while revealed', async () => {
    const user = userEvent.setup()
    const { container } = renderSsn()
    await user.type(input(), '123456789')
    await user.click(showToggle())
    await expectNoA11yViolations(container)
  })

  it('has no violations while showing the incomplete-number error', async () => {
    const user = userEvent.setup()
    const { container } = renderSsn()
    await user.type(input(), '12345')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    await screen.findByRole('alert')
    await expectNoA11yViolations(container)
  })
})

describe('SsnField form integration', () => {
  it('displays a formatted value that arrives from defaultValues', () => {
    render(
      <Form schema={schema} defaultValues={{ ssn: '123456789' }} onSubmit={() => {}}>
        <SsnField name="ssn" label="SSN" />
      </Form>,
    )
    expect(input()).toHaveValue('123-45-6789')
  })

  it('Form requiredIndicator="optional": not-required gets the optional suffix', () => {
    render(
      <Form
        schema={schema}
        defaultValues={{ ssn: '' }}
        onSubmit={() => {}}
        requiredIndicator="optional"
      >
        <SsnField name="ssn" label="SSN" />
      </Form>,
    )
    expect(screen.getByLabelText('SSN (optional)')).toBeInTheDocument()
  })
})

describe('SsnField theming', () => {
  it('carries the root and toggle class hooks', () => {
    const { container } = renderSsn()
    expect(container.querySelector(`.${ssnFieldClasses.root}`)).toBeInTheDocument()
    expect(showToggle()).toHaveClass(ssnFieldClasses.toggle)
  })

  it('takes invalidMessage and reveal from theme defaultProps', async () => {
    const user = userEvent.setup()
    const theme = createTheme({
      components: {
        EzSsnField: { defaultProps: { invalidMessage: 'Whole number please', reveal: false } },
      },
    })
    render(
      <ThemeProvider theme={theme}>
        <Form schema={schema} defaultValues={{ ssn: '' }} onSubmit={() => {}}>
          <SsnField name="ssn" label="SSN" />
          <button type="submit">Go</button>
        </Form>
      </ThemeProvider>,
    )
    expect(screen.queryByRole('button', { name: /Social Security number/ })).not.toBeInTheDocument()
    await user.type(input(), '12345')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Whole number please')
  })

  it("a prop on the element still wins over the theme's default", async () => {
    const user = userEvent.setup()
    const theme = createTheme({
      components: { EzSsnField: { defaultProps: { invalidMessage: 'From the theme' } } },
    })
    render(
      <ThemeProvider theme={theme}>
        <Form schema={schema} defaultValues={{ ssn: '' }} onSubmit={() => {}}>
          <SsnField name="ssn" label="SSN" invalidMessage="From the prop" />
          <button type="submit">Go</button>
        </Form>
      </ThemeProvider>,
    )
    await user.type(input(), '12345')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('From the prop')
  })

  it('applies EzSsnField styleOverrides.toggle and slotProps.toggle', () => {
    const theme = createTheme({
      components: {
        EzSsnField: {
          defaultProps: { slotProps: { toggle: { size: 'small' } } },
          styleOverrides: { toggle: { marginRight: 4 } },
        },
      },
    })
    render(
      <ThemeProvider theme={theme}>
        <Form schema={schema} defaultValues={{ ssn: '' }} onSubmit={() => {}}>
          <SsnField name="ssn" label="SSN" />
        </Form>
      </ThemeProvider>,
    )
    expect(showToggle()).toHaveClass('MuiIconButton-sizeSmall')
    expect(getComputedStyle(showToggle()).marginRight).toBe('4px')
  })
})
