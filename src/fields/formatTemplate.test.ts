import {
  caretAtDigitIndex,
  digitIndexAt,
  digitsOnly,
  formatTemplate,
  templateDigitCount,
} from './formatTemplate'

const PHONE = '###-###-####'
const PAREN = '(###) ###-####'
const SSN = '###-##-####'

describe('templateDigitCount', () => {
  it.each([
    [PHONE, 10],
    [PAREN, 10],
    [SSN, 9],
    ['#####', 5],
    ['', 0],
  ])('%j has %i digit slots', (template, expected) => {
    expect(templateDigitCount(template)).toBe(expected)
  })
})

describe('digitsOnly', () => {
  it.each([
    ['(555) 555-5555', '5555555555'],
    ['+1 555 555 5555', '15555555555'],
    ['abc', ''],
    ['', ''],
  ])('digitsOnly(%j) -> %j', (text, expected) => {
    expect(digitsOnly(text)).toBe(expected)
  })
})

describe('formatTemplate', () => {
  it.each([
    ['', PHONE, ''],
    ['5', PHONE, '5'],
    ['555', PHONE, '555'],
    // A complete group stops before the separator, so nothing dangles while typing.
    ['5555', PHONE, '555-5'],
    ['5555555555', PHONE, '555-555-5555'],
    ['5555555555', PAREN, '(555) 555-5555'],
    ['5', PAREN, '(5'],
    ['123456789', SSN, '123-45-6789'],
  ])('formatTemplate(%j, %j) -> %j', (digits, template, expected) => {
    expect(formatTemplate(digits, template)).toBe(expected)
  })

  it('ignores digits past the template capacity', () => {
    expect(formatTemplate('55555555559999', PHONE)).toBe('555-555-5555')
  })
})

describe('digitIndexAt', () => {
  it.each([
    ['555-555-5555', 0, 0],
    ['555-555-5555', 3, 3],
    // A caret sitting just after the separator has still passed 3 digits.
    ['555-555-5555', 4, 3],
    ['555-555-5555', 5, 4],
    ['555-555-5555', 12, 10],
  ])('digitIndexAt(%j, %i) -> %i', (text, caret, expected) => {
    expect(digitIndexAt(text, caret)).toBe(expected)
  })
})

describe('caretAtDigitIndex', () => {
  it.each([
    ['555-555-5555', 0, 0],
    ['555-555-5555', 3, 3],
    ['555-555-5555', 4, 5],
    ['555-555-5555', 10, 12],
    // Past the end clamps to the end rather than throwing the caret away.
    ['555-555-5555', 99, 12],
  ])('caretAtDigitIndex(%j, %i) -> %i', (formatted, digitIndex, expected) => {
    expect(caretAtDigitIndex(formatted, digitIndex)).toBe(expected)
  })

  it('round-trips with digitIndexAt across every caret offset', () => {
    const text = formatTemplate('5551234567', PAREN)
    for (let caret = 0; caret <= text.length; caret++) {
      const restored = caretAtDigitIndex(text, digitIndexAt(text, caret))
      // The restored caret sits after the same count of digits, which is the
      // invariant the field relies on; it may skip forward over separators.
      expect(digitIndexAt(text, restored)).toBe(digitIndexAt(text, caret))
    }
  })
})
