# ez-form v1 — pattern review of Tasks 1-3 and plan Tasks 5-9

Reviewer: Fable (read-only). Date: 2026-09-01.
Scope: `src/` as of Task 3 (commit 9abbc94), `package.json`, `tsconfig*.json`, `vite.config.ts`, plan Tasks 5-9, deferred minors in `progress.md`. Library claims below were checked against the installed packages (react-hook-form 7.87.0, @hookform/resolvers 5.9.1, zod 4.5.4, @mui/material 9.4.0, storybook 10.5.10, typescript 7.0.2, vite-plugin-dts 5.1.0 → unplugin-dts 1.1.0). Type claims about `Form` were verified with a TS 7 probe in the scratchpad (not in the repo). No builds or tests were run.

## 1. Verdict on the foundation

The foundation is sound and worth building on: the context-guard hook, the `useController`-from-context binding, the controlled `value ?? ''` + `inputRef` pattern in `TextField`, path-only MUI imports, ESM-only build with tests/stories excluded from the d.ts, and KCD-style tests are all patterns I would want twenty more components to copy. The single most important change is in `Form.tsx`: replace the `S extends z.ZodType<FieldValues, FieldValues>` generic and its `as unknown as Resolver<...>` cast with `<TIn extends FieldValues, TOut>` generics and `schema: z.ZodType<TOut, TIn>`. That removes the only type hole in the library (verified cast-free under TS 7), makes `zodResolver` pick the right overload on its own, and is the natural place to hand `onSubmit` the form methods so consumers can `reset`/`setError` from the component that owns the form, which the spec's "use `useFormContext`" advice cannot do (the parent is outside the provider). Everything else is polish: Checkbox/Switch need real a11y wiring before they are written, the zod peer range must match what the d.ts actually requires, and the examples should use zod 4 idioms so the README does not ship deprecated calls.

## 2. Recommendations, prioritized

