# Housekeeping wave 3 — SDD ledger

Plan: docs/superpowers/plans/2026-09-02-housekeeping-wave-3.md (commit b7c7e62). Authority:
the issues plus `docs/PHILOSOPHY.md`. Base 363cd30. Plans posted on #26 and #42.

Execution: two worktrees — `hk3/number` (T1 #26, opus) and `hk3/group` (T2 #42, sonnet);
task reviews, merge, final review, one fix wave.

## Rulings

- **#26** — Steve decided: adopt the MUI `TextField` wrapper (spike
  `spike/number-textfield` @ ab4470f). Stacked stepper arrows move from `sx` (a
  pre-existing rule-2 violation) into `EzNumberField` styled slots (`root`, `steppers`,
  `increment`, `decrement`), so a theme can restyle them. Costs a visual diff if parity
  is imperfect; the screenshot showed parity.
- **#26 `className`** — narrowed from Base UI's `string | (state) => string` to `string`,
  because the Base UI root no longer renders an element and forwarding a state-derived
  string to a different node would be a silent semantic change. Documented in JSDoc and
  CHANGELOG Unreleased. Costs a type error for a consumer passing a function (none known).
- **#26 `translateY(±2px)` icon nudges** dropped rather than ported: they were
  theme-unreachable literals compensating for the old adornment padding. Costs nothing
  visible per the screenshot.
- **#42 fix location** — the brief said "remove the whitespace fallback from
  `isAllowedChar`"; that function is the bail-out gate (any disallowed char leaves the
  text untouched), so removing it there would make a stray space abort grouping instead
  of being stripped. Stripping in the `stripped` step is correct; brief defect.
- **Final-review triage** — fix wave = CHANGELOG Unreleased entries only; remaining `sx`
  in OtpFieldControl and FileField → #50; mid-string stray-space caret test deferred.

## Findings worth knowing

- **`slots.input` / `inputComponent` is the wrong extension point** for Base UI's
  `NumberField.Input`: MUI's contract is for imperative wrappers where `InputBase` keeps
  owning `value`/`onChange`. `slotProps.htmlInput` targets the real `<input>`; `InputBase`
  reads `inputProps.value` first and chains `inputProps.onChange/onBlur/onFocus` before
  its own, so Base UI stays the single owner. Recorded in a comment in
  `NumberFieldControl.tsx`.
- **`SSRInitialFilled` was unnecessary** once `TextField` is used: `FormControl` computes
  initial `filled` at render from `inputProps.value`. Two `renderToString` tests pin
  `data-shrink` for filled and empty.
- **`sx={{ pr: 0 }}` was redundant**: `OutlinedInput` already zeroes right padding under
  `endAdornment`.
- **Whitespace strip and `htmlInput` wiring** run in the same `onChange`; an exhaustive
  ad-hoc probe (four locales, all strings ≤ 4 chars over a mixed alphabet, every caret)
  found no out-of-range caret.
- **Two `sx` remain in `src/`** (OtpFieldControl, FileField), pre-existing; #44's
  guardrail script will catch new ones.

## Verification

`pnpm typecheck` clean; 384/384 tests; `pnpm build` and `pnpm build-storybook` green;
NumberField default story screenshot shows the stacked arrows on the new TextField root.

Fix wave (e975c27): CHANGELOG Unreleased gained the `EzNumberField` / `numberFieldClasses`
Added entry and the `className` narrowing Changed entry; verified by the controller (14
added lines, documentation only). Wave closes at e975c27 plus this ledger commit.
Worktrees removed; branches `hk3/*` and `spike/number-textfield` retained.
Follow-ups: #47 QA sweep, #48 example forms, #49 TextareaField, #50 remaining `sx`.
