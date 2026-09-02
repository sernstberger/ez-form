import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Checkout } from './Checkout'
import { DECLINED_CARD_NUMBER } from '../fakeApi'
import { expectNoA11yViolations } from '../../test/axe'

async function fillShipping(user: ReturnType<typeof userEvent.setup>) {
  const shipping = screen.getByRole('group', { name: 'Shipping address' })
  await user.type(within(shipping).getByLabelText(/full name/i), 'Ada Lovelace')
  await user.type(within(shipping).getByLabelText(/street address/i), '1 Analytical Way')
  await user.type(within(shipping).getByLabelText(/^city/i), 'London')
  await user.click(within(shipping).getByRole('combobox', { name: /country/i }))
  await user.click(await screen.findByRole('option', { name: 'United Kingdom' }))
  await user.type(within(shipping).getByLabelText(/state \/ region/i), 'Greater London')
  await user.type(within(shipping).getByLabelText(/postal code/i), 'SW1A 1AA')
}

async function fillPayment(
  user: ReturnType<typeof userEvent.setup>,
  cardNumber = '4111111111111111',
) {
  const payment = screen.getByRole('group', { name: 'Payment' })
  await user.type(within(payment).getByLabelText(/card number/i), cardNumber)
  await user.type(within(payment).getByLabelText(/expiry/i), '04/29')
  await user.type(within(payment).getByLabelText(/^cvc/i), '123')
}

async function fillCompleteForm(user: ReturnType<typeof userEvent.setup>, cardNumber?: string) {
  await fillShipping(user)
  await fillPayment(user, cardNumber)
}

async function confirmDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /place order/i }))
  await screen.findByRole('alertdialog', { name: /place order\?/i })
  await user.click(screen.getByRole('button', { name: /^confirm$/i }))
}

