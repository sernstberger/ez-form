# Housekeeping wave 2 — SDD ledger

Plan: docs/superpowers/plans/2026-09-02-housekeeping-wave-2.md (commit a934aa0). No spec;
each task's authority is its GitHub issue plus the rulings below. Base 46a3cd3. Finalized
per-task plans were posted as comments on the issues.

Execution: six worktrees in parallel — `hk2/wizard` (T1 #40), `hk2/dialog` (T2 #41),
`hk2/autocomplete` (T3 #29), `hk2/number` (T4 #24 → T5 #26 spike on a throwaway branch),
`hk2/otp` (T6 #30, browser verification only), `hk2/release` (T7 #31 prep + issue
template). Per task: implementer → spec + quality review → merge into `main`; then one
final whole-branch review, one fix wave, one scoped re-review.

## Rulings

- **#41** — `{ variant: 'contained', ...slotProps?.confirm }` IS the v4 slot-default
  pattern (WizardNav, SubmitButton, ClearButton do the same; a theme overrides via
  `useDefaultProps` → `slotProps`). The wave 1 final-review finding was a false positive;
  only the no-theme fallback test was missing. The no-styling rule reads: no
  *un-overridable* literal. Costs nothing.
- **#24** — vague ticket turned into four acceptance bullets: paste yields the value
  immediately and regroups on blur; leading minus survives; fr-FR (U+202F) and de-CH
  (U+2019) separators group and parse; IME `isComposing` skips the rewrite. Costs rework
  if "apply on blur" meant something else.
- **#26** — spike only; deliverable is a comment. Recommendation (adopt `TextField` via
  `slotProps.htmlInput`, branch `spike/number-textfield` @ ab4470f) is Steve's decision;
  issue left open, labelled needs-design. Costs nothing.
- **#30** — verified with Playwright against Storybook on port 6017; closed with evidence,
  no code. Costs nothing.
- **#31** — prep only: CHANGELOG, version 0.2.0, pack check, issue template. `pnpm
  publish`, deleting `origin/feat/v1`, and subpath exports (now #43) are Steve's. Costs
  nothing.
- **Final-review triage** — all five findings fixed in one wave (peer changes and wave-2
  entries in CHANGELOG, Unreleased → #43, duplicate minus test deleted, CHANGELOG shipped
  in `files`); #42 widened from en-US to every non-space-group locale.

## Findings worth knowing

- **Three tickets had already-correct premises**: #29 (default `isOptionEqualToValue` by
  `getOptionValue` existed), #41 (pattern already matched), and, from wave 1, #35. All
  three closed with tests instead of code. Tickets should state a repro or "suspected".
- **Real NumberField bug under #24**: `groupWhileTyping` matched the locale separator by
  exact character, so pasted `1 234 567` (ASCII spaces, fr-FR) or `1'234'567` (ASCII
  apostrophe, de-CH) broke live grouping. `makeIsGroupChar` now mirrors Base UI's
  `parseNumber` equivalences (`\p{Zs}`, `'`/`’`, literal), so grouper and parser cannot
  disagree. Paste, leading minus, and the IME guard already worked; tests kept.
- **IME test needs a real `InputEvent`**: `fireEvent.change` carries no `isComposing`
  and bypasses the guard entirely; the test constructs `new InputEvent(..., { isComposing:
  true })` and pairs it with a non-composing edit so it cannot pass vacuously.
- **Storybook script hardcodes `-p 6006 --exact-port`**; a second instance needs
  `pnpm exec storybook dev -p <port> --ci`.
- **Peer changes since 0.1.0** were undocumented until the final review: zod `^4.0.0`
  only, plus new required peers `@base-ui/react` and `@mui/x-date-pickers`. 0.1.0 was
  never published, so nobody is broken, but the changelog now says so.
- **Focus effect** in `Wizard` now clears `focusTarget` on any `current.id` that is not
  the target. React batching means an intermediate step in the same commit cannot
  suppress focus; the reviewer traced it and the existing tests are unmodified.

## Verification

Gate on `main`: `pnpm typecheck` clean; 379/379 tests after the merges, 378/378 after
the fix wave (one duplicate test deleted). `pnpm pack --dry-run` → 7 files (dist ×3,
CHANGELOG, LICENSE, README, package.json), no stories/tests/.superpowers leakage.

Scoped re-review of the fix wave (0ce8a40..ea63577): all five findings addressed, no new
breakage. Wave closes at ea63577 plus this ledger commit. Worktrees removed; branches
`hk2/*` and `spike/number-textfield` retained. Follow-ups: #42, #43; #26 awaiting a
decision.
