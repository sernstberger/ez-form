# ez-form

MUI + react-hook-form + zod, wired together so you write plain JSX.

```tsx
import { z } from 'zod'
import {
  Form,
  TextField,
  Select,
  Autocomplete,
  RadioGroup,
  CheckboxGroup,
  ToggleButtonGroup,
  Slider,
  Rating,
  NumberField,
  MoneyField,
  DatePicker,
  TimePicker,
  DateTimePicker,
  OtpField,
  FileField,
  Checkbox,
  Switch,
  SubmitButton,
} from 'ez-form'

const schema = z.object({
  email: z.email({ error: (iss) => (iss.input === '' ? 'Email is required' : 'Invalid email') }),
  role: z.enum(['admin', 'user'], { error: 'Pick a role' }),
  tos: z.boolean().refine(Boolean, { error: 'Required' }),
  newsletter: z.boolean(),
})

export function Signup() {
  return (
    <Form
      schema={schema}
      defaultValues={{ email: '', role: 'user', tos: false, newsletter: false }}
      onSubmit={(values) => console.log(values)}
    >
      <TextField name="email" label="Email" />
      <Select
        name="role"
        label="Role"
        options={[
          { value: 'admin', label: 'Admin' },
          { value: 'user', label: 'User' },
        ]}
      />
      <Checkbox name="tos" label="I accept the terms" />
      <Switch name="newsletter" label="Newsletter" />
      <SubmitButton />
    </Form>
  )
}
```

## Install

```bash
pnpm add ez-form @mui/material @mui/x-date-pickers @emotion/react @emotion/styled @base-ui/react react-hook-form zod
```

`@base-ui/react` backs `NumberField`, `MoneyField`, and `OtpField`; `@mui/x-date-pickers` backs the three pickers. Both are tree-shakeable, and you also install one date adapter library (`date-fns`, `dayjs`, `luxon`, or `moment`) for the pickers — see "Date pickers" below.

