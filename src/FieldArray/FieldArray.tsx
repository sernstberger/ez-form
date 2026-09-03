import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react'
import Button, { type ButtonProps } from '@mui/material/Button'
import FormHelperText, { type FormHelperTextProps } from '@mui/material/FormHelperText'
import IconButton, { type IconButtonProps } from '@mui/material/IconButton'
import KeyboardArrowUp from '@mui/icons-material/KeyboardArrowUp'
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown'
import { useDefaultProps } from '@mui/material/DefaultPropsProvider'
import generateUtilityClasses from '@mui/material/generateUtilityClasses'
import { styled } from '@mui/material/styles'
import { useFieldArray, useFormState, type UseFieldArrayProps } from 'react-hook-form'
import { useEzFormContext } from '../useEzFormContext'
import { cx } from '../cx'
import { FormSection, type FormSectionProps } from '../FormSection'
import { LiveRegion, type LiveRegionProps } from '../Form/LiveRegion'

// `errorText`, not `error`: MUI reserves `error` (with `active`, `checked`,
// `disabled`, `required`, …) as a *global state* class, so
// `generateUtilityClasses` would hand back the shared `Mui-error` instead of an
// `EzFieldArray-` class — a class every errored MUI control in the tree also
// carries, useless as a hook for this slot. The theme slot is still `error`
// (`EzFieldArray.styleOverrides.error`); only the class key differs.
export const fieldArrayClasses = generateUtilityClasses('EzFieldArray', [
  'root',
  'row',
  'actions',
  'add',
  'remove',
  'move',
  'status',
  'errorText',
])

/** What the `children` render prop receives for one row. */
export interface FieldArrayRow {
  /** Zero-based position in the array. */
  index: number
  /** hookform's stable `field.id` — the React `key` for the row, already applied. */
  id: string
  /** Builds the full form path for a field in this row: `name('email')` → `applicants.0.email`. */
  name: (field: string) => string
}

export interface FieldArrayProps<TRow = Record<string, unknown>> extends Pick<
  UseFieldArrayProps,
  'name' | 'rules' | 'shouldUnregister'
> {
  /** Name of the array group, rendered as the outer `FormSection`'s legend. */
  label: ReactNode
  /**
   * Base name for a row's legend, numbered per row (`Applicant 1`), and the
   * name every row button announces (`Remove Applicant 1`).
   *
   * The default is derived from `label` by stripping one trailing `s`, which is
   * deliberately naive — it gives `Applicants` → `Applicant`, but also
   * `Addresses` → `Addresse` and `People` → `People`. Set `singular` whenever
   * that guess is wrong. A non-string `label` (a `ReactNode`) cannot be
   * stripped at all and falls back to `Row`, so a `label` that is an element
   * should always pass `singular` too. For full control use `rowLabel`.
   */
  singular?: string
  /**
   * How `singular` is guessed from a string `label` when `singular` is not
   * set: the naive English strip above. A locale object replaces it with its
   * own rule (`esES` strips `-es`/`-s`). Default `(label) => label.replace(/s$/, '')`.
   */
  singularize?: (label: string) => string
  /** The row name when neither `singular` nor a string `label` is available. Default `Row`. */
  rowText?: string
  /** Full control over a row's name, used in its legend and in every button's `aria-label`. */
  rowLabel?: (index: number) => ReactNode
  /** Rows below which Remove is disabled. Default 0. */
  minRows?: number
  /** Rows at which Add is disabled. Unbounded by default. */
  maxRows?: number
  /** Add button text. Default "Add". */
  addLabel?: ReactNode
  /**
   * Remove button text. The button's accessible name is always
   * `removeRowLabel(<row label>)` so screen-reader users know which row it drops.
   */
  removeLabel?: ReactNode
  /** Accessible name of a row's Remove button. Default `` `Remove ${row}` ``. */
  removeRowLabel?: (row: string) => string
  /** Accessible name of a row's Move up button. Default `` `Move ${row} up` ``. */
  moveUpLabel?: (row: string) => string
  /** Accessible name of a row's Move down button. Default `` `Move ${row} down` ``. */
  moveDownLabel?: (row: string) => string
  /** Announced after Add; `row` is the new row's 1-based number. Default `` `Row ${row} added` ``. */
  addedMessage?: (row: number) => string
  /** Announced after Remove. Default `` `Row ${row} removed` ``. */
  removedMessage?: (row: number) => string
  /** Announced after Move; `row` is where the row landed. Default `` `Row ${row} moved ${direction}` ``. */
  movedMessage?: (row: number, direction: 'up' | 'down') => string
  /** A new row's value. A function is called per Add, so object rows are never shared. */
  emptyRow: TRow | (() => TRow)
  /** Adds Move up / Move down buttons to each row. */
  reorder?: boolean
  children: (row: FieldArrayRow) => ReactNode
  slotProps?: {
    row?: Omit<FormSectionProps, 'title'>
    actions?: ComponentProps<'div'>
    add?: ButtonProps
    remove?: ButtonProps
    move?: IconButtonProps
    status?: Omit<LiveRegionProps, 'message' | 'announcementKey'>
    error?: FormHelperTextProps
  }
}

