import {
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import Button, { type ButtonProps } from '@mui/material/Button'
import FormHelperText, { type FormHelperTextProps } from '@mui/material/FormHelperText'
import IconButton, { type IconButtonProps } from '@mui/material/IconButton'
import Table, { type TableProps } from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell, { type TableCellProps } from '@mui/material/TableCell'
import TableContainer, { type TableContainerProps } from '@mui/material/TableContainer'
import TableHead, { type TableHeadProps } from '@mui/material/TableHead'
import TableRow, { type TableRowProps } from '@mui/material/TableRow'
import KeyboardArrowUp from '@mui/icons-material/KeyboardArrowUp'
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown'
import { useDefaultProps } from '@mui/material/DefaultPropsProvider'
import generateUtilityClasses from '@mui/material/generateUtilityClasses'
import { styled, ThemeProvider, useTheme, type Theme } from '@mui/material/styles'
import { useFieldArray, useFormState, type UseFieldArrayProps } from 'react-hook-form'
import { useEzFormContext } from '../useEzFormContext'
import { cx } from '../cx'
import { warnFieldArrayLayout } from '../devWarn'
import { FormSection, type FormSectionProps } from '../FormSection'
import { LiveRegion, type LiveRegionProps } from '../Form/LiveRegion'
import { useRegisterFieldArrayRows } from '../Form/FieldArrayRowsContext'
// In its own module so `Form/FieldArrayRowsContext` can name it without importing this
// component (which imports that context back), and re-exported here because this is the
// module consumers of the render prop already take it from. The row *slot* below is
// `FieldArrayRowRoot` rather than `FieldArrayRow` for the same reason: TypeScript keeps a type
// and a value of one name apart, but the declaration build cannot emit the collision — it
// fails to name the `styled` const's inferred type ("cannot be named without a reference to
// MUIStyledCommonProps").
import type { FieldArrayRow } from './FieldArrayRow'

export type { FieldArrayRow }
import { FieldCellContext, type FieldCellContextValue } from '../fields/FieldCellContext'
import { FieldFocusContext } from '../Form/FieldFocusContext'
import { isPlainKey } from '../keys'
import { visuallyHidden } from '../visuallyHidden'

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
  // `layout="table"` (#14)
  'tableContainer',
  'table',
  'tableHead',
  'tableRow',
  'cell',
  'rowHeader',
  'actionsCell',
  'actionsHeaderText',
])

/** How the rows render: today's stacked `FormSection` per row, or one table row each (#14). */
export type FieldArrayLayout = 'stacked' | 'table'

/**
 * Where a cell's error message is *visible* under `layout="table"` (#14). It is the
 * control's `aria-describedby` target either way, and `<FormErrorSummary>` lists it as
 * `<row name> <column header>: <message>` either way.
 *
 * - `summary` (default): the cell shows `aria-invalid` + MUI's error outline, the text is
 *   visually hidden; the summary is where a sighted user reads it.
 * - `inline`: the text shows under the control and the row grows.
 */
export type FieldArrayCellErrors = 'summary' | 'inline'

