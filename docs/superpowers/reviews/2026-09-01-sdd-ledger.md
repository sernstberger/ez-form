# SDD ledger — plan: docs/superpowers/plans/2026-09-01-ez-form-v1.md
Spec: docs/superpowers/specs/2026-09-01-ez-form-v1-design.md (read)
Branch: feat/v1 (created from 901e0b1 → c85f206)

Ruling: implement on branch feat/v1 in the main checkout, no worktree — fresh repo with nothing else in the working dir to isolate from — cost if wrong: none, branch is still separable.

## Pre-flight scan
| Pair / task | Produces vs consumes | Found |
|---|---|---|
| T2→T3 | useEzFormContext(componentName) / useEzField calls it with componentName | consistent |
| T3→T6 | TextFieldProps keeps `select` + `children` / Select passes both | consistent |
| T3→T4 | TextField stories decorator renders `<button>Submit</button>`; WithError play clicks 'Submit' | consistent |
| T4→T5→T9 | Form.stories: T5 swaps raw button for SubmitButton, T9 rewrites file | consistent, T9 supersedes |
| T7→T8 | useBooleanField returns {name,checked,onChange,onBlur,inputRef,disabled,errorMessage} / Switch uses same keys | consistent |
| T2 vs stories/tests | Form<S extends z.ZodType<FieldValues,FieldValues>>; all schemas are z.object | consistent |
| T1 vs all tests | tsconfig types vitest/globals + vitest globals:true; tests use bare vi/describe/it/test | consistent |
| T1 vite.config | imports ./package.json → resolveJsonModule true in tsconfig | consistent |
| T1 self | smoke test asserts toBeInTheDocument (not empty); deleted in T9 | ok |
| T5 vs T6/T7/T8 stories | SubmitButton imported in later field stories | exists by then |
| Global "MUI by path" vs T4 preview | imports @mui/material/styles, CssBaseline by path | consistent |
Scan clean; no rulings needed beyond the branch ruling.

