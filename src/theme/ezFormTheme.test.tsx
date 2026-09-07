import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen, waitFor } from '@testing-library/react'
import CssBaseline from '@mui/material/CssBaseline'
import MuiTextField from '@mui/material/TextField'
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

/**
 * Occurrences of the shim marker in `src/`, excluding test files (which talk *about*
 * the marker, including this line, and would make the count circular). Counted by the
 * test below so the deletion when upstream ships is one `git grep`. See the test's own
 * comment for what to do when this number changes.
 */
const MARKER_COUNT = 16

/** Small schemas for the per-variant tests, which render one field, not `<Fields />`. */
const emailOnly = z.object({ email: z.string() })
const pickerOnly = z.object({ when: z.date().nullable() })

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

  it("pins the static top label as the 'stacked' variant, not theme-wide props (#142)", () => {
    // The mechanism, in one assertion each: the variant is the default, and the
    // fallback input is paired with it (without which a bare `<MuiTextField>` under
    // this preset renders an element whose `type` is `undefined` — see the bare-MUI
    // test below).
    expect(light.components?.MuiTextField?.defaultProps?.variant).toBe('stacked')
    expect(light.components?.MuiTextField?.defaultProps?.slots?.input).toBeDefined()
    expect(light.components?.MuiPickersTextField?.defaultProps?.variant).toBe('stacked')
    expect(light.components?.MuiPickersTextField?.defaultProps?.slots?.input).toBeDefined()
    // …and the props that used to force it theme-wide are gone, so `variant="outlined"`
    // on one field really does float again (asserted below).
    expect(light.components?.MuiInputLabel?.defaultProps?.shrink).toBeUndefined()
    expect(light.components?.MuiInputLabel?.defaultProps?.disableAnimation).toBeUndefined()
    // `notched: false` is gone too: no `label` ever reaches the input under a custom
    // variant, so `NotchedOutline`'s `withLabel` is false and there is nothing to notch.
    expect(light.components?.MuiOutlinedInput?.defaultProps?.notched).toBeUndefined()
    expect(light.components?.MuiPickersOutlinedInput?.defaultProps?.notched).toBeUndefined()

    renderUnder(light)
    const label = screen.getByText('Email', { selector: 'label' })
    const style = getComputedStyle(label)
    expect(style.position).toBe('relative')
    expect(style.transform).toBe('none')
    expect(style.transition).toBe('none')
    // The legend holds only the zero-width placeholder span, never the label text —
    // which is what "the notch never opens" means, with no `notched` prop involved.
    const notch = document.querySelector('.MuiOutlinedInput-notchedOutline legend')!
    expect(notch.textContent).not.toContain('Email')
    expect(notch.querySelector('span')).toHaveAttribute('aria-hidden', 'true')
  })

  it('variant="outlined" opts one field back to MUI\'s floating label (#142)', () => {
    renderUnder(
      light,
      <Form schema={emailOnly} defaultValues={{ email: '' }} onSubmit={() => {}}>
        <TextField name="email" label="Email" variant="outlined" />
      </Form>,
    )
    const label = screen.getByText('Email', { selector: 'label' })
    const style = getComputedStyle(label)
    expect(style.position).toBe('absolute')
    expect(style.transform).not.toBe('none')
    // The notch opens for it: MUI passes `label` to the input under `'outlined'`.
    const notch = document.querySelector('.MuiOutlinedInput-notchedOutline legend')!
    expect(notch.textContent).toContain('Email')
  })

  it("a bare MUI TextField renders under the preset — the 'stacked' default needs slots.input (#142)", () => {
    // The regression the theme-level `slots.input` exists to prevent. MUI resolves
    // `slots.input ?? variantComponent[variant]`; `variantComponent['stacked']` is
    // `undefined`, so without the pairing `useSlot` renders `<undefined>` and
    // `FormControl`'s `isMuiElement` child scan throws reading `type.muiName`.
    // This consumer wrote no ez-form component at all, so nothing but the theme can
    // supply it.
    expect(() =>
      render(
        <ThemeProvider theme={light}>
          <MuiTextField label="Bare" />
        </ThemeProvider>,
      ),
    ).not.toThrow()
    const label = screen.getByText('Bare', { selector: 'label' })
    expect(getComputedStyle(label).position).toBe('relative')
  })

  it('a bare built-in variant keeps its own input under the preset (#142)', () => {
    // The theme's `defaultProps.slots.input` cannot be a constant: `resolveProps`
    // merges it as a plain object, not keyed on the resolved `variant`, so a constant
    // `OutlinedInput` would reach `variant="filled"` / `"standard"` too and force them
    // onto the outlined box. `VariantInput` resolves the input at render from the
    // variant on `FormControl` context — the only channel, since MUI's `useSlot` does
    // not forward `variant` into the input slot's props.
    const filled = render(
      <ThemeProvider theme={light}>
        <MuiTextField variant="filled" label="Filled" />
      </ThemeProvider>,
    )
    expect(filled.container.querySelector('.MuiFilledInput-root')).not.toBeNull()
    expect(filled.container.querySelector('.MuiOutlinedInput-root')).toBeNull()
    filled.unmount()

    const standard = render(
      <ThemeProvider theme={light}>
        <MuiTextField variant="standard" label="Standard" />
      </ThemeProvider>,
    )
    expect(standard.container.querySelector('.MuiInput-root')).not.toBeNull()
    expect(standard.container.querySelector('.MuiOutlinedInput-root')).toBeNull()
    standard.unmount()

    // …and the default still lands on the outlined box with the notch closed, which is
    // what `stacked` means.
    const stacked = render(
      <ThemeProvider theme={light}>
        <MuiTextField label="Stacked" />
      </ThemeProvider>,
    )
    expect(stacked.container.querySelector('.MuiOutlinedInput-root')).not.toBeNull()
    const legend = stacked.container.querySelector('.MuiOutlinedInput-notchedOutline legend')!
    expect(legend.textContent).not.toContain('Stacked')
  })

  it('a bare picker keeps its own input per variant under the preset (#142)', () => {
    // The pickers' twin of the test above. `PickersTextFieldRoot` is a
    // `styled(FormControl)` — MUI's own — and `PickersTextField` passes the resolved
    // variant to it, so `PickersVariantInput` reads it off the same context.
    const { unmount } = renderUnder(
      light,
      <Form schema={pickerOnly} defaultValues={{ when: null }} onSubmit={() => {}}>
        <DatePicker name="when" label="When" slotProps={{ textField: { variant: 'filled' } }} />
      </Form>,
    )
    expect(document.querySelector('.MuiPickersFilledInput-root')).not.toBeNull()
    expect(document.querySelector('.MuiPickersOutlinedInput-root')).toBeNull()
    unmount()

    renderUnder(
      light,
      <Form schema={pickerOnly} defaultValues={{ when: null }} onSubmit={() => {}}>
        <DatePicker name="when" label="When" />
      </Form>,
    )
    // The default is `stacked`, which is not in MUI X's map either, so it falls back
    // to the outlined input.
    expect(document.querySelector('.MuiPickersOutlinedInput-root')).not.toBeNull()
  })

  it('a picker is stacked under the preset and floats under variant="outlined" (#142)', () => {
    // The pickers reach the variant only through the theme — MUI X's own
    // `slotProps.textField.variant` type is the closed union and `usePickerField`
    // deliberately leaves it alone (PHILOSOPHY rule 1). `PickersTextField` resolves
    // `slots?.input ?? VARIANT_COMPONENT[variant]` the same way, so the pairing above
    // is what makes this render at all.
    const { unmount } = renderUnder(
      light,
      <Form schema={pickerOnly} defaultValues={{ when: null }} onSubmit={() => {}}>
        <DatePicker name="when" label="When" />
      </Form>,
    )
    expect(getComputedStyle(screen.getByText('When', { selector: 'label' })).position).toBe(
      'relative',
    )
    unmount()
    renderUnder(
      light,
      <Form schema={pickerOnly} defaultValues={{ when: null }} onSubmit={() => {}}>
        <DatePicker name="when" label="When" slotProps={{ textField: { variant: 'outlined' } }} />
      </Form>,
    )
    expect(getComputedStyle(screen.getByText('When', { selector: 'label' })).position).toBe(
      'absolute',
    )
  })

  it('pins the UPSTREAM SHIM (#142) marker count so the deletion is one grep', () => {
    // When `@mui/material` ships `TextFieldPropsVariantOverrides`, every line carrying
    // this marker is deleted (keeping only the `stacked: true` member); §4 of
    // `docs/superpowers/specs/2026-09-07-text-field-variant-shim-design.md` is the plan.
    //
    // If this number changed: a shim line was added or removed. Confirm the change is
    // deliberate — `grep -rn 'UPSTREAM SHIM (#142)' src` shows every one — and update
    // the number here. A *growing* count is the thing to look at: the shim is meant to
    // stay confined to `textFieldVariants.ts`, the augmentation, the three wrapper
    // boundaries, the preset and one note in `usePickerField`.
    const marker = ['UPSTREAM', 'SHIM', '(#142)'].join(' ')
    const counts = execFileSync(
      'git',
      ['grep', '-c', '--fixed-strings', marker, '--', 'src', ':!src/**/*.test.*'],
      { cwd: join(import.meta.dirname, '..', '..'), encoding: 'utf8' },
    )
    const perFile = counts
      .trim()
      .split('\n')
      .map((line) => {
        const at = line.lastIndexOf(':')
        return [line.slice(0, at), Number(line.slice(at + 1))] as const
      })
    // The file list is pinned too, so a marker appearing somewhere new is a failure
    // even if another file lost one at the same time.
    expect(perFile.map(([file]) => file)).toEqual([
      'src/fields/Autocomplete/Autocomplete.tsx',
      'src/fields/NumberField/NumberFieldControl.tsx',
      'src/fields/TextField/TextField.tsx',
      'src/fields/pickers/usePickerField.ts',
      'src/fields/textFieldVariants.tsx',
      'src/index.ts',
      'src/theme/augmentation.ts',
      'src/theme/ezFormTheme.ts',
    ])
    expect(perFile.reduce((sum, [, n]) => sum + n, 0)).toBe(MARKER_COUNT)
  })

  it('sets no labelPlacement default — static labels are the theme’s, not the axis’s (#139)', () => {
    // The preset's opinion is "labels are static", and that is entirely the
    // `MuiInputLabel` / `MuiOutlinedInput` overrides asserted above: theme-wide, so
    // they reach a consumer's own bare `<MuiTextField>` outside any `<Form>` too,
    // which a form-scoped default never could. The old
    // `EzForm.defaultProps.labelPlacement: 'stacked'` was the belt to their braces
    // and is gone; `<Form>` keeps its own `'top'` default, which emits no CSS.
    expect(light.components?.EzForm?.defaultProps?.labelPlacement).toBeUndefined()
  })

  it('carries the description gap on EzForm.styleOverrides.description (#139)', () => {
    // With every label static, the first thing below the form's description is a
    // line of label text flush against the description's own last line — 0px
    // measured, text touching text. Under a floating-label theme the input's outline
    // already reads as a gap, which is why this belongs to the preset rather than to
    // `src/`, where it used to ride along with the deleted `stacked` rule.
    expect(light.components?.EzForm?.styleOverrides?.description).toMatchObject({
      marginBottom: ezFormTokens.spacing.lg,
    })
    // …and the token really is the 16px the `start` placement's `columnGap` uses, so
    // a rename of the token cannot quietly change the gap.
    expect(ezFormTokens.spacing.lg).toBe('16px')
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
      ['Modern', light],
      ['Modern (dark)', dark],
      ['Stock MUI', createTheme()],
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