| # | Area | Change | Why | Severity | Breaking? |
|---|---|---|---|---|---|
| 1 | `src/Form/Form.tsx:13-36,43` | Generics `<TIn extends FieldValues, TOut>`, `schema: z.ZodType<TOut, TIn>`, drop the double cast, `NoInfer` on `defaultValues`/`onSubmit`, pass `methods` as `onSubmit`'s second argument | Removes the only `as unknown as` in the codebase; the cast exists because zod 4's classic `ZodType` still exposes `_output/_input/_def` (zod/v4/classic/schemas.d.ts:7-15) so `zodResolver` matches its Zod3 overload and widens to `Resolver<FieldValues, unknown, FieldValues>` for a generic `S` (probe: TS2322). With `ZodType<TOut, TIn>` the same overload infers `Resolver<TIn, unknown, TOut>` exactly. Second arg closes the reset/setError-from-parent gap | Must | Type-level: `FormProps<S>` becomes `FormProps<TIn, TOut>`. Runtime additive |
| 2 | Plan Task 7/8 (`Checkbox.tsx` 1199-1238, `Switch.tsx` 1376-1415, `useBooleanField.ts` 1177-1195) | Add `aria-describedby` → `FormHelperText id`, `aria-invalid`, `required` on `FormControlLabel`, merge consumer `slotProps.input` with `mergeSlotProps`, drop `role: 'switch'` | MUI's `FormHelperText` has no id and `SwitchBase` never sets `aria-invalid` (FormHelperText.js:98-100, SwitchBase.js:210-230), so the zod message under a checkbox is invisible to AT; MUI 9 `Switch` already sets `role: 'switch'` (Switch.js:325-326) so the plan's copy is a duplicate; `FormControlLabel` reads `required` only from its own prop/control, not from `FormControl` (FormControlLabel.js:142-143) | Must | No |
| 3 | `package.json:36` | `"zod": "^4.0.0"` | The published d.ts uses `z.ZodType<Output, Input>`; zod 3's signature is `ZodType<Output, Def, Input>`, so zod 3.25 consumers get a broken `FormProps`. The range is a promise the types cannot keep (and #1 makes the breakage certain) | Must | Install-time only; v0.1 |
| 4 | `package.json:14-19` | `"import"` → `"default"`, add `"./package.json"` | ESM-only is fine, but Node 22+ `require(esm)` resolves the `require` then `default` condition; with only `import`, `require('ez-form')` throws ERR_PACKAGE_PATH_NOT_EXPORTED. `default` keeps the ESM-only build and unblocks that path | Should | No |
| 5 | `vite.config.ts:6-14` | `external: (id) => !id.startsWith('.') && !id.startsWith('\0') && !isAbsolute(id)` | The regex list covers `@mui/`, `react/` etc. but not `zod/` (`zod/v4`, `zod/v4-mini` are real subpaths); any future subpath import silently bundles a peer. A predicate makes "never bundle a dependency" the rule rather than a list | Should | No |
| 6 | `vite.config.ts:23-28`, `Form.test.tsx:49-55`, `TextField.test.tsx:51-57` | `test.restoreMocks: true`; delete manual `vi.restoreAllMocks()` | The "throws outside `<Form>`" test is copied per component; if its `expect` fails, `restoreAllMocks` never runs and `console.error` stays stubbed for the rest of the file. Config-level restore makes the copy-paste safe | Should | No |
| 7 | Plan Tasks 6/7/9 tests, stories, README (`'' as never` 968/982/1070/1547; `false as never` 1133/1149/1277/1548; `z.literal(true, { message })` 1124-1126; `z.string().email` 1624; `{ message }` 955/1054) + `Form.test.tsx:7`, `TextField.test.tsx:8` | Use zod 4 idioms: `z.email({ error })`, `error:` not `message:`, `z.boolean().refine` instead of `z.literal(true)`, omit the key instead of `'' as never` | `z.string().email()` is `@deprecated` (schemas.d.ts:111-112) and `message` is `@deprecated` (core/api.d.ts:9-10); `as never` in every example teaches consumers to lie to the type system, and it is unnecessary: `DefaultValues` is `DeepPartial` (types/form.d.ts:19) and `TextField` already renders `undefined` as `''` (TextField.tsx:18) | Should | No |
| 8 | `src/fields/TextField/TextField.tsx:4-9,17-23` | Omit only what the binding owns (`name`, `value`, `error`, `inputRef`); compose consumer `onChange`/`onBlur` after hookform's | Defines the omission rule the other 20 components will copy. Consumers routinely need change side-effects (masking, analytics, dependent fields); `watch` is a poor substitute for "the user just typed" | Should | No (additive) |
| 9 | `src/Form/Form.tsx` | `disabled?: boolean` prop → `useForm({ disabled })` | `TextField.tsx:19` merges `field.disabled`, but nothing in the public API can set it (`formState.disabled` comes only from `useForm({ disabled })`, index.esm.mjs:2124). Form-level disabled toggles DOM refs + state (3188-3200) and does not strip submit values, unlike field-level disabled | Nice | No |
| 10 | Plan Task 5 `SubmitButton.tsx` 857-881 | Consider `loading={isSubmitting}` instead of `disabled={... \|\| isSubmitting}` | MUI 9 Button `loading` disables and shows the indicator (Button.d.ts:57-61); gives async feedback for free. Keep `disabled` for the consumer prop | Nice | No |
| 11 | `src/useEzFormContext.ts:3-5,7-9` | Drop the unused `T` generic; add the "types say non-null, runtime is `useContext(null)`" comment (deferred minor) | An unused generic invites callers to assert types with no check; RHF's `useFormContext` is literally `React.useContext(HookFormContext)` (index.esm.mjs:1556) | Nice | Type-level, internal |
| 12 | `tsconfig.json`, `tsconfig.build.json` | `verbatimModuleSyntax: true`; build `exclude` globs `src/**/*.test.*`, `src/**/*.stories.*` | Enforces `import type` for an ESM lib; the current exclude misses a future `.test.ts` | Nice | No |
| 13 | `package.json` | Add `repository`, `keywords`, `packageManager`, `engines.node` | npm page and corepack; cosmetic | Nice | No |
| 14 | Plan Task 6 `SelectOption`/`options` | `options: readonly SelectOption[]`; `label: ReactNode` is fine to leave as `string` | Lets consumers pass `as const` arrays | Nice | No (widening) |
| 15 | Plan Task 4/6/7/8 stories decorators (`onSubmit={fn()}` at 688, 1070, 1277, 1452) | Hoist `const onSubmit = fn()` to module scope | A new spy per render; harmless, but the hoisted form is the one to copy | Nice | No |
| 16 | README (Task 9 Step 3) | Note `z.coerce.number()` for numeric text fields; document `onSubmit(values, form)` for reset/setError and `useFormContext()` for children | RHF hands `TextField` the string from `event.target.value`; `z.number()` will fail on every submit | Nice | No |

