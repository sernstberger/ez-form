import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen, waitFor } from '@testing-library/react'
import CssBaseline from '@mui/material/CssBaseline'
import { ThemeProvider, createTheme, type Theme } from '@mui/material/styles'
import { z } from 'zod'
import { Form } from '../Form'
import { Checkbox } from '../fields/Checkbox'
import { RadioGroup } from '../fields/RadioGroup'
import { ReadOnlyField } from '../fields/ReadOnlyField'
import { Select } from '../fields/Select'
import { TextField } from '../fields/TextField'
import { DatePicker } from '../fields/DatePicker'
import { SubmitButton } from '../SubmitButton'
import { Checkout } from '../examples/Checkout/Checkout'
import { Insurance } from '../examples/Insurance/Insurance'
import { Loan } from '../examples/Loan/Loan'
import { Login } from '../examples/Login/Login'
import { Profile } from '../examples/Profile/Profile'
import { SignUp } from '../examples/SignUp/SignUp'
import { expectNoA11yViolations } from '../test/axe'
import { withPickers } from '../test/pickers'
import { createEzFormTheme, ezFormThemeOptions, ezFormTokens } from './ezFormTheme'

// ---------------------------------------------------------------------------
// WCAG contrast, computed here because axe's `color-contrast` rule needs layout and
// jsdom has none: it is skipped in every other test in this repo. The palette is
// plain `hsl()` strings, so the maths is small enough to own.
// ---------------------------------------------------------------------------

