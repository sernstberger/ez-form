import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { z } from 'zod'
import { Form } from '../../Form'
import { NumberField } from '../../fields/NumberField'

const schema = z.object({ amount: z.number({ error: 'Enter an amount' }).nullable() })

function paste(input: HTMLInputElement, text: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
  input.focus()
  setter.call(input, text)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

async function run(locale: string, text: string) {
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
  await userEvent.click(screen.getByRole('button', { name: 'Go' }))
  const errorEl = document.querySelector('.MuiFormHelperText-root')
  console.log(
    `[${locale}] "${text}" -> displayed=${JSON.stringify(input.value)} submitted=${JSON.stringify(
      onSubmit.mock.calls[0]?.[0],
    )} error=${JSON.stringify(errorEl?.textContent ?? null)}`,
  )
}

describe('QA: NumberField cross-locale ambiguous separator paste — detail', () => {
  it('en-US: paste "1.234,56" (de-CH-shaped) — check submitted value + error', async () => {
    await run('en-US', '1.234,56')
  })
  it('en-US: paste "$1,234.56" (currency symbol) — check submitted value + error', async () => {
    await run('en-US', '$1,234.56')
  })
  it('en-US: paste "1 234,56 €" — check submitted value + error', async () => {
    await run('en-US', '1 234,56 €')
  })
  it('en-US: paste "1e3" — check submitted value + error', async () => {
    await run('en-US', '1e3')
  })
  it('en-US: paste "12abc" — check submitted value + error', async () => {
    await run('en-US', '12abc')
  })
  it('de-CH: paste "1,234.56" (en-US-shaped) — check submitted value + error', async () => {
    await run('de-CH', '1,234.56')
  })
})