Not a finding, recorded so nobody re-opens it: `@typescript/typescript6` (package.json devDependencies) is consumer-invisible. TS 7's `typescript` package exports only `lib/version.cjs` from `"."` (no JS API); `unplugin-dts` (what `vite-plugin-dts` 5 wraps) references the `typescript6` shim itself. It is a devDependency, not shipped. `sideEffects: false` is correct (no CSS, no globals). `types` condition is present. `react-hook-form ^7.55.0` matches `@hookform/resolvers`' own peer range. `@emotion/*` are optional peers of MUI 9 (`peerDependenciesMeta`), but keeping them required here is the simpler install story; see non-recommendations.

### 2.1 Must #1 — `Form` generics, no cast, `onSubmit(values, form)`

`src/Form/Form.tsx`:

```tsx
import type { FormHTMLAttributes, ReactNode } from 'react'
import {
  FormProvider,
  useForm,
  type DefaultValues,
  type FieldValues,
  type Mode,
  type UseFormReturn,
} from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { z } from 'zod'

/**
 * The hookform methods for this form. It is the same object `useFormContext()`
 * returns inside the form; it is handed to `onSubmit` so the component that
 * owns the form can `reset`, `setError`, etc. without a child component.
 */
export type FormMethods<TIn extends FieldValues, TOut> = UseFormReturn<TIn, unknown, TOut>

export interface FormProps<TIn extends FieldValues, TOut>
  extends Omit<FormHTMLAttributes<HTMLFormElement>, 'onSubmit'> {
  /** zod schema. Its input type types `defaultValues`; its output type types `onSubmit`. */
  schema: z.ZodType<TOut, TIn>
  onSubmit: (values: NoInfer<TOut>, form: FormMethods<TIn, TOut>) => void | Promise<void>
  defaultValues?: NoInfer<DefaultValues<TIn>>
  mode?: Mode
  children: ReactNode
}

export function Form<TIn extends FieldValues, TOut>({
  schema,
  onSubmit,
  defaultValues,
  mode = 'onSubmit',
  children,
  ...formProps
}: FormProps<TIn, TOut>) {
  const methods = useForm<TIn, unknown, TOut>({
    resolver: zodResolver(schema),
    defaultValues,
    mode,
  })

  return (
    <FormProvider {...methods}>
      <form
        noValidate
        {...formProps}
        onSubmit={methods.handleSubmit((values) => onSubmit(values, methods))}
      >
        {children}
      </form>
    </FormProvider>
  )
}
```

Why each piece:

