# ez-form v1 design

Date: 2026-09-01
Status: approved

## Goal

An open source React form library that wires MUI components to react-hook-form
with zod validation, so a consumer writes ordinary JSX and gets validation,
error display, and submit state for free. Installable as an npm dependency.
Storybook is the development environment and living documentation.

## Non-goals (v1)

- Schema-driven form generation (`<AutoForm schema />`). May come later on top of these fields.
- Typed `name` props (`createForm(schema)` factory). Plain `string` names in v1; a typed layer can be added without breaking this API.
- Field arrays, nested object helpers, date pickers, file inputs.
- Automatic server error mapping, async validation helpers. (`onSubmit` receives the form methods, so a consumer can call `setError` by hand.)
- Re-exporting react-hook-form runtime APIs. Consumers import `useFormContext` etc. from `react-hook-form` directly. Type aliases that reference RHF types (`FormMethods`) are fine.

## Architecture

```
consumer JSX
  <Form schema={s} defaultValues onSubmit disabled?>
    ├─ useForm({ resolver: zodResolver(s), defaultValues, mode, disabled })
    ├─ <FormProvider>                        ← hookform context
    └─ <form noValidate onSubmit={handleSubmit((values) => onSubmit(values, methods))}>
         ├─ <TextField name="email" />   ─┐
         ├─ <Select    name="role" />    ├─ useController({ name })
         ├─ <Checkbox  name="tos" />     │   → MUI component
         ├─ <Switch    name="dark" />   ─┘   → error + helperText from fieldState
         └─ <SubmitButton />              ← useFormState → disabled while isSubmitting
```

Every field component reads the form via hookform context. Fields rendered
outside a `<Form>` throw (hookform's `useFormContext` returns null; we assert
and throw a clear message).

## Public API

