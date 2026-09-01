# Task 4c: field-level validation rules (owner requirement, approved shape)

## What the owner asked for
Each field accepts hookform-style rules as individual props. A bare value gives a default message derived from the label; `{ value, message }` customizes it. Examples:

```tsx
<TextField name="email" label="Email" required />                                   // "Email is required."
<TextField name="email" label="Email" required="You must enter something here!" />  // custom
<TextField name="age" label="Age" required min={18} max={{ value: 99, message: 'Nobody is that old' }} />
<TextField name="nick" label="Nickname" minLength={3} maxLength={{ value: 12, message: 'Too long!' }} pattern={/^[a-z]+$/} />
<TextField name="user" label="Username" validate={(v) => v !== 'admin' || 'Reserved'} />
<Checkbox name="tos" label="I accept the terms" required />                          // must be checked
```

A rule error on a field wins over zod's message for that field (it is more specific); zod still validates everything else and still types `onSubmit`. `required` also renders MUI's asterisk.

## Verified facts about react-hook-form 7.87 (read from node_modules, do not re-derive)
- A resolver and built-in rules cannot both run (docs: "A resolver cannot be used with built-in validators"). The form-level `validate` option is NOT usable as the zod driver: its errors land under `errors.root.<key>` and stale keys are never cleared.
- `useController({ name, rules })` stores the rules in `_fields[name]._f` even when a resolver is present (they are just not executed).
- `_runSchema` calls the resolver as `resolver(values, context, getResolverOptions(names, _fields, ...))` and `options.fields` is a nested object where `get(options.fields, name)` is that field's `_f` (contains `required`, `min`, `max`, `minLength`, `maxLength`, `pattern`, `validate`, `mount`, `ref`, `name`). `options.names` lists the mounted names being validated.
- `get` and `set` (deep path helpers) and the types `ValidationRule`, `ValidationValueMessage`, `Validate`, `Message` are exported from `react-hook-form`.
- CORRECTED (Task 4b probe): form-level `disabled` DOES exclude fields from the submit payload; pending-submit disable is safe only because handleSubmit captures values first.

## Design

### Public types — `src/rules.ts` (flat)
```ts
import type { FieldValues, Message, Validate, ValidationRule } from 'react-hook-form'

/** Hookform-shaped rules. A bare value uses the default message; `{ value, message }` overrides it. */
export interface FieldRules<TValue = unknown> {
  required?: Message | ValidationRule<boolean>
  min?: ValidationRule<number | string>
  max?: ValidationRule<number | string>
  minLength?: ValidationRule<number>
  maxLength?: ValidationRule<number>
  pattern?: ValidationRule<RegExp>
  validate?: Validate<TValue, FieldValues> | Record<string, Validate<TValue, FieldValues>>
}
export type BooleanFieldRules = Pick<FieldRules<boolean>, 'required' | 'validate'>
```
Export `FieldRules` and `BooleanFieldRules` types from the barrel (types only; the six component exports stay the only values).

### Normalization with default messages — `src/rules.ts`
`normalizeRules(rules: FieldRules, label: string | undefined): RegisterOptions-subset` converts every bare value to `{ value, message }` using the label (fallback `'This field'`):
| rule | default message |
|---|---|
| required | `${label} is required.` |
| min | `${label} must be at least ${value}.` |
| max | `${label} must be at most ${value}.` |
| minLength | `${label} must be at least ${value} characters.` |
| maxLength | `${label} must be at most ${value} characters.` |
| pattern | `${label} is invalid.` |
| validate returning `false` | `${label} is invalid.` (a returned string is the message) |
`required: 'msg'` (string) means `{ value: true, message: 'msg' }`; `required: false` drops the rule. `label` is derived from the field's `label` prop when it is a string; otherwise undefined.

### Field side — `useEzField(name, componentName, { label, rules })`
Normalizes and passes `rules` to `useController({ name, rules })`. Returns `{ field, fieldState, required: boolean }` so the component can set MUI `required` for the asterisk. `useBooleanField` forwards the same. Each field component's props: `Omit<Mui..., existing omissions | 'required'> & { name: string } & FieldRules<string>` (TextField/Select) or `& BooleanFieldRules` (Checkbox/Switch). The rule props are destructured out before spreading `rest`, so nothing leaks to MUI/DOM.

### Form side — composite resolver `src/Form/ezResolver.ts`
```ts
export function ezResolver<TIn extends FieldValues, TOut>(schema: z.ZodType<TOut, TIn>): Resolver<TIn, unknown, TOut>
```
Runs `zodResolver(schema)(values, ctx, options)`, then for each `name` in `options.names` reads `get(options.fields, name)` and runs `validateRules(_f, get(values, name), values)`; on a rule error, `set(errors, name, { type, message })` (rule error replaces zod's error for that field). Returns `{ values: {}, errors }` when any errors exist, else the zod result (so `onSubmit` still receives zod's parsed output). `Form.tsx` uses `ezResolver(schema)` instead of `zodResolver(schema)`; nothing else in Form changes.

`validateRules` mirrors hookform semantics and order (`required`, `min`, `max`, `maxLength`, `minLength`, `pattern`, `validate`; first failure wins):
- `required` fails on an empty value (`undefined | null | '' | []`) or `false`; `min`/`max`/`minLength`/`maxLength`/`pattern` are skipped for empty values; `validate` always runs (hookform runs it unconditionally). (Revised in Task 7 fix round 1; the original text said empty skipped everything.)
- `min`/`max`: numeric compare via `Number()` when both sides are numeric, else string compare (dates as ISO strings work); `minLength`/`maxLength` on `String(value).length`; `pattern.test(String(value))` with `lastIndex` reset for global regexes; `validate` fn or record, awaited, `string` = message, `false` = default message, `true`/`undefined` = pass.
- Error shape `{ type: <rule name or validate key>, message }`.

### Tests
- `src/Form/ezResolver.test.ts`: pure-function tests per rule (empty skip, order, custom message, validate record, zod error retained when no rule fails, rule error replaces zod error, parsed output returned when clean). Extend the vitest `include` to `src/**/*.test.{ts,tsx}` (review #12 already widens the build excludes similarly).
- `TextField.test.tsx`: `required` default message uses the label; `required="custom"`; `min`/`maxLength` shorthand default messages; asterisk rendered when `required`; rule error wins over zod's message for the same field; consumer `helperText` shows when no error.
- `Checkbox.test.tsx` (Task 7): `required` → "I accept the terms is required." when unchecked.
- Stories: `Fields/TextField/Rules` showing required/min/max/pattern with a submit button; Form/ValidationErrors uses `required` on every field so the messages are the friendly ones.

### Spec updates
Public API table: rules props per component; Error handling table: add row "field rule fails → composite resolver → fieldState.error → helper text (rule message wins over zod for that field)"; note zod remains the source of truth for types and cross-field validation.

### Where it goes in the plan
Insert as **Task 4c** between Task 4b and Task 5 (Task 5 SubmitButton is independent; Tasks 6-9 use the rule props in their tests/stories). Keep the plan format (Files / Interfaces / numbered Steps with code).