function hslToRgb(color: string): [number, number, number] {
  const m = /^hsla?\(\s*([\d.]+),\s*([\d.]+)%,\s*([\d.]+)%/.exec(color)
  if (!m) throw new Error(`not an hsl colour: ${color}`)
  const h = Number(m[1]) / 360
  const s = Number(m[2]) / 100
  const l = Number(m[3]) / 100
  const hue = (p: number, q: number, tIn: number) => {
    let t = tIn
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  if (s === 0) return [l, l, l]
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  return [hue(p, q, h + 1 / 3), hue(p, q, h), hue(p, q, h - 1 / 3)]
}

function luminance(color: string): number {
  const rgb = color === 'white' ? [1, 1, 1] : color === 'black' ? [0, 0, 0] : hslToRgb(color)
  const lin = rgb.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * lin[0]! + 0.7152 * lin[1]! + 0.0722 * lin[2]!
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi! + 0.05) / (lo! + 0.05)
}

// ---------------------------------------------------------------------------
// The YAML block at the top of DESIGN.md — nested maps of scalars, two-space
// indented, which is all that file uses. Parsed here rather than with a YAML
// library so the guard adds no dependency.
// ---------------------------------------------------------------------------

interface YamlTree {
  [key: string]: YamlTree | string | number
}

function parseDesignTokens(markdown: string): YamlTree {
  const [, block] = markdown.split(/^---\n/m)
  if (!block) throw new Error('DESIGN.md has no front-matter block')
  const root: YamlTree = {}
  const stack: { indent: number; node: YamlTree }[] = [{ indent: -1, node: root }]
  for (const raw of block.split('\n')) {
    if (!raw.trim() || raw.trimStart().startsWith('#')) continue
    const indent = raw.length - raw.trimStart().length
    const line = raw.trim()
    const colon = line.indexOf(':')
    const key = line.slice(0, colon).trim()
    const value = line.slice(colon + 1).trim()
    while (stack[stack.length - 1]!.indent >= indent) stack.pop()
    const parent = stack[stack.length - 1]!.node
    if (value === '') {
      const child: YamlTree = {}
      parent[key] = child
      stack.push({ indent, node: child })
    } else if (/^".*"$/.test(value)) {
      parent[key] = value.slice(1, -1)
    } else if (/^-?\d+(\.\d+)?$/.test(value)) {
      parent[key] = Number(value)
    } else {
      parent[key] = value
    }
  }
  return root
}

// ---------------------------------------------------------------------------

const schema = z.object({
  email: z.string().min(1, 'Email is required'),
  plan: z.string().min(1, 'Pick a plan'),
  color: z.string().min(1, 'Pick a colour'),
  terms: z.boolean(),
  start: z.date().nullable(),
})

function Fields() {
  return (
    <Form
      schema={schema}
      defaultValues={{ email: '', plan: '', color: '', terms: false, start: null }}
      onSubmit={() => {}}
    >
      <TextField name="email" label="Email" helperText="We never share it" />
      <Select
        name="plan"
        label="Plan"
        options={[
          { value: 'free', label: 'Free' },
          { value: 'pro', label: 'Pro' },
        ]}
      />
      <RadioGroup
        name="color"
        label="Colour"
        options={[
          { value: 'red', label: 'Red' },
          { value: 'blue', label: 'Blue' },
        ]}
      />
      <Checkbox name="terms" label="I agree" />
      <DatePicker name="start" label="Start" />
      <ReadOnlyField name="email" label="Email (read-only)" />
      <SubmitButton />
    </Form>
  )
}

function renderUnder(theme: Theme, ui = <Fields />) {
  return render(
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {withPickers(ui)}
    </ThemeProvider>,
  )
}

// `Theme.colorSchemes` is only typed once CSS variables are enabled by augmentation.
const schemesOf = (theme: Theme) =>
  Object.keys((theme as { colorSchemes?: Record<string, unknown> }).colorSchemes ?? {}).sort()

const light = createEzFormTheme()
const dark = createEzFormTheme({ defaultColorScheme: 'dark' })

describe('ezFormTheme', () => {
  describe.each([
    ['light', light],
    ['dark', dark],
  ])('%s scheme', (name, theme) => {
    it(`builds the ${name} palette`, () => {
      expect(theme.palette.mode).toBe(name)
      expect(theme.palette.background.default).toBe(
        ezFormTokens.colors[name as 'light' | 'dark'].canvas,
      )
    })

    it('renders fields with no axe violations', async () => {
      const { container } = renderUnder(theme)
      expect(screen.getByRole('textbox', { name: 'Email' })).toBeInTheDocument()
      await expectNoA11yViolations(container)
    })

    it('keeps text at WCAG AA contrast on both surfaces', () => {
      const { palette } = theme
      for (const surface of [palette.background.default, palette.background.paper]) {
        expect(contrast(palette.text.primary, surface)).toBeGreaterThanOrEqual(4.5)
        expect(contrast(palette.text.secondary, surface)).toBeGreaterThanOrEqual(4.5)
        // Error helper text is `error.main`.
        expect(contrast(palette.error.main, surface)).toBeGreaterThanOrEqual(4.5)
        // Focus ring and borders: non-text, 3:1 (WCAG 1.4.11).
        expect(contrast(palette.primary.main, surface)).toBeGreaterThanOrEqual(3)
      }
    })
  })

  it('contained primary button text passes AA in both schemes', () => {
    const { gray } = ezFormTokens.colors
    // Light: white on the gray[700]→gray[800] gradient; dark: black on gray[100]→gray[50].
    expect(contrast('white', gray[700])).toBeGreaterThanOrEqual(4.5)
    expect(contrast('white', gray[800])).toBeGreaterThanOrEqual(4.5)
    expect(contrast('black', gray[100])).toBeGreaterThanOrEqual(4.5)
    expect(contrast('black', gray[50])).toBeGreaterThanOrEqual(4.5)
  })

  it('stacks the label above the input: shrunk, static, no notch', () => {
    expect(light.components?.MuiInputLabel?.defaultProps).toMatchObject({
      shrink: true,
      disableAnimation: true,
    })
    expect(light.components?.MuiOutlinedInput?.defaultProps).toMatchObject({ notched: false })
    expect(light.components?.MuiPickersOutlinedInput?.defaultProps).toMatchObject({
      notched: false,
    })
    renderUnder(light)
    // MUI marks the label shrunk regardless of focus or value, and the outline's
    // legend stays collapsed — nothing is left for a label to float into.
    const label = screen.getByText('Email', { selector: 'label' })
    expect(label).toHaveClass('MuiInputLabel-shrink')
    const notch = document.querySelector('.MuiOutlinedInput-notchedOutline legend')
    expect(notch).not.toHaveClass('MuiOutlinedInput-notchedOutline-notched')
  })

  it('collapses transitions under prefers-reduced-motion (WCAG 2.3.3)', () => {
    renderUnder(light)
    const css = Array.from(document.querySelectorAll('style'))
      .map((s) => s.textContent ?? '')
      .join('\n')
    expect(css).toMatch(/@media \(prefers-reduced-motion:\s*reduce\)/)
    expect(css).toMatch(/transition-duration:\s*0\.01ms\s*!important/)
    expect(css).toMatch(/animation-duration:\s*0\.01ms\s*!important/)
  })

  it('gives the ReadOnlyField header a gap (#38)', () => {
    expect(light.components?.EzReadOnlyField?.styleOverrides?.header).toMatchObject({
      gap: ezFormTokens.spacing.sm,
    })
  })

  describe('createEzFormTheme', () => {
    it('accepts the palette.mode idiom', () => {
      const theme = createEzFormTheme({ palette: { mode: 'dark' } })
      expect(theme.palette.mode).toBe('dark')
      expect(theme.palette.background.default).toBe(ezFormTokens.colors.dark.canvas)
    })

    it('ships both schemes unless one is named, which pins the theme to it', () => {
      // Both present: MUI's ThemeProvider follows `prefers-color-scheme` / `useColorScheme`.
      expect(schemesOf(light)).toEqual(['dark', 'light'])
      // One named: the provider has only that scheme to render, whatever the OS says.
      expect(schemesOf(dark)).toEqual(['dark'])
      expect(schemesOf(createEzFormTheme({ palette: { mode: 'light' } }))).toEqual(['light'])
    })

    it('renders the pinned dark scheme through ThemeProvider', () => {
      renderUnder(dark)
      // CssBaseline paints `body` from the scheme the provider resolved, so this is
      // the provider's choice, not the theme object's.
      const css = Array.from(document.querySelectorAll('style'))
        .map((s) => s.textContent ?? '')
        .join('\n')
      // Emotion's style tags outlive a test, so look at the body rule this render added last.
      // (`body{margin:0;color:…` is CssBaseline's own rule; its `@media print` body rule has no colour.)
      const bodyRules = Array.from(
        css.matchAll(/body\{margin:0;color:[^}]*?background-color:([^;]+);/g),
      )
      expect(bodyRules.at(-1)?.[1]).toBe(ezFormTokens.colors.dark.canvas)
    })

    it('derives shades from a consumer primary and keeps the rest of the scheme', () => {
      const theme = createEzFormTheme({ palette: { primary: { main: '#6a1b9a' } } })
      expect(theme.palette.primary.main).toBe('#6a1b9a')
      expect(theme.palette.primary.light).not.toBe(ezFormTokens.colors.brand[200])
      expect(theme.palette.background.default).toBe(ezFormTokens.colors.light.canvas)
    })

    it('deep-merges component overrides into the preset', () => {
      const theme = createEzFormTheme({
        components: { MuiButton: { defaultProps: { disableElevation: true } } },
      })
      expect(theme.components?.MuiButton?.defaultProps).toMatchObject({ disableElevation: true })
      expect(theme.components?.MuiButton?.styleOverrides?.root).toBeDefined()
      expect(theme.components?.MuiChip?.defaultProps).toMatchObject({ size: 'small' })
    })

    it('is the same theme as spreading ezFormThemeOptions into createTheme', () => {
      const spread = createTheme({ ...ezFormThemeOptions, defaultColorScheme: 'dark' })
      expect(spread.palette.mode).toBe('dark')
      expect(spread.palette.background.paper).toBe(dark.palette.background.paper)
      expect(spread.shape.borderRadius).toBe(dark.shape.borderRadius)
    })
  })

  describe('DESIGN.md', () => {
    const designMd = readFileSync(join(__dirname, '..', '..', 'DESIGN.md'), 'utf8')
    const tokens = parseDesignTokens(designMd)

    it('carries the same tokens as the preset', () => {
      expect(tokens.colors).toEqual(ezFormTokens.colors)
      expect(tokens.typography).toEqual(ezFormTokens.typography)
      expect(tokens.rounded).toEqual(ezFormTokens.rounded)
      expect(tokens.spacing).toEqual(ezFormTokens.spacing)
      expect(tokens.sizing).toEqual(ezFormTokens.sizing)
    })

    it('says the preset is its code form and that components ship unstyled', () => {
      expect(designMd).toMatch(/src\/theme\/ezFormTheme\.ts/)
      expect(designMd).toMatch(/ship unstyled/i)
    })
  })

  describe('example forms', () => {
    const examples: [string, () => React.ReactElement, (() => Promise<unknown>) | undefined][] = [
      ['Login', () => <Login />, undefined],
      ['SignUp', () => <SignUp />, undefined],
      ['Checkout', () => <Checkout />, undefined],
      ['Loan', () => <Loan />, undefined],
      ['Insurance', () => <Insurance />, undefined],
      [
        'Profile',
        () => <Profile />,
        () => waitFor(() => expect(screen.getByLabelText(/display name/i)).toBeEnabled()),
      ],
    ]

    describe.each([
      ['preset', light],
      ['preset (dark)', dark],
      ['bare', createTheme()],
    ])('under %s', (_name, theme) => {
      it.each(examples)('%s renders with no axe violations', async (_example, ui, settle) => {
        const { container } = renderUnder(theme, ui())
        await settle?.()
        expect(screen.getByRole('form')).toBeInTheDocument()
        await expectNoA11yViolations(container)
      })
    })
  })
})
