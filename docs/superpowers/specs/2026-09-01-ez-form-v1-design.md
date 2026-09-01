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
- Server error mapping, async validation helpers.
- Re-exporting react-hook-form APIs. Consumers import `useFormContext` etc. from `react-hook-form` directly.

## Architecture

```
consumer JSX
  <Form schema={s} defaultValues onSubmit>
    ├─ useForm({ resolver: zodResolver(s), defaultValues, mode })
    ├─ <FormProvider>                        ← hookform context
    └─ <form noValidate onSubmit={handleSubmit(onSubmit)}>
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
| `Form<S extends z.ZodType>` | `useForm` + `FormProvider` + `<form>` | `schema: S`, `onSubmit(values: z.output<S>): void \| Promise<void>`, `defaultValues?: DefaultValues<z.input<S>>`, `mode?: Mode`, `children`, remaining props spread onto `<form>` | `noValidate` set on the form so browser validation does not preempt zod |
| `TextField` | MUI `TextField` | `name: string` + `TextFieldProps` minus `value`, `onChange`, `onBlur`, `error`, `helperText`, `inputRef` … plus `helperText?` | On error: `error={true}`, `helperText=error.message`. Otherwise consumer `helperText` |
| `Select` | MUI `TextField select` | `name`, `options: { value: string \| number; label: string }[]` + same MUI passthrough as TextField | Renders `MenuItem` per option. Single select only |
| `Checkbox` | `FormControl` + `FormControlLabel` + MUI `Checkbox` | `name`, `label: ReactNode` + `CheckboxProps` passthrough | `checked = !!field.value`, `onChange → e.target.checked`. Error shown in `FormHelperText` |
| `Switch` | same as Checkbox with MUI `Switch` | same as Checkbox | shares `useBooleanField` internal hook |
| `SubmitButton` | MUI `Button` | `ButtonProps` | `type="submit"`, `variant="contained"` default, `disabled` while `isSubmitting` or if consumer passes `disabled` |

Only these six symbols are exported from `src/index.ts`, plus their prop types.

## Error handling

| Source | Path | Owner |
|---|---|---|
| zod validation | resolver → `fieldState.error.message` → field helper text | library |
| `onSubmit` throws | hookform rejects `handleSubmit`; `isSubmitting` resets | consumer |
| server/field errors | consumer calls `setError` via `useFormContext` | consumer |
| field outside `<Form>` | throw `Error("ez-form: <TextField> must be rendered inside <Form>")` | library |

## Tooling

| Concern | Choice |
|---|---|
| Package manager | pnpm |
| Language | TypeScript strict |
| Build | Vite lib mode, ESM only, `vite-plugin-dts` emits `.d.ts`. Entry `src/index.ts` → `dist/index.js` + `dist/index.d.ts` |
| Peer deps | `react`, `react-dom`, `@mui/material`, `@emotion/react`, `@emotion/styled`, `react-hook-form`, `zod` |
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

## Stories (v1)

- `Form/Basic` — signup form with all five components, logs values on submit
- `Form/ValidationErrors` — submit empty, every field shows its zod message
- `Form/AsyncSubmit` — onSubmit awaits 1s, SubmitButton disables
- One `Default` story per field, plus `WithError` for TextField

## Success criteria

- `pnpm build` produces `dist/index.js` and `dist/index.d.ts`; installing the tarball into a fresh Vite app and rendering `Form/Basic` works.
- `pnpm test` green; Form test proves: empty submit shows zod messages, valid submit calls `onSubmit` with parsed values, button disabled during async submit.
- `pnpm storybook` shows all stories without console errors.