Requires zod 4 (the types use zod 4's `ZodType<Output, Input>`) and TypeScript >= 5.4 (the types use `NoInfer`).

## Components

| Component                                      | Wraps                                         | Extra props                                                                                                                                                                                                                              |
| ---------------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Form`                                         | `useForm` + `<form>`                          | `schema`, `onSubmit(values, form)`, `defaultValues?` (object or async function), `values?`, `resetOptions?`, `ref?`, `mode?`, `disabled?`; fields disable while `onSubmit` is pending or async defaults are loading                      |
| `TextField`                                    | MUI `TextField`                               | `name`; rules `required`, `min`, `max`, `minLength`, `maxLength`, `pattern`, `validate`                                                                                                                                                  |
| `Select`                                       | MUI `TextField select`                        | `name`, `options: readonly SelectOption[]` (`{ value: string \| number; label: string }`); the same rules as TextField, typed over the option value                                                                                      |
| `RadioGroup`                                   | MUI `RadioGroup`                              | `name`, `label` (legend), `options: readonly Option[]`, `helperText?`; rules `required`, `validate`. The form value keeps the option's type                                                                                              |
| `CheckboxGroup`                                | MUI `FormGroup` + `Checkbox`                  | `name`, `label` (legend), `options: readonly Option[]`, `row?`, `helperText?`; rules `required` (at least one), `validate`. Value is `Option['value'][]` in `options` order                                                              |
| `ToggleButtonGroup`                            | MUI `ToggleButtonGroup`                       | `name`, `label` (legend), `options: readonly Option[]`, `exclusive?`, `helperText?`; rules `required`, `validate`. Value is `Option['value'] \| null` when exclusive, else `Option['value'][]`                                           |
| `Slider`                                       | MUI `Slider`                                  | `name`, `label` (legend), `helperText?`; rules `required`, `min`, `max` (also the slider bounds), `validate`. Value is a `number`, or `[number, number]` for a range                                                                     |
| `Rating`                                       | MUI `Rating`                                  | `name`, `label` (legend), `helperText?`; rules `required`, `validate`. Value is `number \| null`                                                                                                                                         |
| `Autocomplete`                                 | MUI `Autocomplete`                            | `name`, `options`, `getOptionValue?` (default `o => o.value`; return `o` to store objects), `multiple`, `freeSolo`, `textFieldProps?`; all TextField rules. Options may carry extra fields (they reach `onChange`)                       |
| `NumberField`                                  | Base UI `NumberField` in MUI's outlined style | `name`, `label?`, `helperText?`, `size?`; rules `required`, `min`, `max` (also the stepper bounds), `validate`. Value is `number \| null`; digits group while typing (new in v2.1), and `format={{ useGrouping: false }}` turns that off |
| `MoneyField`                                   | `NumberField` pinned to USD                   | `name`, `label?`, `helperText?`, `size?`; rules `required`, `min`, `max`, `validate`. Value is a `number` in dollars, rounded to the cent; shows `$1,234.50` on blur                                                                     |
| `DatePicker` / `TimePicker` / `DateTimePicker` | MUI X pickers                                 | `name`, `label?`, `helperText?`, `errorMessages?`; rules `required`, `validate`. The picker's own props (`minDate`, `disablePast`, `views`, …) pass through. Value is the adapter's date type or `null`                                  |
| `OtpField`                                     | Base UI `OTPField` in MUI's outlined style    | `name`, `label?`, `helperText?`, `length?` (6), `mask?`, `validationType?`, `size?`; rules `required`, `validate`. Value is the code string; a partial code fails with `<label> must be <length> characters.`                            |
| `FileField`                                    | MUI `Button` + hidden `<input type="file">`   | `name`, `label` (button text), `accept?`, `multiple?`, `buttonProps?`, `helperText?`; rules `required`, `validate`. Value is `File \| null`, or `File[]` under `multiple`                                                                |
| `Checkbox`                                     | MUI `Checkbox`                                | `name`, `label`, `helperText?`; rules `required`, `validate`                                                                                                                                                                             |
| `Switch`                                       | MUI `Switch`                                  | `name`, `label`, `helperText?`; rules `required`, `validate`                                                                                                                                                                             |
| `SubmitButton`                                 | MUI `Button`                                  | `loading` while submitting, disabled while the form is                                                                                                                                                                                   |

Every field shows its zod message as helper text (linked to the input with `aria-describedby`; the first invalid field is focused on submit). The error text is a live region (`role="alert"`), so it is announced in `onChange`/`onBlur` modes as well. Fields must be rendered inside `<Form>`. Consumer `onChange`/`onBlur` handlers run after the form's own.

Need `reset`, `setError`, `watch`? `onSubmit` receives the form methods as its second argument (the same object `useFormContext()` returns), so the component that owns the form can handle server errors or reset after success:

```tsx
<Form
  schema={schema}
  defaultValues={emptyValues}
  onSubmit={async (values, form) => {
    const res = await save(values)
    if (res.error) form.setError('email', { message: res.error })
    else form.reset()
  }}
>
```

Inside child components use `useFormContext()` from `react-hook-form`.

Numbers: NumberField stores `number | null`, so use `z.number()` (add `.nullable()` if empty is allowed). TextField hands zod the string from the input, so a numeric TextField needs `z.coerce.number()`.

## Loading values from a server

```tsx
// Form owns the fetch: disabled while loading, filled when it resolves
<Form schema={schema} defaultValues={async () => (await fetch('/api/me')).json()} onSubmit={save}>

// Or hand it the data from a hook: the form re-syncs whenever `values` changes
const { data } = useQuery(...)
<Form schema={schema} values={data} resetOptions={{ keepDirtyValues: true }} onSubmit={save}>

// Reset or set values from a parent through `ref`
const form = useRef<FormMethods<Input, Output>>(null)
<Form ref={form} …>  …  <Button onClick={() => form.current?.reset()}>Clear</Button>
```

A rejected async `defaultValues` promise currently leaves the form disabled (a known limitation, not a feature).

## Validation rules

Every field also takes hookform-style rules as props. A bare value gets a message derived from the label; `{ value, message }` customizes it. A rule error wins over zod's message for that field; zod still validates everything else, handles cross-field checks, and types `onSubmit`.

```tsx
<TextField name="email" label="Email" required />                                   // "Email is required."
<TextField name="email" label="Email" required="You must enter something here!" />  // custom
<TextField name="age" label="Age" required min={18} max={{ value: 99, message: 'Nobody is that old' }} />
<TextField name="nick" label="Nickname" minLength={3} maxLength={{ value: 12, message: 'Too long!' }} pattern={/^[a-z]+$/} />
<TextField name="user" label="Username" validate={(v) => v !== 'admin' || 'Reserved'} />
<Checkbox name="tos" label="I accept the terms" required />                          // must be checked
```

| rule                      | fields                                                   | default message                                                                       |
| ------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `required`                | all                                                      | `<label> is required.` (also renders the asterisk)                                    |
| `min` / `max`             | TextField, Select, Autocomplete, NumberField, MoneyField | `<label> must be at least/most <value>.` Numbers, or date strings (compared as dates) |
| `minLength` / `maxLength` | TextField, Select, Autocomplete                          | `<label> must be at least/most <value> characters.`                                   |
| `pattern`                 | TextField, Select, Autocomplete                          | `<label> is invalid.`                                                                 |
| `validate`                | all                                                      | a returned string; `false` gives `<label> is invalid.`                                |

`required` fails on empty or `false`; `min`/`max`/length/`pattern` rules are skipped while the value is empty; `validate` always runs (so `validate={(v) => v || 'You must opt in'}` works on an unchecked checkbox). Rules run in hookform's order, first failure wins.

## Date pickers

`DatePicker`, `TimePicker`, and `DateTimePicker` wrap MUI X. Wrap your app in MUI X's `LocalizationProvider` with the adapter you use; the form stores whatever that adapter produces (a `Date` under `AdapterDateFns`, a `Dayjs` under `AdapterDayjs`), so type the field accordingly (`z.date()`, or `z.custom<Dayjs>()`).

```tsx
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'

;<LocalizationProvider dateAdapter={AdapterDateFns}>
  <Form
    schema={z.object({ start: z.date().nullable() })}
    defaultValues={{ start: null }}
    onSubmit={save}
  >
    <DatePicker name="start" label="Start" minDate={new Date()} required />
  </Form>
</LocalizationProvider>
```

The picker's own validation (`minDate`, `disablePast`, an unparsable date, …) shows through the field like any rule: `Start is too early.`, `Start must be in the future.`, `Start is invalid.`, `Start is not available.` Override per code with `errorMessages={{ minDate: 'Pick a later day' }}`.

## Autocomplete

Address lookup (Places-style): the options list is fed by an async lookup, and the free-typed text is kept even if it doesn't match a suggestion.

```tsx
<Autocomplete
  name="address"
  label="Address"
  freeSolo
  autoSelect
  options={predictions} // [{ value: description, label: description, placeId }]
  loading={loading}
  filterOptions={(x) => x}
  onInputChange={(_, q, reason) => reason === 'input' && lookup(q)}
  onChange={(_, v) => v && typeof v === 'object' && fetchDetails(v.placeId)}
/>
```

The form stores the address string (`z.string()`); `placeId` reaches `onChange` but isn't stored. For objects in form state use `getOptionValue={(o) => o}` and a `z.object` schema.

## NumberField

Digits group as you type for every consumer (new in v2.1): typing `1234` shows `1,234` before any blur. Pass `format={{ useGrouping: false }}` to turn grouping off. Pasted numbers group on blur rather than on paste, because Base UI handles the paste itself.

```tsx
<NumberField name="age" label="Age" min={18} max={120} />
```

## MoneyField

USD only: digits group as you type (`1234` shows `1,234`) and the field formats to `$1,234.50` on blur. The form value is always a plain `number` in dollars — never cents, never a string — and it rounds to the cent, so typing `19.999` submits `20`.

```tsx
<MoneyField name="price" label="Price" min={0} />
```

```ts
const schema = z.object({ price: z.number().min(0) })
```

## Develop

```bash
pnpm install
pnpm storybook   # http://localhost:6006 (with the a11y addon panel)
pnpm test        # vitest + Testing Library, plus jest-axe accessibility checks per component
pnpm build
```

MIT
