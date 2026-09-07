# FieldArray `layout="table"` — Excel-like cell inputs (#14)

Date: 2026-09-06. Status: design approved by Steve (four forks answered in session); build
follows via one lane. Supersedes the open questions on #14.

## Rulings (Steve, 2026-09-06)

- Ruling: **the surface is `<FieldArray layout="table" columns={[…]}>`, not a new `FieldGrid`**
  — FieldArray already owns rows (stable `field.id`, add/remove/reorder, focus moves, `role=status`
  announcements, the array-level error); a second component would re-implement all of it
  (PHILOSOPHY rule 1) — cost if wrong: FieldArray grows a second render path that a future
  change must keep in step with the stacked one.
- Ruling: **plain MUI `Table`, no MUI X DataGrid** — no new peer dependency; DataGrid's own
  edit/commit lifecycle would fight rule 4 ("the form owns the lifecycle") — cost if wrong: we
  write the keyboard model ourselves (bounded, see §4).
- Ruling: **cell mode: the field's own label is visually hidden and the input is named by
  row header + column header** (`aria-labelledby="<rowHeaderId> <columnHeaderId>"` → "Line item
  2, Qty"); the error renders as the cell's invalid state plus a visually-hidden description,
  and `<FormErrorSummary>` lists it with a link to the cell — cost if wrong: a sighted user
  without the summary sees only a red outline; the opt-in `cellErrors="inline"` restores the
  text under the cell.
- Ruling: **keyboard v1 = Tab native; Enter = same column, next row (appends on the last row
  while under `maxRows`); ArrowUp/ArrowDown = row move when the control did not consume the
  key; paste is a follow-up issue** — cost if wrong: Enter no longer submits from a table cell,
  a documented, table-scoped exception to the #122 contract line.
- Ruling: **no commit-on-blur / explicit save** — values are live through hookform as in every
  field; the form's `mode` governs validation — cost if wrong: none; it is what every other
  field already does.

## 1. Surface

```tsx
<FieldArray
  name="lines"
  label="Line items"
  layout="table"                       // default 'stacked' = today's FormSection rows
  emptyRow={() => ({ sku: '', qty: 1, price: 0 })}
  minRows={1}
  reorder
  columns={[
    { key: 'sku',   header: 'SKU',   render: (row) => <TextField  name={row.name('sku')}   label="SKU" /> },
    { key: 'qty',   header: 'Qty',   width: '6rem',
      render: (row) => <NumberField name={row.name('qty')} label="Qty" min={1} /> },
    { key: 'price', header: 'Price', render: (row) => <MoneyField name={row.name('price')} label="Price" /> },
  ]}
  cellErrors="summary"                 // 'summary' (default) | 'inline'
/>
```

`FieldArrayProps` gains:

| Prop | Type | Notes |
|---|---|---|
| `layout` | `'stacked' \| 'table'` | default `'stacked'`; `children` render prop is for stacked, `columns` for table — passing the wrong one is a dev-warn |
| `columns` | `FieldArrayColumn<TRow>[]` | `{ key: string; header: ReactNode; field?: string; width?: string \| number; align?: 'left' \| 'right' \| 'center'; render: (row: FieldArrayRow) => ReactNode }` — `field` is the row-relative field name the column's control is bound to, for keyboard navigation and summary links; defaults to `key` |
| `cellErrors` | `'summary' \| 'inline'` | see §3 |
| `slotProps.table`, `.tableHead`, `.tableRow`, `.cell`, `.rowHeader`, `.actionsCell` | MUI `TableProps` etc. | `stickyHeader` and `size` pass through `slotProps.table`; default `size="small"` |

`FieldArrayRow` is unchanged (`{ index, id, name(field) }`). Add/Remove/Move keep their
props, names and announcements; in table layout Remove and Move render in a trailing
actions column, Add renders under the table, the array-level error under Add (as today).

## 2. Markup and accessibility

```
<FormSection title={label}>                         ← unchanged: names the whole array
  <TableContainer>
    <Table size="small" aria-labelledby={legendId}>
      <TableHead><TableRow>
        <TableCell id={hdr(col)} scope="col">Qty</TableCell> …   <TableCell>actions header, visually hidden text "Actions"</TableCell>
      </TableRow></TableHead>
      <TableBody onKeyDown={tableKeyDown}>
        <TableRow key={row.id}>
          <TableCell component="th" scope="row" id={rowHdr(row)} className=visually-hidden-or-narrow>Line item 2</TableCell>
          <TableCell headers={hdr(col)}>  <CellContext rowHeaderId headerId column>{col.render(row)}</CellContext>  </TableCell> …
          <TableCell>Move up / Move down / Remove (same buttons, same names)</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </TableContainer>
  [Add]   <array-level error role=alert>   <status region>
</FormSection>
```

- The row header cell carries the row name (`rowLabel`/`singular` logic unchanged). By default
  it is visually hidden (`slotProps.rowHeader` can show it); it exists so AT gets "Line item 2"
  as row context and so `aria-labelledby` has a target.
- **Cell mode is applied by `useEzField`, not by each field.** The cell wrapper provides
  `FieldCellContext { rowHeaderId, headerId }`. `useEzField` reads it and, when present:
  - adds `fieldLayoutClasses.cell` to `layoutClassName` (label + helper text visually hidden;
    root `width: 100%`; no bottom margin) — an internal fourth layout class, NOT a public
    `labelPlacement` value (`LabelPlacement` stays `'floating' | 'stacked' | 'start'`);
  - sets the control's `aria-labelledby` to `"<rowHeaderId> <headerId>"` **when the consumer
    passed no `aria-label`/`aria-labelledby`** (the #99/#100 channels still win); the field's own
    `label` prop stays required for `describeFieldContract` and stays in the DOM visually hidden
    so `getByLabelText` keeps working;
  - keeps `aria-describedby` = helper/error id (#102/#104 merge unchanged) so the error text is
    the cell's description even when hidden.
- Density: the table body renders under a nested `ThemeProvider` that extends the outer theme
  with `defaultProps.size = 'small'` for the MUI components our fields render through
  (`MuiTextField`, `MuiFormControl`, `MuiAutocomplete`, `MuiCheckbox`, `MuiRadio`, `MuiSwitch`,
  `MuiRating`, `MuiSlider`, `MuiToggleButtonGroup`) and `EzNumberField`/`EzOtpField`
  (`size: 'small'`). A consumer's explicit `size` on a field still wins. This is a theme
  default, not a style literal (rule 2). Note the pickers: `slotProps.textField.size`.
- Every focusable in a row is reachable by Tab in DOM order: cells left→right, then the row's
  action buttons.
- `FormErrorSummary`: items for `lines.1.qty` already link via the #98 focus registry; the item
  text becomes `"<row name> <column header>: <message>"` when the field is inside a cell — the
  cell context registers `(name → { rowName, header })` on the existing `FieldFocusContext`
  store's sibling (a small `cellLabels` map on the same `<Form>` registry), read by the summary.
  If that proves invasive, fall back to the message alone (still linked) and file a follow-up.

## 3. Errors

| `cellErrors` | Cell | Summary |
|---|---|---|
| `'summary'` (default) | `aria-invalid`, MUI error outline, helper text present but visually hidden (still the description) | lists `Line item 2 Qty: Qty must be at least 1`, link focuses the cell's control |
| `'inline'` | as above but helper text visible under the control (row grows) | same |

Array-level error (`.min`, `.max`, `setError('lines.root')`) renders under Add as today.
`shouldFocusError` / #123 single-owner focus rules are untouched.

## 4. Keyboard model (table layout only)

One `onKeyDown` on `<TableBody>` (the pattern #116 used on the Wizard step fieldset), with the
exclusions factored out of `WizardStep.isPlainEnter` into a shared `src/keys.ts` helper
(`isPlainKey(event, key)`): ignore when `defaultPrevented`, `repeat`, modifier held, IME
composing, target is `textarea`/`contenteditable`/`button`/`link`.

| Key | Behaviour |
|---|---|
| Tab / Shift+Tab | browser default |
| Enter (plain, in a cell) | `preventDefault`; focus the same column in the next row; on the last row, if `append` is allowed (`maxRows`), append a row and focus that column once it mounts (reuse the Add focus path); otherwise stay. Never submits. |
| ArrowDown / ArrowUp | if the control did not `preventDefault` (Select/Autocomplete/pickers/Slider/Radio do), `preventDefault` and focus the same column one row down/up; no wrap. |
| ArrowLeft / ArrowRight | untouched (caret). |
| Escape | untouched. |

Target resolution: `row.name(column.field ?? column.key)` → element via the #98
`FieldFocusContext` ids (`useFocusTargetIds`), falling back to the first focusable in the
target cell. Focus uses hookform's `setFocus` where the name is registered, else `element.focus()`.

Contract exception: `describeFieldContract` row 4 ("Enter submits once") does not apply to
fields rendered inside a table cell; `FieldArray.test.tsx` pins "Enter in a cell never
submits" instead, and the README says so under the table section.

## 5. Theming

`EzFieldArray` gains `styleOverrides` slots `table | tableHead | tableRow | cell | rowHeader |
actionsCell`; `fieldLayoutClasses.cell` in the placement styles (visually-hidden label/helper
via the same clip-rect recipe `LiveRegion` uses, on a styled slot). Column `width`/`align`
land on `<TableCell>` props, not `sx`. Augmentation updated.

## 6. Out of scope (file as follow-ups)

- TSV/CSV paste filling cells across a row and appending rows (per-column coercion).
- Column sorting/filtering, virtualisation, column resizing.
- Cell-level read-only display (`ReadOnlyField` in a cell works as a plain render already).
- A Wizard-step example using the table (add to Insurance or Checkout later).

## 7. Testing

- `FieldArray.test.tsx`: table layout renders headers from `columns`; row header naming;
  every cell control named "Row N Header" (assert via `getByRole(role, { name })`); Tab order;
  Enter moves/appends/never submits; ArrowUp/Down move except when consumed (a `Select` cell);
  `cellErrors` both modes; Remove/Move focus rules unchanged in table layout; array-level
  error; jest-axe in rest and error states, both `cellErrors` modes.
- `useEzField` / `labelPlacement.test.tsx`: cell class applied only inside a cell; consumer
  `aria-label` beats the cell's labelledby; helper/error id still in `aria-describedby`.
- `FormErrorSummary.test.tsx`: item text for a cell field and its link.
- Story `FieldArray/Table` (line items, with a Select column and a picker column to exercise
  the arrow exclusion) plus `stories.nesting` stays green; `check:guardrails` documents the
  new slots.

## 8. Build plan (one lane, reviewable commits)

1. `FieldCellContext` + `useEzField` cell mode + `fieldLayoutClasses.cell` CSS + tests.
2. `FieldArray layout="table"` markup, columns, row header, actions column, density theme,
   slots, augmentation + tests + story.
3. Keyboard model (`src/keys.ts` extraction from WizardStep, table `onKeyDown`) + tests.
4. `cellErrors` + FormErrorSummary item text + tests.
5. README section "Table layout", DESIGN.md paragraph, DECISIONS.md rulings; file the paste
   follow-up issue.
