# SDD ledger — plan: docs/superpowers/plans/2026-09-01-ez-form-v2.md
Spec: docs/superpowers/specs/2026-09-01-ez-form-v2-design.md (read; binding authority)
Workspace ruling: work in place on feat/v1 (feature branch; Storybook on :6006 serves this checkout per Steve's standing preference; v1 built here). Cost if wrong: none beyond a dirty branch that is already unmerged.
Models: T1 sonnet, T2 opus, T3 opus, T4 sonnet, T5 sonnet, T6 opus, T7 opus, T8 fable, T9 fable, T10 sonnet; reviews sonnet(spec)+opus(quality) via one task reviewer on opus for T2/3/6/7/8/9 and sonnet for T1/4/5/10; final review fable.

## Pre-flight scan
| Pair / task | Produces vs consumes | Found |
|---|---|---|
| T2 -> T3 | useEzField returns invalid, helperText(), inputA11y(), helperTextA11y; FieldFrame uses exactly those | match |
| T2 -> T8, T9 | Autocomplete/NumberField use f.helperText(text), f.inputA11y(text), f.helperTextA11y.role / full object | match |
| T3 -> T7 | BoundField {field, invalid, required, inputA11y, labelId}; RadioGroup destructures field, required, inputA11y, labelId | match |
| T4 -> T7/T8/T9 | FieldContractProps.onChange: (...args:any[])=>void; NumberField contract maps onChange->onValueChange | match |
| T4 -> T2/T3 | contract expects role="alert" on error helper text for all fields; T2 adds it to TextField/Select, T3 to Checkbox/Switch via FieldFrame | match |
| T5 -> T7/T8 | Option from ../Option; SelectOption alias kept in Select | match |
| T1 -> T9 | @base-ui/react installed in T1; T9 imports @base-ui/react/number-field | match |
| T6 -> T10 | Form gains values/ref; stories/tests extended in T10 reference them | match |
| T1 internal | rollupTypes needs @microsoft/api-extractor; installed in Step 1 | consistent |
| T4 internal | Switch contract: z.boolean() + defaultValues false; required rule fails on false (resolver `value === false`) | consistent |
| T7 internal | toBeRequired on radiogroup via aria-required; first radio ref via slotProps.input | consistent |
| T8 internal | Clear button aria-label "Clear" (MUI default); freeSolo commit via {Enter} createOption | consistent |
| T9 internal | NumberFieldControl inputProps 'aria-invalid'?: true vs InputA11y true|undefined — Step 6 note allows widening | consistent |
| T10 internal | Step 1 describes edits in comments and requires full JSX in the file — instruction, not placeholder | acceptable |
| Rubric | no task mandates an empty test or verbatim duplicated logic | clean |

## Execution
Task 1: implementer DONE_WITH_CONCERNS (commit 27a806e). Ruling: plan's `rollupTypes: true` is a silent no-op on vite-plugin-dts 5 (unplugin-dts rewrite); implementer used `bundleTypes: true` + `invokeOptions.typescriptCompilerFolder` pointed at api-extractor's own TS 5.9.3 because the repo's typescript@7 (native preview) has no classic compiler API/lib files. Accepted — spec requires a single rolled-up d.ts, which now ships. Cost if wrong: build config only; revert one file.
Task 1: minor (deferred): vite.config.ts typescriptCompilerFolder resolution relies on @microsoft/api-extractor keeping `typescript` as a direct dependency; a future bump would fail loudly (build error), not silently.
Task 1: complete (commits 016a11f..27a806e, review clean)
Session note (Sept 1 2026): Steve paused after Task 1 to restart on a new Claude version. Resume at Task 2 (brief: task-2-brief.md, model opus, reviewer opus). BASE for Task 2 = 27a806e.
Session resume (Sept 1 2026, new session): Storybook restarted on :6006. Task 2 dispatched, BASE 27a806e, implementer opus.
Task 2: implementer DONE (commit 63f724e); reviewer (opus) dispatched on review-27a806e..63f724e.diff
Task 2: minor (deferred): TextField always builds a formHelperText slot object ({role: undefined}) even when valid — harmless.
Task 2: minor (deferred): useBooleanField duplicates useId/errorMessage/invalid/helperTextId now owned by useEzField — Task 3 deletes that file; verify the removal lands.
Task 2: minor (deferred): TextField destructures hook result as single-letter `f` (plan-mandated).
Task 2: complete (commits 27a806e..63f724e, review clean)
Task 3: dispatched, BASE 63f724e, implementer opus.
Task 3: implementer DONE (commit e91362e); reviewer (opus) dispatched
Task 3: minor (deferred): FieldFrame labelAs="legend" branch untested until Task 7 (RadioGroup) — Task 7 reviewer must treat labelId/legend wiring as in-scope.
Task 3: minor (deferred): Switch has no new test of its own; existing suite covers the FieldFrame path.
Task 3: complete (commits 63f724e..e91362e, review clean)
Task 4: dispatched, BASE e91362e, implementer sonnet.
Task 4: implementer DONE_WITH_CONCERNS (commit ee07b0d). Ruling: brief's Select contract `componentName: 'Select'` is a plan defect — Select is a pure <TextField select> wrapper, so the outside-<Form> error names <TextField> (v1 spec line 65 already documents that exact message; v2 spec is silent). Test uses 'TextField' to match real behavior. Cost if wrong: one-line change to thread a componentName through TextField later.
Task 4: minor (deferred): Select's outside-<Form> error says <TextField>, not <Select> — DX wart, final review to triage.
Task 4: minor (deferred): TextField onChange contract case no longer asserts toHaveValue('a') by name; typed values exercised indirectly elsewhere.
Task 4: complete (commits e91362e..ee07b0d, review clean)
Task 5: dispatched, BASE ee07b0d, implementer sonnet.
Task 5: implementer DONE (commit e834a34); reviewer (sonnet) dispatched.
Ruling (parallelism, per Steve's request): Tasks 6, 7, 8, 9 are file-independent apart from src/index.ts export lines; dispatching all four concurrently in isolated worktrees from e834a34, cherry-picking each onto feat/v1 as it lands; resolving index.ts conflicts as controller bookkeeping. Cost if wrong: a few trivial merge conflicts; each task still gets its own review after cherry-pick.
Tasks 6/7/8/9: dispatched in parallel worktrees, BASE e834a34 (models: T6 opus, T7 opus, T8 fable, T9 fable).
Task 5: complete (commits ee07b0d..e834a34, review clean)
Note: worktrees for T6/T8/T9 were created at d456e6f (stale); agents instructed to ff to e834a34 before working. T7 worktree correct.
Task 7: implementer DONE (worktree commit 0fd8eed, cherry-picked as 852bdbb on feat/v1; 99/99 green after pick); reviewer (opus) dispatched on review-e834a34..852bdbb.diff. Note: worktree agents cannot write to main checkout — reports live in each worktree's .superpowers path; copy on merge.
Task 6: implementer DONE_WITH_CONCERNS (worktree 412774f, cherry-picked bb6b330; 102/102 green). Concerns were observations (no Storybook visual in worktree; lockfile drift on stale base, moot). Reviewer (opus) dispatched on review-852bdbb..bb6b330.diff.
Task 8: implementer DONE_WITH_CONCERNS (worktree ab8c9ef, cherry-picked 8ee6e53 cleanly; 117/117 green). Concerns were observations (Storybook visual deferred to main). Reviewer (opus) dispatched on review-bb6b330..8ee6e53.diff.
Task 7: minor (deferred): first-radio slotProps built without mergeSlotProps — no consumer path today; if a per-radio passthrough is ever added, wrap in mergeSlotProps or the ref is dropped.
Task 7: minor (deferred): keyboard (arrow-key) navigation untested; only clicks.
Task 7: minor (deferred): `row` asserted via MUI class name (plan-mandated).
Task 7: minor (deferred): option matching keyed on String(value); 1 and '1' would collide.
Task 7: complete (commits e834a34..852bdbb, review clean)
Task 6: minor (deferred, SURFACE TO STEVE): async defaultValues rejection leaves the form permanently disabled with no error surfaced — brief specified no rejection contract; candidate follow-up task.
Task 6: minor (deferred): resetOptions forwarding and unmount-during-load untested; useImperativeHandle dep array decorative.
Task 6: complete (commits 852bdbb..bb6b330, review clean)
Task 8: minor (deferred): Autocomplete formHelperText slot uses a bare object, not mergeSlotProps like TextField (safe today; consistency).
Task 8: minor (deferred): AutocompleteFormValue not load-bearing internally (useEzField non-generic; casts at toMui/fromMui) — candidate follow-up: make useEzField generic in value.
Task 8: minor (deferred): object-valued defaults match by Object.is; document on getOptionValue JSDoc.
Task 8: minor (deferred): no test for clearing a multiple field to [].
Task 8: complete (commits bb6b330..8ee6e53, review clean)
Storybook: restarted (old process held :6006; index was stale) — 35 stories indexed incl. RadioGroup + new Form stories.
Task 9: implementer DONE_WITH_CONCERNS (worktree a5715da). Departures from brief: input handlers via OutlinedInput inputProps (InputBase only chains inputProps handlers); id on BaseNumberField.Root so stepper aria-controls resolves; max test asserts Increase toBeDisabled. Reviewer to verify.
Task 9: cherry-picked d9c7fc9 (index.ts export-line conflict resolved by controller; 130/130 green). Reviewer (opus) dispatched on review-8ee6e53..d9c7fc9.diff with the three departures flagged for verification.
Storybook visual check (controller, main): form--async-defaults OK (values load, form enabled); fields-radiogroup--required OK; fields-autocomplete--multiple DEFECT: story-level decorators nest inside meta decorator → Form inside Form, two Submit buttons. Storybook restarted again (indexer misses story files added while running; 42 stories now).
Task 8: fix round 1/5 opened (1 open — nested Form decorators in Autocomplete.stories.tsx); T8 implementer resumed in its worktree.
Task 9: Ruling: brief's NumberFieldControl routed Base UI handlers via slotProps.input — plan defect; MUI 9.4 InputBase overwrites slot handlers and chains only legacy inputProps (InputBase.js:541-552). Implementation uses inputProps. Cost if wrong: MUI deprecating inputProps later forces a rewrite of that one seam.
Task 9: Ruling: brief placed `id` on BaseNumberField.Input — plan defect; Base UI reads id from Root context for steppers' aria-controls (NumberFieldRoot.js:41,314). Implementation puts id on Root. Cost if wrong: none observed; axe passes.
Task 9: Ruling: brief's at-max test clicked a disabled stepper (pointer-events: none → user-event throws) — plan defect; test asserts Increase toBeDisabled + value unchanged. Cost if wrong: slightly different coverage of the same behavior.
Task 9: minor (deferred): <SSRInitialFilled {...rootProps}/> spread now pointless; two type casts in the bridge deserve a header note; no helperText-only or allowOutOfRange story.
Task 9: Storybook visual (controller): fields-numberfield--min-max renders with steppers + helper text; axe covered by contract test.
Task 9: complete (commits 8ee6e53..d9c7fc9, review clean)
Task 10: dispatched on main checkout, BASE d9c7fc9, implementer sonnet. (T8 fix round 1 still open in its worktree; touches only Autocomplete.stories.tsx.)
Task 8: fix round 1/5 — implementer fix (worktree 1ffe118, cherry-picked 7315a6b: one Form per story via parameters.form); scoped re-review (sonnet) dispatched on review-d9c7fc9..7315a6b.diff.
Task 8: fix round 1/5 (1 addressed, 0 open — nested Form decorators; commit 7315a6b). Visual re-check on main: one Form, one Submit, no nesting error.
Task 8: minor (deferred): parameters.form.{schema,defaultValues} untyped (Storybook Parameters is any); lost per-story const typing.
Task 8: complete (commits bb6b330..8ee6e53 + fix 7315a6b, review clean after 1 fix round)
Task 10: implementer committed 08dfda0 (README v2, whole-form coverage); reviewer (sonnet) dispatched on review-7315a6b..08dfda0.diff. Worktrees for T6-T9 removed after confirming content on feat/v1.
Task 10: Ruling: README rules table min/max row omits Autocomplete (plan-mandated text; Autocomplete.tsx wires min/max) — doc-only defect in the brief; MUST be fixed in the final-review fix wave (not a separate fix round). Cost if wrong: one README row.
Task 10: minor (deferred): README note about Select's error naming <TextField> added beyond the brief's enumerated edits (accurate).
Task 10: complete (commits 7315a6b..08dfda0, review clean; 1 Important carried to final fix wave)
Final review: dispatched (fable) on review-016a11f..08dfda0.diff.
Final review (fable): With fixes. Fix wave items: (1) NumberField.stories Formatted nests Form in Form; (2) NumberFieldProps leaks Root onBlur/inputRef (add to Omit); (3) README min/max row add Autocomplete; (5) Select calls useEzFormContext('Select') so its error names <Select>; contract test componentName 'Select'; drop README note. Ruling: all four accepted as-is — mechanical, spec-consistent. Cost if wrong: small reverts.
Final review: Important #4 (Autocomplete object defaults never match by Object.is) — Ruling: FOLLOW-UP, not blocking (value still submits; README documents getOptionValue); Steve to decide fix shape.
Final review: follow-ups for Steve: async-defaults rejection contract; generic useEzField/BoundField; multiple-clear-to-[] test; RadioGroup arrow-key test; spec corrections (isLoading same-render claim; rejection claim); Autocomplete textFieldProps omits slotProps (spec doesn't) — decide restore vs spec edit; AutocompleteFormValue export beyond constraints list.
Final fix wave: dispatched (opus), FIX_BASE 08dfda0.
Final fix wave: commit ef2ce41 (130/130, build-storybook OK). Scoped re-review (opus) dispatched on review-08dfda0..ef2ce41.diff.
Final fix wave: re-review clean (4/4 addressed, no breakage). Formatted story visually verified: one Form. Branch verified: typecheck OK, 130/130.
