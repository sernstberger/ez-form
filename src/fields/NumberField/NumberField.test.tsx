import { renderToString } from 'react-dom/server'
import { createTheme, ThemeProvider } from '@mui/material/styles'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { z } from 'zod'
import { Form } from '../../Form'
import { NumberField } from './NumberField'
import { numberFieldClasses } from './NumberFieldControl'
import { getSeparators } from './groupWhileTyping'
import { describeFieldContract } from '../../test/describeFieldContract'
import { expectTargetSize } from '../../test/targetSize'

const schema = z.object({ age: z.number({ error: 'Enter your age' }) })
const input = () => screen.getByRole('textbox', { name: 'Age' })

describeFieldContract({
  componentName: 'NumberField',
  label: 'Age',
  schema,
  defaultValues: {},
  render: ({ onChange, ...props }) => (
    <NumberField name="age" label="Age" onValueChange={onChange} {...props} />
  ),
  getControl: input,
  interact: (user) => user.type(input(), '4'),
})

describe('NumberField', () => {
  it('submits a number for typed digits', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <Form schema={schema} defaultValues={{}} onSubmit={onSubmit}>
        <NumberField name="age" label="Age" />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.type(input(), '42')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ age: 42 }, expect.anything())
  })

  it('submits null when cleared', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    const nullable = z.object({ age: z.number().nullable() })
    render(
      <Form schema={nullable} defaultValues={{ age: 5 }} onSubmit={onSubmit}>
        <NumberField name="age" label="Age" />
        <button type="submit">Go</button>
      </Form>,
    )
    expect(input()).toHaveValue('5')
    await user.clear(input())
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ age: null }, expect.anything())
  })

  it('shows the zod message when empty', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={{}} onSubmit={() => {}}>
        <NumberField name="age" label="Age" />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByText('Enter your age')).toBeInTheDocument()
  })

  it('shows the min rule message for a value below the bound', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={{}} onSubmit={() => {}}>
        <NumberField name="age" label="Age" min={18} />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.type(input(), '17')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByText('Age must be at least 18.')).toBeInTheDocument()
  })

  it('steps with the increment button and the arrow keys', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={{ age: 5 }} onSubmit={() => {}}>
        <NumberField name="age" label="Age" />
      </Form>,
    )
    await user.click(screen.getByRole('button', { name: 'Increase' }))
    expect(input()).toHaveValue('6')
    await user.click(input())
    await user.keyboard('{ArrowDown}{ArrowDown}')
    expect(input()).toHaveValue('4')
  })

  it('stops stepping at max but still validates typed input against it', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={{ age: 10 }} onSubmit={() => {}}>
        <NumberField name="age" label="Age" max={10} />
        <button type="submit">Go</button>
      </Form>,
    )
    // Base UI disables the stepper at the bound, so a click cannot move past it.
    expect(screen.getByRole('button', { name: 'Increase' })).toBeDisabled()
    expect(input()).toHaveValue('10')
    await user.clear(input())
    await user.type(input(), '11')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByText('Age must be at most 10.')).toBeInTheDocument()
  })

  it('marks the input required and focuses it after a failed submit', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={{}} onSubmit={() => {}}>
        <NumberField name="age" label="Age" required />
        <button type="submit">Go</button>
      </Form>,
    )
    expect(input()).toBeRequired()
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByText('Age is required.')).toBeInTheDocument()
    expect(input()).toHaveFocus()
  })

  it('groups digits while typing and submits the number', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <Form schema={schema} defaultValues={{}} onSubmit={onSubmit}>
        <NumberField name="age" label="Age" />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.type(input(), '1234567')
    expect(input()).toHaveValue('1,234,567')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ age: 1234567 }, expect.anything())
  })

  it('leaves the fraction alone while grouping the integer digits', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <Form schema={schema} defaultValues={{}} onSubmit={onSubmit}>
        <NumberField name="age" label="Age" />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.type(input(), '1234.5')
    expect(input()).toHaveValue('1,234.5')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ age: 1234.5 }, expect.anything())
  })

  it('does not group when format disables grouping', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={{}} onSubmit={() => {}}>
        <NumberField name="age" label="Age" format={{ useGrouping: false }} />
      </Form>,
    )
    await user.type(input(), '1000')
    expect(input()).toHaveValue('1000')
  })

  it('backspaces the last digit of a grouped value', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={{}} onSubmit={() => {}}>
        <NumberField name="age" label="Age" />
      </Form>,
    )
    await user.type(input(), '1000')
    expect(input()).toHaveValue('1,000')
    await user.keyboard('{Backspace}')
    expect(input()).toHaveValue('100')
  })

  it('keeps the caret in place when backspace deletes a group separator', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={{}} onSubmit={() => {}}>
        <NumberField name="age" label="Age" />
      </Form>,
    )
    await user.type(input(), '1000')
    expect(input()).toHaveValue('1,000')
    // 1,|000 — backspace removes the separator, which regrouping puts straight back.
    ;(input() as HTMLInputElement).setSelectionRange(2, 2)
    await user.keyboard('{Backspace}')
    expect(input()).toHaveValue('1,000')
    expect((input() as HTMLInputElement).selectionStart).toBe(1)
  })

  it('keeps the caret in place when delete removes a group separator', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={{}} onSubmit={() => {}}>
        <NumberField name="age" label="Age" />
      </Form>,
    )
    await user.type(input(), '1000')
    // 1|,000 — forward delete removes the separator, likewise restored.
    ;(input() as HTMLInputElement).setSelectionRange(1, 1)
    await user.keyboard('{Delete}')
    expect(input()).toHaveValue('1,000')
    expect((input() as HTMLInputElement).selectionStart).toBe(1)
  })

  describe('paste', () => {
    it('parses pasted grouped text to the right number without regrouping during the paste', async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn()
      render(
        <Form schema={schema} defaultValues={{}} onSubmit={onSubmit}>
          <NumberField name="age" label="Age" />
          <button type="submit">Go</button>
        </Form>,
      )
      await user.click(input())
      await user.paste('1,234,567')
      // The pasted text stands as pasted; Base UI's own paste handler owns the value.
      expect(input()).toHaveValue('1,234,567')
      await user.click(screen.getByRole('button', { name: 'Go' }))
      expect(onSubmit).toHaveBeenCalledWith({ age: 1234567 }, expect.anything())
    })

    it('leaves ungrouped pasted digits ungrouped until blur', async () => {
      const user = userEvent.setup()
      render(
        <Form schema={schema} defaultValues={{}} onSubmit={() => {}}>
          <NumberField name="age" label="Age" />
          <button type="submit">Go</button>
        </Form>,
      )
      await user.click(input())
      await user.paste('1234567')
      expect(input()).toHaveValue('1234567')
      await user.tab()
      expect(input()).toHaveValue('1,234,567')
    })

    it('leaves the caret after the pasted text', async () => {
      const user = userEvent.setup()
      render(
        <Form schema={schema} defaultValues={{}} onSubmit={() => {}}>
          <NumberField name="age" label="Age" />
        </Form>,
      )
      await user.click(input())
      await user.paste('1,234,567')
      expect((input() as HTMLInputElement).selectionStart).toBe('1,234,567'.length)
    })

    it('keeps grouping correctly when typing continues after a paste', async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn()
      render(
        <Form schema={schema} defaultValues={{}} onSubmit={onSubmit}>
          <NumberField name="age" label="Age" />
          <button type="submit">Go</button>
        </Form>,
      )
      await user.click(input())
      await user.paste('1,234,567')
      await user.type(input(), '8')
      expect(input()).toHaveValue('12,345,678')
      await user.click(screen.getByRole('button', { name: 'Go' }))
      expect(onSubmit).toHaveBeenCalledWith({ age: 12345678 }, expect.anything())
    })
  })

  describe('leading minus', () => {
    it('keeps a lone minus and groups the digits typed after it', async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn()
      render(
        <Form schema={schema} defaultValues={{}} onSubmit={onSubmit}>
          <NumberField name="age" label="Age" />
          <button type="submit">Go</button>
        </Form>,
      )
      await user.type(input(), '-')
      expect(input()).toHaveValue('-')
      await user.type(input(), '1234')
      expect(input()).toHaveValue('-1,234')
      await user.click(screen.getByRole('button', { name: 'Go' }))
      expect(onSubmit).toHaveBeenCalledWith({ age: -1234 }, expect.anything())
    })

    it('keeps the minus without producing NaN when the digits are deleted back to it', async () => {
      const user = userEvent.setup()
      render(
        <Form schema={schema} defaultValues={{}} onSubmit={() => {}}>
          <NumberField name="age" label="Age" />
        </Form>,
      )
      await user.type(input(), '-1234')
      expect(input()).toHaveValue('-1,234')
      await user.keyboard('{Backspace}{Backspace}{Backspace}{Backspace}')
      expect(input()).toHaveValue('-')
      expect(input()).not.toHaveValue('NaN')
    })
  })

  describe('space-group locales', () => {
    // fr-FR groups with U+202F (narrow no-break space). de-CH groups with an apostrophe, but
    // which variant depends on the ICU build: local Node 22.13.0 gives U+2019 (RIGHT SINGLE
    // QUOTATION MARK), while GitHub Actions' Node 22.x gives the ASCII U+0027 APOSTROPHE.
    // `getSeparators` and `groupWhileTyping` already treat the two as equivalent (see
    // groupWhileTyping.ts's makeIsGroupChar), so the de-CH assertions below derive the
    // expected separator from `getSeparators('de-CH')` at runtime rather than hardcoding one
    // variant, and the paste test feeds the *other* variant to prove cross-variant acceptance
    // on both environments.
    const NNBSP = '\u202f'
    const RSQUO = '\u2019'
    const APOS = "'"
    const chGroup = getSeparators('de-CH').group
    const chOther = chGroup === APOS ? RSQUO : APOS

    it('groups fr-FR with its narrow no-break space and submits the number', async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn()
      render(
        <Form schema={schema} defaultValues={{}} onSubmit={onSubmit}>
          <NumberField name="age" label="Age" locale="fr-FR" />
          <button type="submit">Go</button>
        </Form>,
      )
      await user.type(input(), '1234567')
      expect(input()).toHaveValue(`1${NNBSP}234${NNBSP}567`)
      await user.click(screen.getByRole('button', { name: 'Go' }))
      expect(onSubmit).toHaveBeenCalledWith({ age: 1234567 }, expect.anything())
    })

    it('groups de-CH with its apostrophe and submits the number', async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn()
      render(
        <Form schema={schema} defaultValues={{}} onSubmit={onSubmit}>
          <NumberField name="age" label="Age" locale="de-CH" />
          <button type="submit">Go</button>
        </Form>,
      )
      await user.type(input(), '1234567')
      expect(input()).toHaveValue(`1${chGroup}234${chGroup}567`)
      await user.click(screen.getByRole('button', { name: 'Go' }))
      expect(onSubmit).toHaveBeenCalledWith({ age: 1234567 }, expect.anything())
    })

    it('keeps grouping fr-FR after a paste that used plain spaces', async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn()
      render(
        <Form schema={schema} defaultValues={{}} onSubmit={onSubmit}>
          <NumberField name="age" label="Age" locale="fr-FR" />
          <button type="submit">Go</button>
        </Form>,
      )
      await user.click(input())
      await user.paste('1 234 567')
      expect(input()).toHaveValue('1 234 567')
      await user.type(input(), '8')
      expect(input()).toHaveValue(`12${NNBSP}345${NNBSP}678`)
      await user.click(screen.getByRole('button', { name: 'Go' }))
      expect(onSubmit).toHaveBeenCalledWith({ age: 12345678 }, expect.anything())
    })

    it('keeps grouping de-CH after a paste that used the other apostrophe variant', async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn()
      render(
        <Form schema={schema} defaultValues={{}} onSubmit={onSubmit}>
          <NumberField name="age" label="Age" locale="de-CH" />
          <button type="submit">Go</button>
        </Form>,
      )
      await user.click(input())
      await user.paste(`1${chOther}234${chOther}567`)
      expect(input()).toHaveValue(`1${chOther}234${chOther}567`)
      await user.type(input(), '8')
      expect(input()).toHaveValue(`12${chGroup}345${chGroup}678`)
      await user.click(screen.getByRole('button', { name: 'Go' }))
      expect(onSubmit).toHaveBeenCalledWith({ age: 12345678 }, expect.anything())
    })

    it('keeps the leading minus in both space-group locales', async () => {
      const user = userEvent.setup()
      render(
        <Form schema={schema} defaultValues={{}} onSubmit={() => {}}>
          <NumberField name="age" label="Age" locale="fr-FR" />
        </Form>,
      )
      await user.type(input(), '-1234')
      expect(input()).toHaveValue(`-1${NNBSP}234`)
    })
  })

  it('does not rewrite the input value mid-IME-composition', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={{}} onSubmit={() => {}}>
        <NumberField name="age" label="Age" />
      </Form>,
    )
    const el = input() as HTMLInputElement
    await user.click(el)
    const setNativeValue = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )!.set!

    // A composing change must be left exactly as the IME wrote it: reassigning `.value`
    // mid-composition cancels the composition in real browsers.
    setNativeValue.call(el, '1234')
    fireEvent(el, new InputEvent('input', { bubbles: true, isComposing: true, data: '1234' }))
    expect(input()).toHaveValue('1234')

    // The same edit outside composition is grouped, proving the guard — not a dead
    // grouping path — is what kept the value above untouched.
    setNativeValue.call(input(), '5678')
    fireEvent(input(), new InputEvent('input', { bubbles: true, isComposing: false, data: '5678' }))
    expect(input()).toHaveValue('5,678')
  })

  it('shrinks the label on the server render for a field that already has a value', () => {
    // TextField's own FormControl derives `filled` from the input's `value`, so the
    // markup is already shrunk with no effects run — this is what replaced the
    // `SSRInitialFilled` placeholder the hand-composed FormControl needed.
    const html = renderToString(
      <Form schema={schema} defaultValues={{ age: 5 }} onSubmit={() => {}}>
        <NumberField name="age" label="Age" />
      </Form>,
    )
    expect(html).toContain('data-shrink="true"')
  })

  it('does not shrink the label on the server render for an empty field', () => {
    const html = renderToString(
      <Form schema={schema} defaultValues={{}} onSubmit={() => {}}>
        <NumberField name="age" label="Age" />
      </Form>,
    )
    expect(html).toContain('data-shrink="false"')
  })

  it('is themeable: EzNumberField defaultProps and styleOverrides.steppers apply', () => {
    const theme = createTheme({
      components: {
        EzNumberField: {
          defaultProps: { size: 'small' },
          styleOverrides: { steppers: { flexDirection: 'row' } },
        },
      },
    })
    const { container } = render(
      <ThemeProvider theme={theme}>
        <Form schema={schema} defaultValues={{ age: 5 }} onSubmit={() => {}}>
          <NumberField name="age" label="Age" />
        </Form>
      </ThemeProvider>,
    )
    // defaultProps reached the control: `size="small"` is what makes the input dense.
    expect(input().closest('.MuiInputBase-root')).toHaveClass('MuiInputBase-sizeSmall')
    const steppers = container.querySelector(`.${numberFieldClasses.steppers}`)!
    expect(steppers).toBeInTheDocument()
    expect(getComputedStyle(steppers).flexDirection).toBe('row')
    // The other slots carry their class hooks for CSS / styleOverrides to target.
    expect(screen.getByRole('button', { name: 'Increase' })).toHaveClass(
      numberFieldClasses.increment,
    )
    expect(screen.getByRole('button', { name: 'Decrease' })).toHaveClass(
      numberFieldClasses.decrement,
    )
    expect(container.querySelector(`.${numberFieldClasses.root}`)).toBeInTheDocument()
  })

  it.each(['medium', 'small'] as const)('%s: meets 24×24 target size', (size) => {
    render(
      <Form schema={schema} defaultValues={{}} onSubmit={() => {}}>
        <NumberField name="age" label="Age" size={size} />
      </Form>,
    )
    expectTargetSize(screen.getByRole('button', { name: 'Increase' }))
    expectTargetSize(screen.getByRole('button', { name: 'Decrease' }))
  })

  it('calls a consumer onValueChange after updating the form', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(
      <Form schema={schema} defaultValues={{}} onSubmit={() => {}}>
        <NumberField name="age" label="Age" onValueChange={onValueChange} />
      </Form>,
    )
    await user.type(input(), '7')
    expect(onValueChange).toHaveBeenCalledWith(7, expect.anything())
  })

  it('Form requiredIndicator="optional": required stays required with no asterisk', () => {
    const { container } = render(
      <Form schema={schema} defaultValues={{}} onSubmit={() => {}} requiredIndicator="optional">
        <NumberField name="age" label="Age" required />
      </Form>,
    )
    expect(input()).toBeRequired()
    expect(container.querySelector('[class*="asterisk"]')).toBeNull()
  })

  it('Form requiredIndicator="optional": not-required gets the optional suffix in its label', () => {
    render(
      <Form schema={schema} defaultValues={{}} onSubmit={() => {}} requiredIndicator="optional">
        <NumberField name="age" label="Age" />
      </Form>,
    )
    expect(screen.getByLabelText('Age (optional)')).toBeInTheDocument()
  })
})
