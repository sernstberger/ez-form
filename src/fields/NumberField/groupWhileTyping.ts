export interface Separators {
  group: string
  decimal: string
}

/** Locale/format-derived separators, from `Intl.NumberFormat(...).formatToParts(1234567.891)`. */
export function getSeparators(locale?: Intl.LocalesArgument, format?: Intl.NumberFormatOptions): Separators {
  const parts = new Intl.NumberFormat(locale, format).formatToParts(1234567.891)
  const group = parts.find((part) => part.type === 'group')?.value ?? ','
  const decimal = parts.find((part) => part.type === 'decimal')?.value ?? '.'
  return { group, decimal }
}

export interface GroupedText {
  text: string
  caret: number
}

/**
 * Re-groups the integer digits of `text` and maps the caret to the same logical
 * position. Fraction digits are left exactly as typed (so `1234.50` stays `1,234.50`
 * and `1234.` keeps its trailing decimal). Returns the input unchanged when the text
 * contains anything other than digits, one leading `-`, the decimal separator, group
 * separators, and whitespace — e.g. a pasted `$` — because Base UI normalizes those on blur.
 */
export function groupWhileTyping(text: string, caret: number, separators: Separators): GroupedText {
  if (text === '') return { text: '', caret: 0 }

  const { group, decimal } = separators

  const isAllowedChar = (char: string) => /\d/.test(char) || char === '-' || char === decimal || char === group || /\s/.test(char)
  if (![...text].every(isAllowedChar)) {
    return { text, caret }
  }

  const isSignificant = (char: string) => /\d/.test(char) || char === '-' || char === decimal

  // Count significant characters strictly before the caret in the input.
  const chars = [...text]
  let significantBeforeCaret = 0
  for (let i = 0; i < caret && i < chars.length; i++) {
    if (isSignificant(chars[i]!)) significantBeforeCaret++
  }

  // Strip existing group separators.
  const stripped = [...text].filter((char) => char !== group).join('')

  // Split into sign, integer part, and the rest (decimal separator + fraction), on the
  // first decimal separator found.
  const negative = stripped.startsWith('-')
  const unsigned = negative ? stripped.slice(1) : stripped
  const decimalIndex = unsigned.indexOf(decimal)
  const integerPart = decimalIndex === -1 ? unsigned : unsigned.slice(0, decimalIndex)
  const rest = decimalIndex === -1 ? '' : unsigned.slice(decimalIndex)

  // Insert `group` every three integer digits from the right.
  const integerChars = [...integerPart]
  let groupedInteger = ''
  for (let i = 0; i < integerChars.length; i++) {
    const fromRight = integerChars.length - i
    if (i > 0 && fromRight % 3 === 0) groupedInteger += group
    groupedInteger += integerChars[i]
  }

  const outText = (negative ? '-' : '') + groupedInteger + rest

  // If regrouping didn't change the text, the caret is already in the right place —
  // including sitting just after a group separator, which the significant-character
  // count below would otherwise pull backward.
  if (outText === text) {
    return { text: outText, caret }
  }

  // Place the output caret after the same count of significant characters.
  const outChars = [...outText]
  let outCaret = outChars.length
  let seen = 0
  for (let i = 0; i < outChars.length; i++) {
    if (isSignificant(outChars[i]!)) {
      seen++
      if (seen === significantBeforeCaret) {
        outCaret = i + 1
        break
      }
    }
  }
  if (significantBeforeCaret === 0) outCaret = 0

  return { text: outText, caret: outCaret }
}
