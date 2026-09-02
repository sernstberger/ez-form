export interface Separators {
  group: string
  decimal: string
}

/** Locale/format-derived separators, from `Intl.NumberFormat(...).formatToParts(1234567.891)`. */
export function getSeparators(
  locale?: Intl.LocalesArgument,
  format?: Intl.NumberFormatOptions,
): Separators {
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
 * Whether `char` reads as `group` for grouping purposes, mirroring the equivalences Base UI's
 * `parseNumber` applies: a space-like separator (fr-FR's U+202F) matches any Unicode space
 * separator, and an apostrophe separator (de-CH's `’`) matches the ASCII `'` too. Without this,
 * text pasted with the plainer variant — a spreadsheet copy, another locale's rendering — is
 * either left unrecognised (so later keystrokes never regroup) or treated as a digit-run
 * boundary and regrouped into nonsense, while Base UI parses it to the right number regardless.
 */
function makeIsGroupChar(group: string): (char: string) => boolean {
  if (/\p{Zs}/u.test(group)) return (char) => /\p{Zs}/u.test(char)
  if (group === "'" || group === '’') return (char) => char === "'" || char === '’'
  return (char) => char === group
}

/**
 * Rewrites `text` into this locale's own `.`/`,` roles when it unambiguously reads as a
 * *different* locale's grouping (#72). `.` and `,` are the only two ASCII punctuation marks
 * either locale style ever uses for decimal/group, so a string containing both is never
 * genuinely ambiguous: whichever of the two occurs last is the decimal separator (the same
 * "keep only the last separator as decimal" rule Base UI's own `parseNumber` falls back to
 * for mixed-locale text), and every earlier `.` or `,` is a group separator. Rewriting here —
 * before the existing regroup logic runs — means a pasted `1.234,56` under an `en-US` field
 * (whose own separators are `,` group / `.` decimal) is recognised as the de-CH/de-DE shape
 * it is and resolves to `1234.56`, not silently reinterpreted as `1.23456`.
 *
 * A single `.`/`,` with no other separator character present stays ambiguous (it could be a
 * thousands group or a decimal fraction) and is left for the existing locale-native handling
 * below, unchanged from before this fix.
 */
export function normalizeForeignShape(text: string, separators: Separators): string {
  const { group, decimal } = separators
  const positions: number[] = []
  for (let i = 0; i < text.length; i++) {
    const char = text[i]!
    if (char === '.' || char === ',') positions.push(i)
  }
  // Need at least one '.' and one ',' present to know which is which; a single kind
  // repeated (e.g. "1,234,567") is already this locale's own grouping, not a foreign shape.
  const hasDot = [...text].includes('.')
  const hasComma = [...text].includes(',')
  if (!hasDot || !hasComma) return text

  const decimalIndex = positions[positions.length - 1]!
  let out = ''
  for (let i = 0; i < text.length; i++) {
    const char = text[i]!
    if (char !== '.' && char !== ',') {
      out += char
    } else {
      out += i === decimalIndex ? decimal : group
    }
  }
  return out
}

/**
 * Re-groups the integer digits of `text` and maps the caret to the same logical
 * position. Fraction digits are left exactly as typed (so `1234.50` stays `1,234.50`
 * and `1234.` keeps its trailing decimal). Returns the input unchanged when the text
 * contains anything other than digits, one leading `-`, the decimal separator,
 * characters `isGroupChar` recognises as this locale's group separator, or whitespace —
 * e.g. a pasted `$` — because Base UI normalizes those on blur. Whitespace that isn't
 * this locale's group separator (a stray ASCII space typed or pasted under a
 * non-space-group locale, #42) is dropped rather than kept: it isn't a group char here,
 * so leaving it in place would misplace it relative to the freshly inserted separators.
 */
export function groupWhileTyping(text: string, caret: number, separators: Separators): GroupedText {
  if (text === '') return { text: '', caret: 0 }

  const normalized = normalizeForeignShape(text, separators)
  if (normalized !== text) {
    // The foreign-shape rewrite changes which characters are significant (a `,` that was
    // the pasted string's decimal point becomes this locale's group separator, or vice
    // versa), so recompute the caret as "same count of characters from the end" rather
    // than reusing the caller's index against the rewritten string.
    const caretFromEnd = text.length - caret
    return groupWhileTyping(normalized, normalized.length - caretFromEnd, separators)
  }

  const { group, decimal } = separators
  const isGroupChar = makeIsGroupChar(group)

  const isAllowedChar = (char: string) =>
    /\d/.test(char) || char === '-' || char === decimal || isGroupChar(char) || /\s/.test(char)
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

  // Strip existing group separators, in every form this locale's separator can arrive as,
  // and any other whitespace that isn't this locale's group char (#42) — e.g. a plain
  // ASCII space typed under a locale whose group separator isn't space-like.
  const stripped = [...text].filter((char) => !isGroupChar(char) && !/\s/.test(char)).join('')

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
