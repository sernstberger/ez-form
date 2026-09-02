# Housekeeping wave 1 — small follow-ups from GitHub Issues

Spec: none (each task's authority is its GitHub issue, quoted verbatim below, plus the
rulings in this file). Base: c033b30 on `main`.

## Global Constraints

- No styling judgement calls in `src/` components: no `sx`, no ripple props, no literal
  `variant`/`size`/`color`/spacing in JSX. Theming is `useDefaultProps` + `styled` slots +
  `generateUtilityClasses` + `Components` augmentation (see `theming-pattern.md` if present,
  and existing components such as `src/Wizard/WizardNav.tsx`).
- Extend MUI / react-hook-form / Base UI types; never re-implement what a library already
  provides. Audit before changing.
- Tests: vitest + testing-library, colocated `*.test.tsx`. `pnpm typecheck && pnpm test`
  must pass before every commit. Run `pnpm format` before committing.
- Commit per task, conventional prefix (`fix:`, `test:`, `docs:`, `ci:`), body references
  the issue as `Closes #N`.
- Do not touch files outside the task's listed area unless required to compile.

## Tracks (independent; run in parallel worktrees)

| Track | Worktree | Tasks | Issues |
|---|---|---|---|
| A form | `.worktrees/hk-form` | 1, 2 | #27, #36 |
| B wizard | `.worktrees/hk-wizard` | 3, 4 | #35, #34 |
| C small | `.worktrees/hk-small` | 5 | #37, #38 |
| D ci | `.worktrees/hk-ci` | 6 | #39 |

---

### Task 1: Form — async `defaultValues` rejection re-enables the form (#27)

Issue #27: "If the async `defaultValues` function rejects, the form stays disabled forever.
Decide: surface an error state / re-enable."

Ruling: re-enable, and surface the error through a new prop.

Files: `src/Form/Form.tsx`, `src/Form/Form.test.tsx`, README (Form props table if one exists).

Requirements:
1. Add `onDefaultValuesError?: (error: unknown) => void` to `FormProps`, JSDoc'd: called
   when the async `defaultValues` function rejects; the form re-enables with its fields
   empty (no defaults were applied).
2. Behavior on rejection: the form's `loading` flag clears so fields re-enable; no
   unhandled promise rejection when `onDefaultValuesError` is provided. When it is NOT
   provided, the rejection must still be observable: rethrow so it surfaces as an
   unhandled rejection (current JS norm), but the form still re-enables.
   Implementation hint: hookform's `_resetDefaultValues` has no `.catch`, so its
   `isLoading` never clears on rejection — wrap the user's function before handing it to
   `useForm`, and clear `Form`'s own `loading` state in the catch. Verify by reading
   `node_modules/react-hook-form/dist/index.esm.mjs` (`_resetDefaultValues`) and note what
   you found in the report.
3. Tests: (a) rejection with handler → handler receives the error, fields become enabled,
   no unhandled rejection (assert via `process.on('unhandledRejection')` or vitest's
   default failure on unhandled rejections); (b) rejection without handler → fields become
   enabled (the rejection may be asserted with `expect(...).rejects` on a captured
   promise, or by temporarily catching it); (c) existing resolve path unchanged.
4. Commit: `fix(Form): re-enable after async defaultValues rejects; onDefaultValuesError`
   with `Closes #27`.

### Task 2: Form confirm path — rejection parity and confirm + guard test (#36)

Issue #36: "The confirm-path submit handler has no try/catch around `trigger()` /
`ask()`; a rejecting resolver becomes an unhandled rejection (same as the pre-existing
non-confirm path). Decide whether to surface it. Add a regression test that
`useFormGuard` stops blocking after a *confirmed* submit (verified manually in the v4
final review, untested)."

Ruling: do NOT swallow. A rejecting resolver is a programming error and hookform's own
`handleSubmit` also rethrows; the confirm path keeps parity. The requirement is that
nothing is left stuck (form stays enabled, no `submitting`/`pending` flag stranded, no
dialog left open) and that the behavior is documented and tested.