- `schema: z.ZodType<TOut, TIn>` makes `zodResolver`'s Zod3-shaped overload (`schema: Zod3Type<Output, Input>` → `Resolver<Input, Context, Output>`, @hookform/resolvers/zod/dist/zod.d.ts) infer `Resolver<TIn, unknown, TOut>`, which is exactly what `useForm<TIn, unknown, TOut>` wants. No cast. Verified with TS 7.0.2: the current `S` form fails with TS2322 (`Resolver<FieldValues, unknown, FieldValues>` not assignable), the single cast fails with TS2352 (as the ledger says), and the `TIn/TOut` form compiles clean, including a schema with `.transform()` where `TIn !== TOut`, and JSX usage.
- `NoInfer<DefaultValues<TIn>>` stops `defaultValues={{ role: '' }}` from widening `TIn.role` to `string` (probe: `''` is rejected against `z.enum(['admin','user'])`). Without it the schema and the default values are both inference sites and TS may pick the wider one.
- `NoInfer<TOut>` on `onSubmit` for the same reason in the other direction.
- `handleSubmit((values) => onSubmit(values, methods))` keeps the arity wrap the ledger ruled on (hookform passes `(values, event)`) and adds the methods.
- `FormMethods` is a type alias referencing RHF, the same way `DefaultValues`/`Mode` already do; it is not a re-export of a runtime symbol, so it stays inside the owner's "nothing re-exported from react-hook-form" rule. Export it from `src/index.ts` alongside `FormProps`.

`src/index.ts`: `export { Form, type FormProps, type FormMethods } from './Form'`.

`src/Form/Form.test.tsx` changes:

```tsx
// existing assertion becomes:
expect(onSubmit).toHaveBeenCalledWith(
  { email: 'a@b.co' },
  expect.objectContaining({ setError: expect.any(Function) }),
)

// new test (needs TextField, which exists):
it('hands the form methods to onSubmit so the caller can map a server error', async () => {
  const user = userEvent.setup()
  const onSubmit = vi.fn((_values: { email: string }, form: FormMethods<{ email: string }, { email: string }>) =>
    form.setError('email', { message: 'Already registered' }),
  )
  render(
    <Form schema={schema} defaultValues={{ email: 'a@b.co' }} onSubmit={onSubmit}>
      <TextField name="email" label="Email" />
      <button type="submit">Go</button>
    </Form>,
  )
  await user.click(screen.getByRole('button', { name: 'Go' }))
  expect(await screen.findByText('Already registered')).toBeInTheDocument()
})
```

`TextField.test.tsx:35` and the plan's `toHaveBeenCalledWith({...})` assertions in Tasks 6-8 get the same `expect.objectContaining(...)` second argument (or `expect.anything()`).

Plan text to update: Task 2 Interfaces (line 269), Task 9 README table row for `Form` (1653) and the `useFormContext` note (1661) → "Need `reset`, `setError`, `watch`? `onSubmit` receives the form methods as its second argument; inside child components use `useFormContext()` from `react-hook-form`."

### 2.2 Must #2 — Checkbox/Switch a11y wiring (plan Tasks 7-8)

`src/fields/useBooleanField.ts`:

```ts
import { useId, type ChangeEvent } from 'react'
import { useEzField } from './useEzField'

export function useBooleanField(name: string, componentName: string) {
  const { field, fieldState } = useEzField(name, componentName)
  const helperTextId = useId()
  const errorMessage = fieldState.error?.message
  return {
    name: field.name,
    checked: Boolean(field.value),
    onChange: (e: ChangeEvent<HTMLInputElement>) => field.onChange(e.target.checked),
    onBlur: field.onBlur,
    inputRef: field.ref,
    disabled: field.disabled,
    invalid: fieldState.invalid,
    errorMessage,
    helperTextId,
  }
}
```

`src/fields/Checkbox/Checkbox.tsx` (Switch is identical with `MuiSwitch`, `'Switch'`, and no `role` — MUI 9 sets `role="switch"` itself, Switch.js:325-326):

