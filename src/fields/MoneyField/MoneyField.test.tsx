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
})
