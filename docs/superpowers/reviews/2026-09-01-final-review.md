# ez-form v1 — final whole-branch review

Reviewer: Fable (read-only). Date: 2026-09-01.
Range: c85f206..d4e16a2 (28 commits, branch `feat/v1`). Read in full: `src/`, `.storybook/`, `package.json`, `vite.config.ts`, `tsconfig*.json`, `README.md`, `dist/**/*.d.ts`, the spec, the plan's Global Constraints, the pattern review, and the triage list. Library claims verified against the installed react-hook-form 7.87.0, @hookform/resolvers 5.9.1, @mui/material 9.4.0, zod 4.5.4. I ran `pnpm typecheck` and `pnpm test` once each with a throwaway probe under `src/` (type inference for plain / `z.coerce` / `.transform()` schemas, disabled propagation to every field, a second submit after a pending one, `mode="onChange"` with rule props); all 76 passed (70 + 6 probe). The probe is deleted and `git status --porcelain` is empty. Reviewed in one pass.

## Strengths

- **The six prop types read as one API.** Every field omits exactly what the binding owns (`name`, `value`/`checked`, `error`, the ref prop, `required`) and merges everything else with hookform's handler first (`TextField.tsx:56-63`, `BooleanFieldControl.tsx:69-76`). `helperText` is replaced by the error message in all four fields; `required` is rule-driven everywhere and drives the asterisk everywhere. MUI 9's Checkbox/Switch have no `inputRef`/`error` props, so the shorter boolean omission list is complete, not lax.
- **`FormProps<TIn, TOut>` infers cleanly.** Probe: `z.object` → `onSubmit` sees output, `defaultValues` accepts input; `z.coerce.number()`/`z.coerce.date()` → `defaultValues={{ age: '', when: '' }}` accepted and `onSubmit` sees `number`/`Date`; `.transform()` → `string[]` in `onSubmit` and `@ts-expect-error` fires when `defaultValues` is given the output shape. No `as unknown` anywhere in `src/` or `dist/`.
- **`ezResolver` is a faithful, small mirror of `validateField`.** I read hookform's `validateField` (index.esm.mjs:841-990) side by side: `required` on empty-or-`false`, value rules gated on emptiness, `minLength`/`maxLength`/`pattern` string-only for non-field-array fields, `validate` always runs, first failure wins, `lastIndex` reset. `options.fields` is read by path with `get` exactly as `getResolverOptions` nests it with `set`; unmounted fields are skipped as hookform does (`!mount`). The resolver-level test file (`ezResolver.test.ts`, 21 cases) is the best test file on the branch.
- **The disabled story is correct for a non-obvious reason.** In 7.87 `useController` stores a focus/select *proxy* as `_f.ref` (index.esm.mjs, `useController` `ref` callback), so hookform's `_disableForm` (`ref.disabled = …`) never touches the DOM for controlled fields; the explicit `disabled` merge in every component is what actually disables them. The plan's "isolate disabled merge" ruling turned out to be load-bearing. `register` → `_setDisabledField` (3082-3092) and `handleSubmit` (3228-3232) confirm ruling 60 exactly: form-disabled names are unset from the payload while disabled and restored on re-enable; my second-submit probe carried every value.
- **A11y is equivalent across the MUI-native and hand-wired fields.** TextField/Select: MUI's `useId`-based `id`, `${id}-helper-text` + `aria-describedby`, `aria-invalid` from `FormControl` (TextField.js:137,206,241; InputBase.js:522). Checkbox/Switch: `useId` helper-text id, `aria-describedby`/`aria-invalid` merged into `slotProps.input` with `mergeSlotProps` (which composes handlers and lets consumer keys win, verified in utils/mergeSlotProps.js), `required` on `FormControlLabel`. The `toHaveAccessibleDescription` assertions lock this in without ids.
- **Packaging is right for an ESM-only React lib.** `exports` with `types` first and `default`, `./package.json` exposed, `sideEffects: false`, `files: ["dist"]`, path-only MUI imports in `dist/index.js`, the externals predicate (nothing bundled: `dist/index.js` is 9 KB and imports only peers + `@hookform/resolvers/zod`), `tsconfig.build.json` excludes tests/stories/`src/test`, `@typescript/typescript6` is a devDependency only. `dist/index.d.ts` names exactly the public surface.
- **Tests follow the stated conventions.** `screen` everywhere, `userEvent.setup()` per test, `findBy*` for async, role queries with names, `restoreMocks` instead of manual restore, no `fireEvent`/`act`/test ids, one jest-axe test per component in its error state, the Select listbox axe test scoped correctly and its reason written down.
- **Docs are honest.** Comments explain *why* (the null-guard comment in `useEzFormContext.ts`, the `submitting` local-state comment in `Form.tsx`, the `get`-because-`set` comment in `ezResolver.ts`). The README's validation section matches the resolver's behaviour line for line.