```tsx
import type { ReactNode } from 'react'
import MuiCheckbox, { type CheckboxProps as MuiCheckboxProps } from '@mui/material/Checkbox'
import FormControl from '@mui/material/FormControl'
import FormControlLabel from '@mui/material/FormControlLabel'
import FormHelperText from '@mui/material/FormHelperText'
import mergeSlotProps from '@mui/material/utils/mergeSlotProps'
import { useBooleanField } from '../useBooleanField'

export type CheckboxProps = Omit<MuiCheckboxProps, 'name' | 'checked' | 'onChange' | 'onBlur'> & {
  name: string
  label: ReactNode
  helperText?: ReactNode
}

export function Checkbox({ name, label, helperText, disabled, required, slotProps, ...rest }: CheckboxProps) {
  const f = useBooleanField(name, 'Checkbox')
  const text = f.errorMessage ?? helperText

  return (
    <FormControl error={f.invalid} disabled={disabled ?? f.disabled} required={required}>
      <FormControlLabel
        label={label}
        required={required}
        control={
          <MuiCheckbox
            {...rest}
            name={f.name}
            checked={f.checked}
            onChange={f.onChange}
            onBlur={f.onBlur}
            slotProps={{
              ...slotProps,
              input: mergeSlotProps(slotProps?.input, {
                ref: f.inputRef,
                'aria-invalid': f.invalid || undefined,
                'aria-describedby': text ? f.helperTextId : undefined,
              }),
            }}
          />
        }
      />
      {text ? <FormHelperText id={f.helperTextId}>{text}</FormHelperText> : null}
    </FormControl>
  )
}
```

Why:

- `FormControlLabel` renders a `<label>` around the control, so the accessible name is by nesting; no `id` is needed for the name. The helper text is the piece with no association: `FormHelperText` reads `error`/`disabled` from `FormControl` context but has no default id (FormHelperText.js:98-100), and `SwitchBase` forwards `slotProps.input` to the `<input>` (SwitchBase.js:210-230) but never sets `aria-invalid`. The three attributes above are the whole fix.
- `required` must be passed to `FormControlLabel` explicitly: it reads `requiredProp ?? control.props.required`, not the `FormControl` context (FormControlLabel.js:142-143). The asterisk is `aria-hidden` (184-188); the native `required` attribute is inert under `noValidate`.
- `mergeSlotProps` (exported by path, `@mui/material/utils/mergeSlotProps.d.ts:2`) handles the object-or-function `slotProps.input` shape and is what MUI's own `Switch` uses; the plan's `{ input: { ref } }` literal would clobber any consumer `slotProps.input`. Consumer keys win per MUI convention; overriding `ref` is then their explicit choice.
- `field.ref` on the real `<input>` is what makes RHF's `shouldFocusError` (default `true`, index.esm.mjs:2091, `_focusError` 3185) move focus to the first invalid checkbox on submit; with `aria-describedby` in place the screen reader then reads the zod message. This is the error-announcement strategy for the whole library (see §3); no live region needed.
- Keep the plan's fallback (`as Record<string, unknown>`, plan line 1246) only if `SlotProps<'input', ...>` rejects `ref`; `CheckboxSlotsAndSlotProps.input` is `SlotProps<'input', CheckboxInputSlotPropsOverrides, CheckboxOwnerState>` (Checkbox.d.ts:35), which should accept it.

Tests to add to the plan's `Checkbox.test.tsx` (and Switch):

```tsx
it('associates the message with the input for assistive tech', async () => {
  const user = userEvent.setup()
  render(
    <Form schema={schema} defaultValues={{ tos: false }} onSubmit={() => {}}>
      <Checkbox name="tos" label="Accept terms" />
      <button type="submit">Go</button>
    </Form>,
  )
  await user.click(screen.getByRole('button', { name: 'Go' }))
  const box = await screen.findByRole('checkbox', { name: 'Accept terms' })
  expect(box).toHaveAttribute('aria-invalid', 'true')
  expect(box).toHaveAccessibleDescription('You must accept the terms')
})

it('marks the control required', () => {
  render(
    <Form schema={schema} defaultValues={{ tos: false }} onSubmit={() => {}}>
      <Checkbox name="tos" label="Accept terms" required />
    </Form>,
  )
  expect(screen.getByRole('checkbox', { name: 'Accept terms' })).toBeRequired()
})
```

