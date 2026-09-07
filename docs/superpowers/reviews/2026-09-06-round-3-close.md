# Sept 6 round 3 — BoundField, useFieldArrayRows, FileField gutter; #14 started

Date: 2026-09-06 (late). Orchestrator: main session (Fable); lanes and reviewers on Fable at
Steve's request. Each merge had its own review before landing.

## Gate on merged main (idle machine)

| Step | Result |
|---|---|
| `pnpm typecheck` / `pnpm lint` | clean |
| `pnpm test` | 81 files, 2552 passed, 9 skipped (documented exemptions), 2 todo |
| `pnpm build` / `pnpm build-storybook` | clean |
| `pnpm check:guardrails` | 54 files, 0 violations, 48 exported components documented |

## Merges

| Merge | Issue | What landed | Review |
|---|---|---|---|
| 62bfdb8 | #79 | `useFieldArrayRows(name)` reads a Form-level rows registry published by `<FieldArray>` (`useLayoutEffect`, per-name snapshot, value-carrying latch); dev-warn uses the #108 schema discriminator; Loan Documents step keyed by row id | Fable: 6 findings, all fixed; identity claim reproduced |
| 5f04757 | #133 | `fieldLayoutClasses.selfLabelled` opts FileField out of the `start` grid; a plain direct-child `<label>` takes column 1 (guarded) | lane rulings + orchestrator browser check (gutter gone) |
| 6c6416d | #28 h2 | `FieldFrame` → public render-prop `BoundField` (`labelAs: none \| control \| legend`, `Bound<TValue>`), `BoundFieldBase` keeps `EzBoundField.defaultProps` off the seven internal fields, ReferenceControl under the full contract with nothing exempt | Fable: 5 findings (defaultProps leak, docs, gutter, stale refs, Bound docs), all fixed |
| 9412368 | — | CLAUDE.md prettier reflow, so `pnpm format` stops dirtying every lane | direct on main |
| 00ff285 | #14 | design spec `docs/superpowers/specs/2026-09-06-field-array-table-design.md` | Steve approved the four forks in session |

Sweep ledger: label placement (dbdfdfa) → #133. Upstream checks: #91 (react/react#37518, #37523 open, unmerged) and #114 (mui#49092 no maintainer response) — dated status comments, nothing to do.

## Rulings made by the orchestrator this round

- Ruling: **agents run on Fable for the rest of the session** (Steve: "use fable") — overrides
  the Opus-impl/Sonnet-review default for this session only; the memory rule stands otherwise.
- Ruling: **label default stays `floating`, preset sets `stacked`** (Steve confirmed).
- Ruling: **#28 half 2 built now as a render prop**; `EzBoundField.defaultProps` applies only
  to the public path (`BoundFieldBase` for internal fields) — cost if wrong: one internal
  component.
- Ruling: **`labelAs="control"` carries `selfLabelled`; `labelAs="none"` does not** — a plain
  label + control wants the two-column layout; a self-labelled custom control adds the class
  itself — cost if wrong: one class for that consumer.
- Ruling: **#79 dev-warn uses the #108 discriminator, not "ever registered"** — a conditional
  Wizard step legitimately renders the reader first — cost if wrong: a correctly spelled name
  no array owns stays silent.
- Ruling: **five-store extraction deferred to #134** — two lanes touched `Form.tsx` this round;
  extract against five real call sites once #14's cell-labels registry lands.
- Ruling: **#14 spec approved and a lane started, then stopped at a step boundary for the
  wrap** — the branch `feat/issue-14-field-array-table` stays in `.worktrees/` for the next
  session; it must merge `main` (#79, #133, #28 touched its files) before continuing.

## Open after this round

#14 (in progress, branch kept), #134 (extraction, after #14), #114/#91 (upstream), #31
(publish, on hold).
