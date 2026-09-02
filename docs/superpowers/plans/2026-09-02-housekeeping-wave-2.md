# Housekeeping wave 2 — follow-ups, fields, release prep

Spec: none (each task's authority is its GitHub issue, quoted verbatim below, plus the
rulings in this file). Base: 46a3cd3 on `main`.

## Global Constraints

- No styling judgement calls in `src/` components: no `sx`, no ripple props, no literal
  `variant`/`size`/`color`/spacing in JSX. Theming is `useDefaultProps` + `styled` slots +
  `generateUtilityClasses` + `Components` augmentation (see `src/Wizard/WizardNav.tsx`).
- Extend MUI / react-hook-form / Base UI types; never re-implement what a library already
  provides. Audit before changing.
- Tests: vitest + testing-library, colocated `*.test.tsx`. `pnpm typecheck && pnpm test`
  must pass before every commit. Run `pnpm format` before committing.
- Commit per task, conventional prefix, body references the issue as `Closes #N` (or
  `Refs #N` for spikes / prep that do not close the issue).
- Do not touch files outside the task's listed area unless required to compile.

## Tracks (independent; run in parallel worktrees)

| Track | Worktree | Tasks | Issues |
|---|---|---|---|
| A wizard | `.worktrees/hk2-wizard` | 1 | #40 |
| B dialog | `.worktrees/hk2-dialog` | 2 | #41 |
| C autocomplete | `.worktrees/hk2-autocomplete` | 3 | #29 |
| D number | `.worktrees/hk2-number` | 4, 5 | #24, #26 |
| E otp | `.worktrees/hk2-otp` | 6 | #30 |
| F release | `.worktrees/hk2-release` | 7 | #31 (prep), issue template |

---

### Task 1: Wizard — clear stale `focusTarget` when a controlled wizard declines the move (#40)

Issue #40: "After a failed submit, `Wizard` stores a `focusTarget` and moves to the owning
step; a controlled wizard (`step`/`onStepChange`) may decline the move, leaving the target
set. It is inert today because the focus effect gates on `id === current.id` and the next
failed submit overwrites it, but a later coincidental arrival at that step could focus a
stale field. Clear the target when the consumer does not follow the move."

Files: `src/Wizard/Wizard.tsx`, `src/Wizard/Wizard.test.tsx`.

Requirements:
1. When `current.id` changes to anything other than `focusTarget.id`, clear `focusTarget`.
   Implement inside the existing focus effect or a sibling effect keyed on `current.id`;
   keep the happy path (target step becomes current → `setFocus` once → clear) intact.
2. Test: controlled wizard whose `onStepChange` ignores the failed-submit move; then the
   consumer moves to the errored step by its own action later (a fresh `step` prop
   change) → the errored field is NOT focused. Plus the existing failed-submit focus tests
   still pass unmodified.
3. Commit: `fix(Wizard): clear stale focusTarget when the consumer declines the move` with
   `Closes #40`.

### Task 2: ConfirmDialog — move the Confirm button's `variant` into registered defaults (#41)

Issue #41: "`src/ConfirmDialog/ConfirmDialog.tsx` builds
`confirmProps = { variant: 'contained', color: confirmColor, ...confirmSlot }`. The v4 rule
says no literal `variant`/`size`/`color` in `src/`; visual defaults belong in
`theme.components.EzConfirmDialog.defaultProps.slotProps.confirm` (via `useDefaultProps`)
so a theme can override them without a per-instance prop. Move the default into the
component's registered default props (or a styled slot) and add a test that a theme
override wins."

Ruling: keep `variant: 'contained'` as the library's own fallback, but express it as a
default of the `slotProps.confirm` slot resolved through `useDefaultProps`, not a literal in
the JSX/props object. Pattern: destructure `slotProps` from `useDefaultProps(...)`, then
compute `confirmSlot = { variant: 'contained', ...slotProps?.confirm }` ONLY IF that is how
`WizardNav`/`SubmitButton` already do it — audit them first and match the established
pattern exactly (if they use a `styled` slot with `variant` in `styleOverrides`, do that
instead). `confirmColor` stays as is (it is a semantic prop, `'error'` for destructive).

