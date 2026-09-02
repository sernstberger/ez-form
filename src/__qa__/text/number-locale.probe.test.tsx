import { render, screen } from '@testing-library/react'
import { z } from 'zod'
import { Form } from '../../Form'
import { NumberField } from '../../fields/NumberField'
import { MoneyField } from '../../fields/MoneyField'

const schema = z.object({ amount: z.number().nullable() })

function paste(input: HTMLInputElement, text: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
  input.focus()
  setter.call(input, text)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

const LOCALE_PASTES: Record<string, string[]> = {
  'en-US': ['1,234.56', '1.234,56', '$1,234.56', '1 234,56 €', '1e3', '12abc', '−5', '١٢٣'],
  'de-CH': ["1'234.56", '1,234.56', '1.234,56', '−5', '١٢٣'],
  'fr-FR': ['1 234,56', '1,234.56', '1.234,56', '−5', '١٢٣'],
  'ar-EG': ['١٢٣', '1,234.56', '1.234,56', '−5'],
  'en-IN': ['1,23,456.78', '1,234.56', '−5'],
}

describe('QA: NumberField paste across locales', () => {
  for (const [locale, pastes] of Object.entries(LOCALE_PASTES)) {
    for (const text of pastes) {
      it(`${locale}: paste "${text}"`, async () => {
        const onSubmit = vi.fn()
        render(
          <Form schema={schema} defaultValues={{ amount: null }} onSubmit={onSubmit}>
            <NumberField name="amount" label="Amount" locale={locale} />
            <button type="submit">Go</button>
          </Form>,
        )
        const input = screen.getByRole('textbox', { name: 'Amount' }) as HTMLInputElement
        paste(input, text)
        input.blur()
        // eslint-disable-next-line testing-library/no-node-access
        console.log(
          `[${locale}] pasted ${JSON.stringify(text)} -> displayed ${JSON.stringify(input.value)}`,
        )
      })
    }
  }
})

describe('QA: MoneyField paste', () => {
  const moneyPastes = ['$1,234.56', '1,234.56', '1.234,56', '1 234,56 €', '−5', '1e3', '12abc']
  for (const text of moneyPastes) {
    it(`en-US money: paste "${text}"`, () => {
      render(
        <Form schema={schema} defaultValues={{ amount: null }} onSubmit={() => {}}>
          <MoneyField name="amount" label="Amount" />
        </Form>,
      )
      const input = screen.getByRole('textbox', { name: 'Amount' }) as HTMLInputElement
      paste(input, text)
      input.blur()
      console.log(
        `[money] pasted ${JSON.stringify(text)} -> displayed ${JSON.stringify(input.value)}`,
      )
    })
  }
})
