# ez-form v4 — SDD ledger

Preserved from the (git-ignored) SDD workspace at the end of the run. Plan:
docs/superpowers/plans/2026-09-02-ez-form-v4-wizard.md; spec:
docs/superpowers/specs/2026-09-02-ez-form-v4-wizard-design.md.

Execution: three worktrees, run concurrently (Steve's standing parallelize rule) —
A `.worktrees/v4-confirm` (Task 1 ConfirmDialog/useConfirm → Task 2 Form confirm/guard
→ Task 3 stories), B `.worktrees/v4-guard` (Task 4 useFormGuard + react-router story),
C `.worktrees/v4-wizard` (Task 5 Wizard/WizardStep/useWizard → Task 6 WizardStepper →
Task 7 WizardNav → Task 8 ReadOnlyField → Task 9 Wizard stories). Task 10 (this ledger)
integrated on `main`. Base for all worktrees: 912e812.

## Spec decisions carried through

- `<Form confirm>` / `<ClearButton confirm>`: `confirm?: true | ConfirmOptions`, dialog
  shown after validation, before the real action, on every path (submit, clear).
- `<Form guard>` + `useFormGuard(useBlocker)`: browser-native prompt for tab close/reload
  while dirty; an injected `useBlocker` (react-router's) for in-app navigation, paired
  with a `ConfirmDialog` the caller renders.
- `Wizard`: one `<Form>`/one schema above all steps; `Next` validates only the current
  step's `fields`, `Submit` on the last step validates everything. Controlled via
  `step`/`onStepChange` and `visited`/`onVisitedChange` so a consumer can drive it from a
  router. `ReadOnlyField` gives review steps a label/value pair with an optional `Edit`
  link back to the owning step (`editStep`).
- Section 5 (added mid-run, see Ruling below): no styling judgement calls inside `src/`
  components — no `sx`, no ripple props, no literal `variant`/`size`/`color`/spacing in
  JSX. Every component registers `useDefaultProps` + `styled` slots + a `<name>Classes`
  utility-classes object under `theme.components.Ez<Name>`, so every visual choice is
  theme-overridable; stories may still style freely.

## Deviations made during implementation, with reasons

- **Mid-run styling ruling (Section 5 retrofit).** Steve paused before Task 7 to
  clarify that no component may bake in a styling judgement call. Confirmed pattern:
  `useDefaultProps` + `styled(..., { name, slot })` + `generateUtilityClasses` + a
  `Components` augmentation entry, documented in `theming-pattern.md`. Applied
  retroactively as Task 6b to the components already built (ConfirmDialog, ClearButton,
  SubmitButton, WizardStepper); Tasks 7–9 (WizardNav, ReadOnlyField, stories) built to
  the pattern from the start. Cost: one extra retrofit task, no behavior change.
- **Redirect target on a stale deep link.** Spec originally said redirect to the "first
  incomplete" step; Task 5's implementer and reviewer converged on "last visited step"
  instead (matches `visited`/`onVisitedChange` resume semantics better), and the spec
  was amended on `main` mid-run to match. Cost if wrong: a wording revert.
- **`Wizard`'s `steps` prop must be a stable reference.** Task 5's reviewer flagged that
  an inline `steps={[...]}` array literal defeats the internal `useMemo`; Ruling:
  document "pass a stable array" on the prop instead of restructuring the memoization —
  cost if wrong is an extra re-render, not a correctness bug.
- **Task 8's `editStep` test used the brief's `ReviewFirst` controlled variant.** The
  brief's wording for that test amended itself mid-writing; since the first version of
  a brief can't move once dispatched, Ruling: the implementer follows the `ReviewFirst`
  variant as instructed. Cost if wrong: nothing (the brief text is what it is).
- **WizardStepper horizontal vs. vertical step control.** MUI 9's `Stepper` switches the
  whole list to `role="tablist"` the moment any `StepButton` appears anywhere in the
  tree, and a tablist may only contain `tab` elements — but vertical steps host
  `StepContent` with real form fields, which can't be a `tab`. Resolved by using MUI's
  own `StepButton` only for horizontal steps (correct there — content lives outside the
  list) and a hand-built `ButtonBase` + `StepLabel` (what `StepButton` is internally,
  minus tab semantics) for vertical steps, keeping that list a plain `<ol>`. Documented
  in `WizardStepper.tsx`; costs a few duplicated lines vs. reusing `StepButton`
  everywhere.
- **`WizardNavRoot`'s `justifyContent` on the styled slot, not a `Stack` prop.**
  `justifyContent` isn't part of `StackOwnProps`, so it can't be passed as a bare JSX
  prop without `sx` (banned by Section 5); it lives as the styled root's minimum default
  instead, still overridable via `theme.components.EzWizardNav.styleOverrides.root`.
- **Task 4's `FormGuard` story used an inline MUI `Dialog` with a `TODO(v4 integration)`**
  because `ConfirmDialog` was being built concurrently in worktree A. Task 10 swapped it
  for the real `ConfirmDialog`, following the usage shown in `useFormGuard`'s own doc
  comment (`title="Discard changes?"`, `confirmLabel="Discard"`, `confirmColor="error"`).
- **`Wizard.stories.tsx`'s main story deferred `confirm={{ title: 'Create account?' }}`**
  with a `TODO(v4 integration)` for the same reason (Form's `confirm` prop landing in a
  different worktree). Task 10 restored it once `<Form confirm>` was on `main`.
- **Test-local theme augmentations.** `Wizard.test.tsx` and `ReadOnlyField.test.tsx` each
  carried a scoped `declare module '@mui/material/styles'` block (documented as
  additive/safe-to-keep) so their themeability tests could typecheck before
  `src/theme/augmentation.ts` had `EzWizardStepper`/`EzWizardNav`/`EzReadOnlyField`
  entries. Task 10 filled in the real entries (including the `header` class key ReadOnly­
  Field's Task 8 added) and deleted both test-local blocks; the tests still typecheck
  through the shared augmentation.
- **`ConfirmDialog` `slotProps` shape.** Task 6b-A's reviewer flagged that
  `slotProps: DialogProps['slotProps'] & { confirm?: ButtonProps; cancel?: ButtonProps }`
  looked like it narrowed `DialogProps['slotProps']`; on inspection there was no real
  collision (disjoint keys), so the type stands as extension, not replacement — kept per
  the "extend MUI types" rule.
- **`ConfirmDialog` uses MUI's native `Dialog` `role` prop instead of `slotProps.paper`.**
  Task 1's reviewer raised this as a Minor (the plan's original shape routed
  `role="alertdialog"` through `slotProps.paper`); Ruling: take the Minor too — the
  native `role` prop is simpler and produces the same DOM result, so there's nothing to
  lose by taking it. Cost if wrong: none (same DOM result either way).

## Ruling: three concurrent worktrees (standing instruction)

SDD skill default is one implementer at a time; Steve's standing instruction
(parallelize independent work) overrides it — three worktrees ran concurrently, one
implementer per worktree, with per-task reviews kept in each worktree before merge.
Cost if wrong: merge conflicts in `src/index.ts`, `README.md`, `package.json`
(`react-router` added as a dev dep by both worktree B and C) — all were adjacent-line
conflicts, resolved by keeping both sides; `pnpm install` re-generated the lockfile once
per merge.

## Minor items left open (deferred; none block v4)

- `Wizard` (Task 5): `Math.max` spread floors a stale `visited` array to index 0 rather
  than erroring; `TIn`-erasing casts in the context could use one more comment; the
  `<useWizard>` hook name reads oddly angle-bracketed in one doc comment.
- `Form` confirm/guard (Task 2): the confirm-path submit handler has no `try/catch`
  around `trigger()`/`ask()` rejecting (pre-existing shape, not new to v4); no test
  exercises `confirm` and `guard` together on the same `<Form>`.
- `FormGuard` story (Task 4): `proceed`/`cancel` are always-present no-ops when the
  blocker is unblocked — this is the plan-mandated shape, not an oversight.
- `ClearButton`/story spread (Task 3): `{...rest}` spread after an explicit `onClick`
  has no runtime effect; stylistic only.
- `ReadOnlyField` (Task 8): a vestigial `useId`/`id` pair on the label; no test covers
  an array value combined with `options` together; the header slot ships no default gap
  (a theme can add one via `styleOverrides.header`).
- `Wizard` stories (Task 9): `steps`/`emptyValues`/`StepsContent` are imported across
  story files via `excludeStories`; build passes, confirmed by a glance in the running
  Storybook rather than an automated check.
- `WizardStepper` (Task 6b-C, pre-existing before this retrofit): the "upcoming step"
  branch bypasses the shared `stepLabel()` helper — noted, not restructured.

## Integration (Task 10) — what this task did

1. `src/index.ts` was missing the entire Wizard export block after the merges (the
   `ReadOnlyField` export had landed, but `Wizard`/`WizardStep`/`WizardStepper`/
   `WizardNav`/`useWizard`/`useOptionalWizard` and their types had not) — added, plus
   `wizardStepperClasses`/`wizardNavClasses`. `submitButtonClasses` was already exported.
2. `src/theme/augmentation.ts`: replaced the commented `EzWizardStepper`/`EzWizardNav`/
   `EzReadOnlyField` placeholders with real entries (imports, `ComponentsPropsList`,
   `ComponentNameToClassKey`, `Components`); deleted the now-redundant test-local
   `declare module` blocks in `Wizard.test.tsx` and `ReadOnlyField.test.tsx` (and their
   now-unused `ComponentsOverrides`/`ComponentsProps`/`WizardStepperProps`/
   `WizardNavProps`/`ReadOnlyFieldProps` imports).
3. `src/Form/FormGuard.stories.tsx`: swapped the inline `Dialog` stopgap for the real
   `ConfirmDialog`, removed the TODO.
4. `src/Wizard/Wizard.stories.tsx`: restored `confirm={{ title: 'Create account?' }}` on
   the main story's `<Form>`, removed the TODO. (`WizardRouter.stories.tsx` and the
   `Resume` story render override carried no such TODO — left as-is.)
5. README: added the five v4 rows to the Components table; added "Wizard", "One route
   per step", and "Confirmations and guards" sections from the brief; added a new
   "Theming" section (not in the brief's literal text, but required by this task)
   summarizing the `Ez<Name>` registration pattern with one `createTheme` example
   touching `EzWizardNav.defaultProps.slotProps.next` and
   `EzReadOnlyField.styleOverrides.label`.
6. This ledger.

## Verification

`pnpm typecheck && pnpm test && pnpm build && pnpm format` — all green: typecheck clean,
330/330 tests, build succeeded, format made only the expected README edits (no source
changes). `dist/index.d.ts` contains `declare module '@mui/material/styles'` with all
six `Ez*` keys (`EzClearButton`, `EzSubmitButton`, `EzConfirmDialog`, `EzWizardStepper`,
`EzWizardNav`, `EzReadOnlyField`) across `ComponentsPropsList`, `ComponentNameToClassKey`,
and `Components` — the type bundler did not drop it. `dist/index.d.ts` also declares
`Wizard`, `WizardStep`, `WizardStepper`, `WizardNav`, `useWizard`, `useOptionalWizard`,
`ReadOnlyField`, `ClearButton`, `ConfirmDialog`, `useFormGuard`, and their prop types.

v4 integration landed at 8f6f9f7; this ledger fix round landed at this commit.
