# ez-form v3 — SDD ledger

Preserved from the (git-ignored) SDD workspace at the end of the run. Plan: docs/superpowers/plans/2026-09-01-ez-form-v3.md; spec: docs/superpowers/specs/2026-09-01-ez-form-v3-design.md.

# SDD ledger — plan: docs/superpowers/plans/2026-09-01-ez-form-v3.md
Spec: docs/superpowers/specs/2026-09-01-ez-form-v3-design.md (read; binding authority)
Branch: feat/v1 (the project's working/default branch; v1, v2, v2.1 all landed here — Steve's standing choice)
Execution: Task 1 in the main checkout; Tasks 2–8 in parallel worktrees (Agent isolation=worktree), cherry-picked onto feat/v1; Task 9 integration.

## Pre-flight scan
| Pair / task | Produces vs consumes | Finding |
|---|---|---|
| T1 ↔ T6 | T1 `withPickers` + deps; T6 imports `../../test/pickers` | consistent |
| T1 ↔ T2–T8 | T1 lockfile/devDeps; worktrees need `pnpm install` | dispatches say so |
| T2–T8 ↔ `src/index.ts`, README table | each appends one line/row | adjacent-line merge conflicts expected; Ruling: keep all lines on cherry-pick, T9 fixes order — cost if wrong: none (T9 re-orders) |
| T6 ↔ spec | plan `invalidDate` → "<label> is invalid."; spec says "is not a valid date." | Ruling: plan wins (same code covers unparsable times); T9 updates the spec — cost if wrong: one string |
| T5 self | `onBlur?: (event: React.FocusEvent<HTMLInputElement>)` with no React namespace import | Ruling: implementer imports `type FocusEvent` from react — cost if wrong: typecheck fails, caught immediately |
| T2 self | tests use `fireEvent.change` on range input; plan carries the valueAsNumber fallback | consistent |
| T3 self | `role="radiogroup"` + inputA11y on Rating root; contract getControl = radiogroup | consistent; axe fallback in plan |
| T7 self | `OtpFieldProps` omits `length` then re-adds optional; Control requires it (default 6 applied in OtpField) | consistent |
| T8 self | `FileFieldValue` in onChange; chip delete via `deleteIcon` element | consistent |
| T9 ↔ all | export order list matches every task's export line | consistent |

