import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { z } from 'zod'
import { Form } from '../../Form'
import { MoneyField } from './MoneyField'
import { describeFieldContract } from '../../test/describeFieldContract'

const schema = z.object({ price: z.number().nullable() })
const input = () => screen.getByRole('textbox', { name: 'Price' })

describeFieldContract({
  componentName: 'MoneyField',
  label: 'Price',
  schema,
  defaultValues: {},
  render: ({ onChange, ...props }) => (
    <MoneyField name="price" label="Price" onValueChange={onChange} {...props} />
  ),
  getControl: input,
  interact: (user) => user.type(input(), '1'),
})

describe('MoneyField', () => {
  it('shows $1,234.50 on blur and submits 1234.5', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <Form schema={schema} defaultValues={{}} onSubmit={onSubmit}>
        <MoneyField name="price" label="Price" />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.type(input(), '1234.5')
    await user.tab()
    expect(input()).toHaveValue('$1,234.50')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ price: 1234.5 }, expect.anything())
  })

  it('groups digits while typing, before any blur', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={{}} onSubmit={() => {}}>
        <MoneyField name="price" label="Price" />
      </Form>,
    )
    await user.type(input(), '1234')
    expect(input()).toHaveValue('1,234')
  })

  it('rounds a sub-cent entry to the cent it displays', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <Form schema={schema} defaultValues={{}} onSubmit={onSubmit}>
        <MoneyField name="price" label="Price" />
        <button type="submit">Go</button>
      </Form>,
    )
    // Blur-then-submit: the display says $20.00, so the value must be 20, not 19.999.
    await user.type(input(), '19.999')
    await user.tab()
    expect(input()).toHaveValue('$20.00')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenLastCalledWith({ price: 20 }, expect.anything())

    // Enter-submit, without an intervening blur.
    await user.clear(input())
    await user.type(input(), '19.999{Enter}')
    expect(onSubmit).toHaveBeenLastCalledWith({ price: 20 }, expect.anything())
  })

  it('shows the min rule message for a value below the bound', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={{}} onSubmit={() => {}}>
        <MoneyField name="price" label="Price" min={0} />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.type(input(), '-5')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByText('Price must be at least 0.')).toBeInTheDocument()
  })

  it('Form requiredIndicator="optional": required stays required with no asterisk', () => {
    const { container } = render(
      <Form schema={schema} defaultValues={{}} onSubmit={() => {}} requiredIndicator="optional">
        <MoneyField name="price" label="Price" required />
      </Form>,
    )
    expect(input()).toBeRequired()
    expect(container.querySelector('[class*="asterisk"]')).toBeNull()
  describe('pasting a currency-formatted amount (#72)', () => {
    it('"$1,234.56" (its own en-US/USD shape) submits 1234.56', async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn()
      render(
        <Form schema={schema} defaultValues={{}} onSubmit={onSubmit}>
          <MoneyField name="price" label="Price" />
          <button type="submit">Go</button>
        </Form>,
      )
      await user.click(input())
      await user.paste('$1,234.56')
      await user.click(screen.getByRole('button', { name: 'Go' }))
      expect(onSubmit).toHaveBeenCalledWith({ price: 1234.56 }, expect.anything())
    })

    // "1 234,56 €" has no '.', so `normalizeForeignShape`'s both-separators detection does not
    // apply (correctly: a single ',' under en-US/USD is the existing, unrelated ambiguous-
    // single-separator case). What actually happens is Base UI's own `parseNumber`, which
    // strips the USD currency symbol '$' but not '€', then falls back to `parseFloat` on
    // "1 23456 €" — silently truncating to 1 rather than rejecting. This is the general
    // trailing-garbage permissiveness in Base UI's parser (see the `it.todo` in
    // NumberField.test.tsx), not something this fix's locale-shape detection covers; scoped
    // out as upstream in the #72 ruling rather than bundled into this fix.
    it.todo(
      'upstream (Base UI parseNumber): "1 234,56 €" pasted into a USD MoneyField should reject or resolve to 1234.56, not silently truncate to 1',
    )
  })
})
