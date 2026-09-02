import { useCallback, useLayoutEffect, useRef, useState } from 'react'

/**
 * The reveal state behind a show/hide toggle, plus the focus and caret contract
 * that swapping the input's `type` demands.
 *
 * Flipping an `<input>` between `type="password"` and `type="text"` is not a
 * cosmetic change: browsers re-create the editing context, which drops the
 * selection (`selectionStart` resets, usually to the end of the value) — and the
 * click that flipped it has already moved focus to the toggle button. Left
 * alone, "let me check what I typed" costs the user their place in the field.
 *
 * So the selection is captured *before* the swap and restored in a layout
 * effect *after* the re-render that changed `type`, before the browser paints.
 * Focus returns to the input only if the input had it when the toggle was
 * pressed: a toggle reached by Tab, or clicked while focus sat elsewhere,
 * leaves focus on the button where the user put it.
 *
 * jsdom does not model the selection reset, so tests assert the restored
 * values rather than the reset itself; the restoring code is the same either way.
 */
export interface RevealState {
  revealed: boolean
  /** Pass to `RevealToggle`'s `onToggle`. */
  toggle: () => void
  /**
   * Attach to the `<input>` this toggle reveals — its selection is what gets
   * restored. Compose it with any other ref on that input (`useForkRef`).
   */
  inputRef: React.RefObject<HTMLInputElement | null>
  /**
   * Pass to `RevealToggle`'s `onPointerDownCapture`/`onKeyDownCapture`. A click
   * moves focus on pointerdown, *before* `onClick` runs, so by the time the
   * toggle fires `document.activeElement` is always the button — whether or not
   * the user was typing in the field a moment earlier. This records the answer
   * while it is still true.
   */
  recordFocus: () => void
}

export function useRevealState(): RevealState {
  const [revealed, setRevealed] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  // Whether focus sat in the input just before the toggle was pressed, recorded
  // on pointerdown/keydown while that is still observable.
  const focusWasInInputRef = useRef(false)

  // The selection to put back after the type swap, or `null` when the toggle
  // was used without the input focused — in which case focus stays on the
  // button and nothing is restored.
  const pendingRef = useRef<{ start: number; end: number } | null>(null)

  const recordFocus = useCallback(() => {
    const input = inputRef.current
    focusWasInInputRef.current = input !== null && document.activeElement === input
  }, [])

  const toggle = useCallback(() => {
    const input = inputRef.current
    pendingRef.current =
      input && focusWasInInputRef.current
        ? { start: input.selectionStart ?? 0, end: input.selectionEnd ?? 0 }
        : null
    focusWasInInputRef.current = false
    setRevealed((r) => !r)
  }, [])

  useLayoutEffect(() => {
    const pending = pendingRef.current
    if (pending === null) return
    pendingRef.current = null
    const input = inputRef.current
    if (!input) return
    // Order matters: focus first (a browser may reset the selection as the
    // element gains focus), then put the caret back where the user left it.
    input.focus()
    input.setSelectionRange(pending.start, pending.end)
  }, [revealed])

  return { revealed, toggle, inputRef, recordFocus }
}
