# ez-form

MUI + react-hook-form + zod, wired together so you write plain JSX.

```tsx
import { z } from 'zod'
import { Form, TextField, Select, Checkbox, Switch, SubmitButton } from 'ez-form'

const schema = z.object({
  email: z.email({ error: 'Invalid email' }),
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
pnpm add ez-form @mui/material @emotion/react @emotion/styled react-hook-form zod
```

Requires zod 4 (the types use zod 4's `ZodType<Output, Input>`).

## Components

| Component      | Wraps                  | Extra props                                                                                                            |
| -------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `Form`         | `useForm` + `<form>`   | `schema`, `onSubmit(values, form)`, `defaultValues?`, `mode?`, `disabled?`; fields disable while `onSubmit` is pending |
| `TextField`    | MUI `TextField`        | `name`                                                                                                                 |
| `Select`       | MUI `TextField select` | `name`, `options: readonly { value, label }[]`                                                                         |
| `Checkbox`     | MUI `Checkbox`         | `name`, `label`, `helperText?`, `required?`                                                                            |
| `Switch`       | MUI `Switch`           | `name`, `label`, `helperText?`, `required?`                                                                            |
| `SubmitButton` | MUI `Button`           | `loading` while submitting, disabled while the form is                                                                 |

Every field shows its zod message as helper text (linked to the input with `aria-describedby`; the first invalid field is focused on submit). Fields must be rendered inside `<Form>`. Consumer `onChange`/`onBlur` handlers run after the form's own.

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

Numbers: `TextField` hands zod the string from the input, so use `z.coerce.number()` (not `z.number()`) for numeric text fields.

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

| rule                      | fields            | default message                                        |
| ------------------------- | ----------------- | ------------------------------------------------------ |
| `required`                | all               | `<label> is required.` (also renders the asterisk)     |
| `min` / `max`             | TextField, Select | `<label> must be at least/most <value>.`               |
| `minLength` / `maxLength` | TextField, Select | `<label> must be at least/most <value> characters.`    |
| `pattern`                 | TextField, Select | `<label> is invalid.`                                  |
| `validate`                | all               | a returned string; `false` gives `<label> is invalid.` |

`required` fails on empty or `false`; `min`/`max`/length/`pattern` rules are skipped while the value is empty; `validate` always runs (so `validate={(v) => v || 'You must opt in'}` works on an unchecked checkbox). Rules run in hookform's order, first failure wins.

## Develop

```bash
pnpm install
pnpm storybook   # http://localhost:6006 (with the a11y addon panel)
pnpm test        # vitest + Testing Library, plus jest-axe accessibility checks per component
pnpm build
```

MIT