`toHaveAccessibleDescription` follows `aria-describedby`, so it locks the wiring in without querying ids. The `defaultValues={{ tos: false }}` above already assumes §2.5's `z.boolean().refine` schema (no `as never`).

### 2.3 Must #3 — zod peer range

`package.json:36`: `"zod": "^4.0.0"`.

The d.ts this package ships references `z.ZodType<…, …>` with zod 4's `(Output, Input)` parameter order; zod 3's `ZodType<Output, Def, Input>` reads the second argument as a `ZodTypeDef`. Today that happens to typecheck by accident (`FieldValues` is an all-index-signature type), but with §2.1's `ZodType<TOut, TIn>` it is a hard break for a zod 3.25 consumer. `@hookform/resolvers` supports both, which is why the plan wrote the wide range, but ez-form's types do not. The spec (`Tech Stack`, line 9) says zod 4; the peer should say the same. (Alternative kept in non-recommendations: import types from `zod/v4` to keep 3.25 support.)

### 2.4 Should #4/#5/#6 — packaging and test config

`package.json:14-19`:

```json
"exports": {
  ".": {
    "types": "./dist/index.d.ts",
    "default": "./dist/index.js"
  },
  "./package.json": "./package.json"
}
```

`vite.config.ts:6-14,20`:

```ts
import { isAbsolute } from 'node:path'

// Never bundle a dependency: anything that is not a relative or absolute
// path (or a Vite virtual module) is a peer/runtime dep and stays external.
const external = (id: string) => !id.startsWith('.') && !id.startsWith('\0') && !isAbsolute(id)
```

and `rollupOptions: { external }` unchanged. `pkg` import and `resolveJsonModule` can go with it if nothing else needs them.

`vite.config.ts:23-28`:

```ts
test: {
  environment: 'jsdom',
  globals: true,
  restoreMocks: true,
  setupFiles: ['src/test/setup.ts'],
  include: ['src/**/*.test.{ts,tsx}'],
},
```

Then the per-component guard test is two lines and safe to copy:

```tsx
it('throws outside <Form>', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  expect(() => render(<TextField name="x" />)).toThrow('ez-form: <TextField> must be rendered inside <Form>')
})
```

Remove `vi.restoreAllMocks()` from `Form.test.tsx:54`, `TextField.test.tsx:56`, and the plan's Task 5-8 tests (846, 1165, 1364). Add `restoreMocks` to the plan's Global Constraints test bullet so implementers stop writing the manual restore.

### 2.5 Should #7 — zod 4 idioms in tests, stories, README

The one schema shape to use everywhere (Task 9 stories 1536-1550, README 1623-1628, and the per-field tests):

```ts
const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.email({ error: (iss) => (iss.input === '' ? 'Email is required' : 'Invalid email') }),
  role: z.enum(['admin', 'user'], { error: 'Pick a role' }),
  tos: z.boolean().refine(Boolean, { error: 'You must accept the terms' }),
  newsletter: z.boolean(),
})

// role omitted: DefaultValues is DeepPartial; TextField/Select render undefined as ''
const emptyValues: DefaultValues<z.input<typeof schema>> = {
  name: '',
  email: '',
  tos: false,
  newsletter: false,
}
```

- `z.email()` replaces the deprecated `z.string().email()` (schemas.d.ts:111-112). The ledger ruled the chain stays because `z.email()` "cannot express required-then-format"; it can: zod 4 error maps receive the raw issue including `input` (core/errors.d.ts:8,55), so one `error` function distinguishes empty from malformed. Verified to typecheck.
- `error:` replaces `message:` (core/api.d.ts:9-10 marks `message` deprecated).
- `z.boolean().refine(Boolean, …)` has input type `boolean`, so `tos: false` is an honest default and `as never` disappears. `z.literal(true)` forces the lie because its input type is `true`.
- Omitting `role` instead of `role: '' as never`: `DefaultValues<T>` is `DeepPartial<T>` (types/form.d.ts:19); `TextField.tsx:18` renders `undefined` as `''`, so the Select shows the empty state and zod reports `Pick a role` on submit exactly as before.

