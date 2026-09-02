import type { ReactElement } from 'react'
import { fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'

/** Pickers need an adapter above them; tests use date-fns, so form values are plain `Date`s. */
export const withPickers = (element: ReactElement) => (
  <LocalizationProvider dateAdapter={AdapterDateFns}>{element}</LocalizationProvider>
)

/**
 * Simulates a real paste over a picker field's whole value — the way a user
 * pastes a full date/time string, not the per-section `fireEvent.change` on
 * the hidden input used elsewhere in these suites (which only exercises MUI
 * X's programmatic-write test seam, not what a real paste dispatches; see
 * QA #73). `fieldRoot` is the field's `role="group"` element.
 *
 * MUI X's own paste handler (`useFieldRootProps.js`'s `handlePaste`) only
 * runs when every section is selected (`parsedSelectedSections === 'all'`),
 * which a real paste always has (the browser selects-all on focus, or the
 * user does via Ctrl/Cmd+A) — so this selects all sections the same way
 * (`useFieldRootProps.js`'s `handleKeyDown`, the "Select all" case) before
 * dispatching `paste`. Both the `keydown` and the `paste` must target the
 * sections container (`.MuiPickersSectionList-root`, the element that is
 * actually focused and holds these listeners) rather than the outer
 * `role="group"` wrapper, or MUI X's field never sees either event.
 */
export const pasteAllText = async (fieldRoot: HTMLElement, text: string) => {
  const user = userEvent.setup()
  await user.click(fieldRoot)
  const target = document.activeElement as HTMLElement
  fireEvent.keyDown(target, { key: 'a', ctrlKey: true, keyCode: 65, code: 'KeyA' })
  const sectionsRoot = fieldRoot.querySelector<HTMLElement>('.MuiPickersSectionList-root')!
  fireEvent.paste(sectionsRoot, {
    clipboardData: { getData: () => text, types: ['text/plain'] } as unknown as DataTransfer,
  })
}

/**
 * The field's clear button (`clearable`), which MUI X renders as an `IconButton`
 * titled by `translations.fieldClearLabel` inside the input adornment.
 *
 * Found by `title` rather than by role + accessible name because MUI X only
 * renders it while at least one section holds a value: `useField.js` computes
 * `clearable: Boolean(clearable && !areAllSectionsEmpty && !readOnly &&
 * !disabled)`, so the button is genuinely absent (not just hidden) on an
 * all-empty field.
 *
 * Throws (like a `getBy*` query) rather than returning `null` when it is
 * missing, naming that MUI X rule in the message: the absence is nearly always
 * "the field is empty, so there is nothing to clear", and a caller that got
 * `null` back would otherwise fail deep inside `user.click` with an unrelated
 * message.
 */
export const clearButton = (fieldRoot: HTMLElement): HTMLButtonElement => {
  const formControl = fieldRoot.closest('.MuiFormControl-root')
  const button = formControl?.querySelector<HTMLButtonElement>('button[title="Clear"]')
  if (!button) {
    throw new Error(
      'No clear button found in this field. MUI X only renders it when `clearable` is set ' +
        'and at least one section holds a value (`clearable: Boolean(clearable && ' +
        '!areAllSectionsEmpty && !readOnly && !disabled)` in useField.js), so an all-empty ' +
        'field — including one just blanked by an unparsable paste — has none.',
    )
  }
  return button
}
