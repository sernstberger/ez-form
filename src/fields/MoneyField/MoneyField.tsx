import { useEzFormContext } from '../../useEzFormContext'
import { NumberField, type NumberFieldProps } from '../NumberField'

export type MoneyFieldProps = Omit<NumberFieldProps, 'format' | 'locale'>

/** US dollars on top of NumberField: `$1,234.50` on blur, digits grouped while typing, value in dollars. */
export function MoneyField(props: MoneyFieldProps) {
  // Ahead of NumberField's own guard, so the "outside <Form>" error names <MoneyField>.
  useEzFormContext('MoneyField')
  return (
    <NumberField
      locale="en-US"
      format={{ style: 'currency', currency: 'USD' }}
      step={1}
      smallStep={0.01}
      largeStep={10}
      {...props}
    />
  )
}