Update `Form.test.tsx:7` (`z.email()`), `TextField.test.tsx:7-9`, the Task 6 test (955, 968, 982), Task 7 (1124-1126, 1133, 1149, 1267-1269, 1277), Task 9 (1536-1550) and the README (1623-1628, 1632). Add to Global Constraints: "zod 4 idioms: `z.email()`, `error:` not `message:`, no `as never` in defaults."

### 2.6 Should #8 — `TextField` owns four props, composes the rest

`src/fields/TextField/TextField.tsx`:

```tsx
export type TextFieldProps = Omit<MuiTextFieldProps, 'name' | 'value' | 'error' | 'inputRef'> & {
  name: string
}

export function TextField({ name, helperText, disabled, onChange, onBlur, ...rest }: TextFieldProps) {
  const { field, fieldState } = useEzField(name, 'TextField')
  const { ref, value, disabled: fieldDisabled, onChange: fieldOnChange, onBlur: fieldOnBlur, ...fieldProps } = field

  return (
    <MuiTextField
      {...fieldProps}
      value={value ?? ''}
      onChange={(e) => {
        fieldOnChange(e)
        onChange?.(e)
      }}
      onBlur={(e) => {
        fieldOnBlur()
        onBlur?.(e)
      }}
      disabled={disabled ?? fieldDisabled}
      inputRef={ref}
      error={fieldState.invalid}
      helperText={fieldState.error?.message ?? helperText}
      {...rest}
    />
  )
}
```

The rule for every future field: omit only what the binding owns (`name`, `value`/`checked`, `error`, the ref prop); anything the consumer might reasonably also want (event handlers, `helperText`, `disabled`, `required`, `id`, `slotProps`) is merged, with hookform's handler running first. Test to add to `TextField.test.tsx`:

```tsx
it('calls a consumer onChange after updating the form value', async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  render(
    <Form schema={schema} defaultValues={{ email: '' }} onSubmit={() => {}}>
      <TextField name="email" label="Email" onChange={onChange} />
    </Form>,
  )
  await user.type(screen.getByLabelText('Email'), 'a')
  expect(onChange).toHaveBeenCalledTimes(1)
  expect(screen.getByLabelText('Email')).toHaveValue('a')
})
```

Apply the same rule to `useBooleanField`/`Checkbox`/`Switch` in Task 7/8 (`onChange?.(e, e.target.checked)` after `field.onChange`).

## 3. Things that are already right (protect these)

