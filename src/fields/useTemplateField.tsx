import { useLayoutEffect, useRef, type ChangeEvent, type SyntheticEvent } from 'react'
import { useWatch } from 'react-hook-form'
import { caretAtDigitIndex, digitsOnly, formatTemplate } from './formatTemplate'
import { resolveTemplateEdit, toEditKind } from './resolveTemplateEdit'

/**
 * The behaviour shared by every `#`-template digit field (`PhoneField`,
 * `SsnField`): the form value is the bare digit string, the template decides
 * only how it is displayed, and typing / pasting / deleting through a
 * separator all keep the caret with the digit being edited.
 *
 * This is a hook rather than a component because the two fields differ in what
 * they *render* — `SsnField` toggles `type` between `password` and `text` and
 * owns an end adornment — while sharing every bit of the value and caret
 * arithmetic. A shared component would have to grow a prop for each of those
 * differences; a hook hands back the two things that are actually common (the
 * display text and the `htmlInput` props) and lets each field render itself.
 */
export interface TemplateFieldOptions {
  /** The form field name, read with `useWatch` for the displayed text. */
  name: string
  /** The `#` template. Each `#` is a digit slot; every other character is a separator. */
  format: string
  /** How many digits the field stores. Normally `templateDigitCount(format)`. */
  capacity: number
  /**
   * Applied to the resolved digits before they are capped at `capacity`, for a
   * field with a normalisation rule of its own (`PhoneField` drops a leading
   * country code). Must only ever *remove* digits, from the front or the tail,
   * so the caret can be clamped to what survives. Defaults to identity.
   */
  normalizeDigits?: (digits: string) => string
}

export interface TemplateFieldBinding {
  /** The formatted text to pass to `TextField`'s `displayValue`. */
  displayValue: string
  /** `onChange`/`onKeyDown`/`onSelect`/`ref` for `slotProps.htmlInput`. */
  htmlInputProps: {
    onChange: (event: ChangeEvent<HTMLInputElement>) => void
    onKeyDown: (event: SyntheticEvent<HTMLInputElement>) => void
    onSelect: (event: SyntheticEvent<HTMLInputElement>) => void
    ref: React.RefObject<HTMLInputElement | null>
  }
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

export function useTemplateField({
  name,
  format,
  capacity,
  normalizeDigits,
}: TemplateFieldOptions): TemplateFieldBinding {
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

    // Capacity and any field-specific normalisation are applied after the edit
    // is resolved, so they narrow the result rather than confusing the reading
    // of it. Both only ever drop digits from the front or the tail, so the
    // caret is clamped to what survives.
    const capped = (normalizeDigits ? normalizeDigits(digits) : digits).slice(0, capacity)
    const dropped = digits.length - capped.length
    const shiftedFromFront = digits.endsWith(capped) && dropped > 0
    const caret = Math.max(
      0,
      Math.min(shiftedFromFront ? digitCaret - dropped : digitCaret, capped.length),
    )
    pendingCaretRef.current = caretAtDigitIndex(formatTemplate(capped, format), caret)

    event.target.value = capped
  }

  return {
    displayValue,
    htmlInputProps: {
      onChange: normalizeOnChange,
      onKeyDown: rememberSelection,
      onSelect: rememberSelection,
      ref: inputRef,
    },
  }
}