/** One column of `<FieldArray layout="table">` (#14). */
export interface FieldArrayColumn<TRow = Record<string, unknown>> {
  /** Column identity (React `key`, header `id`); doubles as the default `field`. */
  key: string
  /** The column header — the visible label of every control in the column. */
  header: ReactNode
  /**
   * The row-relative field name the column's control is bound to, for keyboard
   * navigation and error-summary links. Defaults to `key`.
   */
  field?: Extract<keyof TRow, string>
  /** Column width, as any CSS length (a number is pixels). Set on the header cell. */
  width?: string | number
  /** Cell alignment, `TableCell`'s own. */
  align?: TableCellProps['align']
  /** The cell's content — an ordinary ez-form field bound to `row.name(...)`. */
  render: (row: FieldArrayRow) => ReactNode
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
  /**
   * `stacked` (default): each row is a nested `FormSection` rendered through `children`.
   * `table`: one MUI `Table`, each row a `<tr>` rendered through `columns` (#14). Passing
   * the render prop the layout does not read is a dev-mode warning.
   */
  layout?: FieldArrayLayout
  /** The columns of a `layout="table"` array. Ignored (with a dev warning) under `stacked`. */
  columns?: FieldArrayColumn<TRow>[]
  /** Where a table cell's error text is visible; see `FieldArrayCellErrors`. Default `summary`. */
  cellErrors?: FieldArrayCellErrors
  /**
   * The visually hidden header of the table's trailing actions column (Remove, Move).
   * Default "Actions".
   */
  actionsHeader?: ReactNode
  /** Row contents under `layout="stacked"`. Ignored (with a dev warning) under `table`. */
  children?: (row: FieldArrayRow) => ReactNode
  slotProps?: {
    row?: Omit<FormSectionProps, 'title'>
    actions?: ComponentProps<'div'>
    add?: ButtonProps
    remove?: ButtonProps
    move?: IconButtonProps
    status?: Omit<LiveRegionProps, 'message' | 'announcementKey'>
    error?: FormHelperTextProps
    /** `layout="table"` (#14). `stickyHeader` and `size` (default `small`) pass through `table`. */
    tableContainer?: TableContainerProps
    table?: TableProps
    tableHead?: TableHeadProps
    tableRow?: TableRowProps
    cell?: TableCellProps
    /**
     * The row header cell (`<th scope="row">`, the row's name). Visually hidden by default —
     * it exists so assistive tech has "Line item 2" as row context and so every cell's
     * `aria-labelledby` has a target; `visuallyHidden: false` shows it as a first column.
     */
    rowHeader?: TableCellProps & Pick<LiveRegionProps, 'visuallyHidden'>
    actionsCell?: TableCellProps
  }
}

const FieldArrayRoot = styled(FormSection, { name: 'EzFieldArray', slot: 'Root' })({})
const FieldArrayRowRoot = styled(FormSection, { name: 'EzFieldArray', slot: 'Row' })({})
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

// `layout="table"` (#14). Plain MUI `Table` parts as slots; the table's own `size`
// carries the density (see `denseFieldTheme`), so nothing here sets a padding.
const FieldArrayTableContainer = styled(TableContainer, {
  name: 'EzFieldArray',
  slot: 'TableContainer',
})({})
const FieldArrayTable = styled(Table, { name: 'EzFieldArray', slot: 'Table' })({})
const FieldArrayTableHead = styled(TableHead, { name: 'EzFieldArray', slot: 'TableHead' })({})
const FieldArrayTableRow = styled(TableRow, { name: 'EzFieldArray', slot: 'TableRow' })({})
const FieldArrayCell = styled(TableCell, { name: 'EzFieldArray', slot: 'Cell' })({})
// The row's name as a `<th scope="row">`. Out of sight by default — the same clip-rect
// recipe `LiveRegion` uses, dropped whole under `visuallyHidden: false` rather than
// fought with resets, so a shown row header starts from MUI's own `TableCell`.
const FieldArrayRowHeader = styled(TableCell, { name: 'EzFieldArray', slot: 'RowHeader' })<{
  ownerState: { visuallyHidden: boolean }
}>(({ ownerState }) => (ownerState.visuallyHidden ? visuallyHidden : {}))
const FieldArrayActionsCell = styled(TableCell, { name: 'EzFieldArray', slot: 'ActionsCell' })({})
// The actions column's header text: present for assistive tech (an empty `<th>` is an
// axe failure and names nothing), hidden for everyone else — the buttons are their own
// visible labels.
const FieldArrayActionsHeaderText = styled('span', {
  name: 'EzFieldArray',
  slot: 'ActionsHeaderText',
})(visuallyHidden)

