# ez-form — what it is and how we keep it honest

ez-form is a thin binding layer: **MUI** for the widgets, **react-hook-form** for
state, **zod** for the schema. You write plain JSX; the field learns its name, value,
error, `required`, and `disabled` from the form around it. Nothing here re-invents a
widget, a validator, or a theme.

```
        zod schema ──► react-hook-form ──► <Form>
                                             │ context
   <TextField name="email" />  <Select … />  <Wizard … />
                                             │
                                          MUI + your theme
```

## The five rules

Every rule below has bitten us at least once. The ledgers under
`docs/superpowers/reviews/` record where.

### 1. Extend the library; never re-implement it

Props and types come from MUI, Base UI, and react-hook-form:
`Omit<MuiProps, 'value' | 'onChange' | …> & { name: Path<T> }`. If a type or helper
already exists upstream, alias it. A *deliberate* semantic change is welcome and
stays (`required` as a validation rule, `min`/`max` as bound **and** rule); an
identical copy of something upstream ships is not.

> Test: "why does this line exist?" must have an answer other than "it seemed
> cleaner".

### 2. No styling judgement calls in `src/`

No `sx`, no forced ripple, no hard-coded padding or colour, no literal `variant`
/ `size` / `color` that a theme cannot reach. A component may have a *default*, but
only in the two places MUI keeps its own, so `theme.components` overrides every one:

| Layer | Mechanism | Theme override |
|---|---|---|
| Default props | `useDefaultProps({ props, name: 'Ez<Name>' })` | `theme.components.Ez<Name>.defaultProps` |
| Default styles | `styled(Base, { name: 'Ez<Name>', slot: 'Root' })({ … })` | `theme.components.Ez<Name>.styleOverrides.root` |
| Class hooks | `generateUtilityClasses('Ez<Name>', ['root', …])` exported as `<name>Classes` | CSS / `styleOverrides` keys |
| Types | `src/theme/augmentation.ts` adds every `Ez*` key to `Components`, `ComponentsPropsList`, `ComponentNameToClassKey` | typed `createTheme` |

A slot default such as `{ variant: 'contained', ...slotProps?.confirm }` **is** this
pattern, not a violation: the literal is the library fallback and the theme's
`defaultProps.slotProps` wins. What is forbidden is a literal the theme cannot reach.
Stories may style freely; `src/` may not. An opinionated `ezFormTheme` preset is a
separate, optional package concern.

### 3. Accessible by default, verified by axe

Every component ships with a jest-axe pass in its test file and the Storybook a11y
panel clean. Labels, `aria-describedby` for helper/error text, `aria-invalid`,
`aria-required`, focus on the first error after submit, and live-region
announcements are the component's job, not the consumer's. A visual change that
regresses any of these is a bug, not a trade-off.

### 4. The form owns the lifecycle

`<Form>` is the single place that knows about submission, loading, disabling,
confirmation, and guards. Fields never call `handleSubmit`, never track
`isSubmitting`, never decide when they are disabled: they read it from context
(`mergeDisabled`: the form's lock always wins). Wizards validate the current step's
`fields` on Next and the whole schema on Submit; a failed final submit navigates to
the first errored step. When a behaviour needs the whole form, it goes on `<Form>`
or a `useEzFormContext` hook, not on a field.

### 5. Tickets state a repro; work states its ruling

Three of the first nine housekeeping tickets described bugs that did not exist.
An issue says what was observed (or "suspected"), the preferred outcome if there is
one, and 2–4 acceptance bullets; the task template in `.github/ISSUE_TEMPLATE`
has the headings. Every judgement call made while building is written down as
`Ruling: <what> — <why> — <cost if wrong>` in the ledger, and the finalized plan is
posted on the issue so the decision survives the session that made it.

## A component ships when

- [ ] Props extend the MUI / Base UI type with only the binding-owned keys omitted; no re-declared upstream types.
- [ ] Bound through `useEzField` / `FieldFrame` (fields) or `useEzFormContext` (form-level parts); `required`, `disabled`, `error`, `helperText` come from the form.
- [ ] Anything with a visual default registers as `Ez<Name>`: `useDefaultProps`, `styled` slots, `<name>Classes`, and an entry in `src/theme/augmentation.ts`. A pure pass-through field keeps MUI's own `Mui*` keys and registers nothing.
- [ ] No `sx`, ripple props, or theme-unreachable literals in `src/`.
- [ ] Tests: behaviour through the DOM (Testing Library), the shared `describeFieldContract` for fields, a jest-axe pass, pristine output (no `act()` warnings, no console noise).
- [ ] A story per meaningful state, using the `parameters.form` decorator; `excludeStories` for shared fixtures.
- [ ] README: a row in the Components table and, if the API has a rule or a mode, a short section.
- [ ] Exported from `src/index.ts`, including its props type and `<name>Classes`.
- [ ] `pnpm typecheck && pnpm test && pnpm build && pnpm build-storybook` green (CI runs all four).

## Where things live

| Path | What |
|---|---|
| `src/Form`, `src/Wizard`, `src/ConfirmDialog`, `src/*Button` | form-level lifecycle and navigation |
| `src/fields/*` | one directory per field, each with `.tsx`, `.test.tsx`, `.stories.tsx` |
| `src/theme/augmentation.ts` | the only place `Ez*` theme keys are declared |
| `src/rules.ts`, `src/Form/ezResolver.ts` | the validation-rule vocabulary and how it composes with zod |
| `docs/superpowers/specs`, `plans`, `reviews` | design → plan → ledger for every version and wave |
| GitHub Issues | the backlog, the only one |