## Tasks
User request: after Task 4 (Storybook) completes, start `pnpm storybook` in the background and LEAVE IT RUNNING (http://localhost:6006) so the user can follow along. Do not kill it at the end.
User request: Task 1 implementer on model fable ("at least for this one").
User request: Storybook port locked — Task 4 sets script to 'storybook dev -p 6006 --exact-port' (plan amended).
Task 1: implementer DONE_WITH_CONCERNS (commit 01d4196). Concerns: TS6 shim devDep @typescript/typescript6 for vite-plugin-dts; no sourcemap from empty barrel (resolves in T2); json import attribute; no .prettierignore.
Ruling: accept @typescript/typescript6 devDependency — vite-plugin-dts has no TS 7 API path and prescribes the shim; alternative is downgrading TS which Global Constraints forbid — cost if wrong: one extra devDep to remove later.
Ruling: .prettierignore added to Task 9 scope (pnpm-lock.yaml, docs, .superpowers, dist, storybook-static) — cost if wrong: trivial.
Task 1: minor (deferred): dist/index.js.map absent while barrel is empty — verify map exists after Task 2 build (Task 9 full build covers it).
Task 1: complete (commits 03cecfe..01d4196, review clean)
User request: tests follow Kent C. Dodds / Testing Library best practices — added as Global Constraint "Testing conventions"; plan tests updated (userEvent.setup(), renderHook, toHaveBeenCalledWith); briefs 2-9 regenerated.
Ruling: Form wraps onSubmit as handleSubmit((values) => onSubmit(values)) — hookform passes (values, event) which broke toHaveBeenCalledWith and contradicted the public onSubmit type — cost if wrong: consumers lose access to the submit event (they can use useFormContext/handleSubmit directly if they need it).
Ruling: `as unknown as Resolver<...>` cast in Form.tsx accepted — single cast fails TS2352; implementer probe-verified inference of z.output on onSubmit — cost if wrong: a silent type hole at the resolver boundary.
Ruling: keep `z.string().min(1).email()` chain in tests/stories (deprecated-but-working in zod 4; `z.email()` cannot express "required first, then format" in one chain); README single-check example uses `z.email()` — cost if wrong: deprecation warnings in examples when zod removes it.
Task 2: implementer DONE_WITH_CONCERNS (commit 17b1abf) under the pre-amendment brief; resuming implementer with amendment delta before review.
User request: one folder per component (component + test + stories + index.ts re-export); shared hooks flat. Plan + spec amended, briefs 2-9 regenerated (commit after ae091bd).
Task 2: fix round 0 (plan amendment applied by implementer: folder move, onSubmit wrap, KCD tests; commit 24e5491). Task reviewer dispatched on b13fbaf..24e5491.
Task 2: minor (deferred): useEzFormContext null guard needs a comment (RHF types return non-null but it is null outside provider).
Task 2: minor (deferred): z.string().email() deprecated in zod 4 — project-wide idiom sweep candidate (see ruling above).
Task 2: minor (deferred): resolver cast comment should say "remove when @hookform/resolvers threads schema generics".
Task 2: complete (commits b13fbaf..24e5491, review clean)
Task 3: implementer DONE (commit 8b0af18); reviewer dispatched on 24e5491..8b0af18.
User request: don't pass control explicitly — useController/useFormState read it from FormProvider context; useEzFormContext stays as a guard call only. Plan Tasks 3 + 5 amended, briefs regenerated; apply to Task 3 in its fix round.
Task 3: review — Important (plan-mandated): disabled merge clobbered by rest spread. Ruling: finding overstated (rest lacks the key when consumer omits disabled) but explicit destructure is cleaner and closes disabled={undefined} edge — plan amended, fix in round 1 — cost if wrong: none.
Task 3: minor (deferred): no default id on TextField; relies on MUI auto id (SSR hydration note).
Task 3: fix round 1/5 (2 findings fixed by implementer; commits 8b0af18..9abbc94); scoped re-review dispatched.
Task 3: fix round 1/5 (2 addressed, 0 open; commits 8b0af18..9abbc94)
Task 3: complete (commits 24e5491..9abbc94, review clean)
User request: Fable agent reviews patterns of Tasks 1-3 + plan for 5-9 (running, read-only, report → fable-pattern-review.md); then a Fable implementer carries Tasks 5-9 (same agent resumed per task, task reviews between). Task 4 continues on sonnet.
Task 4: implementer DONE (commit b6d36b3); reviewer dispatched on 9abbc94..b6d36b3. Storybook dev server started in background (task beu7hbfp0, log .superpowers/sdd/.../storybook.log) — LEAVE RUNNING.
Task 4: complete (commits 9abbc94..b6d36b3, review clean). Storybook running on :6006.
Fable pattern review complete: fable-pattern-review.md (3 Must, 5 Should, 8 Nice).
Ruling: accept all 16 recommendations — pre-release, user asked for best patterns, every finding source-verified — cost if wrong: type-level API churn on Form (FormProps<S> → <TIn,TOut>), zod 3 consumers excluded.
Ruling (supersedes earlier): zod 4 idioms everywhere (z.email({error}), error: not message:, refine not literal(true), no `as never`) — cost if wrong: none.
Task 4b (new): Fable implementer applies review to existing code/config/tests AND amends plan Tasks 5-9 per recs 2,7,10,14,15,16; regenerate briefs after. Then same agent carries Tasks 5-9 with task reviews between.
User request: hookform-style rule props on every field (required/min/max/minLength/maxLength/pattern/validate as individual props; bare value → default message from label; {value,message} overrides). Design in task-4c-design.md (composite resolver reading _f rules from options.fields; verified vs RHF 7.87 source). Task 4c to be added to plan by the Fable implementer after 4b review.
User request: SubmitButton with disabled + loading spinner (review #10) and fields disabled while submitting (Form-level disabled || isSubmitting) — sent to Fable implementer mid-4b; NOTE: implementer probe shows form-disabled fields ARE excluded from payload via _names.disabled; pending-submit disable is safe because payload is captured first.
Ruling: form-level `validate` option rejected as zod driver (errors land at errors.root.<key>, stale keys never cleared) — composite resolver instead — cost if wrong: ~60 lines we maintain that mirror hookform's validateField.
Task 4b: implementer DONE_WITH_CONCERNS (5 commits a4c499b..4f0b2ca); reviewer dispatched on b6d36b3..HEAD. Ruling: accept concern-1 correction (form-disabled excluded from payload; SubmitButton also disabled on formState.disabled) and mergeSlotProps from '@mui/material/utils' — cost if wrong: none.
User decision: keep useEzField (becomes the rules-normalization seam in Task 4c).
Task 4b: minor (deferred): Global Constraints bullet on disabled/payload is one dense sentence — split when next touched.
Task 4b: minor (deferred): plan Task 5 progressbar assertions sit outside waitFor (correct, readability only).
Task 4b: complete (commits b6d36b3..4f0b2ca, review clean)
Task 4c: dispatching Fable implementer (resume of 4b agent) with task-4c-design.md.
Task 4c: implementer DONE_WITH_CONCERNS (commits 8f6fa75, f5bfc4d); reviewer dispatched on 4f0b2ca..HEAD.
Ruling: `required` on fields is rule-driven only (no asterisk-without-validation path) — matches owner's ask; consumers needing asterisk-only can be served later by a separate prop — cost if wrong: small additive prop later.
Ruling: non-numeric min/max compare as strings (documented); design note corrected re payload stripping.
Task 4c: review — 2 Important (pattern/length string guards inconsistent; required normalization unreadable). Minors deferred: rules run on disabled fields at submit (spec note); validateRules ignores _f.mount; outOfRange String(value) on objects; normalizeRules unmemoized (intentional).
Task 4c: fix round 1/5 dispatched (2 Important + one-line mount guard + spec note).
Task 4c: fix round 1/5 (2 Important + 2 minors fixed by implementer; commit 3b364a8); scoped re-review dispatched.
Task 4c: fix round 1/5 (4 addressed, 0 open; commits f5bfc4d..3b364a8)
Task 4c: complete (commits 4f0b2ca..3b364a8, review clean)
Task 5: Fable implementer dispatched (resume), BASE 3b364a8.
Task 5: implementer DONE (commit 7f4987d); reviewer dispatched on 3b364a8..7f4987d.
Task 5: complete (commits 3b364a8..7f4987d, review clean)
Task 6: Fable implementer dispatched (resume), BASE 7f4987d.
Task 6: implementer DONE (commit d2fd809); reviewer dispatched on 7f4987d..d2fd809.
Task 6: complete (commits 7f4987d..d2fd809, review clean)
Task 7: Fable implementer dispatched (resume), BASE d2fd809.
Task 7: implementer DONE (commit 035f9cb); reviewer dispatched on d2fd809..035f9cb.
Task 7: review — Important: validate rule dead for unchecked checkbox (ezResolver isEmpty short-circuit includes false). Ruling: load-bearing (Switch reuses); fix in round 1 by matching hookform: required fails on empty-or-false; min/max/length/pattern skipped on empty; validate always runs — cost if wrong: validate now sees empty strings too (hookform-consistent).
Task 7: minor (deferred): aria-invalid omitted rather than "false" (TextField emits "false"); handler-composition duplication watched at third field.
Task 7: fix round 1/5 dispatched.
Task 7: fix round 1/5 (implementer fixed; commit c150c6d); scoped re-review dispatched.
Task 7: fix round 1/5 (2 addressed, 0 open; commits 035f9cb..c150c6d)
Task 7: complete (commits d2fd809..c150c6d, review clean)
Task 8: Fable implementer dispatched (resume), BASE c150c6d.
User request: jest-axe accessibility assertions in tests → Task 8b (design: task-8b-design.md), dispatch after Task 8 review. Ruling: jest-axe@11 over vitest-axe (stale) — cost if wrong: swap one import.
Task 8: implementer DONE (commit 2a8c6eb); reviewer dispatched on c150c6d..2a8c6eb.
Task 8: complete (commits c150c6d..2a8c6eb, review clean)
Ruling: Checkbox/Switch are identical modulo the MUI control → extract an internal `BooleanFieldControl` in Task 9 (thin Checkbox/Switch, no public API change) — cost if wrong: one internal indirection.
Task 8b: Fable implementer dispatched (resume) with task-8b-design.md, BASE 2a8c6eb.
User request: also add @storybook/addon-a11y (folded into Task 8b); dev server restart needed afterwards for the panel to appear.
User request: after Task 9 + final review, STOP with a handoff summary (user will /clear). Next milestone: RadioGroup, Autocomplete, NumberField, then more (saved to memory).
Task 8b: implementer DONE_WITH_CONCERNS (commit d676685); reviewer dispatched on 2a8c6eb..d676685. Storybook restarted (task ba4kd2qze) for addon-a11y.
Ruling: hand-written src/test/jest-axe.d.ts instead of @types/jest-axe (its jest reference shadows vitest's expect) — cost if wrong: maintain ~10 lines of types.
Ruling: Select open-listbox axe test scoped to the listbox (page-level `region` rule on a portal is not a component defect) — cost if wrong: none.
Task 8b: minor (deferred → Task 9): @storybook/addon-a11y pinned exact "10.5.10" vs siblings "^10.5.10"; normalize to caret.
Task 8b: complete (commits 2a8c6eb..d676685, review clean)
Task 9: Fable implementer dispatched (resume), BASE d676685. Scope additions: BooleanFieldControl extraction (ruling after Task 8), addon-a11y caret, deferred-minor sweep.
Task 9: implementer DONE_WITH_CONCERNS (commits baaab05, d4e16a2); reviewer dispatched on d676685..HEAD.
Ruling: BooleanFieldControl at ~60 code lines accepted; per-module d.ts in tarball accepted for v0.1 (rollup of types is a follow-up); no repository field until a remote exists — cost if wrong: none.
Task 9: minor (deferred): ValidationErrors story identical to Basic except docs text — add a play() that clicks submit.
Task 9: minor (deferred): README components table separator width; report overstated "stories passed".
Task 9: complete (commits d676685..d4e16a2, review clean)
ALL TASKS COMPLETE. Final whole-branch review dispatched (Fable) on c85f206..d4e16a2.
Final review: With fixes — 0 Critical, 3 Important, 11 Minor (final-review.md).
Ruling (overturns earlier min/max ruling): mirror hookform — numeric compare when value numeric; string bound → Date compare (skip on Invalid Date); else no error — cost if wrong: none, hookform-consistent.
Ruling: consumer disabled merges with `||` everywhere via one `mergeDisabled` helper (form lock wins) — cost if wrong: a consumer cannot force a field enabled inside a disabled form (correct behavior).
Ruling: add "prepack": "pnpm build"; npm name ez-form is free (registry 404) — keep bare name.
Fix wave scope: Important 1-3 + minors 4,5,6,7,10(raise RHF floor to ^7.87.0),12,13,14. Deferred to v2: 8 (form ref), 9 (live region), 11 (rollupTypes).
Fix wave dispatched to Fable implementer, BASE d4e16a2.
Fix wave: implementer DONE (f49a6e6..f41a157); scoped re-review dispatched.
Fix wave: re-review clean (all 11 addressed; commits d4e16a2..f41a157). Final review complete. Reviews preserved under docs/superpowers/reviews. Workspace deleted.
