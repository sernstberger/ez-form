Closes #

## A component ships when

- [ ] Props extend the MUI / Base UI type with only the binding-owned keys omitted; no re-declared upstream types.
- [ ] Bound through `useEzField` / `FieldFrame` (fields) or `useEzFormContext` (form-level parts); `required`, `disabled`, `error`, `helperText` come from the form.
- [ ] Anything with a visual default registers as `Ez<Name>`: `useDefaultProps`, `styled` slots, `<name>Classes`, and an entry in `src/theme/augmentation.ts`. A pure pass-through field keeps MUI's own `Mui*` keys and registers nothing.
- [ ] No `sx`, ripple props, or theme-unreachable literals in `src/`.
- [ ] Interactive targets ≥ 24×24 px (`expectTargetSize`).
- [ ] Tests: behaviour through the DOM (Testing Library), the shared `describeFieldContract` for fields, a jest-axe pass, pristine output (no `act()` warnings, no console noise).
- [ ] A story per meaningful state, using the `parameters.form` decorator; `excludeStories` for shared fixtures.
- [ ] README: a row in the Components table and, if the API has a rule or a mode, a short section.
- [ ] Exported from `src/index.ts`, including its props type and `<name>Classes`.
- [ ] `pnpm typecheck && pnpm test && pnpm build && pnpm build-storybook` green (CI runs all four).

## Rulings made

- Ruling: … — … — …

## Review

<!-- SDD ledger doc path: docs/superpowers/reviews/… -->
