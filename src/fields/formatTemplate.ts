/**
 * Shared `#`-template formatting for the US digit fields (`PhoneField`, and
 * `SsnField` next to it): the form value is the bare digit string and the
 * template only decides how it is displayed. Every function here is pure, so
 * the caret arithmetic a field needs is testable without a DOM.
 *
 * A template is a literal string in which each `#` is one digit slot and every
 * other character is a separator inserted between them — `'###-###-####'`
 * renders `5551234` as `555-123-4`.
 */

/**
 * A `#`-slot display template, such as `PHONE_FORMAT`'s `'###-###-####'`. An
 * alias for `string` rather than a template-literal type: the useful templates
 * are open-ended (`'(###) ###-####'`, `'###-####'`, an SSN's `'###-##-####'`),
 * so a narrower type would reject valid ones while catching nothing a
 * consumer is likely to get wrong. It exists to name the parameter in a
 * signature — `formatTemplate(digits, template: FormatTemplate)` reads as
 * intended where a second bare `string` would not.
 */
export type FormatTemplate = string

/** How many digits the template holds: the number of `#` slots. */
export function templateDigitCount(template: FormatTemplate): number {
  let count = 0
  for (const char of template) if (char === '#') count += 1
  return count
}

/** Every non-digit character dropped. Safe on `undefined`/`null` field values. */
export function digitsOnly(text: string): string {
  return text.replace(/\D/g, '')
}

/**
 * Applies `template` to `digits`, stopping as soon as the digits run out so a
 * partially typed value never shows a trailing separator (`'555'`, not
 * `'555-'`). Digits past the template's capacity are ignored — the caller is
 * expected to have truncated already, but formatting must not invent slots.
 */
export function formatTemplate(digits: string, template: FormatTemplate): string {
  if (digits === '') return ''
  let out = ''
  let digitIndex = 0
  for (const char of template) {
    if (digitIndex >= digits.length) break
    if (char === '#') {
      out += digits[digitIndex]
      digitIndex += 1
    } else {
      out += char
    }
  }
  return out
}

/**
 * The index into the digit string that a caret at `caret` in `text` sits
 * after — i.e. how many digits precede it. This is the position that survives
 * reformatting, which is why it is computed *before* the text is rebuilt.
 */
export function digitIndexAt(text: string, caret: number): number {
  let digits = 0
  for (let i = 0; i < caret && i < text.length; i++) {
    if (/\d/.test(text[i]!)) digits += 1
  }
  return digits
}

/**
 * The caret offset in `formatted` that sits just after its `digitIndex`-th
 * digit — the inverse of `digitIndexAt`, used to restore the caret once the
 * formatted text has been rebuilt. A `digitIndex` of 0 is the start of the
 * string; one past the last digit is the end, so typing at the end never
 * strands the caret before a separator that is about to be filled.
 */
export function caretAtDigitIndex(formatted: string, digitIndex: number): number {
  if (digitIndex <= 0) return 0
  let seen = 0
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i]!)) {
      seen += 1
      if (seen === digitIndex) return i + 1
    }
  }
  return formatted.length
}
