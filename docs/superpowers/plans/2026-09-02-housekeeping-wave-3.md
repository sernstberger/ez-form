# Housekeeping wave 3 — NumberField on MUI TextField, whitespace quirk

Spec: none; authority is each GitHub issue plus the rulings here and `docs/PHILOSOPHY.md`
(rules 1, 2, 3 and the "a component ships when" checklist are binding). Base: 363cd30.

## Global Constraints

- `docs/PHILOSOPHY.md` rule 2: no `sx`, ripple props, or theme-unreachable literals in
  `src/`. Defaults via `useDefaultProps` + `styled` slots + `<name>Classes` +
  `src/theme/augmentation.ts`. A slot default spread under `slotProps` is the pattern.
- Rule 1: extend MUI / Base UI types; never re-implement. Audit before changing.
- Tests: vitest + Testing Library + jest-axe, pristine output. `pnpm typecheck && pnpm test`
  before every commit; `pnpm format`.
- Commit per task, conventional prefix, `Closes #N`.

## Tracks

| Track | Worktree | Task | Issue |
|---|---|---|---|
| A number | `.worktrees/hk3-number` | 1 | #26 |
| B group | `.worktrees/hk3-group` | 2 | #42 |

---

### Task 1: NumberFieldControl renders through MUI TextField (#26)

Decision (Steve, Sept 2): adopt the TextField wrapper. Spike branch
`spike/number-textfield` @ ab4470f proves the approach: keep the small wrapper that Base UI's
`NumberField.Input` `render` targets, but have it render `<TextField slotProps={{ htmlInput:
{...basePropsFromBaseUI} }} id={rest.id} />` instead of hand-composing `FormControl` +
`InputLabel` + `OutlinedInput` + `FormHelperText` + the `SSRInitialFilled` hack. `slots.input`
/ `inputComponent` is a documented dead end (two owners of one controlled input); do not
retry it. Forwarding `id` to `TextField` itself is the one-line a11y fix the spike found.

Files: `src/fields/NumberField/NumberFieldControl.tsx`, `NumberField.tsx` if its props
change, `NumberField.test.tsx`, `NumberField.stories.tsx`, `src/theme/augmentation.ts`,
`src/index.ts` (export `numberFieldClasses`), README NumberField section.

Requirements:
1. Start from the spike: `git diff 0fd8be4 ab4470f` shows the working change; port it onto
   this branch by hand (do not merge the spike; it has a `.bak` file and comment trail).
   Drop `SSRInitialFilled` if `TextField` handles shrink on mount with a value (the spike
   verified `data-shrink="true"`); keep it only if a test proves it is still needed.
2. Stepper buttons: today's stacked-arrow layout is produced with `sx` in `src/` (a
   pre-existing rule-2 violation). Re-create it the sanctioned way: register the control as
   `EzNumberField` with `useDefaultProps`, `styled` slots (`Root` = the TextField,
   `Steppers` = the adornment column, `Increment`, `Decrement`), `numberFieldClasses`
   via `generateUtilityClasses('EzNumberField', ['root', 'steppers', 'increment',
   'decrement'])`, and the `Components` / `ComponentsPropsList` /
   `ComponentNameToClassKey` entries in `src/theme/augmentation.ts`. The stacked layout
   (column flex, divider border, shared radius) lives in the `Steppers` slot's default
   style block so `theme.components.EzNumberField.styleOverrides.steppers` can replace it.
   Zero `sx` remains in the file.
3. Everything the existing 56 NumberField tests cover must pass unmodified (a11y name via
   label, `inputRef` reaching the real input, `groupWhileTyping` on change, focus class,
   shrink, increment/decrement + disabled-at-bound, axe). Add: a theme override test
   (`EzNumberField.styleOverrides.steppers` applies a class-visible style, and
   `defaultProps` reaches the control) and an SSR-shrink test if `SSRInitialFilled` is
   removed (render with a value, assert `data-shrink="true"` without effects running —
   `renderToString` is fine).
4. Stories: no change in story files is expected; run `pnpm build-storybook` to confirm.
   Then compare visually: start Storybook on port 6019 (`pnpm exec storybook dev -p 6019
   --ci`), open the NumberField default story with the Playwright MCP tools, screenshot,
   Read it, and confirm the stacked arrows still render; kill it after.
5. README NumberField section: one sentence that it renders through MUI `TextField` and
   is themeable under `EzNumberField`; add `EzNumberField` to the Theming section's key
   list if one exists.
6. Commit: `feat(NumberField): render through MUI TextField; EzNumberField theme slots
   for the steppers` with `Closes #26`.

### Task 2: NumberField — stray ASCII space under non-space-group locales (#42)

Issue #42: `isAllowedChar` in `groupWhileTyping.ts` keeps a trailing `|| /\s/.test(char)`
after `isGroupChar(char)`, so under any locale whose group separator is not a Unicode
space (en-US comma, de-DE dot) a typed or pasted ASCII space is admitted but never
stripped: `groupWhileTyping('1 234', 5)` → `'1 ,234'`. Value parses; blur reformats.

Files: `src/fields/NumberField/groupWhileTyping.ts`, `groupWhileTyping.test.ts`.

Requirements:
1. TDD: failing tests first for en-US and de-DE (`'1 234'` with caret after the 4 →
   `'1,234'` / `'1.234'` with the caret adjusted), plus a guard that fr-FR (space group)
   still accepts a typed ASCII space as a group char.
2. Fix: only the locale's group-char equivalence class is allowed; remove the whitespace
   fallback. Confirm the caret math stays in range (the existing exhaustive probe idea from
   the wave 2 review is a good ad-hoc check; do not commit a 58k-case test).
3. Commit: `fix(NumberField): drop stray whitespace under non-space-group locales` with
   `Closes #42`.