| Export | Wraps | Props | Behavior |
|---|---|---|---|
| `Form<TIn extends FieldValues, TOut>` | `useForm` + `FormProvider` + `<form>` | `schema: z.ZodType<TOut, TIn>`, `onSubmit(values: TOut, form: FormMethods<TIn, TOut>): void \| Promise<void>`, `defaultValues?: DefaultValues<TIn>`, `mode?: Mode`, `disabled?: boolean`, `children`, remaining props spread onto `<form>` | `noValidate` set on the form so browser validation does not preempt zod. `FormMethods<TIn, TOut> = UseFormReturn<TIn, unknown, TOut>` is the same object `useFormContext()` returns, handed to `onSubmit` so the owner can `reset`/`setError`. `disabled` maps to `useForm({ disabled })`: every field disables, values are still submitted |
| `TextField` | MUI `TextField` | `name: string` + `TextFieldProps` minus `name`, `value`, `error`, `inputRef` | On error: `error={true}`, `helperText=error.message`. Otherwise consumer `helperText`. Consumer `onChange`/`onBlur` run after hookform's |
| `Select` | MUI `TextField select` | `name`, `options: readonly { value: string \| number; label: string }[]` + same MUI passthrough as TextField | Renders `MenuItem` per option. Single select only |
| `Checkbox` | `FormControl` + `FormControlLabel` + MUI `Checkbox` | `name`, `label: ReactNode`, `helperText?`, `required?` + `CheckboxProps` minus `name`, `checked` | `checked = !!field.value`, `onChange → e.target.checked` (consumer `onChange(e, checked)` runs after). Error shown in `FormHelperText` with an id; the input gets `aria-describedby`, `aria-invalid`, the RHF ref via `slotProps.input` (merged with the consumer's using `mergeSlotProps`); `required` goes to `FormControlLabel` |
| `Switch` | same as Checkbox with MUI `Switch` | same as Checkbox | shares `useBooleanField` internal hook; MUI 9 sets `role="switch"` |
| `SubmitButton` | MUI `Button` | `ButtonProps` minus `type` | `type="submit"`, `variant="contained"` default, MUI `loading` (which disables) while `isSubmitting`; consumer `disabled` passed through |

Only these six symbols are exported from `src/index.ts`, plus their prop types and the `FormMethods` type alias.

## Error handling

| Source | Path | Owner |
|---|---|---|
| zod validation | resolver → `fieldState.error.message` → field helper text | library |
| `onSubmit` throws | hookform rejects `handleSubmit`; `isSubmitting` resets | consumer |
| server/field errors | consumer calls `form.setError` on `onSubmit`'s second argument (or `useFormContext` inside the form) | consumer |
| field outside `<Form>` | throw `Error("ez-form: <TextField> must be rendered inside <Form>")` | library |

## Tooling

| Concern | Choice |
|---|---|
| Package manager | pnpm |
| Language | TypeScript strict |
| Build | Vite lib mode, ESM only, `vite-plugin-dts` emits `.d.ts`. Entry `src/index.ts` → `dist/index.js` + `dist/index.d.ts` |
| Peer deps | `react`, `react-dom`, `@mui/material`, `@emotion/react`, `@emotion/styled`, `react-hook-form`, `zod` (`^4`: the published d.ts uses zod 4's `ZodType<Output, Input>` parameter order) |
| Runtime deps | `@hookform/resolvers` |
| Storybook | `@storybook/react-vite`, stories co-located as `*.stories.tsx`, global decorator with MUI `ThemeProvider` + `CssBaseline` |
| Tests | Vitest + `@testing-library/react` + `@testing-library/user-event` + jsdom. Co-located `*.test.tsx` |
| Format | Prettier. ESLint deferred |
| License | MIT |

## Layout

One folder per component; each folder holds the component, its test, its stories, and an `index.ts` re-export. Shared hooks stay flat.

```
ez-form/
├── .storybook/         main.ts, preview.tsx
├── docs/superpowers/   specs, plans
├── src/
│   ├── index.ts                 public barrel
│   ├── useEzFormContext.ts      context guard (throws outside <Form>)
│   ├── Form/                    Form.tsx  Form.test.tsx  Form.stories.tsx  index.ts
│   ├── SubmitButton/            SubmitButton.tsx  SubmitButton.test.tsx  index.ts
│   ├── fields/
│   │   ├── useEzField.ts        useController + context guard
│   │   ├── useBooleanField.ts   shared by Checkbox/Switch
│   │   ├── TextField/           TextField.tsx  .test.tsx  .stories.tsx  index.ts
│   │   ├── Select/              (same shape)
│   │   ├── Checkbox/            (same shape)
│   │   └── Switch/              (same shape)
│   └── test/setup.ts            jest-dom matchers
├── package.json  tsconfig.json  vite.config.ts  .prettierrc  .prettierignore
├── README.md  LICENSE
```

## Testing conventions

Tests follow Kent C. Dodds' Testing Library guidance: query by role/label/text in that priority, `screen` everywhere, `userEvent.setup()` per test, `findBy*` for async, jest-dom matchers, `renderHook` for hooks, behavior over implementation. No test IDs, no `fireEvent`, no manual `act()`.

Vitest runs with `restoreMocks: true`; the per-component "throws outside `<Form>`" test stubs `console.error` with `vi.spyOn` and never restores by hand. `onSubmit` spies are asserted with `toHaveBeenCalledWith(values, expect.anything())`. Helper-text wiring is asserted with `toHaveAccessibleDescription`, never by id.

## Patterns

- **Field prop rule.** Omit from the MUI props only what the binding owns: `name`, `value`/`checked`, `error`, and the ref prop. Everything else (`onChange`, `onBlur`, `helperText`, `disabled`, `required`, `id`, `slotProps`) is accepted and merged; hookform's handler runs first, the consumer's after.
- **A11y wiring is the error-announcement strategy** (no live region). Every field hands RHF the real `<input>` ref, so `shouldFocusError` focuses the first invalid field on submit; the input carries `aria-invalid` and `aria-describedby` pointing at the helper text, which the screen reader then reads. MUI `TextField` does this itself (ids from `React.useId`, SSR-stable). `Checkbox`/`Switch` do it by hand: `useBooleanField` mints a `helperTextId` with `useId`, `FormHelperText` gets that id, and `slotProps.input` (merged with the consumer's via `mergeSlotProps`) carries `ref`, `aria-invalid`, `aria-describedby`. `required` is passed to `FormControlLabel` explicitly because it does not read `FormControl` context.
- **`disabled` semantics.** A consumer's field-level `disabled` is UI-only and is never passed to `useController({ disabled })`, which would strip the value on submit and make a required field fail its own schema. Form-level disabling is `<Form disabled>` → `useForm({ disabled })`, which disables every field and still submits values.
- **zod 4 idioms.** `z.email({ error })` (an error map can tell empty from malformed via `iss.input`), `error:` not `message:`, `z.boolean().refine(Boolean, { error })` for must-be-true, and no `as never` in `defaultValues`; omit the key instead (`DefaultValues` is `DeepPartial`; fields render `undefined` as empty). Numeric text fields need `z.coerce.number()` because the input hands zod a string.

## Stories (v1)

- `Form/Basic` — signup form with all five components, logs values on submit
- `Form/ValidationErrors` — submit empty, every field shows its zod message
- `Form/AsyncSubmit` — onSubmit awaits 1s, SubmitButton disables
- One `Default` story per field, plus `WithError` for TextField

## Success criteria

- `pnpm build` produces `dist/index.js` and `dist/index.d.ts`; installing the tarball into a fresh Vite app and rendering `Form/Basic` works.
- `pnpm test` green; Form test proves: empty submit shows zod messages, valid submit calls `onSubmit` with parsed values, button disabled during async submit.
- `pnpm storybook` shows all stories without console errors.
