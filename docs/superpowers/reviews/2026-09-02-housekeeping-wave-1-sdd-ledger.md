# Housekeeping wave 1 — SDD ledger

Plan: docs/superpowers/plans/2026-09-02-housekeeping-wave-1.md (commit eb6d0d4). No spec;
each task's authority is its GitHub issue plus the rulings below. Base c033b30.
Finalized per-task plans were also posted as comments on the issues.

Execution: four worktrees in parallel (Steve's standing rule) — A `hk/form` (T1 #27 → T2
#36), B `hk/wizard` (T3 #35 → T4 #34), C `hk/small` (T5 #37 + #38), D `hk/ci` (T6 #39).
Each task: implementer → spec + quality review → merge into `main`; then one final
whole-branch review, one fix wave, one scoped re-review.

## Rulings

- **#27** — re-enable the form and add `onDefaultValuesError?: (error: unknown) => void`;
  without a handler the rejection is rethrown so it stays visible. Costs an API-surface
  addition if Steve would rather have an error-state UI.
- **#36** — do not swallow resolver rejections in the confirm path (parity with hookform's
  `handleSubmit`); test that nothing is stranded instead. Costs nothing if wrong.
- **#34** — on a failed submit, navigate to the first step owning an errored field and
  focus it once mounted; errors on fields listed in no step belong to the last step. The
  dev-mode warning stays in #8. Costs a navigation surprise if a consumer wanted stay-put.
- **#39** — the ClearButton rest-spread lint-rule idea is out of scope (no eslint). Costs
  nothing.
- **Final review triage** — fix wave = the `errorFieldPaths` leaf check + the
  `submitCount` decrease guard; `focusTarget` lingering → #40; pre-existing ConfirmDialog
  literal `variant: 'contained'` (never ruled on in v4) → #41; `stepStatus` complexity,
  two-step field marking, fixture reuse, cosmetic commit wording → dropped.

## Deviations and findings worth knowing

- **#35 premise was numerically already correct.** `Math.max(0, ...)` never let a `-1`
  win, so stale ids could not mis-index; the fix (explicit filter + documented fallback +
  tests for `visited=['gone','b']`, `['gone']`, `stepStatus('gone')`, `go('gone')`) buys
  explicitness and coverage, not a behavior change.
- **#34 test staging.** "Errored field on step 1 while on step 3" cannot be reached by
  clearing a field and pressing Next, because `ezResolver` validates the whole schema on
  every `trigger`. The test invalidates the unmounted field via `setValue` from the review
  step, which is the scenario the issue actually describes.
- **hookform `isDirty` does not reset after a successful submit** (verified by probe);
  `useFormGuard` releases because it also gates on `isSubmitSuccessful`. Anyone building
  unsaved-changes UI off raw `isDirty` should know.
- **hookform `_resetDefaultValues` has no `.catch`**, so `isLoading` never clears on
  rejection; `Form` wraps the user's function and clears its own `loading` flag in the
  catch. The wrapper's per-render identity is safe because `useForm` reads
  `defaultValues` once at mount.
- **`stepStatus` now shares `ownerIndex` with the navigation target** (old `hasError`
  removed), so the stepper mark and the redirect cannot drift. A field listed in two steps
  now marks only the first; the documented rule is "exactly one step".
- **Final review found the `'type' in errors` leaf check was a full regression**, not the
  graceful degradation the task review recorded: a top-level schema field named `type`
  made `errorFieldPaths` return `[]`. Fixed in the fix wave with the
  `typeof type === 'string' && (message || ref)` check and tests; the detector now ignores
  `submitCount` decreases from `reset`.

## Verification

Gate on `main` after the merges: `pnpm typecheck` clean, 346/346 tests, then 349/349
after the fix wave. CI workflow verified locally (install, typecheck, test, build,
build-storybook).

Scoped re-review of the fix wave (170120f..d31e8d2): all findings addressed, no new
breakage. Note from it: a hookform `FieldError` with `type` but neither `message` nor
`ref` is unreachable through `ezResolver` and `@hookform/resolvers`, so the tighter leaf
check has no blind spot in this library.

Wave closes at d31e8d2 plus this ledger commit. Worktrees removed; branches `hk/form`,
`hk/wizard`, `hk/small`, `hk/ci` retained. Follow-ups filed: #40, #41.
