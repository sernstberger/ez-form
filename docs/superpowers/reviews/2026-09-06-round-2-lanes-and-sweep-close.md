# Sept 6 round 2 — lanes after the QA fix wave push, and sweep #47 closed

Date: 2026-09-06 (evening). Orchestrator: main session (Fable). Every lane below had its
own Sonnet review (or a documented self-review ruling) before merge; this doc records the
round and the whole-branch gate, not a second line-by-line review.

## Gate on merged main (idle machine)

| Step | Result |
|---|---|
| `pnpm typecheck` / `pnpm lint` | clean |
| `pnpm test` | 80 files, 2495 passed, 9 skipped (documented contract exemptions), 2 todo |
| `pnpm build` / `pnpm build-storybook` | clean |
| `pnpm check:guardrails` | 54 files, 0 violations |

## Merges (in order)

| Merge | Issue | What landed | Review |
|---|---|---|---|
| 2535a9b | #126 | ruling: three registry stores stay separate; one canonical comment | comments-only, self-reviewed |
| 82b4d2a, d334ac3 | — | Form.tsx NUL bytes → escape; prettier reflow | direct on main |
| 9f0eb33 | — | FormDialog open-dialog a11y test settles the Fade (CI flake) | direct on main, sibling precedent |
| 1df1176 | #122 | contract rows 4 and 5; 9 baseline-named exemptions; double-submit check proven to bite | Sonnet: 1 high (vacuous waitFor pair) fixed |
| 341446d | #127 | `helperTextRole` owns the picker helper-text role; manual spread keeps consumer ownerState | Sonnet: 1 blocking (mergeSlotProps polluted ownerState) fixed |
| 5d081d7 | #128 | `parameters.form: false` opt-out; repo-wide nested-form guard | Sonnet approve |
| 5071435 | #28 (half 1) | `useEzField`/`BoundField` typed over `TValue`; five casts gone; paste path `undefined`→`null` pinned | Sonnet approve after one test added |
| 7555423 | #129 | Slider honours `getAriaLabel` (drops `aria-labelledby` on thumbs when passed) | one-line src change, self-reviewed |
| 5674a2c | #9, #66 | `labelPlacement` axis; preset defaults to `stacked`; library default stays `floating` | Sonnet approve; orchestrator browser check filed #130 #131 |
| f8dcf57 | #132 | AddressField announces a failed lookup resolve; `resolve` returns a tagged result | Sonnet approve |
| 844e9e8 | #130, #131 | start-only rules under `up(bp)`; legend floats into the grid; floating story under a stock theme; nesting guard checks real nesting | Sonnet approve; RTL verified by orchestrator screenshot |

Sweep ledgers committed by the breakers: choice fields (86133ca), specialised text fields
(c703edb, zero findings), AddressField/FileField/ReadOnlyField (51b4c43). With these, every
component group has been swept once; #47 closes.

## Rulings made by the orchestrator this round

- Ruling: **#122's Enter decisions** — same-harness baseline decides submit-vs-exempt;
  Select/StateSelect exempt (select-only combobox, Enter opens); Autocomplete submits with the
  popup closed — cost if wrong: one exemption line to revisit per field.
- Ruling: **#129 re-scoped from docs to a one-line component fix** — `aria-labelledby`
  outranks `aria-label`, so the documented MUI escape hatch was silently overridden; a
  two-prop workaround in a story would have hidden a real defect — cost if wrong: a consumer
  who passes `getAriaLabel` and wants the legend in the thumb name includes it in the string.
- Ruling: **#28's `undefined`→`null` on the picker unparsable-paste path is kept and pinned**
  — matches the file's own value normalisation and the picker contract — cost if wrong: a
  consumer distinguishing never-set from cleared loses that on one path where every other
  path already normalises.
- Ruling: **#127 uses a factored `helperTextRole` rather than a skip-the-pin option** — one
  owner of "the binding's role goes last"; `mergeSlotProps` rejected for the function form
  because it pollutes ownerState — cost if wrong: one more small export.
- Ruling: **#9/#66 library default stays `floating`; `createEzFormTheme()` sets `stacked`**
  (lane's ruling, endorsed; flagged to Steve, who filed #9 as "made the default") — cost if
  wrong: one `EzForm.defaultProps` line for a consumer on stock MUI who wanted stacked.
- Ruling: **orchestrator browser check after a visual merge** — the #9/#66 lane could not
  open Storybook and jsdom cannot see layout; a 4-screenshot pass found #130 (P2) and #131 —
  cost if wrong: ten minutes per visual merge.
- Ruling: **the nesting guard counts nesting, not forms** — `AllThree` renders three sibling
  forms legitimately; the flat `<= 1` count had been red on main since 5674a2c until 844e9e8
  — cost if wrong: none; the guard still fails on the #120/#128 shape (verified).

## Known non-issues

- `Insurance.test.tsx` and `Loan.test.tsx` each flaked once under load in a lane's full run
  and passed alone and on the idle gate. Not filed, per CLAUDE.md.

## Open after this round

#28 half 2 (public `BoundField`, `needs-design`, proposal on the issue for Steve), #79, #14,
#114/#91 (upstream), #31 (publish, on hold).