## Issues

### Critical (Must Fix)

None.

### Important (Should Fix)

1. **`disabled={false}` means different things on fields and on `SubmitButton`.**
   `src/fields/TextField/TextField.tsx:64` and `src/fields/BooleanFieldControl.tsx:62` merge with `disabled ?? fieldDisabled`; `src/SubmitButton/SubmitButton.tsx:20` merges with `disabled || formDisabled`. Under `<Form disabled>` (or during a pending submit) `<TextField disabled={false}>` and `<Checkbox disabled={false}>` stay **enabled** while `<SubmitButton disabled={false}>` is **disabled**. The common way to hit this is `disabled={someFlag}` where the flag is `false`: that field keeps accepting input while the rest of the form is locked during `onSubmit`. hookform's own `_disableForm` ORs (`_f.disabled || disabled`), and the spec's "Form disables every field while onSubmit is pending" is stated unconditionally.
   Fix: `disabled={disabled || fieldDisabled}` in both field files (the boolean `??` was chosen to avoid `disabled={undefined}` clobbering; `||` closes that too). Add one Form-level test: all five components rendered with `disabled={false}` under `<Form disabled>` are disabled. Update the spec's `disabled` pattern bullet (line 117) to say form-level disabling wins over a consumer `disabled`.

2. **Publishing from a fresh clone ships no `dist`.**
   `package.json` has `files: ["dist"]`, `dist` is gitignored, and there is no `prepack`/`prepublishOnly`. `pnpm publish` (or `pnpm pack` in CI) after `git clone` produces a tarball whose `main`/`types` point at files that do not exist; that is the "embarrassing first `npm install`". The plan's Task 9 verified `pnpm pack` only after a manual `pnpm build`.
   Fix: `"prepack": "pnpm build"` (runs for both `pack` and `publish` under pnpm and npm). While there: confirm the bare name `ez-form` is free on npm before the first publish (I could not check offline); if it is taken, a scope (`@<owner>/ez-form`) is a one-line change now and a breaking rename later.

3. **`min`/`max` on non-numeric strings diverge from hookform and can replace zod's message with a false error.**
   `src/Form/ezResolver.ts:27-33` (`outOfRange`): when the value is not numeric it falls back to lexicographic string comparison against `String(bound)`. hookform (index.esm.mjs:908-940) does two different things: with a *numeric* bound and a non-numeric value it reports nothing (`+'abc'` is `NaN`, both comparisons false); with a *string* bound it compares as `Date`s (`new Date(value) < new Date(bound)`). Consequences today: `<TextField label="Age" type="number" max={99}>` with the text "abc" shows "Age must be at most 99." and, because a rule error replaces zod's, hides `z.coerce.number()`'s "expected number" message; `min="2020-01-01"` with the value "1/2/2021" is reported out of range ("1" < "2"). Ruling 68 calls this "documented", but the documentation is one clause in the plan (line 833: "else as strings (ISO dates work)"), not the README, and the doc comment on `validateRules` (line 36-40) still says it mirrors hookform.
   Fix (~8 lines): numeric value → numeric compare; else if the bound is a string → `Date` compare (skip when either side is `Invalid Date`); else no error. Add the three resolver cases above to `ezResolver.test.ts` and put one sentence in the README rules table ("`min`/`max`: numbers, or date strings").

### Minor (Nice to Have)

4. **README component table is out of step with the rules section.** `README.md:53-56`: the Checkbox/Switch rows list `required?` but not `validate`; the TextField/Select rows list only `name` although every field takes the rule props; `SelectOption` (an exported type) is not named. The intro example (`README.md:10`, `z.email({ error: 'Invalid email' })` with `email: ''` default) shows "Invalid email" for an *empty* submit; the stories use the `iss.input === ''` idiom, the README should too or should add `required`. Add "TypeScript ≥ 5.4" next to "Requires zod 4" (`README.md:46`): the shipped d.ts uses `NoInfer` (`dist/Form/Form.d.ts:13-14`), which older TS cannot parse even with `skipLibCheck`.

5. **Spec drift.** `docs/superpowers/specs/2026-09-01-ez-form-v1-design.md:51` omits `SelectOption` from the exported-types list; the Layout (95-101) lacks `src/fields/BooleanFieldControl.tsx` (Task 9 ruling); the Stories section (120-125) is stale (`ValidationErrors` now shows rule messages, per-field stories have `Required`/`Disabled`/`WithHelperText`/`Rules`); the architecture diagram (line 33) says `SubmitButton` is "disabled while isSubmitting" whereas the API table says `loading`. Five-minute sync.