Files: `src/Form/Form.tsx` (JSDoc only unless a flag can strand), `src/Form/Form.test.tsx`,
`src/Form/FormGuard*` tests or `src/hooks/useFormGuard*` tests (find with grep).

Requirements:
1. Read the confirm-path `onSubmit` handler. If any state can be stranded by a rejecting
   `trigger()` or `ask()` (dialog open, `submitting` true), fix it with `try/finally`;
   otherwise add a two-line comment stating that rejections propagate like the non-confirm
   path and nothing is stranded.
2. Test: `confirm` + a resolver that throws → the submit handler's promise rejects, the
   form's inputs are NOT disabled afterwards, no dialog is open.
3. Test: `<Form guard confirm>` with `useFormGuard` wired to a fake `useBlocker` → make
   the form dirty, submit, confirm in the dialog, await submit → the blocker is no longer
   engaged (guard reports not-dirty / not-blocking). Mirror the existing guard tests'
   fixture style.
4. Commit: `test(Form): confirm-path rejection parity; guard releases after confirmed submit`
   with `Closes #36`.

### Task 3: Wizard — stale `visited` ids; comment the TIn-erasing casts (#35)

Issue #35: "`Math.max(0, ...visited.map(indexOf))` floors a restored `visited` list whose
ids no longer exist to step 0 silently (a renamed step id after a localStorage resume).
Filter `-1` out and document the fallback. Also: the `steps as readonly WizardStepDef[]` /
`current as WizardStepDef` casts at the context boundary erase `TIn` and deserve a
one-line comment so nobody 'fixes' them."

Files: `src/Wizard/Wizard.tsx`, `src/Wizard/Wizard.test.tsx`, `src/Wizard/WizardContext.ts`
(JSDoc on `visited` if it lives there).

Requirements:
1. `lastVisitedIndex` ignores ids that are not in `steps` (filter `-1` before `Math.max`).
   If no visited id exists, fall back to index 0. Document on the `visited` prop JSDoc:
   "ids that no longer match a step are ignored; if none match, the wizard starts at the
   first step."
2. Anywhere else `visited` is consumed (`reachable`, `go`, `stepStatus`), a stale id must
   not throw or mis-index. Audit and cover.
3. One-line comment above the `steps as readonly WizardStepDef[]` / `current as
   WizardStepDef` casts explaining that the context is deliberately untyped in `TIn` so
   `WizardStepper`/`WizardNav`/`useWizard` do not need the form's generic.
4. Tests: controlled `visited={['gone','b']}` with steps a,b,c → renders step b, not a;
   `visited={['gone']}` → renders step a; `stepStatus('gone')` does not throw.
5. Commit: `fix(Wizard): ignore stale visited ids; comment TIn-erasing casts` with
   `Closes #35`.

### Task 4: Wizard — failed final submit surfaces errors on unmounted / unlisted fields (#34)