Task 1: implemented (commit 14bb8ed, DONE, 157/157) — review dispatched
Task 1: minor (deferred): README mentions MoneyField/OtpField/"Date pickers" section before those land (plan-mandated, resolved by T6/T7/T9)
Task 1: complete (commits a9473b0..14bb8ed, review clean)
Tasks 2–8: implementers dispatched in parallel worktrees off 14bb8ed (T2 Slider, T3 Rating, T4 ToggleButtonGroup, T5 CheckboxGroup: sonnet; T6 pickers, T7 OtpField: opus; T8 FileField: sonnet)
Task 2: implemented in worktree (commit a0bff09, DONE_WITH_CONCERNS: added disabled wiring to MuiSlider — Ruling: accepted, MUI Slider ignores FormControl context so the plan omitted a real requirement; cost if wrong: none, test covers it) — review dispatched
Ruling: worktrees for T2–T6, T8 were cut from 28cc870 (session-start snapshot), not 14bb8ed; T7 from 14bb8ed. Review packages use each worktree's merge-base; T6 told to merge 14bb8ed first. Cost if wrong: a cherry-pick conflict, visible immediately.
Task 7: implemented in worktree (commit 35c5b08, DONE, 11/11; group-scoped blur applied; contract onChange→onValueChange mapping) — review dispatched
Task 2: minor (deferred): src/index.ts export appended at end (T9 orders)
Task 2: complete (worktree commit a0bff09 cherry-picked onto feat/v1 as 57cd57b, review clean)
Task 4: implemented in worktree (commit a596522, DONE_WITH_CONCERNS: fieldset and inner group both role=group named by the legend; test getControl picks the non-fieldset one, component unchanged) — review dispatched
Task 8: implemented in worktree (commit 2db3961, DONE_WITH_CONCERNS: Button role={undefined} and CloseIcon aria-hidden={undefined} needed for axe — Ruling: accepted as real a11y fixes, cost if wrong: none) — review dispatched
Task 7: complete (worktree commit 35c5b08 cherry-picked onto feat/v1 as a1a5714, review clean; README conflict resolved keeping T1's wording)
Task 7: minor (deferred): Incomplete story play fn unverified in a browser (T9 build-storybook covers compile; spot-check in Storybook)
Ruling: the "merge 14bb8ed" message went to the CheckboxGroup agent (T5), not T6 — dispatch-order mixup; harmless (fast-forward adds deps). T6 rebased onto feat/v1 on its own.
Task 6: implemented in worktree (commit 6f64db6, DONE, 194/194; onChange ctx typed as MUI PickerChangeHandlerContext; hidden input is aria-hidden so tests query input[name]) — review dispatched
Task 5: implemented in worktree (commit 51d79ee on top of 14bb8ed, DONE, 11/11; FocusEvent import + Checkbox onBlur event type fixed; fieldset/group name collision handled in test as in T4) — review dispatched
Task 4: Ruling: reviewer's Important (drop aria-labelledby from the inner role=group to avoid two same-named groups) conflicts with the spec, which mandates aria-labelledby + inputA11y on the inner group so the element carrying aria-invalid/aria-describedby has a name; an unnamed group carrying those attrs is worse, and RadioGroup already nests fieldset+radiogroup the same way. Code stands; parked. Cost if wrong: a screen reader announces the group name twice.
Task 4: minor (deferred): one-line note near FieldFrame labelAs doc about role=group inner controls colliding with the fieldset in role+name queries (T9)
Task 4: complete (worktree commit a596522 cherry-picked onto feat/v1 as 33da6d7, 1 parked)
Task 8: minor (deferred): buttonProps type does not Omit 'role' though role={undefined} always wins (T9 or final review)
Task 8: complete (worktree commit 2db3961 cherry-picked onto feat/v1 as 4e00fc9, review clean)
Task 5: minor (deferred): duplicate option values would break includes-based toggling (shared with RadioGroup; not in scope)
Task 5: complete (worktree commit 51d79ee cherry-picked onto feat/v1 as 0f75a11, review clean)
Task 6: review — 1 Important (plan-mandated): usePickerField's shallow mergeSlotProps lets consumer slotProps.textField.slotProps clobber formHelperText.role. Ruling: the spec's intent is that the a11y role always applies (TextField merges the formHelperText slot itself; the picker has one more nesting level the plan missed) — fix with a nested merge. Cost if wrong: none. Also fold in: consumer slotProps.textField.onBlur must run after field.onBlur; add a picker-error-clearing test.
Task 6: minor (deferred): hidden-input test helper takes the field name, reads like a label; `document.querySelector(...)!` in tests
Task 3: implemented in worktree (commit 78707f6, DONE_WITH_CONCERNS: added disabled wiring to MuiRating (same MUI gap as Slider — Ruling: accepted); test-only jsdom workarounds for Rating hover math and clear-on-reclick) — review dispatched
Task 3: Ruling: MUI Rating (like Slider) ignores FormControl's disabled context → disabled wired via mergeDisabled on the control; jsdom-only test scaffolding (mousemove suppression, user.pointer with coords) accepted — the tests still drive MUI's real click/clear paths. Cost if wrong: none.
Task 3: complete (worktree commit 78707f6 cherry-picked onto feat/v1 as b989424, review clean)
Task 6: fix round 1/5 (3 addressed, 0 open; commits 6f64db6..1e66ccd)
Task 6: complete (worktree commits 6f64db6,1e66ccd cherry-picked onto feat/v1 ending at 12da57a, review clean)
Task 9: implementer dispatched in main checkout (BASE 12da57a); rulings folded in: FieldFrame labelAs doc note (T4 minor), FileField buttonProps Omit 'role' (T8 minor), .gitignore .claude/worktrees/
Task 9: complete (commits 12da57a..3c411c8, review clean). Final whole-branch review dispatched (opus) over a9473b0..3c411c8.
Final review (a9473b0..3c411c8): 1 Critical (Slider range min/max inert), 5 Important, 6 Minor; "With fixes". Rulings (see final-review-findings.md): #1 fix locally via validate entries; #2 Ruling: drop `required` from Slider (HTML gives required no meaning on range), contract gains errorProps/errorMessage to keep a11y error coverage — cost if wrong: re-adding a prop; #3 aria-required on group fields + required on FileField input + contract assertion; #4 built-ins after consumer, reserved keys documented; #5 FileField onChange fires on chip delete with (event, value) — cost if wrong: signature churn; #6 README rules row; minors 8, 9, 11, 12, R6 fixed; 7/10 and all parked items stay. ONE fix wave dispatched (opus).
Final fix wave: commit 6c1ff4d (DONE_WITH_CONCERNS, 261/261, build green). Ruling: `aria-required` is not an allowed attribute on role="group" (axe aria-allowed-attr), so it lands on Rating (radiogroup) and FileField's input only; ToggleButtonGroup, CheckboxGroup, and the three pickers keep no aria-required, with a `requiredNotAnnounced` contract opt-out and a source comment at each site. Not restructuring group roles. Cost if wrong: required-ness of those five fields is conveyed visually (asterisk) and by validation only. Also accepted: normalized `required` boolean instead of `required || undefined`. Scoped re-review dispatched.
Final fix wave: scoped re-review clean (all 11 findings addressed; commit 3c411c8..6c1ff4d). v3 complete at 6c1ff4d.

## Final whole-branch review findings and rulings

# Final whole-branch review — findings to fix (one wave)

Base for this wave: 3c411c8 on feat/v1 (main checkout). Rulings by the controller are marked ▶.

## Critical
1. `src/fields/Slider/Slider.tsx` — `min`/`max` rules are silently inert on a range value: `ezResolver`'s `outOfRange` returns false for arrays, so `defaultValues={{ hours: [-5, 99] }}` with `min={0} max={24}` submits without error, contradicting the spec ("a defaultValues / setValue outside them must still fail validation").
   ▶ Fix locally in Slider (do not change the shared resolver): keep `bound()` for the DOM bounds; stop passing `min`/`max` into `rules`; add `validate` entries that handle both shapes — a number compares directly, an array checks `Math.min(...v) >= minBound` / `Math.max(...v) <= maxBound` — returning the rule's message (`{ value, message }` form) or the default `` `${label} must be at least ${value}.` `` / `must be at most`. Reuse `defaultMessages.min/max` from `src/rules.ts` and `FALLBACK_LABEL` for a non-string label. Spread the consumer's `validate` (function or record) first, then the built-ins (see #4 for the ordering rule). Add a range out-of-bounds test beside the scalar one in `Slider.test.tsx`.

## Important
2. `Slider.tsx` — a `required` Slider with no default renders a thumb at min/0 while the form value stays `undefined`, so `required` fails invisibly.
   ▶ Ruling: HTML itself gives `required` no meaning on a range input; drop `required` from `SliderProps` (the rules pick becomes `validate` only, plus the min/max built-ins from #1). Remove the `required` story/test if any, update the README component row for Slider (no `required`). For `describeFieldContract`: add an optional `errorProps?: FieldContractProps` + `errorMessage?: string` pair (defaults `{ required: true }` and `` `${label} is required.` ``) used by the helper-text/alert case and the axe case, so Slider keeps full a11y-error coverage via e.g. `errorProps: { max: 0 }`, `errorMessage: 'Volume must be at most 0.'` with a default value of 10. The "required" wording in those two test names may become "error".
3. `aria-required` inconsistency: `RadioGroup` sets `aria-required` on its group; `Slider`, `Rating`, `ToggleButtonGroup`, `CheckboxGroup` don't, and `FileField`'s hidden input has neither `required` nor `aria-required`.
   ▶ Fix: set `aria-required={required || undefined}` on the control in Rating, ToggleButtonGroup, CheckboxGroup (Slider has no required after #2); set `required={f.required}` on FileField's hidden `<input>` (if the browser's native required-validation would interfere, the form is `noValidate`, so it won't). Add one contract assertion: in the default (required) error case, `expect(getControl()).toBeRequired()` before submit; skipped when `errorProps` is customized.
4. Built-in `validate` keys are spread in opposite orders: `OtpField` `{ complete, ...consumer }` (consumer can delete the built-in), pickers `{ ...consumer, picker }`.
   ▶ Fix: OtpField matches the pickers (`{ ...consumer, complete }`), and Slider's new entries follow the same rule. Add one sentence to the README "Validation rules" section: `validate` record keys `complete` (OtpField), `picker` (date pickers), `min`/`max` (Slider) are reserved for the field's built-in checks.
5. `src/fields/FileField/FileField.tsx` — chip delete updates form state but never calls the consumer `onChange`.
   ▶ Fix: change `onChange` to `(event: React.SyntheticEvent, value: FileFieldValue) => void`, called after the form's handler on both pick and chip delete (the chip's delete click event). Update the doc comment, the README row, and extend the multiple+delete test to assert the consumer `onChange` receives the reduced array.
6. `README.md` rules table — the `min`/`max` row omits `Slider`. ▶ Add it (both number and range values).

## Minor (fix; all small)
8. `src/fields/Rating/Rating.tsx` — the `useCallback` keyed on `field.ref` never memoizes. ▶ Drop the `useCallback`; keep the callback ref inline with the same comment.
9. `src/fields/CheckboxGroup/CheckboxGroup.tsx` — `e as unknown as FocusEvent<HTMLInputElement>` lies about the element. ▶ Type `CheckboxGroupProps['onBlur']` as `(event: FocusEvent<HTMLElement>) => void` and drop the double cast.
11. `src/fields/OtpField/OtpFieldControl.tsx` — blur guard uses `parentElement`. ▶ Use `event.currentTarget.closest('[role="group"]')`.
12. README install section — ▶ add one sentence: `@mui/x-date-pickers` is a required peer even if you use no picker (single entry point).
R6. Three test files repeat `.find(el => el.tagName !== 'FIELDSET')`. ▶ Add `getInnerGroup(name)` to `src/test/` (returns the non-fieldset `role="group"` named `name`) and use it in ToggleButtonGroup, CheckboxGroup tests (and any picker test that does the same).

## Not in this wave (stay as ruled)
7 (Slider Required story — moot after #2), 10 (option-level `disabled: false` matches RadioGroup), T4 parked nested-group naming, T5 duplicate option values, T6 test helper naming, T7 story spot-check.

## Verification
`pnpm format && pnpm typecheck && pnpm test && pnpm build`. Commit once (or a few logical commits), trailers as usual.
