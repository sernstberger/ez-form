# Sept 6 round 4 — FieldArray `layout="table"` (#14) merged; session close

Date: 2026-09-06/07 (overnight). Orchestrator: main session (Fable); lane and reviewer on Fable
(Steve: "use fable"). Steve's direction at wrap: "finish #14 then push and wrap"; "if theres
tasks remaining, they should be in tickets, not just memory."

## Gate on merged main (idle machine)

| Step | Result |
|---|---|
| `pnpm typecheck` / `pnpm lint` | clean |
| `pnpm test` | 81 files, 2581 passed, 9 skipped (documented exemptions), 2 todo |
| `pnpm build` / `pnpm build-storybook` | clean; `fieldarray--table`, `fieldarray--table-inline-errors` indexed |
| `pnpm check:guardrails` | 54 files, 0 violations, 48 exported components documented |

## Merge

| Merge | Issue | What landed | Review |
|---|---|---|---|
| 6833a14 | #14 | `<FieldArray layout="table" columns cellErrors actionsHeader>`; cell mode in `useEzField` via `FieldCellContext` (hidden label, `aria-labelledby="<row> <header>"`); dense cells via a nested theme; keyboard model (`src/keys.ts`, Enter = next row / append, arrows = row move with radio and consumed-key exclusions, picker Enter disarmed in a cell); `cellErrors` with `FormErrorSummary` item text via a `cellLabels` map on `FieldFocusStore`; README/DESIGN/DECISIONS; en/es `actionsHeader` | Fable: 2 medium (radio arrows hijacked; composite in a cell takes the cell name for every part), 2 low — all fixed (b5a6333) |

Spec: `docs/superpowers/specs/2026-09-06-field-array-table-design.md`. Deviations are recorded
in `docs/DECISIONS.md` § #14 (Rating out of the density list; two extra slots; row-noun
header; dense theme as an object; imperative focus-id reads; picker disarm inside
`usePickerField` because React gives capture/bubble different synthetic events;
`FieldArrayColumn.field` typed as `Extract<keyof TRow, string>`).

Browser check after merge (Chrome DevTools, main's Storybook): both table stories render,
inline errors show under the cell, summary mode shows the outline only. The story container
(360px decorator) squeezes the unsized column and scrolls the fixed ones — filed as #138, not a
component defect.

## Rulings made by the orchestrator this round

- Ruling: **#14 finished tonight rather than parked** (Steve: "finish this. i dont want you to
  stop midtask") — cost if wrong: a late-night merge of a large feature, mitigated by a Fable
  review and a full green gate.
- Ruling: **composites reset the cell context for their parts** (`AddressField`, nested
  `FieldArray`) — one control per cell is the design; parts keep their own labels — cost if
  wrong: a composite in a cell shows visible part labels inside a dense row.
- Ruling: **radio inputs are excluded from the table's arrow handling by target type**, not by
  `defaultPrevented` — MUI Radio/Rating have no keydown handler; radio arrows are the browser's
  default action — cost if wrong: a custom radio-like control without `type="radio"` loses its
  arrows to the table.
- Ruling: **remaining work goes to tickets, not memory** (Steve) — #135 (QA sweep of BoundField
  + table), #136 (TSV paste), #137 (BoundField family cell naming), #138 (table story width),
  #134 (store extraction) all exist; memory points at them.

## Open after this session

#135, #136, #137, #138, #134; upstream holds #114, #91; #31 publish (on hold, Steve's call).