Issue #34: "If a schema field is in no step's `fields`, or the failing field's step is not
mounted, Submit on the last step fails silently: no error shown, nothing focused, no
stepper mark. v4 documents 'every field in exactly one step' as the rule. Think through:
navigate to the first errored step on failed submit; or treat unlisted-field errors as
belonging to the last step in `stepStatus`; or a dev-mode warning for unlisted fields
(#8). Relates to the error summary (#1), which would show these too."

Ruling: do both of the first two. (a) On a failed submit the wizard navigates to the
first step (in `steps` order) that owns an errored field and focuses that field once it
mounts. (b) Errors on fields listed in no step's `fields` belong to the LAST step for
`stepStatus` and for the navigation target. Dev-mode warning stays in #8.

Files: `src/Wizard/Wizard.tsx`, `src/Wizard/Wizard.test.tsx`, `src/Wizard/WizardContext.ts`
(JSDoc), README Wizard section (update the "every field in exactly one step" note to
describe the new behavior).

Requirements:
1. Detect a failed submit from form state: `submitCount` increments while `errors` is
   non-empty (`useFormState({ control })` already exists in `Wizard`). Do not change
   `Form`'s API for this.
2. On detection: compute the first errored step. An error path `p` belongs to the step
   whose `fields` contains `p` (or a prefix of it for nested paths, matching how
   `hasError` uses `get(errors, f)`); if none, it belongs to the last step. If that step
   is not the current step, `move` there (mark visited) and, after the step's content
   mounts, focus the first errored field with hookform `setFocus`. If it IS the current
   step, do nothing extra (hookform already focused).
3. `stepStatus(lastStepId)` returns the error status when an unlisted field has an error.
4. Tests: (a) schema key in no step, on last step Submit → last step shows error status
   and the submit `onSubmit` was not called; (b) errored field on step 1 while on step 3,
   Submit → wizard moves to step 1 and the errored input has focus; (c) errored field on
   the current step → no navigation. Use an `onSubmit` spy.
5. Commit: `fix(Wizard): navigate to first errored step on failed submit; unlisted errors
   belong to the last step` with `Closes #34`.

### Task 5: ConfirmDialog autoFocus opt-out; ReadOnlyField array + options test (#37, #38)

Issue #37: "`autoFocus` on Cancel is set before `{...cancelProps}`, so a consumer can pass
`slotProps.cancel={{ autoFocus: false }}` and disable the 'Enter never confirms by
accident' default. Probably fine as an opt-out, but undocumented and untested."

Issue #38: "`display()` recurses per element so a multi-select value renders option
labels, but no test covers array + `options` together — the exact case ReadOnlyField
exists for on a review step. Also note the `header` slot ships with no default gap between
label and Edit (correct per the no-styling rule); `ezFormTheme` (#10) should set one."

Files: `src/Form/ConfirmDialog.tsx` (or wherever it lives — grep), its test,
`src/fields/ReadOnlyField/ReadOnlyField.test.tsx`, README ConfirmDialog section if any.

Requirements:
1. #37: JSDoc on `slotProps.cancel` (or the `slotProps` type) documenting the opt-out and
   why Cancel has focus by default. Test: default → Cancel button has focus on open;
   `slotProps={{ cancel: { autoFocus: false } }}` → Cancel does NOT have focus on open.
2. #38: test `ReadOnlyField` with `options=[{value:'a',label:'Alpha'},{value:'b',label:'Beta'}]`
   and a watched value `['a','b']` renders "Alpha, Beta". Also a value `['a','zzz']`
   renders the raw fallback for the unknown one (whatever `display` does today — assert
   the current behavior, do not change it).
3. #38 header gap: no code. Post one comment on issue #10 via `gh issue comment 10`:
   "ReadOnlyField `header` ships with no gap between label and Edit; `ezFormTheme` should
   set `EzReadOnlyField.styleOverrides.header` (from #38)."
4. One commit: `test: ConfirmDialog cancel autoFocus opt-out; ReadOnlyField array+options`
   with `Closes #37` and `Closes #38`.

### Task 6: CI workflow (#39)

Issue #39: "No CI yet. A workflow that runs `pnpm typecheck`, `pnpm test`, `pnpm build`,
and `pnpm build-storybook` would catch cross-story-file imports and `excludeStories`
regressions mechanically. Consider ClearButton `{...rest}` spread order as a lint rule
candidate while here."

Ruling: the lint rule idea is out of scope for this task (no eslint in the repo today);
leave a note on #39 when closing.

Files: `.github/workflows/ci.yml` (new).

Requirements:
1. Trigger on `push` to `main` and on `pull_request`.
2. Single job, `ubuntu-latest`, `actions/checkout@v4`, `pnpm/action-setup@v4` (reads
   `packageManager` from package.json, so do not pin a version in the action),
   `actions/setup-node@v4` with `node-version: 22` and `cache: pnpm`, then
   `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm test`, `pnpm build`,
   `pnpm build-storybook`.
3. `concurrency` group per ref with `cancel-in-progress: true`.
4. Verify locally that every command in the workflow passes from a clean checkout of this
   worktree (run them). `pnpm build-storybook` output goes to `storybook-static`, which is
   git-ignored — confirm and do not commit it.
5. Commit: `ci: typecheck, test, build, build-storybook on push and PR` with `Closes #39`
   and a body line "Lint-rule idea for ClearButton rest-spread order deferred; no eslint
   in repo yet."
