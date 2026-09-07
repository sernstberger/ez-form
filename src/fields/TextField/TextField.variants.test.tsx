import { render, screen } from '@testing-library/react'
import { expectTypeOf } from 'vitest'
import OutlinedInput from '@mui/material/OutlinedInput'
import Input from '@mui/material/Input'
import { createTheme, ThemeProvider } from '@mui/material/styles'
import type { TextFieldVariants } from '@mui/material/TextField'
import { z } from 'zod'
import { Form } from '../../Form'
import { TextField, type TextFieldProps } from './TextField'
import { Autocomplete } from '../Autocomplete'
import { Select } from '../Select'
import { expectNoA11yViolations } from '../../test/axe'
import {
  customVariantSlots,
  isBuiltInTextFieldVariant,
  type EzTextFieldVariants,
} from '../textFieldVariants'

/**
 * The custom-variant shim (#142). Everything here is about a `variant` outside
 * MUI's closed `'outlined' | 'standard' | 'filled'` union rendering at all — the
 * *look* under `createEzFormTheme()` is `src/theme/ezFormTheme.test.tsx`'s.
 */

const schema = z.object({ a: z.string() })

const stock = createTheme()

function renderField(ui: React.ReactNode) {
  return render(
    <ThemeProvider theme={stock}>
      <Form schema={schema} defaultValues={{ a: '' }} onSubmit={() => {}}>
        {ui}
      </Form>
    </ThemeProvider>,
  )
}

describe('custom TextField variants (#142)', () => {
  it('renders a custom variant under a stock theme instead of throwing', () => {
    // Unshimmed, MUI looks the variant up in `variantComponent`, finds `undefined`,
    // and React throws on an element with no type. `customVariantSlots` fills in
    // `slots.input`, which MUI resolves *before* that map.
    expect(() => renderField(<TextField name="a" label="A" variant="stacked" />)).not.toThrow()
    const input = screen.getByRole('textbox', { name: 'A' })
    expect(input.closest('.MuiInputBase-root')).toHaveClass('MuiOutlinedInput-root')
  })

  it('leaves the notch closed for a custom variant, with no `notched` prop', () => {
    // MUI's TextField passes `label` to the input only under `variant === 'outlined'`
    // (TextField.js), so `NotchedOutline` renders with `withLabel` false: the legend
    // holds a zero-width placeholder span, never the label text. This is why the
    // preset can drop `MuiOutlinedInput.defaultProps.notched`.
    renderField(<TextField name="a" label="A" variant="stacked" />)
    const legend = document.querySelector('.MuiOutlinedInput-notchedOutline legend')!
    expect(legend.textContent).not.toContain('A')
    expect(legend.querySelector('span')).toHaveAttribute('aria-hidden', 'true')
  })

  it("leaves the three built-in variants on MUI's own inputs", () => {
    const { unmount } = renderField(<TextField name="a" label="A" variant="standard" />)
    expect(screen.getByRole('textbox', { name: 'A' }).closest('.MuiInputBase-root')).toHaveClass(
      'MuiInput-root',
    )
    unmount()
    renderField(<TextField name="a" label="A" variant="filled" />)
    expect(screen.getByRole('textbox', { name: 'A' }).closest('.MuiInputBase-root')).toHaveClass(
      'MuiFilledInput-root',
    )
  })

  it("a consumer's own slots.input wins over the custom variant's fallback", () => {
    // The upstream escape hatch: `slots.input` is how a custom variant chooses
    // another input, so the fallback must never displace one the consumer passed.
    renderField(<TextField name="a" label="A" variant="stacked" slots={{ input: Input }} />)
    expect(screen.getByRole('textbox', { name: 'A' }).closest('.MuiInputBase-root')).toHaveClass(
      'MuiInput-root',
    )
  })

  it('a Select renders under a custom variant too', () => {
    // MUI's `Select` has its own closed variant map and `cloneElement`s the result,
    // which throws on `undefined`. It never gets there: `TextField` hands `Select` the
    // already-built input as its `input` prop, and `Select` short-circuits on it
    // (`input || {…}[variant]`). So the shim covers `Select` with no code of its own.
    expect(() =>
      renderField(
        <Select name="a" label="A" variant="stacked" options={[{ value: 'x', label: 'X' }]} />,
      ),
    ).not.toThrow()
    expect(screen.getByRole('combobox', { name: 'A' })).toBeInTheDocument()
  })

  it("an Autocomplete's textFieldProps.variant takes a custom variant", () => {
    expect(() =>
      renderField(
        <Autocomplete
          name="a"
          label="A"
          options={[{ value: 'x', label: 'X' }]}
          textFieldProps={{ variant: 'stacked' }}
        />,
      ),
    ).not.toThrow()
    expect(screen.getByRole('combobox', { name: 'A' }).closest('.MuiInputBase-root')).toHaveClass(
      'MuiOutlinedInput-root',
    )
  })

  it('has no axe violations under a custom variant', async () => {
    const { container } = renderField(
      <TextField name="a" label="A" variant="stacked" helperText="Hint" />,
    )
    await expectNoA11yViolations(container)
  })

  describe('customVariantSlots', () => {
    it('returns slots untouched for a built-in or absent variant', () => {
      const slots = { input: Input }
      expect(customVariantSlots('outlined', slots)).toBe(slots)
      expect(customVariantSlots('standard', slots)).toBe(slots)
      expect(customVariantSlots('filled', slots)).toBe(slots)
      expect(customVariantSlots(undefined, slots)).toBe(slots)
      // …including when there are none: the theme's own default must reach MUI
      // unshadowed by an empty object.
      expect(customVariantSlots(undefined, undefined)).toBeUndefined()
      expect(customVariantSlots('outlined', undefined)).toBeUndefined()
    })

    it('fills in OutlinedInput for a custom variant, consumer first', () => {
      expect(customVariantSlots('stacked', undefined)).toEqual({ input: OutlinedInput })
      expect(customVariantSlots('stacked', { input: Input })).toEqual({ input: Input })
    })

    it('takes an explicit fallback, which is how the pickers would use it', () => {
      expect(customVariantSlots('stacked', undefined, Input)).toEqual({ input: Input })
    })
  })

  describe('isBuiltInTextFieldVariant', () => {
    it('is true for exactly the three MUI renders from its own map', () => {
      expect(isBuiltInTextFieldVariant('outlined')).toBe(true)
      expect(isBuiltInTextFieldVariant('standard')).toBe(true)
      expect(isBuiltInTextFieldVariant('filled')).toBe(true)
      expect(isBuiltInTextFieldVariant('stacked')).toBe(false)
      expect(isBuiltInTextFieldVariant(undefined)).toBe(false)
    })
  })

  describe('types', () => {
    it("EzTextFieldVariants is MUI's union plus what augments the overrides", () => {
      expectTypeOf<TextFieldVariants>().toExtend<EzTextFieldVariants>()
      expectTypeOf<'stacked'>().toExtend<EzTextFieldVariants>()
      expectTypeOf<'outlined'>().toExtend<EzTextFieldVariants>()
      expectTypeOf<'standard'>().toExtend<EzTextFieldVariants>()
      expectTypeOf<'filled'>().toExtend<EzTextFieldVariants>()
      // Not open to any string: an undeclared variant is still a type error, which is
      // the whole point of augmenting rather than widening to `string`.
      expectTypeOf<'dashed'>().not.toExtend<EzTextFieldVariants>()
    })

    it("the field's own prop takes every one of them", () => {
      expectTypeOf<TextFieldProps['variant']>().toEqualTypeOf<EzTextFieldVariants | undefined>()
    })
  })
})