6. **`SelectProps` types its rules as `FieldRules<string>` but `SelectOption.value` may be a `number`.** `src/fields/Select/Select.tsx:4-11`: `validate={(v) => …}` is typed `v: string` while the runtime value for numeric options is a `number`. Fix: `Omit<TextFieldProps, 'select' | 'children' | keyof FieldRules> & FieldRules<SelectOption['value']> & { options }`.

7. **Behavioural test gaps across components.** Only TextField is tested under `<Form disabled>` and a pending submit (`Form.test.tsx:69-92`); Select/Checkbox/Switch rely on my probe. No component-level `mode="onChange"`/`"onBlur"` test exercises the composite resolver's per-name path (only the resolver test does). Select has no `helperText` or consumer-`onChange` test (it inherits them, but the wrapper could regress). One Form test with all five fields under `disabled` (folds into #1) and one onChange-mode TextField test cover this.

8. **`Form` exposes no `ref` to the `<form>`.** `FormProps` extends `FormHTMLAttributes` (no `ref`), so a parent cannot call `requestSubmit()`/`reset()` on the element or reuse it via `form="id"` without knowing the id. `ref?: Ref<HTMLFormElement>` is free under React 19 (ref-as-prop) and needs `forwardRef` under 18, which the peer range allows.

9. **No live region for errors that appear while the field keeps focus.** The focus-first-invalid + `aria-describedby` strategy is right for `mode: 'onSubmit'`; in `onChange`/`onBlur` modes the description changes under a focused input and most screen readers do not re-announce it. jest-axe cannot see this. v2 option: `role="alert"` (or `aria-live="polite"`) on the helper text when it is an error; document the strategy in the README (it is only in the spec).

10. **`react-hook-form` peer floor `^7.55.0` is wider than what was verified.** The disabled/payload semantics (`_setDisabledField`, `_names.disabled` unset in `handleSubmit`) and the `useController` proxy-ref were checked on 7.87 only. Either spot-check 7.55 or raise the floor to the verified minor. Also note `@emotion/*` are optional peers of MUI 9; keeping them required is a fine simplification, but `peerDependenciesMeta.optional` would let Pigment CSS users install without them.