- `useEzFormContext(componentName)` as a guard with the `ez-form: <X> must be rendered inside <Form>` message (`useEzFormContext.ts:7-9`). The guard is real, not defensive: RHF's `useFormContext` is `React.useContext(HookFormContext)` with a `null` default (index.esm.mjs:1524, 1556) despite its non-null return type.
- `useEzField` reading `control` from context and not threading it (`useEzField.ts:4-8`); `SubmitButton`'s `useFormState()` the same way (plan 872-873). `useFormState` returns a proxy, so reading only `isSubmitting` re-renders only on that key.
- `TextField.tsx:17-23` spread order: `field` props first, bound props next, `{...rest}` last so the consumer wins on everything the binding does not own. `value ?? ''` keeps MUI controlled. `disabled` destructured on both sides so the merge is the only writer.
- `inputRef={ref}` (`TextField.tsx:20`) is load-bearing for a11y: RHF focuses the first invalid field on submit through that ref (index.esm.mjs:2091, 3185); the input's `aria-describedby` then reads the helper text. Every field must give RHF the real `<input>`.
- Ids: `TextField` correctly leaves `id` to MUI, which uses `React.useId` (TextField.js:136-138; @mui/utils useId.js:34-43), so ids are SSR-stable and unique when the same form renders twice. The Task 3 deferred minor ("no default id … SSR hydration note") can be closed as no-action. Label `htmlFor`, `${id}-helper-text` + `aria-describedby`, `aria-invalid` from `FormControl` error (TextField.js:206, 233, 241; InputBase.js:522) are all automatic.
- `Select` on top of `TextField select` (plan 1000-1026) inherits all of the above plus `role="combobox"`, `aria-labelledby`, `aria-required`, `aria-invalid` (SelectInput.js:718-728). Right choice.
- MUI 9 `slotProps.input.ref` for Checkbox/Switch (plan Global Constraints): `SwitchBase` forwards `slotProps.input` to the input slot (SwitchBase.js:210-230).
- `disabled` semantics: consumer `disabled` is UI-only and never passed to `useController({ disabled })`. This is correct, not an omission: RHF unsets field-disabled values before validation (`handleSubmit`, index.esm.mjs:3228-3231), which would make a disabled required field fail its own schema.
- `noValidate` before the spread (`Form.tsx:41-42`), `mode = 'onSubmit'` default, the `handleSubmit((values) => …)` arity wrap.
- Build: ESM only, `dts` reading `tsconfig.build.json` that excludes tests/stories/setup, `sideEffects: false`, `files: ["dist"]`, sourcemaps, `types` condition first.
- Tests: `userEvent.setup()` per test, `findByText` for async, `renderHook` + `wrapper` for the context hook, a small `renderForm` helper, no `fireEvent`/`act`/test ids. The "throws outside `<Form>`" test in every component file is the right ritual.
- Stories plan: decorator wrapping `<Form>`, `satisfies Meta<typeof X>`, `play({ canvas, userEvent })` from the story context (Storybook 10 `StoryContext` has `canvas`, `userEvent`, `mount`: storybook/dist/chunk-DEJsEo3q.d.ts:869-871), `fn` from `storybook/test` (export exists).
- One folder per component with `index.ts` re-export and a barrel that names exactly six symbols.

## 4. Explicit non-recommendations

- `id={name}` as the default input id: `name` may contain dots (`address.street`) and duplicates when a form renders twice; MUI's `useId` is already SSR-safe.
- Deriving `required` from the schema: zod 4's `.isOptional()` cannot see `min(1)`, `refine`, or unions; an explicit `required` prop is honest and matches MUI.
- Passing consumer `disabled` into `useController({ disabled })`: strips the value on submit (index.esm.mjs:3228-3231) and breaks required fields.
- `formRef`/`useImperativeHandle` or render-prop `children={(form) => …}`: `onSubmit(values, form)` covers the parent-side cases (reset, server errors) with no imperative surface; children already have `useFormContext`.
- An `aria-live` region for validation messages: RHF's focus-first-error + `aria-describedby` is the standard pattern and announces without a live region.
- A shared `BooleanField` frame component for Checkbox/Switch: two ~25-line files sharing `useBooleanField` is fine until a third boolean control appears.
- `useMemo(() => zodResolver(schema))`: RHF refreshes `control._options` every render anyway (index.esm.mjs:3626) and `zodResolver` allocates one closure.
- Importing types from `zod/v4` to keep zod 3.25 in the peer range: works, but the spec says zod 4 and the range is easier to narrow than to explain.
- Marking `@emotion/*` optional (MUI 9 does): one install line in the README is worth more than Pigment-CSS purity in v1.
- Re-exporting `useFormContext` or adding a typed `useEzForm()` hook: owner decision; `FormMethods` type covers the typing need.
- `React.memo`/`forwardRef` on fields: React 19 passes `ref` as a prop; the binding owns the input ref anyway.
- Omitting `children` from `TextFieldProps`: `Select` needs it.
- `exactOptionalPropertyTypes`: MUI's prop types are not written for it.
- Typed field names / `createForm(schema)` factory: deferred by the owner; §2.1's `TIn/TOut` shape is what such a factory would wrap, so nothing here blocks it.
