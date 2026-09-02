import { useDefaultProps } from '@mui/material/DefaultPropsProvider'
import { useEzFormContext } from '../../useEzFormContext'
import { NumberField, type NumberFieldProps } from '../NumberField'

/**
 * `format` and `locale` are the binding's: the `%` sign is what makes this a
 * percent field, and it comes from `Intl` through `NumberField`'s own `format`
 * — the same slot `MoneyField` puts `$` through — rather than a hand-hung
 * adornment beside the input. `valueScale` is `NumberField`'s internal
 * display/stored transform, which `scale` below is the public way to ask for.
 */
export type PercentFieldProps = Omit<NumberFieldProps, 'format' | 'locale' | 'valueScale'> & {
  /**
   * What the form value means, relative to what is displayed. Default
   * `'percent'`: the field stores the number it shows, so `12.5` displays as
   * `12.5%`. Under `'fraction'` the display is unchanged but the stored value
   * is the fraction — `12.5%` on screen submits `0.125` — for schemas and APIs
   * that keep rates as fractions.
   *
   * Only the stored value moves. `min`, `max` and `step` are always in display
   * units (percentage points), so `max={100}` means 100% under either scale.
   */
  scale?: 'percent' | 'fraction'
}

// `maximumFractionDigits: 2` also rounds the committed value, so `12.3456`
// submits as `12.35` rather than displaying `12.35%` over a longer number.
// `style: 'unit'` with `unit: 'percent'` draws the `%` sign *without* Intl's
// own `style: 'percent'` ×100 scaling, so the number on screen is the number
// the control holds and `scale` stays the only thing that moves it. Hoisted so
// the identity is stable across renders (NumberFieldControl memoizes the
// separators on it).
const PERCENT_FORMAT = {
  style: 'unit',
  unit: 'percent',
  maximumFractionDigits: 2,
} as const satisfies Intl.NumberFormatOptions

/**
 * Both directions round to the precision the display actually carries — two
 * fraction digits of a percentage point — so a `fraction` round-trip does not
 * accumulate binary float noise. `29.7 / 100` is `0.29700000000000004`
 * unrounded, which would then submit and re-display as that.
 */
const FRACTION_SCALE = {
  toDisplay: (stored: number) => Math.round(stored * 100 * 100) / 100,
  toStored: (display: number) => Math.round((display / 100) * 1e6) / 1e6,
}

/**
 * A percentage on top of `NumberField`: `12.5%` on blur, digits grouped while
 * typing, and `min` 0 / `max` 100 / `step` 1 by default — all overridable, and
 * all in percentage points. The `%` comes from `Intl` through `NumberField`'s
 * `format`, the same way `$` does on `MoneyField`, so it is part of the
 * formatted value rather than an adornment the caret can land beside.
 */
export function PercentField(inProps: PercentFieldProps) {
  // Ahead of NumberField's own guard, so the "outside <Form>" error names <PercentField>.
  useEzFormContext('PercentField')
  const props = useDefaultProps({ props: inProps, name: 'EzPercentField' })
  const { scale = 'percent', min = 0, max = 100, step = 1, ...rest } = props

  // `undefined` under the default scale, so a `'percent'` field is a plain
  // `NumberField` with a `%` format and no transform in the way at all.
  // `FRACTION_SCALE` is a module constant, so this is already stable across
  // renders — no memo needed.
  const valueScale = scale === 'fraction' ? FRACTION_SCALE : undefined

  return (
    <NumberField
      locale="en-US"
      format={PERCENT_FORMAT}
      min={min}
      max={max}
      step={step}
      smallStep={0.1}
      largeStep={10}
      {...rest}
      valueScale={valueScale}
    />
  )
}
