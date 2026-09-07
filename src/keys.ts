import type { KeyboardEvent, SyntheticEvent } from 'react'

/**
 * Whether a keydown that bubbled up to a container is the user pressing `key` *at the
 * container* — "I'm done with this screen" on a Wizard step's `<fieldset>` (#116), "next
 * row" in a `<FieldArray layout="table">` body (#14) — rather than a keystroke some field
 * or control has its own meaning for.
 *
 * The load-bearing check is `defaultPrevented`. A control that consumes the key marks the
 * event handled, which is the same signal the browser's own implicit-submission rule
 * respects — so this needs no allow-list of field types and stays correct for fields that
 * do not exist yet. Today that covers MUI `Autocomplete` (Enter with an open popup selects
 * the highlighted option and calls `preventDefault`, its own comment saying "Avoid early
 * form validation, let the end-users continue filling the form"; ArrowDown opens or moves
 * the highlight), MUI `Select` (Enter, Space, ArrowUp and ArrowDown on a closed select open
 * the menu, likewise prevented — `SelectInput.js`, `isOpenKey`) and `EmailListField`
 * (Enter commits a chip). An *open* `Select`/`Autocomplete` listbox and a picker popper
 * are portalled out of the container entirely, so their keydown never reaches it in the
 * first place — belt and braces.
 *
 * A *closed* date-picker field is the exception that proves the rule, and it arrives by a
 * different route than the two above. `PickersInputBase`'s own Enter handler does not
 * `preventDefault` unconditionally: it looks up `closest('form')` and
 * `querySelector('[type="submit"]')` and **returns early, leaving the event unprevented,
 * when there is no submit trigger** (`@mui/x-date-pickers`, `PickersInputBase.js`). On a
 * non-last Wizard step there is none — that absence is the very bug #116 is about — so the
 * picker no-ops and the step advances, exactly as for a plain text input. On the last step
 * a `SubmitButton` does exist, so the picker submits the form itself; the step handler is
 * not installed there either way, so the two never race. (Where a submit button *is*
 * present and the container still owns Enter — a table cell — the container has to disarm
 * the picker first; see `FieldArray`'s capture-phase handler.)
 *
 * The rest are the cases no `preventDefault` is involved in, so nothing else could catch
 * them: a `<textarea>`/`contenteditable`, where Enter is natively a newline and the arrows
 * move the caret across lines; a button or link, where Enter is that control's own
 * activation (Back, a chip's delete, `ReadOnlyField`'s Edit); a modified key, which belongs
 * to whatever gesture the modifier names; an auto-repeat from a held key; and an IME
 * composition commit (`isComposing`, plus the legacy `keyCode === 229` that some IMEs still
 * report instead).
 *
 * One `contenteditable` is *not* a text-editing surface: MUI X's picker sections are
 * `<span role="spinbutton" contenteditable>` (`PickersSectionList`), borrowing the attribute
 * for caret control over a single value — Enter means nothing to the section itself, and
 * the arrows it uses it already `preventDefault`s. Excluding it by the attribute alone would
 * make the closed-picker case above a dead letter in a real browser (jsdom does not
 * implement `isContentEditable`, so no test could tell), so a `spinbutton` is let through.
 */
export function isPlainKey(event: KeyboardEvent<Element>, key: string): boolean {
  if (event.key !== key) return false
  if (event.defaultPrevented || event.repeat) return false
  if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return false
  if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return false
  const target = event.target as HTMLElement | null
  if (!target) return false
  const tag = target.tagName
  const role = target.getAttribute('role')
  if (tag === 'TEXTAREA' || tag === 'BUTTON' || tag === 'A') return false
  if (target.isContentEditable && role !== 'spinbutton') return false
  if (role === 'button' || role === 'link') return false
  return true
}

/**
 * Marks a React event as already handled *for MUI*: `event.defaultMuiPrevented` is MUI's
 * documented cross-component flag (an `Autocomplete`'s `onKeyDown` doc names it), checked
 * by MUI X's `PickersInputBase` before it submits the form on Enter and by `Autocomplete`
 * before its own key handling. It is a property of the synthetic event, so it has to be set
 * by a handler that runs *before* the MUI handler in the same dispatch — a consumer
 * `onKeyDown` MUI calls first — not from a capture-phase listener higher up, which React
 * hands a different synthetic event object.
 */
export function preventMuiDefault(event: SyntheticEvent): void {
  ;(event as SyntheticEvent & { defaultMuiPrevented?: boolean }).defaultMuiPrevented = true
}