Files: `src/ConfirmDialog/ConfirmDialog.tsx`, its test, `src/theme/augmentation.ts` only if
a type needs widening, README Theming section if it lists ConfirmDialog defaults.

Requirements:
1. No literal `variant` remains in `ConfirmDialog.tsx` JSX outside the single registered
   default (or none at all if the styled-slot route is used).
2. Test: render inside `ThemeProvider` with
   `createTheme({ components: { EzConfirmDialog: { defaultProps: { slotProps: { confirm: { variant: 'outlined' } } } } } })`
   → the Confirm button has MUI's outlined class (`MuiButton-outlined`), not contained.
   Second test: no theme → still contained (fallback preserved).
3. Commit: `fix(ConfirmDialog): Confirm variant is a registered default, not a literal`
   with `Closes #41`.

### Task 3: Autocomplete — default `isOptionEqualToValue` by option value (#29)

Issue #29: "Server-provided default objects don't match option objects by identity; add
`isOptionEqualToValue` default by `value`."

Files: `src/fields/Autocomplete/Autocomplete.tsx`, `src/fields/Autocomplete/Autocomplete.test.tsx`.

Requirements:
1. When the consumer does not pass `isOptionEqualToValue`, default it to comparing
   `getOptionValue(a)` with `getOptionValue(b)` via `Object.is` (reuse the existing
   `getOptionValue` prop; keep `toMui`'s synthesized-option path working).
2. Consumer-supplied `isOptionEqualToValue` still wins.
3. Tests: (a) `defaultValues` holding an object that is structurally equal to an option
   but not the same reference → the option shows selected, no MUI "value not in options"
   console warning (assert `console.warn`/`console.error` not called); (b) `multiple` with
   two such objects → both chips render; (c) custom `isOptionEqualToValue` is used when
   provided.
4. Commit: `fix(Autocomplete): default isOptionEqualToValue compares option values` with
   `Closes #29`.

### Task 4: NumberField — paste, leading minus, space groups, IME guard test (#24)

Issue #24: "Open since v2.1: paste into digit groups should apply on blur; leading-minus
and space-group edge cases; IME guard test."

Ruling (concrete acceptance for a vague ticket):
- Paste: pasting text containing group separators (e.g. `1,234,567` or `1 234 567` under a
  space-grouping locale) must yield the correct numeric value immediately; visual regrouping
  of the pasted text happens on blur (the existing blur formatting), not during the paste
  event. No caret jump on paste.
- Leading minus: typing `-` first, then digits, keeps the minus and groups the digits
  (`-1,234`); deleting back to `-` alone keeps `-` without throwing or producing `NaN`.
- Space-group locales (`fr-FR` uses U+202F narrow no-break space; `de-CH` uses `’`):
  `getSeparators` must return the locale's actual separator, `groupWhileTyping` must insert
  it, and parsing grouped text back must strip it. Cover `fr-FR` and `de-CH`.
- IME guard: a change event whose `nativeEvent.isComposing === true` must NOT rewrite the
  input value (currently implemented at NumberFieldControl.tsx ~line 111, untested).

Files: `src/fields/NumberField/groupWhileTyping.ts` + `.test.ts`,
`src/fields/NumberField/NumberFieldControl.tsx`, `src/fields/NumberField/NumberField.test.tsx`.

Requirements:
1. Read `groupWhileTyping.ts` and `NumberFieldControl.tsx` fully first; write the failing
   tests for the four bullets before changing code (TDD; record RED/GREEN in the report).
2. Fix only what the tests prove broken. If a bullet already passes, keep the test and say
   so in the report.
3. Commit: `fix(NumberField): paste, leading minus, space-group locales; IME guard test`
   with `Closes #24`.

### Task 5: Spike — NumberFieldControl on MUI TextField (#26)

Issue #26: "Explore rendering NumberFieldControl through MUI TextField instead of the
vendored look."

Ruling: this is a spike. Deliverable is a findings comment on #26, not merged code. Work on
the track's worktree; a throwaway commit is fine but will not be merged — put the
exploration in a branch `spike/number-textfield` cut from the worktree HEAD and leave it.

Requirements:
1. Read `NumberFieldControl.tsx` and how other fields (e.g. `TextField`-based ones under
   `src/fields/`) render on MUI `TextField`. Identify what Base UI's NumberField gives that
   MUI `TextField type="text" inputMode="decimal"` + hookform would not (increment buttons,
   scrub, keyboard step, locale parsing), and what the vendored look costs (theme
   consistency, a11y, bundle).
2. Prototype the smallest version: `NumberFieldControl` rendering MUI `TextField` with
   Base UI's `NumberField.Input` as `slots.input` (or `inputComponent`), keeping
   `groupWhileTyping`. Note what breaks (ref forwarding, `onChange` chaining, focus ring,
   `InputLabel` shrink).
3. Post a comment on #26 with: options table (keep vendored / TextField wrapper /
   hybrid), what broke in the prototype, a recommendation, and an estimate (S/M/L). Branch
   name in the comment. Commit nothing to the track branch itself.
