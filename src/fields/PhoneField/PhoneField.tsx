import { useLayoutEffect, useRef, type ChangeEvent, type SyntheticEvent } from 'react'
import { useWatch } from 'react-hook-form'
import { useDefaultProps } from '@mui/material/DefaultPropsProvider'
import { mergeSlotProps } from '@mui/material/utils'
import { TextField, type TextFieldProps } from '../TextField'
import { useEzFormContext } from '../../useEzFormContext'
import {
  caretAtDigitIndex,
  digitsOnly,
  formatTemplate,
  templateDigitCount,
} from '../formatTemplate'
import { resolveTemplateEdit, toEditKind } from '../resolveTemplateEdit'

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
   * separator inserted between them. Defaults to `PHONE_FORMAT`
   * (`'###-###-####'`). The number
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

/**
 * `PhoneField`'s default display template, exported so a consumer can render a
 * stored phone the same way the field does — `formatTemplate(digits,
 * PHONE_FORMAT)` on a review screen, in a table, or in a confirmation email.
 * Without it, reproducing the field's own display means re-typing the template
 * and silently drifting from it if the default ever changes.
 */
export const PHONE_FORMAT = '###-###-####'

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

/** How many leading characters `a` and `b` share. */
function commonPrefixLength(a: string, b: string): number {
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1
  return i
}

/**
 * How many trailing characters `a` and `b` share, stopping at `floor` so the
 * suffix can never reach back past a prefix already claimed — otherwise an
 * all-same-digits value would count the same characters twice.
 */
function commonSuffixLength(a: string, b: string, floor = 0): number {
  let i = 0
  while (
    i < a.length - floor &&
    i < b.length - floor &&
    a[a.length - 1 - i] === b[b.length - 1 - i]
  )
    i += 1
  return i
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
    format = PHONE_FORMAT,
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

  const inputRef = useRef<HTMLInputElement | null>(null)

  // The selection as it stood *before* the browser applied an edit. `onChange`
  // fires after the fact, when `selectionStart`/`selectionEnd` already describe
  // the new text, so the range that says what the user was aiming at has to be
  // captured beforehand — `onKeyDown` for keys, `onSelect` for every other way
  // the caret moves (click, drag, arrows, select-all).
  const selectionRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 })
  const rememberSelection = (event: SyntheticEvent<HTMLInputElement>) => {
    const el = event.currentTarget
    selectionRef.current = { start: el.selectionStart ?? 0, end: el.selectionEnd ?? 0 }
  }

  // The input is controlled by the form value, so React rewrites its text on
  // every keystroke and the browser leaves the caret at the end. This carries
  // the offset the caret should return to; a ref rather than state because
  // nothing renders from it — as state it forced a second render per keystroke
  // just to clear itself.
  const pendingCaretRef = useRef<number | null>(null)

  useLayoutEffect(() => {
    const caret = pendingCaretRef.current
    if (caret === null) return
    pendingCaretRef.current = null
    const input = inputRef.current
    // Only reposition while this input still has focus, so a value change from
    // elsewhere (a reset, async defaultValues arriving) never steals the caret.
    if (input && document.activeElement === input) {
      input.setSelectionRange(caret, caret)
    }
  })

  const consumerValidate =
    validate === undefined ? {} : typeof validate === 'function' ? { validate } : validate

  /**
   * Runs on the `<input>` itself, which fires before the handler `TextField`
   * composes — so rewriting `event.target.value` to the bare digits here is
   * what react-hook-form (and then any consumer `onChange`) actually receives.
   *
   * What the edit *meant* is worked out by `resolveTemplateEdit` from the
   * pre-edit selection and the event's `inputType`, not guessed from how the
   * text's length changed: a same-length paste and a separator delete are
   * indistinguishable by length, and a length comparison cannot tell which side
   * of a separator a forward `Delete` was aiming at.
   */
  const normalizeOnChange = (event: ChangeEvent<HTMLInputElement>) => {
    const previousDigits = digitsOnly(displayValue)
    const kind = toEditKind((event.nativeEvent as InputEvent).inputType)
    const nextText = event.target.value

    // The remembered range can be stale or absent: a synthetic clear
    // (`user.clear()`, some autofills) fires a lone change with no preceding
    // key or select event, and a caret moved by `setSelectionRange` alone
    // notifies nothing. So the range is cross-checked against the edit itself.
    //
    // The unchanged text either side of the change pins down what was actually
    // replaced: everything between the common prefix and the common suffix.
    const remembered = selectionRef.current
    const changeStart = commonPrefixLength(displayValue, nextText)
    const changeEnd = Math.max(
      changeStart,
      displayValue.length - commonSuffixLength(displayValue, nextText, changeStart),
    )
    // A collapsed caret can only account for a one-character span: a keystroke
    // inserts one, Backspace and Delete remove one. A wider span means the edit
    // really covered a selection the ref never saw, so the span is the truth.
    // A non-collapsed remembered range came from a real select event and stands.
    const trusted = remembered.start !== remembered.end ? true : changeEnd - changeStart <= 1
    const selection = trusted ? remembered : { start: changeStart, end: changeEnd }

    const { digits, digitCaret } = resolveTemplateEdit({
      previousDigits,
      previousDisplay: displayValue,
      selectionStart: selection.start,
      selectionEnd: selection.end,
      kind,
      nextText,
    })

    // Capacity and the country-code rule are applied after the edit is
    // resolved, so they narrow the result rather than confusing the reading of
    // it. Both only ever drop digits from the front or the tail, so the caret
    // is clamped to what survives.
    const capped = stripCountryCode(digits, capacity).slice(0, capacity)
    const dropped = digits.length - capped.length
    const shiftedFromFront = digits.endsWith(capped) && dropped > 0
    const caret = Math.max(
      0,
      Math.min(shiftedFromFront ? digitCaret - dropped : digitCaret, capped.length),
    )
    pendingCaretRef.current = caretAtDigitIndex(formatTemplate(capped, format), caret)

    event.target.value = capped
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
          onKeyDown: rememberSelection,
          onSelect: rememberSelection,
          ref: inputRef,
        }),
      }}
    />
  )
}
