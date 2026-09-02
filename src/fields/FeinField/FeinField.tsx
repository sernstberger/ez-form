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
 * `type`, `inputMode` and `pattern` are the binding's: an EIN is always typed
 * on a numeric keypad, and a `pattern` rule would duplicate (and could
 * contradict) the built-in completeness rule below. `displayValue` is how this
 * field shows formatted text over a digits-only value, so it is the binding's
 * too. `autoComplete` is re-declared as an ordinary `string` so a consumer can
 * override the `'off'` default — there is no autofill token for a tax ID, and a
 * browser guessing one over a federal identifier is worse than none.
 */
export type FeinFieldProps = Omit<
  TextFieldProps,
  'type' | 'inputMode' | 'autoComplete' | 'pattern' | 'displayValue'
> & {
  /**
   * Display template: each `#` is one digit slot, every other character is a
   * separator inserted between them. Defaults to `'##-#######'`, the IRS's own
   * two-then-seven shape. The number of `#`s is also how many digits the field
   * accepts and what the built-in completeness rule requires.
   */
  format?: string
  /**
   * Shown when the value is non-empty but has fewer digits than `format`
   * holds. Default `'Enter a 9-digit employer identification number'`.
   *
   * A `string`, not a `ReactNode`: this is a validation message, and
   * react-hook-form's `Message` is a string — it has to survive the trip
   * through `useController`'s rules to `fieldState.error.message`, exactly
   * like every message in `rules.ts`.
   */
  invalidMessage?: string
  autoComplete?: string
}

const DEFAULT_FORMAT = '##-#######'

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
 * US employer identification number on top of `TextField`: the form value is
 * the bare digit string (`'123456789'`, and `''` when empty, never `undefined`,
 * so `required` still applies) and `format` decides only how it is displayed.
 * Typing, pasting a formatted EIN, and deleting through the separator all work,
 * and the caret stays with the digit being edited rather than jumping to the end.
 *
 * The edit machinery here is `PhoneField`'s, parameterised on this template.
 * Once `SsnField` lands, all three should share one template-field component or
 * hook rather than three copies of this body; the resolver and formatter they
 * all call (`../formatTemplate`, `../resolveTemplateEdit`) are already shared.
 */
export function FeinField(inProps: FeinFieldProps) {
  // Ahead of TextField's own guard, so the "outside <Form>" error names <FeinField>.
  useEzFormContext('FeinField')
  const props = useDefaultProps({ props: inProps, name: 'EzFeinField' })
  const {
    name,
    format = DEFAULT_FORMAT,
    invalidMessage = 'Enter a 9-digit employer identification number',
    autoComplete = 'off',
    validate,
    slotProps,
    ...rest
  } = props

  const capacity = templateDigitCount(format)

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
  // nothing renders from it.
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
   * text's length changed.
   */
  const normalizeOnChange = (event: ChangeEvent<HTMLInputElement>) => {
    const previousDigits = digitsOnly(displayValue)
    const kind = toEditKind((event.nativeEvent as InputEvent).inputType)
    const nextText = event.target.value

    // The remembered range can be stale or absent: a synthetic clear
    // (`user.clear()`, some autofills) fires a lone change with no preceding
    // key or select event. So it is cross-checked against the edit itself —
    // the unchanged text either side pins down what was actually replaced.
    const remembered = selectionRef.current
    const changeStart = commonPrefixLength(displayValue, nextText)
    const changeEnd = Math.max(
      changeStart,
      displayValue.length - commonSuffixLength(displayValue, nextText, changeStart),
    )
    // A collapsed caret can only account for a one-character span: a keystroke
    // inserts one, Backspace and Delete remove one. A wider span means the edit
    // really covered a selection the ref never saw, so the span is the truth.
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

    // Capacity is applied after the edit is resolved, so it narrows the result
    // rather than confusing the reading of it. It only ever drops digits from
    // the tail, so the caret is clamped to what survives.
    const capped = digits.slice(0, capacity)
    const caret = Math.max(0, Math.min(digitCaret, capped.length))
    pendingCaretRef.current = caretAtDigitIndex(formatTemplate(capped, format), caret)

    event.target.value = capped
  }

  return (
    <TextField
      {...rest}
      name={name}
      autoComplete={autoComplete}
      displayValue={displayValue}
      validate={{
        // Consumer entries first: a built-in key must not be silently replaced.
        ...consumerValidate,
        complete: (v) => {
          const value = typeof v === 'string' ? v : ''
          return value === '' || value.length === capacity || invalidMessage
        },
      }}
      slotProps={{
        ...slotProps,
        htmlInput: mergeSlotProps(slotProps?.htmlInput, {
          inputMode: 'numeric',
          onChange: normalizeOnChange,
          onKeyDown: rememberSelection,
          onSelect: rememberSelection,
          ref: inputRef,
        }),
      }}
    />
  )
}