const FieldArrayRoot = styled(FormSection, { name: 'EzFieldArray', slot: 'Root' })({})
const FieldArrayRow = styled(FormSection, { name: 'EzFieldArray', slot: 'Row' })({})
// The row's buttons sit on one line rather than stacking as block-level
// children — the component's minimum layout, so it lives on the styled slot's
// default style block rather than as `sx`, and stays overridable via
// `theme.components.EzFieldArray.styleOverrides.actions`.
const FieldArrayActions = styled('div', { name: 'EzFieldArray', slot: 'Actions' })({
  display: 'flex',
  alignItems: 'center',
})
const FieldArrayAdd = styled(Button, { name: 'EzFieldArray', slot: 'Add' })({})
const FieldArrayRemove = styled(Button, { name: 'EzFieldArray', slot: 'Remove' })({})
// WCAG 2.5.8: an icon-only `IconButton` at the small size this defaults to can
// fall under the 24×24 CSS px target once a theme trims its padding; this is
// the functional floor, still overridable via
// `theme.components.EzFieldArray.styleOverrides.move`.
const FieldArrayMove = styled(IconButton, { name: 'EzFieldArray', slot: 'Move' })({
  minWidth: 24,
  minHeight: 24,
})
// The status line is visible (it doubles as sighted feedback for Add/Remove/Move),
// so it opts out of LiveRegion's visually-hidden default while still getting the
// region's role/aria-live and its re-announce handling.
const FieldArrayStatus = styled(LiveRegion, { name: 'EzFieldArray', slot: 'Status' })({})
const FieldArrayError = styled(FormHelperText, { name: 'EzFieldArray', slot: 'Error' })({})

/** Where focus should land once React has rendered the new row list. */
type PendingFocus =
  /** The row that was just appended, identified at commit time (see `handleAdd`). */
  | { kind: 'appended' }
  | { kind: 'row'; index: number }
  | { kind: 'move'; index: number; direction: 'up' | 'down' }
  | { kind: 'add' }

/**
 * A repeating group of fields over a hookform `useFieldArray`, with Add,
 * Remove and optional Move up / Move down.
 *
 * The array is one `FormSection` named by `label`; each row is a nested
 * `FormSection` named `<singular> <n>` (or `rowLabel(index)`), so rows inherit
 * the heading level the surrounding sections imply. Rows are keyed by
 * hookform's `field.id`, never by index, so a remove in the middle does not
 * shuffle typed values between rows.
 *
 * Focus and announcements are the component's job, not the consumer's: Add
 * moves focus into the new row's first focusable field, Remove moves it to the
 * previous row (or the Add button when the first row went), Move keeps focus
 * on the button that was pressed as it travels with its row, and a
 * `role="status"` region announces each change once (cleared before the next,
 * so a repeated action re-announces).
 *
 * An array-level message — zod's `.min(1, msg)` / `.max(n, msg)` on the array,
 * or `setError('<name>.root', …)` — renders under the Add button as an alert.
 * Per-row field errors stay on their own fields.
 */
