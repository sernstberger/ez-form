import { useLayoutEffect, useRef, useState, type ChangeEvent } from 'react'
import { useWatch } from 'react-hook-form'
import { useDefaultProps } from '@mui/material/DefaultPropsProvider'
import { mergeSlotProps } from '@mui/material/utils'
import { TextField, type TextFieldProps } from '../TextField'
import { useEzFormContext } from '../../useEzFormContext'
import {
  caretAtDigitIndex,
  digitIndexAt,
  digitsOnly,
  formatTemplate,
  templateDigitCount,
} from '../formatTemplate'

/**
 * `type`, `inputMode` and `pattern` are the binding's: a phone field is always
 * `type="tel"` with the telephone keypad, and a `pattern` rule would duplicate
 * (and could contradict) the built-in completeness rule below. `displayValue`
 * is how this field shows formatted text over a digits-only value, so it is
 * the binding's too. `autoComplete` is re-declared as an ordinary `string` so
 * a consumer can pass a sectioned token — `'shipping tel'`, `'work tel'` —
 * over the `'tel'` default.
 */
export type PhoneFieldProps = Omit<
  TextFieldProps,
  'type' | 'inputMode' | 'autoComplete' | 'pattern' | 'displayValue'
> & {
  /**
   * Display template: each `#` is one digit slot, every other character is a
   * separator inserted between them. Defaults to `'###-###-####'`. The number
   * of `#`s is also how many digits the field accepts and what the built-in
   * completeness rule requires, so `'(###) ###-####'` still means ten digits
   * while `'###-####'` means seven.
   */
  format?: string
  /**
   * Shown when the value is non-empty but has fewer digits than `format`
   * holds. Defaults to `Enter a <n>-digit phone number`, with `<n>` derived
   * from the template so a custom `format` gets a matching default.
   *
   * A `string`, not a `ReactNode`: this is a validation message, and
   * react-hook-form's `Message` is a string — it has to survive the trip
   * through `useController`'s rules to `fieldState.error.message`, exactly
   * like every message in `rules.ts`. Rich markup in an error belongs in a
   * `validate` of your own.
   */
  invalidMessage?: string
  autoComplete?: string
}

const DEFAULT_FORMAT = '###-###-####'

/**
 * A US 11-digit entry is the country code plus the number — `+1 555 555 5555`
 * pasted from a contact card — so the leading `1` is dropped rather than
 * truncating the last digit off the real number. Only for a template holding
 * ten digits; a shorter or longer template has no such convention.
 */
function stripCountryCode(digits: string, capacity: number): string {
  if (capacity === 10 && digits.length === 11 && digits.startsWith('1')) return digits.slice(1)
  return digits
}

/**
 * US phone number on top of `TextField`: the form value is the bare digit
 * string (`'5555555555'`, and `''` when empty — never `undefined`, so
 * `required` still applies) and `format` decides only how it is displayed.
 * Typing, pasting a formatted number, and deleting through a separator all
 * work, and the caret stays with the digit being edited rather than jumping to
 * the end.
 */
export function PhoneField(inProps: PhoneFieldProps) {
  // Ahead of TextField's own guard, so the "outside <Form>" error names <PhoneField>.
  useEzFormContext('PhoneField')
  const props = useDefaultProps({ props: inProps, name: 'EzPhoneField' })
  const {
    name,
    format = DEFAULT_FORMAT,
    invalidMessage,
    autoComplete = 'tel',
    validate,
    slotProps,
    ...rest
  } = props

  const capacity = templateDigitCount(format)
  const message = invalidMessage ?? `Enter a ${capacity}-digit phone number`

  // The display is a pure function of the stored digits, read from the form
  // rather than kept as a second copy that could drift out of sync with a
  // reset or a programmatic `setValue`.
  const stored = useWatch({ name })
  const displayValue = formatTemplate(typeof stored === 'string' ? digitsOnly(stored) : '', format)

  // The input is controlled by the form value, so React rewrites its text on
  // every keystroke and the browser leaves the caret at the end of the new
  // text. `pendingCaret` carries the offset derived from the digit index
  // measured *before* reformatting; the layout effect restores it after paint.
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [pendingCaret, setPendingCaret] = useState<number | null>(null)

  useLayoutEffect(() => {
    if (pendingCaret === null) return
    const input = inputRef.current
    // Only reposition while this input still has focus, so a value change from
    // elsewhere (a reset, async defaultValues arriving) never steals the caret.
    if (input && document.activeElement === input) {
      input.setSelectionRange(pendingCaret, pendingCaret)
    }
    setPendingCaret(null)
  }, [pendingCaret])

  const consumerValidate =
    validate === undefined ? {} : typeof validate === 'function' ? { validate } : validate

  /**
   * Runs on the `<input>` itself, which fires before the handler `TextField`
   * composes — so rewriting `event.target.value` to the bare digits here is
   * what react-hook-form (and then any consumer `onChange`) actually receives.
   */
  const normalizeOnChange = (event: ChangeEvent<HTMLInputElement>) => {
    const text = event.target.value
    // Measured against the text the user just produced, before it is
    // reformatted: "how many digits are to my left" is the one position that
    // survives the rewrite.
    const caret = event.target.selectionStart ?? text.length
    let digitIndex = digitIndexAt(text, caret)
    let typed = digitsOnly(text)

    // Backspace onto a separator deletes only that separator, which leaves the
    // digits unchanged — reformatting would put it straight back and the key
    // would do nothing. The user meant the digit the separator follows, so
    // delete that instead. Recognised by: the text got shorter, no digit went
    // with it, and the caret has digits to its left to remove.
    const deletedSeparatorOnly =
      text.length < displayValue.length && typed.length === digitsOnly(displayValue).length
    if (deletedSeparatorOnly && digitIndex > 0) {
      typed = typed.slice(0, digitIndex - 1) + typed.slice(digitIndex)
      digitIndex -= 1
    }

    const next = stripCountryCode(typed, capacity).slice(0, capacity)
    // Stripping a country code shifts every digit one place left, and a
    // truncated paste can leave the index past the end; clamp so the caret
    // lands on a digit that exists.
    const clamped = Math.min(digitIndex, next.length)
    setPendingCaret(caretAtDigitIndex(formatTemplate(next, format), clamped))

    event.target.value = next
  }

  return (
    <TextField
      {...rest}
      name={name}
      type="tel"
      autoComplete={autoComplete}
      displayValue={displayValue}
      validate={{
        // Consumer entries first: a built-in key must not be silently replaced.
        ...consumerValidate,
        complete: (v) => {
          const value = typeof v === 'string' ? v : ''
          return value === '' || value.length === capacity || message
        },
      }}
      slotProps={{
        ...slotProps,
        htmlInput: mergeSlotProps(slotProps?.htmlInput, {
          inputMode: 'tel',
          onChange: normalizeOnChange,
          ref: inputRef,
        }),
      }}
    />
  )
}
