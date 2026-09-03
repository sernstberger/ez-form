import { createTheme, ThemeProvider } from '@mui/material/styles'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { z } from 'zod'
import { Form } from '../../Form'
import { PercentField, type PercentFieldProps } from './PercentField'
import { describeFieldContract } from '../../test/describeFieldContract'
import { expectNoA11yViolations } from '../../test/axe'
import { expectTargetSize } from '../../test/targetSize'

const schema = z.object({ rate: z.number().nullable() })
// Widens HTMLElement to HTMLInputElement so `.value` / `.selectionStart` are reachable;
// TS 7 needs the assertion, the linter's TS 6 thinks it redundant (see eslint.config.js).
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
const input = () => screen.getByRole('textbox', { name: /Rate/ }) as HTMLInputElement

describeFieldContract({
  componentName: 'PercentField',
  label: 'Rate',
  schema,
  defaultValues: {},
  render: ({ onChange, ...props }) => (
    <PercentField name="rate" label="Rate" onValueChange={onChange} {...props} />
  ),
  getControl: () => screen.getByRole('textbox', { name: /Rate/ }),
  interact: (user) => user.type(screen.getByRole('textbox', { name: /Rate/ }), '1'),
})

function renderPercent(props: Record<string, unknown> = {}, onSubmit = vi.fn()) {
  const utils = render(
    <Form schema={schema} defaultValues={{}} onSubmit={onSubmit}>
      <PercentField name="rate" label="Rate" {...props} />
      <button type="submit">Go</button>
    </Form>,
  )
  return { onSubmit, ...utils }
}

describe('PercentField display', () => {
  it('shows 12.5% on blur and submits 12.5', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderPercent()
    await user.type(input(), '12.5')
    await user.tab()
    expect(input()).toHaveValue('12.5%')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ rate: 12.5 }, expect.anything())
  })

  it('groups digits while typing, before any blur', async () => {
    const user = userEvent.setup()
    renderPercent({ max: 100000 })
    await user.type(input(), '1234')
    expect(input()).toHaveValue('1,234')
  })

  it('rounds past the two fraction digits it displays', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderPercent()
    await user.type(input(), '12.3456')
    await user.tab()
    expect(input()).toHaveValue('12.35%')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenLastCalledWith({ rate: 12.35 }, expect.anything())
  })

  it('displays a value that arrives from defaultValues', () => {
    render(
      <Form schema={schema} defaultValues={{ rate: 7.5 }} onSubmit={() => {}}>
        <PercentField name="rate" label="Rate" />
      </Form>,
    )
    expect(input()).toHaveValue('7.5%')
  })
})

describe('PercentField bounds and step', () => {
  it('defaults to min 0, max 100 and step 1', async () => {
    const user = userEvent.setup()
    renderPercent()
    await user.type(input(), '5')
    await user.click(screen.getByRole('button', { name: 'Increase' }))
    expect(input()).toHaveValue('6%')

    await user.clear(input())
    await user.type(input(), '150')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByText('Rate must be at most 100.')).toBeInTheDocument()
  })

  it('reports the min message below 0', async () => {
    const user = userEvent.setup()
    renderPercent()
    await user.type(input(), '-5')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByText('Rate must be at least 0.')).toBeInTheDocument()
  })

  it('a consumer min/max/step wins over the defaults', async () => {
    const user = userEvent.setup()
    renderPercent({ min: 5, max: 50, step: 5 })
    await user.type(input(), '10')
    await user.click(screen.getByRole('button', { name: 'Increase' }))
    expect(input()).toHaveValue('15%')

    await user.clear(input())
    await user.type(input(), '60')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByText('Rate must be at most 50.')).toBeInTheDocument()
  })
})

describe('PercentField scale="fraction"', () => {
  const fractionSchema = z.object({ rate: z.number().nullable() })

  function renderFraction(props: Record<string, unknown> = {}, onSubmit = vi.fn()) {
    render(
      <Form schema={fractionSchema} defaultValues={{}} onSubmit={onSubmit}>
        <PercentField name="rate" label="Rate" scale="fraction" {...props} />
        <button type="submit">Go</button>
      </Form>,
    )
    return { onSubmit }
  }

  it('displays 12.5% and stores 0.125', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderFraction()
    await user.type(input(), '12.5')
    await user.tab()
    expect(input()).toHaveValue('12.5%')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ rate: 0.125 }, expect.anything())
  })

  it('displays a stored fraction from defaultValues in percentage points', () => {
    render(
      <Form schema={fractionSchema} defaultValues={{ rate: 0.075 }} onSubmit={() => {}}>
        <PercentField name="rate" label="Rate" scale="fraction" />
      </Form>,
    )
    expect(input()).toHaveValue('7.5%')
  })

  it('round-trips without float noise', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderFraction()
    // 29.7 / 100 is 0.29700000000000004 in binary floating point.
    await user.type(input(), '29.7')
    await user.tab()
    expect(input()).toHaveValue('29.7%')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ rate: 0.297 }, expect.anything())
  })

  it('applies min/max in display units, not stored ones', async () => {
    const user = userEvent.setup()
    renderFraction({ max: 50 })
    // 60% stores 0.6, which is under a naive `max: 50` — the bound has to be
    // scaled with the value for the rule to fire at all.
    await user.type(input(), '60')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByText('Rate must be at most 50.')).toBeInTheDocument()
  })

  it('keeps the display-unit number in a default bound message', async () => {
    const user = userEvent.setup()
    renderFraction()
    await user.type(input(), '150')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    // Not "at most 1", which is what the scaled bound compares as.
    expect(await screen.findByText('Rate must be at most 100.')).toBeInTheDocument()
  })

  it('steps in percentage points', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderFraction()
    await user.type(input(), '10')
    await user.click(screen.getByRole('button', { name: 'Increase' }))
    expect(input()).toHaveValue('11%')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ rate: 0.11 }, expect.anything())
  })

  it('an empty field stays null rather than scaling to 0', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <Form schema={fractionSchema} defaultValues={{ rate: 0.25 }} onSubmit={onSubmit}>
        <PercentField name="rate" label="Rate" scale="fraction" />
        <button type="submit">Go</button>
      </Form>,
    )
    expect(input()).toHaveValue('25%')
    await user.clear(input())
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ rate: null }, expect.anything())
  })

  it('a consumer onValueChange sees the stored value, matching onSubmit', async () => {
    const user = userEvent.setup()
    const seen: (number | null)[] = []
    renderFraction({ onValueChange: (v: number | null) => seen.push(v) })
    await user.type(input(), '25')
    await user.tab()
    expect(seen.at(-1)).toBe(0.25)
  })
})