/**
 * Cell density (#14): the outer theme extended with `defaultProps.size` for the controls
 * the cells render, memoised on (theme, size) so the nested `ThemeProvider` hands emotion
 * one stable object. Passed as an *object*, not `ThemeProvider`'s function form: with no
 * provider above, `useTheme()` falls back to MUI's default theme, while the function form
 * errors in dev ("no outer theme is present"). A CSS-variables theme
 * (`createEzFormTheme()`) is fine nested this way — MUI's `CssVarsProvider` detects the
 * nesting, reuses the outer colour scheme and generates no second stylesheet when the
 * variable prefix matches (`createCssVarsProvider`, `nested`).
 */
function useDenseFieldTheme(size: 'small' | 'medium'): Theme {
  const outerTheme = useTheme()
  return useMemo(() => denseFieldTheme(outerTheme, size), [outerTheme, size])
}

/**
 * The MUI components ez-form's fields render through, given `defaultProps.size` for the
 * table's density (#14): `size` on `slotProps.table` (default `small`) sets the cells'
 * padding through MUI's own `Table` → `TableCell` context, and this carries the same
 * value to the controls inside them through the same mechanism a theme would use — a
 * nested theme whose `components` extend the outer one. A field's explicit `size` still
 * wins, because a prop always beats a theme default.
 *
 * `MuiRating` is deliberately *not* in the list, though the design spec named it: its
 * `small` star is 18×18 px, under the WCAG 2.5.8 minimum (README, the Rating section on
 * the small size being below the target-size minimum, #111). A Rating cell keeps its 24 px stars and the row grows.
 *
 * Pickers get it through `MuiPickersTextField`, the `useThemeProps` name of the text
 * field MUI X renders — not `slotProps.textField`, whose object a consumer's own
 * `slotProps.textField` would replace wholesale.
 */
function denseFieldTheme(theme: Theme, size: 'small' | 'medium'): Theme {
  const c = theme.components ?? {}
  return {
    ...theme,
    components: {
      ...c,
      MuiTextField: { ...c.MuiTextField, defaultProps: { ...c.MuiTextField?.defaultProps, size } },
      MuiFormControl: {
        ...c.MuiFormControl,
        defaultProps: { ...c.MuiFormControl?.defaultProps, size },
      },
      MuiAutocomplete: {
        ...c.MuiAutocomplete,
        defaultProps: { ...c.MuiAutocomplete?.defaultProps, size },
      },
      MuiCheckbox: { ...c.MuiCheckbox, defaultProps: { ...c.MuiCheckbox?.defaultProps, size } },
      MuiRadio: { ...c.MuiRadio, defaultProps: { ...c.MuiRadio?.defaultProps, size } },
      MuiSwitch: { ...c.MuiSwitch, defaultProps: { ...c.MuiSwitch?.defaultProps, size } },
      MuiSlider: { ...c.MuiSlider, defaultProps: { ...c.MuiSlider?.defaultProps, size } },
      MuiToggleButtonGroup: {
        ...c.MuiToggleButtonGroup,
        defaultProps: { ...c.MuiToggleButtonGroup?.defaultProps, size },
      },
      MuiPickersTextField: {
        ...c.MuiPickersTextField,
        defaultProps: { ...c.MuiPickersTextField?.defaultProps, size },
      },
      EzNumberField: {
        ...c.EzNumberField,
        defaultProps: { ...c.EzNumberField?.defaultProps, size },
      },
      EzOtpField: { ...c.EzOtpField, defaultProps: { ...c.EzOtpField?.defaultProps, size } },
    },
  }
}

/** Where focus should land once React has rendered the new row list. */
type PendingFocus =
  /**
   * The row that was just appended, identified at commit time (see `handleAdd`). With a
   * `columnKey` (Enter on a table's last row, #14) focus lands in that column's cell rather
   * than the row's first control.
   */
  | { kind: 'appended'; columnKey?: string }
  | { kind: 'row'; index: number }
  | { kind: 'move'; index: number; direction: 'up' | 'down' }
  | { kind: 'add' }