describe('Checkout', () => {
  it('has an accessible form name "Checkout"', () => {
    render(<Checkout />)
    expect(screen.getByRole('form', { name: 'Checkout' })).toBeInTheDocument()
  })

  it('groups Shipping address, Billing address, and Payment under named fieldsets', () => {
    render(<Checkout />)
    expect(screen.getByRole('group', { name: 'Shipping address' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Billing address' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Payment' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Order summary' })).toBeInTheDocument()
  })

  it('shows a State select with US states when the country is United States', async () => {
    const user = userEvent.setup()
    render(<Checkout />)
    const shipping = screen.getByRole('group', { name: 'Shipping address' })
    await user.click(within(shipping).getByRole('combobox', { name: /^country/i }))
    await user.click(await screen.findByRole('option', { name: 'United States' }))
    await user.click(within(shipping).getByRole('combobox', { name: /state \/ region/i }))
    await user.click(await screen.findByRole('option', { name: 'California' }))
    expect(within(shipping).getByRole('combobox', { name: /state \/ region/i })).toHaveTextContent(
      'California',
    )
  })

  it('shows a province select with Canadian provinces when the country is Canada', async () => {
    const user = userEvent.setup()
    render(<Checkout />)
    const shipping = screen.getByRole('group', { name: 'Shipping address' })
    await user.click(within(shipping).getByRole('combobox', { name: /^country/i }))
    await user.click(await screen.findByRole('option', { name: 'Canada' }))
    await user.click(within(shipping).getByRole('combobox', { name: /state \/ region/i }))
    await user.click(await screen.findByRole('option', { name: 'Ontario' }))
    expect(within(shipping).getByRole('combobox', { name: /state \/ region/i })).toHaveTextContent(
      'Ontario',
    )
  })

  it('falls back to a free-text state/region field for a country with no list (e.g. United Kingdom)', async () => {
    const user = userEvent.setup()
    render(<Checkout />)
    const shipping = screen.getByRole('group', { name: 'Shipping address' })
    await user.click(within(shipping).getByRole('combobox', { name: /^country/i }))
    await user.click(await screen.findByRole('option', { name: 'United Kingdom' }))
    expect(within(shipping).getByRole('textbox', { name: /state \/ region/i })).toBeInTheDocument()
  })

  it('resets the state/region value when the country changes', async () => {
    const user = userEvent.setup()
    render(<Checkout />)
    const shipping = screen.getByRole('group', { name: 'Shipping address' })
    await user.click(within(shipping).getByRole('combobox', { name: /^country/i }))
    await user.click(await screen.findByRole('option', { name: 'United States' }))
    await user.click(within(shipping).getByRole('combobox', { name: /state \/ region/i }))
    await user.click(await screen.findByRole('option', { name: 'California' }))

    // Switching to Canada must not keep California selected/lingering as a stale value.
    await user.click(within(shipping).getByRole('combobox', { name: /^country/i }))
    await user.click(await screen.findByRole('option', { name: 'Canada' }))
    const region = within(shipping).getByRole('combobox', { name: /state \/ region/i })
    expect(region).not.toHaveTextContent('California')
  })

  it('hides the billing address fields while "same as shipping" is checked (the default)', () => {
    render(<Checkout />)
    const billing = screen.getByRole('group', { name: 'Billing address' })
    expect(within(billing).getByRole('checkbox', { name: /same as shipping/i })).toBeChecked()
    expect(within(billing).queryByLabelText(/full name/i)).not.toBeInTheDocument()
  })

  it('reveals the billing address fields once "same as shipping" is unchecked', async () => {
    const user = userEvent.setup()
    render(<Checkout />)
    const billing = screen.getByRole('group', { name: 'Billing address' })
    await user.click(within(billing).getByRole('checkbox', { name: /same as shipping/i }))
    expect(within(billing).getByLabelText(/full name/i)).toBeInTheDocument()
    expect(within(billing).getByLabelText(/postal code/i)).toBeInTheDocument()
  })

  it('requires billing fields only once "same as shipping" is unchecked', async () => {
    const user = userEvent.setup()
    render(<Checkout />)
    await fillCompleteForm(user)
    const billing = screen.getByRole('group', { name: 'Billing address' })
    await user.click(within(billing).getByRole('checkbox', { name: /same as shipping/i }))
    await user.click(screen.getByRole('button', { name: /place order/i }))
    await screen.findAllByText(/billing .* is required/i)
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('submits with the shipping address copied onto billing when "same as shipping" stays checked', async () => {
    const user = userEvent.setup()
    const onSuccess = vi.fn()
    render(<Checkout onSuccess={onSuccess} />)
    await fillCompleteForm(user)
    await confirmDialog(user)
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
    const [, billing] = onSuccess.mock.calls[0]!
    expect(billing).toEqual({
      name: 'Ada Lovelace',
      street: '1 Analytical Way',
      city: 'London',
      country: 'GB',
      state: 'Greater London',
      postalCode: 'SW1A 1AA',
    })
  })

  it('shows a field error for a card number that fails the 16-digit pattern', async () => {
    const user = userEvent.setup()
    render(<Checkout />)
    await fillCompleteForm(user, '123')
    await user.click(screen.getByRole('button', { name: /place order/i }))
    await screen.findByText(/16-digit card number/i)
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('shows a field error for a CVC that fails the 3-4 digit pattern', async () => {
    const user = userEvent.setup()
    render(<Checkout />)
    await fillShipping(user)
    const payment = screen.getByRole('group', { name: 'Payment' })
    await user.type(within(payment).getByLabelText(/card number/i), '4111111111111111')
    await user.type(within(payment).getByLabelText(/expiry/i), '04/29')
    await user.type(within(payment).getByLabelText(/^cvc/i), '12')
    await user.click(screen.getByRole('button', { name: /place order/i }))
    await screen.findByText(/3- or 4-digit cvc/i)
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('asks for confirmation before placing the order and only submits on Confirm', async () => {
    const user = userEvent.setup()
    const onSuccess = vi.fn()
    render(<Checkout onSuccess={onSuccess} />)
    await fillCompleteForm(user)
    await user.click(screen.getByRole('button', { name: /place order/i }))
    const dialog = await screen.findByRole('alertdialog', { name: /place order\?/i })
    expect(onSuccess).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: /^confirm$/i }))
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
  })

  it('cancelling the confirm dialog never submits', async () => {
    const user = userEvent.setup()
    const onSuccess = vi.fn()
    render(<Checkout onSuccess={onSuccess} />)
    await fillCompleteForm(user)
    await user.click(screen.getByRole('button', { name: /place order/i }))
    const dialog = await screen.findByRole('alertdialog', { name: /place order\?/i })
    await user.click(within(dialog).getByRole('button', { name: /^cancel$/i }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('shows a server error alert when the fake API declines the card', async () => {
    const user = userEvent.setup()
    render(<Checkout />)
    await fillCompleteForm(user, DECLINED_CARD_NUMBER)
    await confirmDialog(user)
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/declined/i)
  })

  it('updates the total in the order summary as the tip changes', async () => {
    const user = userEvent.setup()
    render(<Checkout />)
    const summary = screen.getByRole('group', { name: 'Order summary' })
    expect(within(summary).getByText(/^total: \$84\.97/i)).toBeInTheDocument()
    const payment = screen.getByRole('group', { name: 'Payment' })
    const tipInput = within(payment).getByLabelText(/^tip$/i)
    await user.clear(tipInput)
    await user.type(tipInput, '10')
    await user.tab()
    await waitFor(() => expect(within(summary).getByText(/^total: \$94\.97/i)).toBeInTheDocument())
  })

  it('is accessible when idle', async () => {
    const { container } = render(<Checkout />)
    await expectNoA11yViolations(container)
  })

  it('is accessible with the billing fields revealed', async () => {
    const user = userEvent.setup()
    const { container } = render(<Checkout />)
    const billing = screen.getByRole('group', { name: 'Billing address' })
    await user.click(within(billing).getByRole('checkbox', { name: /same as shipping/i }))
    await expectNoA11yViolations(container)
  })

  it('is accessible with a server error shown', async () => {
    const user = userEvent.setup()
    const { container } = render(<Checkout />)
    await fillCompleteForm(user, DECLINED_CARD_NUMBER)
    await confirmDialog(user)
    await screen.findByRole('alert')
    await expectNoA11yViolations(container)
  })
})
