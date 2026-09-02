# Examples wave — SDD ledger (Sept 2 2026)

Session: one controller, subagent-driven, 4–6 parallel worktrees (Steve: "4 lanes going most of the time"). Every task: implementer → task review → fix rounds → scoped re-review → merge to `main` immediately (Steve: "when you're done with a ticket and it's reviewed, just merge") → worktree + branch removed → issue closed. Pushes went out after each merge; CI green on main throughout except two windows noted under *Incidents*.

## Shipped (merged to main, issue closed)

| Area | Issues |
|---|---|
| Form semantics | #51 Form title/description + FormSection + step sections; #33 required-by-default (optional marker); #1 FormErrorSummary; #60 FormError; #70 onDefaultValuesError ordering; #74 guard disarm; #75 ClearButton confirm gate; #81 confirm-in-wizard summary |
| Wizard | #64 `layout="page"` + FormSection heading depth; #80 conditional steps (`when`) *(pending merge at time of writing)*; #76 story headings |
| Fields | #58 PasswordField; #59 PasswordStrength; #69 icons prop; #61 DateField; #49 TextareaField; #63 ResendCodeButton; #13 FieldArray; #68 ReadOnlyField `value`; #72 NumberField cross-locale paste; #73 pickers reject unparsable paste; #12 24×24 targets; #67/#62 MUI icons, no inline SVG; #50 last `sx` removed |
| Examples (#48 epic, 6/6) | #52 Login, #53 Sign-up, #54 Profile, #55 Checkout, #56 Insurance, #57 Loan; #77 story play fixes; #82 conditional fields *(pending)* |
| Infra / docs | #44 guardrail script (`sx`, ripple, literal variant/size/color, inline SVG, README coverage) in CI; #46 PR template; #45 DECISIONS.md; #47 qa-breaker agent + design; #78 required-date docs; #32 timeout guidance |

## QA sweep (#47) — first run

Five breakers (form · text · choice · pickers · wizard+examples) against Storybook on main. Findings → fixed the same day: #72 (P1), #73 (P1), #74, #75, #76, #77. Choice group: clean. Lesson (recorded in the agent def, spec and memory): the Playwright MCP browser is one shared session; parallel breakers hijacked each other's tabs, so browser-heavy groups run sequentially next time and vitest probes carry the parallel load.

## Incidents (controller mistakes, fixed on main within minutes)

1. Union-merge resolution dropped a closing brace at hunk seams three times (`augmentation.ts`, `fakeApi.ts`, `MoneyField.test.tsx`) and duplicated the README Components table 5×. Fix: the merge script now auto-repairs the augmentation block, dedupes the README table, strips stray markers, and refuses to commit/push on typecheck or test failure.
2. Two pushes went out with a failing test because a `;` instead of `&&` let `git push` run after `MERGE_BROKEN`; both repaired within one commit.
3. A `format` commit swept the QA breakers' temporary `src/__qa__/` probes into main; untracked, and the dir is now git-ignored and excluded from typecheck.

## Rulings (this wave; also appended to DECISIONS.md)

- Ruling: `title`/`description` are `Form` props, not a `FormTitle` child — one surface; the form owns the lifecycle — cost if wrong: consumers with a custom heading pass `aria-labelledby`.
- Ruling: legend contains a heading element (h3 default, depth-derived below) — heading outline for WCAG 2.4.6/2.4.10 — cost if wrong: double announcement in some AT.
- Ruling: vertical wizard names the step via `aria-labelledby` to the stepper label, no legend — avoids the label twice — cost if wrong: no heading inside the step.
- Ruling: `WizardStep` always renders a fieldset — steps are groups — cost if wrong: one extra element for existing consumers.
- Ruling: legend-less sections do not deepen nested headings — a `title={null}` step otherwise pushed sections to h4 under h2 — cost if wrong: set `slotProps.legend.component` explicitly.
- Ruling: `#48` split into six child issues + epic — each rung reviewable alone — cost if wrong: more tracker noise.
- Ruling: examples live in Storybook (`src/examples`, excluded from the package build) — QA and Playwright already target Storybook — cost if wrong: an `examples/` consumer app comes with #31.
- Ruling: QA breaker = persisted agent definition, session fans out — matches the subagent rule — cost if wrong: manual dedupe of findings.
- Ruling: QA severity reuses `priority:*` + `qa` label — no new taxonomy — cost if wrong: coarser triage.
- Ruling: `@mui/icons-material` is a peer dependency, per-icon imports; hand-rolled SVGs are a guardrail violation — Steve's call — cost if wrong: one more peer for consumers.
- Ruling: `PasswordStrength` is a separate export with a pluggable `score` — keeps zxcvbn-class scorers out of the bundle — cost if wrong: two extra consumer lines.
- Ruling: `FieldArray` class key `errorText` vs theme slot `error` — `generateUtilityClasses` collides with MUI's global `Mui-error` — cost if wrong: one naming asymmetry.
- Ruling: `ReadOnlyField` computed values via an explicit `value` prop, implemented as separate watched/static components — RHF's `useWatch({ disabled })` still subscribes — cost if wrong: two components instead of one.
- Ruling: Wizard `when` predicate evaluated in a child bridge only when some step defines `when`, effective list memoised on a visibility mask — same `disabled` trap — cost if wrong: re-render per keystroke only in `when` wizards.
- Ruling: `FormErrorSummary` root drops `role="alert"`; focus on the heading announces — GOV.UK removed it for double announcement — cost if wrong: AT that ignores focus-driven reading.
- Ruling: `ResendCodeButton` swallows `onResend` rejections into `errorText` + `onResendError` — a resend failing silently is the common case — cost if wrong: consumers wanting the throw wrap it.
- Ruling: `DateField` has no flat `onBlur` (compile error) — one path, like `DatePicker` — cost if wrong: nested `slotProps.textField.onBlur` is two lines.
- Ruling: pickers detect unparsable paste via the forwarded `onPaste` + a single bounded microtask — MUI X offers no callback for the popup pickers' swallowed case — cost if wrong: re-verify on the next MUI X major.
- Ruling: NumberField paste normalises only unambiguous mixed-separator shapes; Base UI's `parseFloat` prefix truncation stays upstream (`it.todo`) — cost if wrong: `12abc` → 12 remains.
- Ruling: v1 ships `en` + `es` only (Steve) — #23 scoped accordingly — cost if wrong: other locales are consumer-supplied.
- Ruling: docs-only branches (#45, #78, #32) are self-checked instead of a review seat — cost if wrong: a doc inaccuracy until the next pass.
- Ruling: we do not mirror MUI's per-instance `classes` prop; per-slot `className` via `slotProps` covers it — cost if wrong: a ticket when a consumer asks.

## Deferred minors (from task reviews, none blocking)

`as const` comment in Form.tsx; non-string ReactNode step label test; `Titled` story shows defaults only; `FieldArray` announcement text still reads `fields.length` from the closure; FormError has no theme test file; `stripFiles` in Insurance is single-key; #83 picker `clearable` stuck error + required-message precedence; #71 React 18 `ref`; #79 cross-step FieldArray mirroring.
