# DECISIONS

A ruling is a judgement call recorded during implementation: `Ruling: <what> — <why> — <cost if wrong>`. This page lists every ruling across the project's SDD ledgers and specs, newest first, grouped by source document. To append a ruling, add a `Ruling:` line to a ledger or spec under `docs/superpowers/`, then re-run this extraction.

**77 rulings across 7 documents as of 2026-09-02.**

## [Examples wave — SDD ledger](superpowers/reviews/2026-09-02-examples-wave-sdd-ledger.md)

- `title`/`description` are `Form` props, not a `FormTitle` child — one surface; the form owns the lifecycle — cost if wrong: consumers with a custom heading pass `aria-labelledby`.
- legend contains a heading element (h3 default, depth-derived below) — heading outline for WCAG 2.4.6/2.4.10 — cost if wrong: double announcement in some AT.
- vertical wizard names the step via `aria-labelledby` to the stepper label, no legend — avoids the label twice — cost if wrong: no heading inside the step.
- `WizardStep` always renders a fieldset — steps are groups — cost if wrong: one extra element for existing consumers.
- legend-less sections do not deepen nested headings — a `title={null}` step otherwise pushed sections to h4 under h2 — cost if wrong: set `slotProps.legend.component` explicitly.
- `#48` split into six child issues + epic — each rung reviewable alone — cost if wrong: more tracker noise.
- examples live in Storybook (`src/examples`, excluded from the package build) — QA and Playwright already target Storybook — cost if wrong: an `examples/` consumer app comes with #31.
- QA breaker = persisted agent definition, session fans out — matches the subagent rule — cost if wrong: manual dedupe of findings.
- QA severity reuses `priority:*` + `qa` label — no new taxonomy — cost if wrong: coarser triage.
- `@mui/icons-material` is a peer dependency, per-icon imports; hand-rolled SVGs are a guardrail violation — Steve's call — cost if wrong: one more peer for consumers.
- `PasswordStrength` is a separate export with a pluggable `score` — keeps zxcvbn-class scorers out of the bundle — cost if wrong: two extra consumer lines.
- `FieldArray` class key `errorText` vs theme slot `error` — `generateUtilityClasses` collides with MUI's global `Mui-error` — cost if wrong: one naming asymmetry.
- `ReadOnlyField` computed values via an explicit `value` prop, implemented as separate watched/static components — RHF's `useWatch({ disabled })` still subscribes — cost if wrong: two components instead of one.
- Wizard `when` predicate evaluated in a child bridge only when some step defines `when`, effective list memoised on a visibility mask — same `disabled` trap — cost if wrong: re-render per keystroke only in `when` wizards.
- `FormErrorSummary` root drops `role="alert"`; focus on the heading announces — GOV.UK removed it for double announcement — cost if wrong: AT that ignores focus-driven reading.
- `ResendCodeButton` swallows `onResend` rejections into `errorText` + `onResendError` — a resend failing silently is the common case — cost if wrong: consumers wanting the throw wrap it.
- `DateField` has no flat `onBlur` (compile error) — one path, like `DatePicker` — cost if wrong: nested `slotProps.textField.onBlur` is two lines.
- pickers detect unparsable paste via the forwarded `onPaste` + a single bounded microtask — MUI X offers no callback for the popup pickers' swallowed case — cost if wrong: re-verify on the next MUI X major.
- NumberField paste normalises only unambiguous mixed-separator shapes; Base UI's `parseFloat` prefix truncation stays upstream (`it.todo`) — cost if wrong: `12abc` → 12 remains.
- v1 ships `en` + `es` only (Steve) — #23 scoped accordingly — cost if wrong: other locales are consumer-supplied.
- docs-only branches (#45, #78, #32) are self-checked instead of a review seat — cost if wrong: a doc inaccuracy until the next pass.
- we do not mirror MUI's per-instance `classes` prop; per-slot `className` via `slotProps` covers it — cost if wrong: a ticket when a consumer asks.

## [Form Title / Sections — design spec](specs/2026-09-02-form-title-sections-design.md)

- title/description are `Form` props, not a `FormTitle` child — Steve chose it; one surface, the form already owns the lifecycle — cost if wrong: a consumer who wants the heading elsewhere passes `aria-labelledby` and renders their own.
- legend contains a heading element — WCAG 2.4.6/2.4.10 want a heading outline, HTML allows heading content in `legend` — cost if wrong: double announcement in some AT ("Address, group" then "Address, heading"), which axe accepts and is the documented pattern.
- vertical wizard uses `aria-labelledby` to the stepper label, no legend — avoids the label appearing twice a few pixels apart — cost if wrong: no heading in the step content; the stepper label carries the name.
- `WizardStep` always renders a fieldset — steps are groups by definition — cost if wrong: an extra element in existing consumers' DOM; the reset keeps it invisible.
- `EzForm` is the theme key for the form element itself, reserved for #33 too — cost if wrong: renaming a public theme key later.

## [ez-form v4 — SDD ledger](reviews/2026-09-02-v4-sdd-ledger.md)

- document "pass a stable array" on the prop instead of restructuring the memoization — cost if wrong is an extra re-render, not a correctness bug.
- the implementer follows the `ReviewFirst` variant as instructed. Cost if wrong: nothing (the brief text is what it is).
- take the Minor too — the native `role` prop is simpler and produces the same DOM result, so there's nothing to lose by taking it. Cost if wrong: none (same DOM result either way).
- three concurrent worktrees (standing instruction)
- keep a bare MUI `StepButton` with class `EzWizardStepper-stepButton` and no literal styling; theme it through `MuiStepButton` styleOverrides or a nested selector under `EzWizardStepper.styleOverrides.root`. `stepButton` is in `wizardStepperClasses` and `ComponentNameToClassKey` but deliberately has no `styleOverrides` slot. Cost if wrong: a slightly asymmetric theme API for that one element.

## [ez-form v3 — SDD ledger](reviews/2026-09-01-v3-sdd-ledger.md)

- keep all lines on cherry-pick, T9 fixes order — cost if wrong: none (T9 re-orders) |
- plan wins (same code covers unparsable times); T9 updates the spec — cost if wrong: one string |
- implementer imports `type FocusEvent` from react — cost if wrong: typecheck fails, caught immediately |
- accepted, MUI Slider ignores FormControl context so the plan omitted a real requirement; cost if wrong: none, test covers it) — review dispatched
- worktrees for T2–T6, T8 were cut from 28cc870 (session-start snapshot), not 14bb8ed; T7 from 14bb8ed. Review packages use each worktree's merge-base; T6 told to merge 14bb8ed first. Cost if wrong: a cherry-pick conflict, visible immediately.
- accepted as real a11y fixes, cost if wrong: none) — review dispatched
- the "merge 14bb8ed" message went to the CheckboxGroup agent (T5), not T6 — dispatch-order mixup; harmless (fast-forward adds deps). T6 rebased onto feat/v1 on its own.
- reviewer's Important (drop aria-labelledby from the inner role=group to avoid two same-named groups) conflicts with the spec, which mandates aria-labelledby + inputA11y on the inner group so the element carrying aria-invalid/aria-describedby has a name; an unnamed group carrying those attrs is worse, and RadioGroup already nests fieldset+radiogroup the same way. Code stands; parked. Cost if wrong: a screen reader announces the group name twice.
- the spec's intent is that the a11y role always applies (TextField merges the formHelperText slot itself; the picker has one more nesting level the plan missed) — fix with a nested merge. Cost if wrong: none. Also fold in: consumer slotProps.textField.onBlur must run after field.onBlur; add a picker-error-clearing test.
- accepted); test-only jsdom workarounds for Rating hover math and clear-on-reclick) — review dispatched
- MUI Rating (like Slider) ignores FormControl's disabled context → disabled wired via mergeDisabled on the control; jsdom-only test scaffolding (mousemove suppression, user.pointer with coords) accepted — the tests still drive MUI's real click/clear paths. Cost if wrong: none.
- drop `required` from Slider (HTML gives required no meaning on range), contract gains errorProps/errorMessage to keep a11y error coverage — cost if wrong: re-adding a prop; #3 aria-required on group fields + required on FileField input + contract assertion; #4 built-ins after consumer, reserved keys documented; #5 FileField onChange fires on chip delete with (event, value) — cost if wrong: signature churn; #6 README rules row; minors 8, 9, 11, 12, R6 fixed; 7/10 and all parked items stay. ONE fix wave dispatched (opus).
- `aria-required` is not an allowed attribute on role="group" (axe aria-allowed-attr), so it lands on Rating (radiogroup) and FileField's input only; ToggleButtonGroup, CheckboxGroup, and the three pickers keep no aria-required, with a `requiredNotAnnounced` contract opt-out and a source comment at each site. Not restructuring group roles. Cost if wrong: required-ness of those five fields is conveyed visually (asterisk) and by validation only. Also accepted: normalized `required` boolean instead of `required || undefined`. Scoped re-review dispatched.
- HTML itself gives `required` no meaning on a range input; drop `required` from `SliderProps` (the rules pick becomes `validate` only, plus the min/max built-ins from #1). Remove the `required` story/test if any, update the README component row for Slider (no `required`). For `describeFieldContract`: add an optional `errorProps?: FieldContractProps` + `errorMessage?: string` pair (defaults `{ required: true }` and `` `${label} is required.` ``) used by the helper-text/alert case and the axe case, so Slider keeps full a11y-error coverage via e.g. `errorProps: { max: 0 }`, `errorMessage: 'Volume must be at most 0.'` with a default value of 10. The "required" wording in those two test names may become "error".

## [ez-form v2.1 — SDD ledger](reviews/2026-09-01-v2.1-sdd-ledger.md)

- paste not grouped live — FOLLOW-UP (Base UI onPaste preventDefaults and restores its own caret; correct fix is an onPasteCapture design change). Cost if wrong: pasted numbers show commas only on blur.
- include in fix wave (no reason for the duplication; Storybook-native; stories only). #2-#8 leave (shape-only duplication carrying per-field facts; hand-rolled pieces have no public equivalent). Cost if wrong: revert one preview.tsx + 8 story files.
- groupWhileTyping locale hardening (leading minus, space-group locales) and paste grouping → FOLLOW-UP (not reachable from MoneyField/en-US).

## [ez-form v2 — SDD ledger](reviews/2026-09-01-v2-sdd-ledger.md)

- plan's `rollupTypes: true` is a silent no-op on vite-plugin-dts 5 (unplugin-dts rewrite); implementer used `bundleTypes: true` + `invokeOptions.typescriptCompilerFolder` pointed at api-extractor's own TS 5.9.3 because the repo's typescript@7 (native preview) has no classic compiler API/lib files. Accepted — spec requires a single rolled-up d.ts, which now ships. Cost if wrong: build config only; revert one file.
- brief's Select contract `componentName: 'Select'` is a plan defect — Select is a pure <TextField select> wrapper, so the outside-<Form> error names <TextField> (v1 spec line 65 already documents that exact message; v2 spec is silent). Test uses 'TextField' to match real behavior. Cost if wrong: one-line change to thread a componentName through TextField later.
- brief's NumberFieldControl routed Base UI handlers via slotProps.input — plan defect; MUI 9.4 InputBase overwrites slot handlers and chains only legacy inputProps (InputBase.js:541-552). Implementation uses inputProps. Cost if wrong: MUI deprecating inputProps later forces a rewrite of that one seam.
- brief placed `id` on BaseNumberField.Input — plan defect; Base UI reads id from Root context for steppers' aria-controls (NumberFieldRoot.js:41,314). Implementation puts id on Root. Cost if wrong: none observed; axe passes.
- brief's at-max test clicked a disabled stepper (pointer-events: none → user-event throws) — plan defect; test asserts Increase toBeDisabled + value unchanged. Cost if wrong: slightly different coverage of the same behavior.
- README rules table min/max row omits Autocomplete (plan-mandated text; Autocomplete.tsx wires min/max) — doc-only defect in the brief; MUST be fixed in the final-review fix wave (not a separate fix round). Cost if wrong: one README row.
- all four accepted as-is — mechanical, spec-consistent. Cost if wrong: small reverts.
- FOLLOW-UP, not blocking (value still submits; README documents getOptionValue); Steve to decide fix shape.

## [ez-form v1 — SDD ledger](reviews/2026-09-01-sdd-ledger.md)

- implement on branch feat/v1 in the main checkout, no worktree — fresh repo with nothing else in the working dir to isolate from — cost if wrong: none, branch is still separable.
- accept @typescript/typescript6 devDependency — vite-plugin-dts has no TS 7 API path and prescribes the shim; alternative is downgrading TS which Global Constraints forbid — cost if wrong: one extra devDep to remove later.
- .prettierignore added to Task 9 scope (pnpm-lock.yaml, docs, .superpowers, dist, storybook-static) — cost if wrong: trivial.
- Form wraps onSubmit as handleSubmit((values) => onSubmit(values)) — hookform passes (values, event) which broke toHaveBeenCalledWith and contradicted the public onSubmit type — cost if wrong: consumers lose access to the submit event (they can use useFormContext/handleSubmit directly if they need it).
- `as unknown as Resolver<...>` cast in Form.tsx accepted — single cast fails TS2352; implementer probe-verified inference of z.output on onSubmit — cost if wrong: a silent type hole at the resolver boundary.
- keep `z.string().min(1).email()` chain in tests/stories (deprecated-but-working in zod 4; `z.email()` cannot express "required first, then format" in one chain); README single-check example uses `z.email()` — cost if wrong: deprecation warnings in examples when zod removes it.
- finding overstated (rest lacks the key when consumer omits disabled) but explicit destructure is cleaner and closes disabled={undefined} edge — plan amended, fix in round 1 — cost if wrong: none.
- accept all 16 recommendations — pre-release, user asked for best patterns, every finding source-verified — cost if wrong: type-level API churn on Form (FormProps<S> → <TIn,TOut>), zod 3 consumers excluded.
- form-level `validate` option rejected as zod driver (errors land at errors.root.<key>, stale keys never cleared) — composite resolver instead — cost if wrong: ~60 lines we maintain that mirror hookform's validateField.
- accept concern-1 correction (form-disabled excluded from payload; SubmitButton also disabled on formState.disabled) and mergeSlotProps from '@mui/material/utils' — cost if wrong: none.
- `required` on fields is rule-driven only (no asterisk-without-validation path) — matches owner's ask; consumers needing asterisk-only can be served later by a separate prop — cost if wrong: small additive prop later.
- non-numeric min/max compare as strings (documented); design note corrected re payload stripping.
- load-bearing (Switch reuses); fix in round 1 by matching hookform: required fails on empty-or-false; min/max/length/pattern skipped on empty; validate always runs — cost if wrong: validate now sees empty strings too (hookform-consistent).
- jest-axe@11 over vitest-axe (stale) — cost if wrong: swap one import.
- Checkbox/Switch are identical modulo the MUI control → extract an internal `BooleanFieldControl` in Task 9 (thin Checkbox/Switch, no public API change) — cost if wrong: one internal indirection.
- hand-written src/test/jest-axe.d.ts instead of @types/jest-axe (its jest reference shadows vitest's expect) — cost if wrong: maintain ~10 lines of types.
- Select open-listbox axe test scoped to the listbox (page-level `region` rule on a portal is not a component defect) — cost if wrong: none.
- BooleanFieldControl at ~60 code lines accepted; per-module d.ts in tarball accepted for v0.1 (rollup of types is a follow-up); no repository field until a remote exists — cost if wrong: none.
- consumer disabled merges with `||` everywhere via one `mergeDisabled` helper (form lock wins) — cost if wrong: a consumer cannot force a field enabled inside a disabled form (correct behavior).
- add "prepack": "pnpm build"; npm name ez-form is free (registry 404) — keep bare name.

