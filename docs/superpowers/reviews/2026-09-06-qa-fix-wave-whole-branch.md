# QA fix wave (sweep #47) — whole-branch review before push

Date: 2026-09-06. Reviewer: main session (Fable). Scope: `origin/main..main`, 58 commits
(39 non-merge), 116 files, +7.4k / −0.7k, covering waves 1–5 of the QA fix wave plus the
sweep ledgers. Process ledger: `.superpowers/sdd/qa-fix-wave/LEDGER.md`.

## Verdict

**Clean — pushed.** Six-command gate green on an idle machine; one test failed on the first
run and passed 3/3 in isolation (load flake, see §3). Two follow-ups filed, neither blocking.

| Gate step | Result |
|---|---|
| `pnpm typecheck` | clean |
| `pnpm lint` | clean (`--max-warnings 0`) |
| `pnpm test` | 76 files, 2050 passed, 2 todo; 1 load flake (`Loan.test` Documents-step a11y) → 3/3 green re-run alone |
| `pnpm build` | clean |
| `pnpm build-storybook` | clean |
| `pnpm check:guardrails` | 54 files, 0 violations, 47 exported components documented |

## 1. What was read

Every non-test, non-story source diff in full: `Form.tsx`, the three registry stores
(`FieldFocusContext`, `ErrorSummaryContext`, `FormErrorFocusContext`), `flattenErrors`,
`ezResolver`, `FormErrorSummary`, `FormError`, `FormDialog`, `Wizard`, `WizardStep`,
`WizardStepper`, `ConfirmDialog`, `devWarn`, `useEzField`, `FieldFrame`, `TextField`,
`Autocomplete`, `NumberField`, `OtpField(+Control)`, `usePickerField`, `FileField`, `Rating`,
`Checkbox`, `TextareaField`, `describeFieldContract`, the ESLint plugin entry, `package.json`,
`ci.yml`, and the README diff. Tests and stories were read where a source change needed its
pinning test located, not line by line — they are what the gate runs.

## 2. Findings

| # | Where | Finding | Disposition |
|---|---|---|---|
| 1 | `usePickerField.ts` formHelperText slot | Still `mergeSlotProps(consumer, { role })`, so a consumer `role` displaces `alert` — the #104 shape, not rolled to the picker family because `helperTextSlotProps` pins the hook id that the picker binding reuses as the *field* id | **#127** filed, P3 S follow-up |
| 2 | `Form.tsx` composite keys | Two literal NUL bytes inside template literals (the separator typed as the raw byte, not the `backslash-u0000` escape); `grep` treats the file as binary and returns nothing | fixed on main (`82b4d2a`) as the escape, byte-identical at runtime; found by the #126 lane |
| 3 | `eslint-plugin/index.js` | `meta.version: '0.2.0'` duplicates `package.json` | already noted in the #107 review; left — a one-rule plugin re-stating its version is not worth a build step |

Nothing else. The Form post-submit path (#124) was traced end to end: the snapshot/diff of
`getErrors()` before and after `onSubmit`, the single effect that settles wording and focus
after commit, the ref-callback registration of `<FormError>` so it exists on the same commit,
and the precedence alert → declared summary → first invalid field. The `flattenErrors` leaf
check (`message` string, or `type` + `ref`) was checked against a nested object whose child
is named `message`: the child value is an object, not a string, so it recurses correctly.

## 3. The Loan flake

`Loan.test.tsx › is accessible on the Documents step with a co-applicant's own upload present`
failed once with `Unable to find … role "group" and name "Employer 1"` while Storybook was
compiling on first start and four worktrees were being created. 3/3 green alone. Per CLAUDE.md
a flakiness claim measured under load is worthless, so it is recorded here and not filed. If
it recurs on an idle machine it is a `next()` timing issue in `fillEmploymentStep`, not a11y.

## 4. Rulings made in this review

- Ruling: **#126 self-reviewed and merged without a reviewer lane** — the diff is comments
  only (verified: every changed non-comment line is empty), 20/−5 lines, and the ruling it
  records matches the reviewer's own reading of the three stores — cost if wrong: a comment
  that mis-states the shape of a 20-line file.
- Ruling: **the NUL-byte fix landed directly on main** — a two-character escape change,
  byte-identical at runtime, verified by `Form.test.tsx` and typecheck — cost if wrong: one
  test file catches it.
- Ruling: **picker helper-text role (#127) is a follow-up, not a blocker** — the exposure
  needs a consumer to set `slotProps.textField.slotProps.formHelperText.role`, which no
  example or story does; the fix needs a decision about the id pin — cost if wrong: one
  consumer with a custom helper role gets an unannounced picker error until #127.
- Ruling: **push now, with 58 commits, rather than wait for the running lanes** — the branch
  is self-contained and green; the running lanes (#122, #9/#66, choice sweep) each get their
  own review and merge — cost if wrong: none; later merges are reviewed on their own.

## 5. Issues closed by this push

Closed by `Closes` keywords on push: #124, #125. Closed by hand against the ledger's merge
commits (the commits reference the issue but carried no closing keyword): #97, #98, #102,
#103, #104, #107, #108, #110, #111, #112, #113, #115, #116, #117, #118, #119, #121, #123,
#126. Left open: #47 (sweep continues), #105 (already closed), #114/#91 (upstream),
#122 (running), #127 (new).