/** The first thing in a row (or cell) that Tab would stop on. */
const FOCUSABLE =
  'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'

/** The data cell for `columnKey` inside a row element. */
const cellIn = (row: HTMLElement, columnKey: string): HTMLElement | null =>
  [...row.querySelectorAll<HTMLElement>('td[data-column]')].find(
    (td) => td.dataset.column === columnKey,
  ) ?? null

/** The data cell (`<td data-column>`) an event target sits in, if any — never the actions cell. */
const cellOf = (target: EventTarget | null): HTMLElement | null =>
  target instanceof Element ? target.closest<HTMLElement>('td[data-column]') : null

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
    layout = 'stacked',
    columns,
    cellErrors = 'summary',
    actionsHeader = 'Actions',
    children,
    slotProps,
  } = useDefaultProps({ props: inProps, name: 'EzFieldArray' })
  // The guard, plus `getValues` for the post-update row count; `useFieldArray`
  // reads `control` from context itself.
  const { getValues, setFocus } = useEzFormContext('FieldArray')
  // Read *imperatively* at keydown time (`getIds()`), never subscribed: `useFocusTargetIds()`
  // would re-render this component — and with it every row's fields — on each cell's
  // registration, which is the exact re-render FieldFocusContext's ruling exists to prevent.
  // The keyboard model only needs the map at the moment a key is pressed.
  const focusStore = useContext(FieldFocusContext)
  warnFieldArrayLayout(name, layout, children !== undefined, columns !== undefined)
  const { fields, append, remove, move } = useFieldArray({ name, rules, shouldUnregister })
  const { errors } = useFormState()

  // The one authoritative row list for this array name, built once and used for both the
  // rendered rows and the registry below, so the two cannot describe different rows.
  const rows = useMemo<readonly FieldArrayRow[]>(
    () =>
      fields.map((field, index) => ({
        index,
        id: field.id,
        name: (f: string) => `${name}.${index}.${f}`,
      })),
    [fields, name],
  )

  // Publish to the form's registry so `useFieldArrayRows(name)` elsewhere — typically a later
  // wizard step rendering one field per row of this array — sees the same stable ids this
  // component keys its rows by. A second `useFieldArray` on this name would not: hookform
  // mints ids per hook instance and keeps only one live subscription per name, so the second
  // reader gets ids matching nothing and a list frozen at mount. See FieldArrayRowsContext,
  // which also records why the registry keeps publishing after this array unmounts.
  //
  // `useLayoutEffect`, so the registry is current before the browser paints. A reader mounted
  // alongside this array re-renders from the store's notification; with a passive effect that
  // notification lands after paint, and an update React does not process synchronously — a
  // `replace`, a `reset`, a `setValue` on the array — would show the reader one commit of
  // stale rows first. Publishing during the layout phase closes that window.
  const registerRows = useRegisterFieldArrayRows()
  useLayoutEffect(() => {
    registerRows(name, rows)
  }, [registerRows, name, rows])

  // `seq` is not decoration: it becomes the region's `announcementKey`, so every
  // announcement mounts a *fresh* node. Clearing then setting the text in one
  // handler does not work here — React batches both updates into a single
  // render, so the region never empties and repeating an action with an
  // identical message (removing row 2 twice) would be silent.
  const [status, setStatus] = useState({ text: '', seq: 0 })
  const [pendingFocus, setPendingFocus] = useState<PendingFocus | null>(null)
  // A row is a `<fieldset>` under `stacked` and a `<tr>` under `table`; the focus effect
  // below only ever queries inside it, so the element type does not matter to it.
  const rowRefs = useRef(new Map<string, HTMLElement>())
  const addRef = useRef<HTMLButtonElement>(null)

  const setRowRef = useCallback((id: string, el: HTMLElement | null) => {
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
    // Enter on a table's last row appends and lands in the *same column* (#14); the cell is
    // found in the DOM because the new row's fields register their focus targets in this very
    // commit, after this effect's closure captured the ids.
    const cell =
      pendingFocus.kind === 'appended' && pendingFocus.columnKey !== undefined
        ? cellIn(row, pendingFocus.columnKey)
        : null
    ;(cell ?? row).querySelector<HTMLElement>(FOCUSABLE)?.focus()
  }, [pendingFocus, fields])

  /** What one row is called — `Applicant`, `Line item` — before its number. */
  const rowNoun = singular ?? (typeof label === 'string' ? singularize(label) : rowText)
  /** The generated `<singular> <n>` name, always a string. */
  const defaultRowName = (index: number): string => `${rowNoun} ${index + 1}`

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

  /** Add. `columnKey` is Enter-on-the-last-row's request to land in that column (#14). */
  const handleAdd = (columnKey?: string) => {
    const row = typeof emptyRow === 'function' ? (emptyRow as () => TRow)() : emptyRow
    // hookform focuses the input it registered for the new row; this component
    // focuses the row's first focusable control itself, in the effect above.
    append(row, { shouldFocus: false })
    // Resolve the target at commit time rather than storing `fields.length`
    // from this render's closure: a double invoke would read the same stale
    // length twice and aim at a row that is no longer the appended one.
    setPendingFocus({ kind: 'appended', columnKey })
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
    tableContainer: tableContainerSlotProps,
    table: tableSlotProps,
    tableHead: tableHeadSlotProps,
    tableRow: tableRowSlotProps,
    cell: cellSlotProps,
    rowHeader: rowHeaderSlotProps,
    actionsCell: actionsCellSlotProps,
  } = slotProps ?? {}
  // Read off the slot props directly (a primitive), not off `tableProps` below, so the
  // memo's dependency is a plain string the hooks lint can see is never mutated.
  const tableSize = tableSlotProps?.size ?? 'small'
  const tableProps = { size: tableSize, ...tableSlotProps } as const
  const addProps = { variant: 'outlined', ...addSlotProps } as const
  // In a table the row buttons follow the table's density; stacked rows keep MUI's default.
  const removeProps = {
    variant: 'text',
    ...(layout === 'table' ? { size: tableSize } : null),
    ...removeSlotProps,
  } as const
  const moveProps = { size: 'small', ...moveSlotProps } as const
  const { visuallyHidden: rowHeaderHidden = true, ...rowHeaderProps } = rowHeaderSlotProps ?? {}

  const denseTheme = useDenseFieldTheme(tableSize)

  // ids for the table's headers: one per column, one per row (by hookform's stable
  // `field.id`, so a row keeps its id across a reorder). The legend id lets the
  // table be named by the same element that names the `FormSection`.
  const tableId = useId()
  const legendId = `${tableId}-legend`
  const columnHeaderId = (key: string) => `${tableId}-col-${key}`
  const rowHeaderId = (id: string) => `${tableId}-row-${id}`

  const renderActions = (index: number, rowAriaName: string) => (
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
  )

  const renderStacked = () =>
    rows.map((row) => (
      <FieldArrayRowRoot
        key={row.id}
        {...rowSlotProps}
        title={nameRow(row.index)}
        ref={(el: HTMLFieldSetElement | null) => setRowRef(row.id, el)}
        className={cx(fieldArrayClasses.row, rowSlotProps?.className)}
      >
        {children?.(row)}
        {renderActions(row.index, nameRowForAria(row.index))}
      </FieldArrayRowRoot>
    ))

  /**
   * Moves focus into `column`'s cell on row `index` (#14): hookform's `setFocus` where the
   * cell's field registered a focus target under the expected name (the #98 registry, read
   * imperatively), else the first focusable thing in the cell — a column whose control is
   * bound under a different name than `field ?? key`, or a cell holding no ez-form field.
   */
  const focusCell = (index: number, column: FieldArrayColumn<TRow>) => {
    const target = fields[index]
    const rowEl = target && rowRefs.current.get(target.id)
    const cell = rowEl ? cellIn(rowEl, column.key) : null
    if (!cell) return
    const fieldName = `${name}.${index}.${column.field ?? column.key}`
    const id = focusStore?.getIds()[fieldName]
    const registered = id ? document.getElementById(id) : null
    if (registered && cell.contains(registered)) {
      setFocus(fieldName)
      if (cell.contains(document.activeElement)) return
    }
    cell.querySelector<HTMLElement>(FOCUSABLE)?.focus()
  }

  /**
   * The table's keyboard model (#4 of the design spec): one handler on `<TableBody>`, the
   * pattern #116 used on the Wizard step's fieldset, with the same exclusions (`isPlainKey`).
   *
   * - Enter, plain, in a data cell: same column, next row; on the last row, append (under
   *   `maxRows`) and land in that column once the row mounts; at the cap, stay. Always
   *   `preventDefault`, so Enter **never** submits from a cell — the one documented,
   *   table-scoped exception to `describeFieldContract`'s "Enter submits once".
   * - ArrowDown / ArrowUp, plain, when the control did not consume the key: same column, one
   *   row down / up, no wrap. `Select`, `Autocomplete`, the pickers, `Slider` and `Radio`
   *   all `preventDefault` the arrows they use, so `isPlainKey` leaves those alone — a closed
   *   Select opens its menu, as MUI intends, rather than changing rows.
   * - Tab, Left/Right, Escape: untouched. Keys in the actions cell: untouched (`cellOf`).
   *
   * The pickers need one thing more: MUI X's `PickersInputBase` submits the form itself on
   * Enter, before this handler sees the event. `usePickerField` disarms that from inside the
   * picker when it is in a cell — see the `cell` note there and `preventMuiDefault`.
   */
  const handleTableKeyDown = (event: KeyboardEvent<HTMLTableSectionElement>) => {
    const cell = cellOf(event.target)
    if (!cell) return
    const column = columns?.find((c) => c.key === cell.dataset.column)
    const index = Number(cell.closest('tr')?.dataset.rowIndex)
    if (!column || Number.isNaN(index)) return
    if (isPlainKey(event, 'Enter')) {
      event.preventDefault()
      if (index < fields.length - 1) focusCell(index + 1, column)
      else if (!atMax) handleAdd(column.key)
      return
    }
    const down = isPlainKey(event, 'ArrowDown')
    if (!down && !isPlainKey(event, 'ArrowUp')) return
    const to = down ? index + 1 : index - 1
    if (to < 0 || to >= fields.length) return
    event.preventDefault()
    focusCell(to, column)
  }

  /**
   * `layout="table"` (#14). Headers name the columns (`scope="col"`), a hidden `<th
   * scope="row">` names each row, and every data cell points at its column through
   * `headers`. The controls inside learn the two header ids from `FieldCellContext`,
   * which `useEzField` turns into `aria-labelledby` and the hidden-label class.
   */
  const renderTable = () => (
    <FieldArrayTableContainer
      {...tableContainerSlotProps}
      className={cx(fieldArrayClasses.tableContainer, tableContainerSlotProps?.className)}
    >
      <FieldArrayTable
        aria-labelledby={legendId}
        {...tableProps}
        className={cx(fieldArrayClasses.table, tableProps.className)}
      >
        <FieldArrayTableHead
          {...tableHeadSlotProps}
          className={cx(fieldArrayClasses.tableHead, tableHeadSlotProps?.className)}
        >
          <FieldArrayTableRow
            {...tableRowSlotProps}
            className={cx(fieldArrayClasses.tableRow, tableRowSlotProps?.className)}
          >
            <FieldArrayRowHeader
              {...rowHeaderProps}
              scope="col"
              ownerState={{ visuallyHidden: rowHeaderHidden }}
              className={cx(fieldArrayClasses.rowHeader, rowHeaderProps.className)}
            >
              {rowNoun}
            </FieldArrayRowHeader>
            {columns?.map((column) => (
              <FieldArrayCell
                key={column.key}
                align={column.align}
                {...cellSlotProps}
                id={columnHeaderId(column.key)}
                scope="col"
                style={
                  column.width === undefined
                    ? cellSlotProps?.style
                    : { width: column.width, ...cellSlotProps?.style }
                }
                className={cx(fieldArrayClasses.cell, cellSlotProps?.className)}
              >
                {column.header}
              </FieldArrayCell>
            ))}
            <FieldArrayActionsCell
              {...actionsCellSlotProps}
              className={cx(fieldArrayClasses.actionsCell, actionsCellSlotProps?.className)}
            >
              <FieldArrayActionsHeaderText className={fieldArrayClasses.actionsHeaderText}>
                {actionsHeader}
              </FieldArrayActionsHeaderText>
            </FieldArrayActionsCell>
          </FieldArrayTableRow>
        </FieldArrayTableHead>
        <ThemeProvider theme={denseTheme}>
          <TableBody onKeyDown={handleTableKeyDown}>
            {rows.map((row) => {
              const { index, id } = row
              const rowAriaName = nameRowForAria(index)
              return (
                <FieldArrayTableRow
                  key={id}
                  {...tableRowSlotProps}
                  data-row-index={index}
                  ref={(el: HTMLTableRowElement | null) => setRowRef(id, el)}
                  className={cx(fieldArrayClasses.tableRow, tableRowSlotProps?.className)}
                >
                  <FieldArrayRowHeader
                    component="th"
                    scope="row"
                    {...rowHeaderProps}
                    id={rowHeaderId(id)}
                    ownerState={{ visuallyHidden: rowHeaderHidden }}
                    className={cx(fieldArrayClasses.rowHeader, rowHeaderProps.className)}
                  >
                    {nameRow(index)}
                  </FieldArrayRowHeader>
                  {columns?.map((column) => {
                    const cell: FieldCellContextValue = {
                      rowHeaderId: rowHeaderId(id),
                      headerId: columnHeaderId(column.key),
                      label:
                        typeof column.header === 'string'
                          ? `${rowAriaName} ${column.header}`
                          : rowAriaName,
                      helperTextHidden: cellErrors === 'summary',
                    }
                    return (
                      <FieldArrayCell
                        key={column.key}
                        align={column.align}
                        {...cellSlotProps}
                        data-column={column.key}
                        headers={columnHeaderId(column.key)}
                        className={cx(fieldArrayClasses.cell, cellSlotProps?.className)}
                      >
                        <FieldCellContext.Provider value={cell}>
                          {column.render(row)}
                        </FieldCellContext.Provider>
                      </FieldArrayCell>
                    )
                  })}
                  <FieldArrayActionsCell
                    {...actionsCellSlotProps}
                    className={cx(fieldArrayClasses.actionsCell, actionsCellSlotProps?.className)}
                  >
                    {renderActions(index, rowAriaName)}
                  </FieldArrayActionsCell>
                </FieldArrayTableRow>
              )
            })}
          </TableBody>
        </ThemeProvider>
      </FieldArrayTable>
    </FieldArrayTableContainer>
  )

  return (
    <FieldArrayRoot
      title={label}
      className={fieldArrayClasses.root}
      slotProps={layout === 'table' ? { legend: { id: legendId } } : undefined}
    >
      {layout === 'table' ? renderTable() : renderStacked()}
      <FieldArrayAdd
        type="button"
        ref={addRef}
        {...addProps}
        disabled={atMax || addProps.disabled}
        className={cx(fieldArrayClasses.add, addProps.className)}
        onClick={() => handleAdd()}
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