describe('PercentField inputMode', () => {
  it('defaults to "decimal" (the percent format allows fraction digits)', () => {
    renderPercent()
    expect(input()).toHaveAttribute('inputMode', 'decimal')
  })

  it('a consumer inputMode wins over the default', () => {
    renderPercent({ inputMode: 'numeric' })
    expect(input()).toHaveAttribute('inputMode', 'numeric')
  })
})

describe('PercentField a11y', () => {
  it('has no violations in the default state', async () => {
    const { container } = renderPercent({ helperText: 'Your share of the premium' })
    await expectNoA11yViolations(container)
  })

  it('has no violations while showing a bound error', async () => {
    const user = userEvent.setup()
    const { container } = renderPercent()
    await user.type(input(), '150')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    await screen.findByRole('alert')
    await expectNoA11yViolations(container)
  })
})

describe('PercentField form integration', () => {
  it('shows the required message when required and empty', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderPercent({ required: true })
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Rate is required.')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('Form requiredIndicator="optional": required stays required with no asterisk', () => {
    const { container } = render(
      <Form schema={schema} defaultValues={{}} onSubmit={() => {}} requiredIndicator="optional">
        <PercentField name="rate" label="Rate" required />
      </Form>,
    )
    expect(input()).toBeRequired()
    expect(container.querySelector('[class*="asterisk"]')).toBeNull()
  })

  it('runs a consumer validate alongside the bounds', async () => {
    const user = userEvent.setup()
    renderPercent({ validate: (v: number | null) => v !== 50 || 'Not exactly half' })
    await user.type(input(), '50')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Not exactly half')
  })
})

describe('PercentField theming', () => {
  it('takes scale and bounds from theme defaultProps', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    const theme = createTheme({
      components: { EzPercentField: { defaultProps: { scale: 'fraction', max: 40 } } },
    })
    render(
      <ThemeProvider theme={theme}>
        <Form schema={schema} defaultValues={{}} onSubmit={onSubmit}>
          <PercentField name="rate" label="Rate" />
          <button type="submit">Go</button>
        </Form>
      </ThemeProvider>,
    )
    await user.type(input(), '50')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByText('Rate must be at most 40.')).toBeInTheDocument()

    await user.clear(input())
    await user.type(input(), '25')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ rate: 0.25 }, expect.anything())
  })

  it("a prop on the element still wins over the theme's default", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    const theme = createTheme({
      components: { EzPercentField: { defaultProps: { scale: 'fraction' } } },
    })
    render(
      <ThemeProvider theme={theme}>
        <Form schema={schema} defaultValues={{}} onSubmit={onSubmit}>
          <PercentField name="rate" label="Rate" scale="percent" />
          <button type="submit">Go</button>
        </Form>
      </ThemeProvider>,
    )
    await user.type(input(), '25')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ rate: 25 }, expect.anything())
  })

  it.each(['medium', 'small'] as const)(
    '%s: the inherited steppers meet 24×24 target size',
    (size) => {
      render(
        <Form schema={schema} defaultValues={{}} onSubmit={() => {}}>
          <PercentField name="rate" label="Rate" size={size} />
        </Form>,
      )
      expectTargetSize(screen.getByRole('button', { name: 'Increase' }))
      expectTargetSize(screen.getByRole('button', { name: 'Decrease' }))
    },
  )
})

describe('PercentField type-level', () => {
  it("rejects NumberField's internal valueScale prop (scale is the public way to ask)", () => {
    const identity = { toDisplay: (v: number) => v, toStored: (v: number) => v }
    // @ts-expect-error valueScale is NumberField-internal; PercentField drives it from `scale`
    const props: PercentFieldProps = { name: 'rate', valueScale: identity }
    expect(props).toBeDefined()
  })
})
