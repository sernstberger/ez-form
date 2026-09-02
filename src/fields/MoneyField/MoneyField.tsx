import { useEzFormContext } from '../../useEzFormContext'
import { NumberField, type NumberFieldProps } from '../NumberField'

// `valueScale` is `NumberField`'s internal display/stored transform (see its
// JSDoc). Money is always stored in the units it displays, so the prop is
// omitted rather than exposed: `@internal` keeps it out of the emitted `.d.ts`
// but not out of this type, and an un-omitted prop is a public prop in source.
export type MoneyFieldProps = Omit<NumberFieldProps, 'format' | 'locale' | 'valueScale'>

// `maximumFractionDigits: 2` also rounds the committed value, so `19.999` submits as `20`
// rather than displaying `$20.00` over a sub-cent value. Hoisted so the identity is stable
// across renders (NumberFieldControl memoizes the separators on it).
const USD_FORMAT = {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
} as const satisfies Intl.NumberFormatOptions

/** US dollars on top of NumberField: `$1,234.50` on blur, digits grouped while typing, value in dollars rounded to the cent. */
export function MoneyField(props: MoneyFieldProps) {
  // Ahead of NumberField's own guard, so the "outside <Form>" error names <MoneyField>.
  useEzFormContext('MoneyField')
  return (
    <NumberField
      locale="en-US"
      format={USD_FORMAT}
      step={1}
      smallStep={0.01}
      largeStep={10}
      {...props}
    />
  )
}
