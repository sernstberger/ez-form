import { humanize } from './humanize'

describe('humanize', () => {
  it.each([
    ['cardNumber', 'Card number'],
    ['address.zipCode', 'Zip code'],
    ['items.0.sku', 'Sku'],
    ['first_name', 'First name'],
    ['email', 'Email'],
  ])('%s → %s', (input, expected) => {
    expect(humanize(input)).toBe(expected)
  })
})