export function FieldArray<TRow = Record<string, unknown>>(inProps: FieldArrayProps<TRow>) {
  const {
    name,
    rules,
    shouldUnregister,
    label,
    singular,
    singularize = (l: string) => l.replace(/s$/, ''),
    rowText = 'Row',
    rowLabel,
    minRows = 0,
    maxRows,
    addLabel = 'Add',
    removeLabel = 'Remove',
    removeRowLabel = (row: string) => `Remove ${row}`,
    moveUpLabel = (row: string) => `Move ${row} up`,
    moveDownLabel = (row: string) => `Move ${row} down`,
    addedMessage = (row: number) => `Row ${row} added`,
    removedMessage = (row: number) => `Row ${row} removed`,
    movedMessage = (row: number, direction: 'up' | 'down') => `Row ${row} moved ${direction}`,
    emptyRow,
    reorder,
    children,
    slotProps,
  } = useDefaultProps({ props: inProps, name: 'EzFieldArray' })
  // The guard, plus `getValues` for the post-update row count; `useFieldArray`
  // reads `control` from context itself.
  const { getValues } = useEzFormContext('FieldArray')
  const { fields, append, remove, move } = useFieldArray({ name, rules, shouldUnregister })
  const { errors } = useFormState()

  // `seq` is not decoration: it becomes the region's `announcementKey`, so every
  // announcement mounts a *fresh* node. Clearing then setting the text in one
  // handler does not work here — React batches both updates into a single
  // render, so the region never empties and repeating an action with an
  // identical message (removing row 2 twice) would be silent.
  const [status, setStatus] = useState({ text: '', seq: 0 })
  const [pendingFocus, setPendingFocus] = useState<PendingFocus | null>(null)
  const rowRefs = useRef(new Map<string, HTMLFieldSetElement>())
  const addRef = useRef<HTMLButtonElement>(null)

  const setRowRef = useCallback((id: string, el: HTMLFieldSetElement | null) => {
    if (el) rowRefs.current.set(id, el)
    else rowRefs.current.delete(id)
  }, [])

  // Focus after the array has re-rendered with the new row list: the element to
  // focus does not exist (add) or has moved (remove/move) until then, and
  // hookform's own `shouldFocus` targets the input it registered rather than
  // "the first focusable control in this row", which is what a row of MUI
  // fields needs.
  useEffect(() => {
    if (!pendingFocus) return
    /* Consuming a one-shot focus request queued by an event handler, not deriving state from
       props. The `if (!pendingFocus) return` above makes the re-render this schedules a no-op,
       so it settles in one extra pass rather than cascading. */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPendingFocus(null)
    if (pendingFocus.kind === 'add') {
      addRef.current?.focus()
      return
    }
    // `appended` resolves against the *committed* `fields`, where the new row is
    // last, instead of an index captured from the render that queued it.
    const field =
      pendingFocus.kind === 'appended' ? fields[fields.length - 1] : fields[pendingFocus.index]
    const row = field && rowRefs.current.get(field.id)
    // The target row is gone (every row removed, or an external `replace`):
    // focus must land somewhere, and Add is the only control left.
    if (!row) {
      addRef.current?.focus()
      return
    }
    if (pendingFocus.kind === 'move') {
      const moveButton = row.querySelector<HTMLButtonElement>(
        `.${fieldArrayClasses.move}[data-direction="${pendingFocus.direction}"]`,
      )
      // A moved row reaches an end and its button in that direction disables;
      // focus must not vanish, so fall back to the opposite Move button.
      if (moveButton && !moveButton.disabled) {
        moveButton.focus()
        return
      }
      const opposite = row.querySelector<HTMLButtonElement>(
        `.${fieldArrayClasses.move}[data-direction="${pendingFocus.direction === 'up' ? 'down' : 'up'}"]`,
      )
      opposite?.focus()
      return
    }
    row
      .querySelector<HTMLElement>(
        'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      )
      ?.focus()
  }, [pendingFocus, fields])

  /** The generated `<singular> <n>` name, always a string. */
  const defaultRowName = (index: number): string =>
    `${singular ?? (typeof label === 'string' ? singularize(label) : rowText)} ${index + 1}`

  const nameRow = (index: number): ReactNode => (rowLabel ? rowLabel(index) : defaultRowName(index))

  /**
   * The row name for the Remove / Move buttons' `aria-label`, which is an attribute and so
   * must be a string. `rowLabel` may legitimately return an element (it names the *visible*
   * `FormSection` legend, where JSX is fine); interpolating that into a template would
   * announce "Remove [object Object]", so a non-string `rowLabel` falls back to the generated
   * name rather than stringifying whatever it returned.
   */
  const nameRowForAria = (index: number): string => {
    const label = rowLabel?.(index)
    return typeof label === 'string' || typeof label === 'number'
      ? String(label)
      : defaultRowName(index)
  }

  const announce = (text: string) => setStatus((prev) => ({ text, seq: prev.seq + 1 }))

  /** Rows *now*, read after a hookform mutation has applied rather than from `fields`. */
  const rowCount = () => (getValues(name) as unknown[] | undefined)?.length ?? 0

  const handleAdd = () => {
    const row = typeof emptyRow === 'function' ? (emptyRow as () => TRow)() : emptyRow
    // hookform focuses the input it registered for the new row; this component
    // focuses the row's first focusable control itself, in the effect above.
    append(row, { shouldFocus: false })
    // Resolve the target at commit time rather than storing `fields.length`
    // from this render's closure: a double invoke would read the same stale
    // length twice and aim at a row that is no longer the appended one.
    setPendingFocus({ kind: 'appended' })
    // The count comes from the form's values, which `append` has already
    // written, not from this render's `fields.length`: two Adds (or a Remove
    // then an Add) landing in one batch run against the same stale closure and
    // would both announce the length the previous render saw.
    announce(addedMessage(rowCount()))
  }

  const handleRemove = (index: number) => {
    remove(index)
    setPendingFocus(index > 0 ? { kind: 'row', index: index - 1 } : { kind: 'add' })
    announce(removedMessage(index + 1))
  }

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const to = direction === 'up' ? index - 1 : index + 1
    move(index, to)
    setPendingFocus({ kind: 'move', index: to, direction })
    announce(movedMessage(to + 1, direction))
  }

  // zod's `.min` / `.max` on the array itself lands on `errors[name].message`,
  // while hookform's own field-array `rules` and `setError('<name>.root', …)`
  // nest under `errors[name].root`. Read both so either surfaces here.
  const arrayError = errors[name] as { message?: string; root?: { message?: string } } | undefined
  const errorMessage = arrayError?.root?.message ?? arrayError?.message

  const atMax = maxRows !== undefined && fields.length >= maxRows
  const atMin = fields.length <= minRows

  const {
    row: rowSlotProps,
    actions: actionsSlotProps,
    add: addSlotProps,
    remove: removeSlotProps,
    move: moveSlotProps,
    status: statusSlotProps,
    error: errorSlotProps,
  } = slotProps ?? {}
  const addProps = { variant: 'outlined', ...addSlotProps } as const
  const removeProps = { variant: 'text', ...removeSlotProps } as const
  const moveProps = { size: 'small', ...moveSlotProps } as const

  return (
    <FieldArrayRoot title={label} className={fieldArrayClasses.root}>
      {fields.map((field, index) => {
        const rowName = nameRow(index)
        const rowAriaName = nameRowForAria(index)
        return (
          <FieldArrayRow
            key={field.id}
            {...rowSlotProps}
            title={rowName}
            ref={(el: HTMLFieldSetElement | null) => setRowRef(field.id, el)}
            className={cx(fieldArrayClasses.row, rowSlotProps?.className)}
          >
            {children({ index, id: field.id, name: (f) => `${name}.${index}.${f}` })}
            <FieldArrayActions
              {...actionsSlotProps}
              className={cx(fieldArrayClasses.actions, actionsSlotProps?.className)}
            >
              <FieldArrayRemove
                type="button"
                {...removeProps}
                disabled={atMin || removeProps.disabled}
                aria-label={removeRowLabel(rowAriaName)}
                className={cx(fieldArrayClasses.remove, removeProps.className)}
                onClick={() => handleRemove(index)}
              >
                {removeLabel}
              </FieldArrayRemove>
              {reorder && (
                <>
                  <FieldArrayMove
                    type="button"
                    {...moveProps}
                    data-direction="up"
                    disabled={index === 0 || moveProps.disabled}
                    aria-label={moveUpLabel(rowAriaName)}
                    className={cx(fieldArrayClasses.move, moveProps.className)}
                    onClick={() => handleMove(index, 'up')}
                  >
                    <KeyboardArrowUp />
                  </FieldArrayMove>
                  <FieldArrayMove
                    type="button"
                    {...moveProps}
                    data-direction="down"
                    disabled={index === fields.length - 1 || moveProps.disabled}
                    aria-label={moveDownLabel(rowAriaName)}
                    className={cx(fieldArrayClasses.move, moveProps.className)}
                    onClick={() => handleMove(index, 'down')}
                  >
                    <KeyboardArrowDown />
                  </FieldArrayMove>
                </>
              )}
            </FieldArrayActions>
          </FieldArrayRow>
        )
      })}
      <FieldArrayAdd
        type="button"
        ref={addRef}
        {...addProps}
        disabled={atMax || addProps.disabled}
        className={cx(fieldArrayClasses.add, addProps.className)}
        onClick={handleAdd}
      >
        {addLabel}
      </FieldArrayAdd>
      {errorMessage != null && (
        <FieldArrayError
          error
          role="alert"
          {...errorSlotProps}
          className={cx(fieldArrayClasses.errorText, errorSlotProps?.className)}
        >
          {errorMessage}
        </FieldArrayError>
      )}
      <FieldArrayStatus
        visuallyHidden={false}
        {...statusSlotProps}
        message={status.text}
        announcementKey={status.seq}
        className={cx(fieldArrayClasses.status, statusSlotProps?.className)}
      />
    </FieldArrayRoot>
  )
}
