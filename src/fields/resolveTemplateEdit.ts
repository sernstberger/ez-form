import { digitIndexAt, digitsOnly } from './formatTemplate'

/**
 * The kinds of edit this resolver distinguishes. These are the
 * `InputEvent.inputType` values a text input produces for the operations a
 * `#`-template field cares about; anything else (an autofill, a drag-drop, an
 * undo) falls through to `'other'` and is treated as a plain replacement of
 * whatever the browser produced.
 */
export type TemplateEditKind =
  'deleteContentBackward' | 'deleteContentForward' | 'insertFromPaste' | 'insertText' | 'other'

export interface TemplateEdit {
  /** The digit string the field held before this edit. */
  previousDigits: string
  /** The formatted text that was on screen before this edit. */
  previousDisplay: string
  /** `selectionStart` in `previousDisplay`, captured *before* the change. */
  selectionStart: number
  /** `selectionEnd` in `previousDisplay`, captured *before* the change. */
  selectionEnd: number
  /** `InputEvent.inputType`, normalised to the set above. */
  kind: TemplateEditKind
  /** The raw text the input holds *after* the browser applied the edit. */
  nextText: string
}

export interface ResolvedTemplateEdit {
  /** The digits the form should store, before capacity/country-code handling. */
  digits: string
  /** Where the caret belongs, as an index into `digits`. */
  digitCaret: number
}

/**
 * Works out what an edit meant in terms of *digits*, independent of the
 * separators the template happens to draw.
 *
 * The previous approach compared string lengths to guess whether a separator
 * had been deleted. That cannot distinguish a same-length paste from a
 * separator delete, and it has no idea which side of a separator a forward
 * `Delete` was aiming at — it silently destroyed a digit in both cases. This
 * decides from the event instead: the selection range as it stood *before* the
 * change, plus the `inputType` that describes the operation.
 *
 * The rules, all expressed over digit indices:
 *
 * - **Collapsed backward delete** (Backspace with no selection): remove the
 *   digit before the caret. When the caret sat just after a separator, that is
 *   the digit the separator follows — which is what the key looks like it
 *   should do, and what the browser cannot express because it deleted only the
 *   separator, leaving the digits untouched.
 * - **Collapsed forward delete** (`Delete` with no selection): remove the digit
 *   *at* the caret. When the caret sat just before a separator, that is the
 *   digit on the far side of it.
 * - **Any non-collapsed selection**: remove exactly the digits inside the
 *   selection — never one outside it — and insert whatever digits the edit
 *   contributed at that point. This is the case the length heuristic got
 *   wrong: pasting ten digits over a formatted ten-digit selection is a
 *   same-length edit, so the old code read it as a separator delete and ate a
 *   digit.
 * - **Insertion with no selection**: splice the new digits in at the caret.
 *
 * Deriving the inserted digits by subtraction — what the input now holds minus
 * what survives outside the selection — rather than reading the clipboard means
 * paste, autofill, IME commit and plain typing all take the same path.
 */
export function resolveTemplateEdit(edit: TemplateEdit): ResolvedTemplateEdit {
  const { previousDigits, previousDisplay, selectionStart, selectionEnd, kind, nextText } = edit

  // The selection, restated in digit indices: everything before it survives,
  // everything after it survives, and what was between the two is replaced.
  const startDigit = digitIndexAt(previousDisplay, selectionStart)
  const endDigit = digitIndexAt(previousDisplay, selectionEnd)
  const collapsed = selectionStart === selectionEnd

  const isDelete = kind === 'deleteContentBackward' || kind === 'deleteContentForward'

  if (isDelete && collapsed) {
    // A collapsed delete contributes no digits; it removes exactly one, on the
    // side the key points. `Backspace` at digit index 0 and `Delete` at the end
    // have nothing to remove, so they are no-ops rather than wrapping around.
    if (kind === 'deleteContentBackward') {
      if (startDigit === 0) return { digits: previousDigits, digitCaret: 0 }
      return {
        digits: previousDigits.slice(0, startDigit - 1) + previousDigits.slice(startDigit),
        digitCaret: startDigit - 1,
      }
    }
    if (startDigit >= previousDigits.length) {
      return { digits: previousDigits, digitCaret: startDigit }
    }
    return {
      digits: previousDigits.slice(0, startDigit) + previousDigits.slice(startDigit + 1),
      digitCaret: startDigit,
    }
  }

  const head = previousDigits.slice(0, startDigit)
  const tail = previousDigits.slice(endDigit)

  if (isDelete) {
    // A delete over a selection removes the selected digits and nothing else.
    return { digits: head + tail, digitCaret: startDigit }
  }

  // An insertion (typed, pasted, or anything else that produced text): the
  // digits the input now holds, minus the head and tail that were never in the
  // selection, are what this edit contributed.
  const nextDigits = digitsOnly(nextText)
  let inserted = nextDigits
  if (inserted.startsWith(head)) inserted = inserted.slice(head.length)
  if (tail.length > 0 && inserted.endsWith(tail)) inserted = inserted.slice(0, -tail.length)

  return { digits: head + inserted + tail, digitCaret: startDigit + inserted.length }
}

/** Narrows a raw `InputEvent.inputType` to the kinds the resolver handles. */
export function toEditKind(inputType: string | undefined): TemplateEditKind {
  if (
    inputType === 'deleteContentBackward' ||
    inputType === 'deleteContentForward' ||
    inputType === 'insertFromPaste' ||
    inputType === 'insertText'
  ) {
    return inputType
  }
  return 'other'
}