4. Reply with the comment URL.

### Task 6: Verify OtpField `Incomplete` story play function in a real browser (#30)

Issue #30: "The play function was never verified in a real browser."

Files: none expected; `src/fields/OtpField/OtpField.stories.tsx` only if the play function
is wrong.

Requirements:
1. Start Storybook on a spare port in the worktree: `pnpm storybook -- -p 6017 --ci`
   (background). Steve may have his own Storybook on 6006; do not touch it.
2. Open `http://localhost:6017/iframe.html?id=<story-id>&viewMode=story` for the
   `Incomplete` story with the Playwright MCP browser tools (find the exact id from the
   Storybook sidebar or `index.json`). Wait for the play function to finish; confirm the
   text "Verification code must be 6 characters." is visible and that the input received
   "12". Take a screenshot to the scratchpad and read it.
3. Also open the story in the full Storybook UI (`?path=/story/<id>`) and check the
   Interactions panel shows the play steps passing (if the addon is installed; otherwise
   note that it is not).
4. If the play function fails, fix it minimally and re-verify; commit
   `fix(OtpField): Incomplete story play function` with `Closes #30`. If it passes with no
   change, do not commit; post a comment on #30 with what you ran, the story id, and the
   result, then close the issue with `gh issue close 30 --comment "..."`.
5. Stop the Storybook you started.

### Task 7: Release prep for 0.2.0 and a task issue template (#31 prep)

Issue #31: "Package is 0.1.0 and unpublished. Version bump, changelog from the SDD
ledgers, `pnpm publish`. Delete the retired `feat/v1` remote branch. Consider subpath
exports if the `@mui/x-date-pickers` peer annoys consumers."

Ruling: this task does the reversible prep only. Do NOT run `pnpm publish`, do NOT delete
the remote branch, do NOT add subpath exports (note it as a follow-up in the changelog's
"Unreleased" section). Steve publishes.

Files: `package.json` (version only), new `CHANGELOG.md`, `README.md` install snippet if
it names a version, new `.github/ISSUE_TEMPLATE/task.md` and
`.github/ISSUE_TEMPLATE/config.yml`.

Requirements:
1. `CHANGELOG.md` in Keep a Changelog format, `## 0.2.0 — 2026-09-02`, sections Added /
   Changed / Fixed, derived from `docs/superpowers/reviews/*ledger*.md` and `git log
   --oneline` (v1 through housekeeping wave 1). One line per user-visible change, grouped
   by component; no internal/process entries. An `## Unreleased` header above it with the
   subpath-exports note.
2. `package.json` version → `0.2.0`. Run `pnpm pack --dry-run` (or `npm pack --dry-run`)
   and paste the file list into the report; confirm `dist/` is present and no stories,
   tests, or `.superpowers` leak. If `files` needs tightening, do it.
3. Issue template `.github/ISSUE_TEMPLATE/task.md` with front matter (`name: Task`,
   `about: A scoped piece of work`, `labels: ''`) and body headings: `## Problem`,
   `## Preferred outcome` (one line; "undecided" is allowed), `## Acceptance` (2–4 given /
   when / then bullets), `## Not in scope / Later`, `## Links` (blocks / blocked by /
   related). `config.yml` with `blank_issues_enabled: true`.
4. Commit: `chore(release): 0.2.0 changelog and version; task issue template` with
   `Refs #31`.