11. **Per-module d.ts in the tarball.** `dist/rules.d.ts` exports `normalizeRules`, `defaultMessages`, `NormalizedRules`; `dist/fields/BooleanFieldControl.d.ts` exports the internal frame. Unreachable through `exports`, so not a leak, but visible. `dts({ rollupTypes: true })` collapses it to one `index.d.ts` (ruling 103's follow-up).

12. **`validate` returning `[]`.** `src/Form/ezResolver.ts:81-82` treats an empty array as pass (`result[0]` is `undefined`); hookform treats any all-string array as a failure. Trivial; mention only because the doc comment claims parity.

13. **`TextField.test.tsx:111`** `getByText('*')` depends on the default normaliser trimming MUI's thin-space before the asterisk; `toBeRequired` on line 110 already proves the point. Drop the second assertion or query the `.MuiFormLabel-asterisk` semantics via the label's accessible name.

14. **`ValidationErrors` story is `Basic` with a docstring** (deferred minor 104). A `play()` that clicks submit and awaits "Name is required." makes it a real story and a smoke test in the a11y panel.

## Triage of deferred minors and rulings

- 5 (branch in main checkout): **agree**.
- 28 (`@typescript/typescript6` devDep): **agree** — devDependency only; not in `peerDependencies`/`dependencies`; consumer-invisible.
- 29 (`.prettierignore`): **agree**.
- 30 (Task 1: `dist/index.js.map` absent): **moot** — `dist/index.js.map` exists after the Task 9 build.
- 33 (`handleSubmit((values) => onSubmit(values))` arity wrap): **agree** — now `(values, methods)`; a consumer who needs the event has `onSubmitCapture` on the form props.
- 34 (`as unknown as Resolver` cast accepted): **agree at the time, now moot** — the cast is gone (pattern review #1); `grep 'as unknown'` over `src/` and `dist/` is empty.
- 35 (keep `z.string().min(1).email()` chain): **disagree, now moot** — the pattern review showed `z.email({ error: (iss) => iss.input === '' ? … : … })` expresses required-then-format; the sweep landed and no `.email()` chain remains.
- 39 (null-guard comment): **moot** — comment present at `useEzFormContext.ts:7-10`.
- 40 (`z.string().email()` sweep): **moot** — done.
- 41 (resolver cast comment): **moot** — no cast to comment on.
- 45 (disabled merge, explicit destructure): **agree** — and it is load-bearing, not cosmetic: with the 7.87 proxy `_f.ref`, hookform cannot disable controlled inputs itself.
- 46 (no default id on TextField): **moot** — MUI mints `useId` ids; pattern review closed it.
- 54 (accept all 16 recommendations): **agree**.
- 59 (composite resolver over form-level `validate`): **agree**.
- 60 (form-disabled excluded from payload; SubmitButton on `formState.disabled`; `mergeSlotProps` from `./utils`): **agree** — verified in `register`/`_setDisabledField`/`handleSubmit`; second-submit probe passed.
- 62 (dense Global Constraints bullet): **defer**.
- 63 (progressbar assertions outside `waitFor`): **defer** — correct as written.
- 67 (`required` rule-driven only): **agree**.
- 68 (non-numeric min/max compare as strings, "documented"): **disagree** — documented only in the plan, diverges from hookform in two directions, and the false error replaces zod's message. See Important #3.
- 82 (validate always runs; required fails on `false`): **agree** — matches `validateField` line for line.
- 83 (`aria-invalid` omitted vs `"false"`; handler-composition duplication): **defer** — equivalent to AT; the duplication was resolved by `BooleanFieldControl`.
- 89 (jest-axe@11 over vitest-axe): **agree**.
- 92 (extract `BooleanFieldControl`): **agree**.
- 97 (hand-written `jest-axe.d.ts`): **agree**.
- 98 (Select listbox axe scoped to the listbox): **agree** — reason is written in the test.
- 103 (BooleanFieldControl size; per-module d.ts; no `repository` yet): **agree** — see Minor #11 for the rollup follow-up; add `repository` with the remote.
- 104 (`ValidationErrors` story identical to `Basic`): **defer** — Minor #14.
- 105 (README separator width; "stories passed" overstated): **moot** for the width (prettier-formatted); **defer** the wording.

## Recommendations (v2: RadioGroup → Autocomplete → NumberField)

- **Settle Important #1 before three more components copy the merge.** Whichever operator wins, it should be one helper (`mergeDisabled(consumer, field)`) used by every field and by `SubmitButton`.
- **`BooleanFieldControl` is two steps from a general `FieldFrame`.** RadioGroup needs the same `FormControl` + `FormHelperText` + `helperTextId`/`aria-invalid`/`aria-describedby`/`required` wiring, with `FormLabel` (as `legend`) instead of `FormControlLabel` and the RHF ref on the first radio. Lift the frame out of the boolean hook so `renderControl` receives `{ inputProps, invalid, required, helperTextId }` and the label strategy is a prop; Checkbox/Switch/RadioGroup become thin.
- **`useEzField<TValue>` + `FieldRules<TValue>` already carry the value type.** NumberField is `FieldRules<number>`; Autocomplete is `FieldRules<Option | null>` (single) or `FieldRules<Option[]>` (multiple); `validate` types follow for free, and `isEmpty` already treats `null` and `[]` as empty for `required`.
- **NumberField should own the value type at the binding.** `TextField` hands zod the raw string (hence the README's `z.coerce` note). NumberField should call `field.onChange(parsed ?? null)` so `z.number()` works and `min`/`max` hit the numeric branch of `outOfRange`; `valueAsNumber` is not available through `useController`, so the parse lives in the component.
- **Autocomplete transfers the Checkbox pattern, not the TextField one.** The RHF ref must reach the real `<input>` (`renderInput`'s `inputRef` or `slotProps.input.ref` via `mergeSlotProps`), and the handler composition is `(event, value, reason)` after `field.onChange(value)`, the same shape as `(e, checked)` in `BooleanFieldControl`.
- **Factor the per-component contract tests.** "throws outside `<Form>`", "has no accessibility violations in error state", "disabled under `<Form disabled>`", and "consumer onChange runs after the form's" are identical across components; a `describeFieldContract(Component, props)` helper keeps the next three test files short and closes Minor #7 for all of them.

## Assessment

**Ready to merge?** With fixes

**Reasoning:** The library is coherent, correctly typed, accessible, and packaged the way a consumer expects; nothing on the branch is broken for a consumer who installs a built tarball. Three small fixes should land first: make form-level disabling win over `disabled={false}` on fields (one operator in two files plus a test), add `prepack: pnpm build` so a publish from a clean clone ships `dist`, and bring `min`/`max` on non-numeric strings in line with hookform so a rule error never hides zod's message with a false one. Everything else is polish that can ride the next PR.
