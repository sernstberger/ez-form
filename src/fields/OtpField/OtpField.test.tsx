import { createTheme, ThemeProvider } from '@mui/material/styles'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { z } from 'zod'
import { Form } from '../../Form'
import { OtpField } from './OtpField'
import { otpFieldClasses } from './OtpFieldControl'
import { describeFieldContract } from '../../test/describeFieldContract'
import { expectTargetSize } from '../../test/targetSize'
import { expectNoA11yViolations } from '../../test/axe'
import { expectConsole } from '../../test/expectConsole'

const schema = z.object({ code: z.string() })
// Widens HTMLElement to HTMLInputElement so `.value` is reachable; TS 7 needs it.
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
const inputs = () => screen.getAllByRole('textbox') as HTMLInputElement[]

describeFieldContract({
  componentName: 'OtpField',
  label: 'Code',
  schema,
  defaultValues: { code: '' },
  render: ({ onChange, ...props }) => (
    <OtpField name="code" label="Code" length={4} onValueChange={onChange} {...props} />
  ),
  getControl: () => screen.getByRole('textbox', { name: 'Code' }),
  interact: async (user) => {
    await user.type(screen.getByRole('textbox', { name: 'Code' }), '1')
  },
})

describe('OtpField', () => {
  it('renders one input per slot and submits the joined code', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <Form schema={schema} defaultValues={{ code: '' }} onSubmit={onSubmit}>
        <OtpField name="code" label="Code" length={4} />
        <button type="submit">Go</button>
      </Form>,
    )
    expect(inputs()).toHaveLength(4)
    await user.type(screen.getByRole('textbox', { name: 'Code' }), '1234')
    expect(inputs().map((i) => i.value)).toEqual(['1', '2', '3', '4'])
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ code: '1234' }, expect.anything())
  })

  it.each(['medium', 'small'] as const)('%s: meets 24×24 target size', (size) => {
    render(
      <Form schema={schema} defaultValues={{ code: '' }} onSubmit={() => {}}>
        <OtpField name="code" label="Code" length={4} size={size} />
      </Form>,
    )
    inputs().forEach(expectTargetSize)
  })

  it('accepts a pasted code', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <Form schema={schema} defaultValues={{ code: '' }} onSubmit={onSubmit}>
        <OtpField name="code" label="Code" length={6} />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.click(screen.getByRole('textbox', { name: 'Code' }))
    await user.paste('987654')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ code: '987654' }, expect.anything())
  })

  it('rejects a partial code with the length message', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <Form schema={schema} defaultValues={{ code: '' }} onSubmit={onSubmit}>
        <OtpField name="code" label="Code" length={4} />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.type(screen.getByRole('textbox', { name: 'Code' }), '12')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Code must be 4 characters.')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('passes an empty code when not required', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <Form schema={schema} defaultValues={{ code: '' }} onSubmit={onSubmit}>
        <OtpField name="code" label="Code" length={4} />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ code: '' }, expect.anything())
  })

  it('masks the characters when asked', () => {
    render(
      <Form schema={schema} defaultValues={{ code: '' }} onSubmit={() => {}}>
        <OtpField name="code" label="Code" length={4} mask />
      </Form>,
    )
    // Masked slots are password inputs, which have no textbox role.
    expect(screen.queryAllByRole('textbox')).toHaveLength(0)
    expect(document.querySelectorAll('input[type="password"]')).toHaveLength(4)
  })

  it('focuses the first slot after a failed submit', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={{ code: '' }} onSubmit={() => {}}>
        <OtpField name="code" label="Code" length={4} required />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByText('Code is required.')).toBeInTheDocument()
    expect(inputs()[0]).toHaveFocus()
  })

  it('is themeable: styleOverrides.helperText applies', () => {
    const theme = createTheme({
      components: {
        EzOtpField: {
          styleOverrides: {
            helperText: { letterSpacing: '9px' },
          },
        },
      },
    })
    render(
      <ThemeProvider theme={theme}>
        <Form schema={schema} defaultValues={{ code: '' }} onSubmit={() => {}}>
          <OtpField name="code" label="Code" length={4} helperText="Enter the code" />
        </Form>
      </ThemeProvider>,
    )
    const helperText = screen.getByText('Enter the code')
    expect(helperText).toHaveClass(otpFieldClasses.helperText)
    expect(getComputedStyle(helperText).letterSpacing).toBe('9px')
  })

  it('Form requiredIndicator="optional": required stays required with no label asterisk', () => {
    const { container } = render(
      <Form
        schema={schema}
        defaultValues={{ code: '' }}
        onSubmit={() => {}}
        requiredIndicator="optional"
      >
        <OtpField name="code" label="Code" length={4} required />
      </Form>,
    )
    expect(screen.getByRole('textbox', { name: 'Code' })).toBeInTheDocument()
    expect(container.querySelector('[class*="asterisk"]')).toBeNull()
  })

  it('Form requiredIndicator="optional": not-required gets the optional suffix in its label', () => {
    render(
      <Form
        schema={schema}
        defaultValues={{ code: '' }}
        onSubmit={() => {}}
        requiredIndicator="optional"
      >
        <OtpField name="code" label="Code" length={4} />
      </Form>,
    )
    expect(screen.getByRole('textbox', { name: 'Code (optional)' })).toBeInTheDocument()
  })
})

describe('OtpField autoComplete/inputMode defaults (#6, #7)', () => {
  // Base UI's OTPField.Root already defaults autoComplete="one-time-code" (first slot only)
  // and, for the default validationType="numeric", inputMode="numeric" — nothing to add here,
  // just verify the binding does not strip or duplicate them.
  it('first slot gets autoComplete="one-time-code" and inputMode="numeric" from Base UI', () => {
    render(
      <Form schema={schema} defaultValues={{ code: '' }} onSubmit={() => {}}>
        <OtpField name="code" label="Code" length={4} />
      </Form>,
    )
    const [first, ...rest] = inputs()
    expect(first).toHaveAttribute('autoComplete', 'one-time-code')
    expect(first).toHaveAttribute('inputMode', 'numeric')
    // Every slot type="password" masking aside, only the first slot carries autoComplete;
    // later slots are explicitly 'off' so password managers don't prompt on every cell.
    for (const slot of rest) {
      expect(slot).toHaveAttribute('autoComplete', 'off')
      expect(slot).toHaveAttribute('inputMode', 'numeric')
    }
  })
})

// #110. Base UI names slot 1 by whatever `<label>` points at the group and ignores
// `aria-label` there by design (it dev-warns), so an ARIA-only name used to leave
// slot 1 bare and axe flagged it. `OtpFieldControl` now renders hidden spans for
// slot 1's `aria-labelledby` — the one channel `OTPField.Input` honours on slot 1.
describe('OtpField slot 1 accessible name (#110)', () => {
  const renderOtp = (props: Partial<Parameters<typeof OtpField>[0]> = {}) =>
    render(
      <Form schema={schema} defaultValues={{ code: '' }} onSubmit={() => {}}>
        <span id="ext">External name</span>
        <OtpField name="code" length={4} {...props} />
      </Form>,
    )

  it('names slot 1 with the `aria-label` name and its position', () => {
    renderOtp({ 'aria-label': 'One-time code' })
    // Every slot is now named, slot 1 included, and each says which one it is.
    // Computed names, not attributes: slot 1 is named by `aria-labelledby` while
    // the rest carry `aria-label`, and only the accname makes them comparable.
    expect(inputs()).toHaveLength(4)
    for (const [index, slot] of inputs().entries()) {
      expect(slot).toHaveAccessibleName(expect.stringContaining(`Character ${index + 1} of 4`))
    }
    const [first] = inputs()
    expect(first).toHaveAccessibleName('One-time code Character 1 of 4')
    // The group keeps the plain name — the position belongs to the slot, not the field.
    expect(screen.getByRole('group')).toHaveAccessibleName('One-time code')
  })

  it('names slot 1 through the consumer’s `aria-labelledby` targets directly', () => {
    renderOtp({ 'aria-labelledby': 'ext' })
    expect(inputs()[0]).toHaveAccessibleName('External name Character 1 of 4')
    expect(screen.getByRole('group')).toHaveAccessibleName('External name')
  })

  it('routes `characterLabel` through slot 1 too', () => {
    renderOtp({
      'aria-label': 'Code',
      characterLabel: (index, count) => `Digit ${index}/${count}`,
    })
    expect(inputs()[0]).toHaveAccessibleName('Code Digit 1/4')
    expect(inputs()[1]).toHaveAccessibleName('Digit 2/4')
  })

  it('leaves a visibly labelled field on Base UI’s own label inheritance', () => {
    renderOtp({ label: 'Code' })
    const [first] = inputs()
    // No hidden spans, no ez-form `aria-labelledby`: the name comes from the
    // `<label for>` Base UI discovers, exactly as before #110.
    expect(first).toHaveAccessibleName('Code')
    expect(document.querySelectorAll(`.${otpFieldClasses.slotLabel}`)).toHaveLength(0)
  })

  it('adds nothing when the field has neither a label nor an ARIA name', () => {
    // The missing-name dev warning is `useEzField`'s job and is asserted there;
    // what matters here is that no dangling `aria-labelledby` is invented.
    expectConsole('warn', 'has no accessible name')
    renderOtp()
    expect(inputs()[0]).not.toHaveAttribute('aria-labelledby')
    expect(document.querySelectorAll(`.${otpFieldClasses.slotLabel}`)).toHaveLength(0)
  })

  it('has no accessibility violations when named by ARIA alone', async () => {
    const { container } = renderOtp({ 'aria-label': 'One-time code' })
    await expectNoA11yViolations(container)
  })

  it('has no accessibility violations with a visible label', async () => {
    const { container } = renderOtp({ label: 'Code' })
    await expectNoA11yViolations(container)
  })

  // `displayLabel` in `optional` mode wraps a missing label with the "(optional)"
  // suffix. Keying off it would both render a label reading "(optional)" alone and
  // suppress slot 1's hidden name, so the control asks `hasLabel(label)` instead.
  it('is unaffected by the `optional` indicator when named by ARIA alone', async () => {
    const { container } = render(
      <Form
        schema={schema}
        defaultValues={{ code: '' }}
        onSubmit={() => {}}
        requiredIndicator="optional"
      >
        <OtpField name="code" length={4} aria-label="One-time code" />
      </Form>,
    )
    expect(inputs()[0]).toHaveAccessibleName('One-time code Character 1 of 4')
    expect(screen.getByRole('group')).toHaveAccessibleName('One-time code')
    await expectNoA11yViolations(container)
  })
})
