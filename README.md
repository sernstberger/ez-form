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

## Why ez-form

ez-form is a thin binding layer, not a component library: MUI supplies the widgets,
react-hook-form the state, and zod the schema, so every prop and type traces back to
one of those three. Nothing in `src/` makes a styling judgement call — defaults live
only where a theme can override them — and every field ships accessible and
axe-tested by default. Every control ez-form renders is at least 24×24 CSS px, per
WCAG 2.5.8 Target Size (Minimum). The form owns submission, loading, and disabling;
fields just read from it. See [`docs/PHILOSOPHY.md`](docs/PHILOSOPHY.md) for the full
rules and the checklist a component must pass before it ships.

## Install

```bash
pnpm add ez-form @mui/material @mui/icons-material @mui/x-date-pickers @emotion/react @emotion/styled @base-ui/react react-hook-form zod
```

`@mui/x-date-pickers` is a required peer even if you use no picker: ez-form has a single entry point, so the package is always resolved. `@base-ui/react` backs `NumberField`, `MoneyField`, and `OtpField`; `@mui/x-date-pickers` backs the three pickers. Both are tree-shakeable, and you also install one date adapter library (`date-fns`, `dayjs`, `luxon`, or `moment`) for the pickers — see "Date pickers" below.

Requires zod 4 (the types use zod 4's `ZodType<Output, Input>`) and TypeScript >= 5.4 (the types use `NoInfer`).

## Components

| Component                                      | Wraps                                         | Extra props                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Form`                                         | `useForm` + `<form>`                          | `schema`, `onSubmit(values, form)`, `defaultValues?` (object or async function), `values?`, `resetOptions?`, `onDefaultValuesError?`, `ref?`, `mode?`, `disabled?`; fields disable while `onSubmit` is pending or async defaults are loading                                                                                                                                                                                                                                     |
| `FormSection`                                  | `<fieldset>` + `<legend>`                     | `title?`, `description?`, `slotProps?` (`legend`, `description`, `content`); group name is the legend, disabled disables every field in the group                                                                                                                                                                                                                                                                                                                                |
| `TextField`                                    | MUI `TextField`                               | `name`; rules `required`, `min`, `max`, `minLength`, `maxLength`, `pattern`, `validate`                                                                                                                                                                                                                                                                                                                                                                                          |
| `Select`                                       | MUI `TextField select`                        | `name`, `options: readonly SelectOption[]` (`{ value: string \| number; label: string }`); the same rules as TextField, typed over the option value                                                                                                                                                                                                                                                                                                                              |
| `RadioGroup`                                   | MUI `RadioGroup`                              | `name`, `label` (legend), `options: readonly Option[]`, `helperText?`; rules `required`, `validate`. The form value keeps the option's type                                                                                                                                                                                                                                                                                                                                      |
| `CheckboxGroup`                                | MUI `FormGroup` + `Checkbox`                  | `name`, `label` (legend), `options: readonly Option[]`, `row?`, `helperText?`; rules `required` (at least one), `validate`. Value is `Option['value'][]` in `options` order                                                                                                                                                                                                                                                                                                      |
| `ToggleButtonGroup`                            | MUI `ToggleButtonGroup`                       | `name`, `label` (legend), `options: readonly Option[]`, `exclusive?`, `helperText?`; rules `required`, `validate`. Value is `Option['value'] \| null` when exclusive, else `Option['value'][]`                                                                                                                                                                                                                                                                                   |
| `Slider`                                       | MUI `Slider`                                  | `name`, `label` (legend), `helperText?`; rules `min`, `max` (also the slider bounds), `validate` — no `required`, since a slider always reports a value. Value is a `number`, or `[number, number]` for a range                                                                                                                                                                                                                                                                  |
| `Rating`                                       | MUI `Rating`                                  | `name`, `label` (legend), `helperText?`; rules `required`, `validate`. Value is `number \| null`                                                                                                                                                                                                                                                                                                                                                                                 |
| `Autocomplete`                                 | MUI `Autocomplete`                            | `name`, `options`, `getOptionValue?` (default `o => o.value`; return `o` to store objects), `multiple`, `freeSolo`, `textFieldProps?`; all TextField rules. Options may carry extra fields (they reach `onChange`)                                                                                                                                                                                                                                                               |
| `NumberField`                                  | Base UI `NumberField` through MUI `TextField` | `name`, `label?`, `helperText?`, `size?`; rules `required`, `min`, `max` (also the stepper bounds), `validate`. Value is `number \| null`; digits group while typing (new in v2.1), and `format={{ useGrouping: false }}` turns that off                                                                                                                                                                                                                                         |
| `MoneyField`                                   | `NumberField` pinned to USD                   | `name`, `label?`, `helperText?`, `size?`; rules `required`, `min`, `max`, `validate`. Value is a `number` in dollars, rounded to the cent; shows `$1,234.50` on blur                                                                                                                                                                                                                                                                                                             |
| `DatePicker` / `TimePicker` / `DateTimePicker` | MUI X pickers                                 | `name`, `label?`, `helperText?`, `errorMessages?`; rules `required`, `validate`. The picker's own props (`minDate`, `disablePast`, `views`, …) pass through. Value is the adapter's date type or `null`                                                                                                                                                                                                                                                                          |
| `OtpField`                                     | Base UI `OTPField` in MUI's outlined style    | `name`, `label?`, `helperText?`, `length?` (6), `mask?`, `validationType?`, `size?`; rules `required`, `validate`. Value is the code string; a partial code fails with `<label> must be <length> characters.`                                                                                                                                                                                                                                                                    |
| `FileField`                                    | MUI `Button` + hidden `<input type="file">`   | `name`, `label` (button text), `accept?`, `multiple?`, `buttonProps?`, `helperText?`; rules `required`, `validate`. Value is `File \| null`, or `File[]` under `multiple`. `onChange(event, value)` fires on a pick and on a chip delete                                                                                                                                                                                                                                         |
| `Checkbox`                                     | MUI `Checkbox`                                | `name`, `label`, `helperText?`; rules `required`, `validate`                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `Switch`                                       | MUI `Switch`                                  | `name`, `label`, `helperText?`; rules `required`, `validate`                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `SubmitButton`                                 | MUI `Button`                                  | `loading` while submitting, disabled while the form is                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `Form` (v4 additions)                          | —                                             | `confirm?: true \| ConfirmOptions` asks after validation on every submit path; `guard?: boolean` warns on tab close while dirty                                                                                                                                                                                                                                                                                                                                                  |
| `ClearButton`                                  | MUI `Button`                                  | `to?: 'defaults' \| 'empty'`, `confirm?`; disabled while pristine                                                                                                                                                                                                                                                                                                                                                                                                                |
| `ConfirmDialog`                                | MUI `Dialog`                                  | `open`, `title`, `message?`, `confirmLabel?`, `cancelLabel?`, `confirmColor?`, `onConfirm`, `onCancel`; `useConfirm()` gives a promise API                                                                                                                                                                                                                                                                                                                                       |
| `Wizard`                                       | MUI `Stepper`                                 | `steps`, `step?`/`onStepChange?`, `visited?`/`onVisitedChange?`, `orientation?`, `layout?: 'steps' \| 'page'`; with `WizardStepper`, `WizardStep`, `WizardNav`, `useWizard`                                                                                                                                                                                                                                                                                                      |
| `ReadOnlyField`                                | MUI `Typography`                              | `name`, `label?`, `options?`, `format?`, `empty?`, `editStep?`                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `PasswordField`                                | ez-form `TextField`                           | `name`; same rules as TextField. `revealable?` (default `true`) shows a show/hide toggle in the end adornment; `autoComplete` defaults to `'current-password'`; `slotProps.toggle?` reaches the toggle `IconButton`                                                                                                                                                                                                                                                              |
| `PasswordStrength`                             | MUI `LinearProgress`                          | `name`; `score?: (password) => 0\|1\|2\|3\|4` (default a small built-in heuristic); `labels?` (5 strings). Renders as an ARIA `meter`, never registers or validates                                                                                                                                                                                                                                                                                                              |
| `TextareaField`                                | `TextField` with `multiline` fixed on         | `name`, `showCount?`; the same rules as TextField. Taller default (`minRows: 4`, `maxRows: 12`, both themeable); shows a `n / max` length meter when `maxLength` is set (or `showCount`), which turns into the validation error past the limit                                                                                                                                                                                                                                   |
| `DateField`                                    | MUI X `DateField`                             | Same shape as `DatePicker`, but no popup — a keyboard-only, sectioned date input. Better for birthdays and other far-away dates: typing beats paging a calendar back decades                                                                                                                                                                                                                                                                                                     |
| `ResendCodeButton`                             | MUI `Button`                                  | `onResend` (awaited if a promise; disabled while pending), `cooldown?` (seconds, default 30) shown in the label (`Resend code (27s)`); a rejected `onResend` shows `errorText?` (default "Code could not be sent") in the status slot instead, starts no cooldown, and calls `onResendError?(error)`. `slotProps.status` for the `role="status"` region that announces "Code sent" (or the error) once per resend. Disabled while the form is disabled (which covers submitting) |
| `FormError`                                    | MUI `Alert`                                   | Renders `formState.errors.root` (set via `form.setError('root.<key>', { message })`, e.g. a rejected async `onSubmit`); renders nothing when there is no root error                                                                                                                                                                                                                                                                                                              |
| `FormErrorSummary`                             | —                                             | `title?` (default "There is a problem"), `slotProps?` (`heading`, `list`, `item`, `link`); lists the last failed validation's errors as focusable links, GOV.UK-style — see "Error summary" below                                                                                                                                                                                                                                                                                |
| `FieldArray`                                   | hookform `useFieldArray`                      | `name`, `label` (array legend), `emptyRow`, `singular?`/`rowLabel?`, `minRows?`/`maxRows?`, `addLabel?`/`removeLabel?`, `reorder?`, `slotProps?`; children is a render prop `(row) => ...` given `row.name('field')` for the array path. Rows are keyed by hookform's `field.id`; Add/Remove/Move move focus and announce in a `role="status"` region                                                                                                                            |

`Form`'s `title` / `description` give the form its accessible name and instructions (wired to the `<form>` via `aria-labelledby` / `aria-describedby`); `slotProps.title.component` sets the heading level (default `h2`). `FormSection` groups fields in a `<fieldset>` named by its `title` (`<legend>`, heading level configurable via `slotProps.legend.component`, default `h3`); `description` is helper text wired via `aria-describedby`.

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

## Error summary

`<FormErrorSummary />` is a child you place — under the form's title, or inside the current
`WizardStep` — not a `<Form>` prop, since a wizard's summary should scope to one step while a
plain form's should not:

```tsx
<Form schema={schema} onSubmit={onSubmit} title="Sign up">
  <FormErrorSummary />
  <TextField name="email" label="Email" />
  <SubmitButton />
</Form>
```

It renders nothing until a submit (or, inside a `Wizard`, a `Next`/step change) has failed, then
lists the errors from that attempt: a heading ("There is a problem" by default, `title` to
override) that receives focus — the move to the heading is what announces the summary, GOV.UK's
own pattern deliberately omits `role="alert"` here so a screen reader doesn't announce it twice
alongside each field's own `role="alert"` helper text — and one link per invalid field showing
its message. Activating a link (click or Enter) focuses that field via `setFocus`, so it works
even without a native `href` target. Items disappear as their fields become valid, and the whole
summary disappears once none are left. While a summary is mounted, `<Form>` (and, inside a
`Wizard`, `Next`'s own step validation) suppresses react-hook-form's own "focus the first invalid
field" behavior so the two don't fight over focus.

Inside a `Wizard`, place one `<FormErrorSummary />` per `WizardStep`: each shows only that step's
own `fields` from its last failed `Next`, not the whole form's errors.
## Field arrays

`FieldArray` repeats a group of fields over a hookform `useFieldArray`. The array
is one `FormSection` named by `label`; each row is a nested `FormSection` named
`<singular> <n>`, so rows sit at the right heading level automatically.
`children` is a render prop: `row.name('email')` builds the full form path
(`applicants.0.email`), so the fields inside are ordinary ez-form fields.

```tsx
const schema = z.object({
  applicants: z
    .array(z.object({ name: z.string().min(1, 'Name is required'), email: z.email() }))
    .min(1, 'Add at least one applicant'),
})

<FieldArray
  name="applicants"
  label="Applicants"
  emptyRow={() => ({ name: '', email: '' })}
  minRows={1}
  maxRows={5}
  reorder
>
  {(row) => (
    <>
      <TextField name={row.name('name')} label="Name" />
      <TextField name={row.name('email')} label="Email" />
    </>
  )}
</FieldArray>
```

Rows are keyed by hookform's stable `field.id`, never by index, so removing a row
in the middle does not shuffle typed values between the rows that remain.

`emptyRow` is the value a new row starts from. Pass a function (called per Add) so
object rows are never shared by reference between rows.

Row names come from `singular`, which defaults to `label` with one trailing `s`
stripped. That guess is deliberately naive — `Applicants` gives `Applicant`, but
`Addresses` would give `Addresse` and `People` stays `People` — which is exactly
why `singular` exists; set it whenever the guess is wrong. A `label` that is an
element rather than a string cannot be stripped at all and falls back to `Row`, so
pass `singular` alongside a non-string `label`. `rowLabel={(index) => ...}` replaces
the whole name (legend and every button's accessible name) when numbering is not
what you want.

Accessibility is the component's job: Add moves focus into the new row's first
field, Remove moves it to the previous row (or the Add button when the first row
went), Move keeps focus on the button that was pressed as it travels with its row,
and a `role="status"` region announces `Row N added` / `removed` / `moved up`.
Every button's accessible name includes the row (`Remove Applicant 2`).
`minRows` disables Remove at the floor; `maxRows` disables Add at the ceiling.

An **array-level** message renders under the Add button as a `role="alert"`: zod's
`.min(1, msg)` / `.max(n, msg)` on the array itself lands there, as does
`form.setError('applicants.root', { message })`. Per-row field errors stay on their
own fields as normal helper text.

Themeable under `EzFieldArray` (`defaultProps`, `styleOverrides` for `root` | `row`
| `actions` | `add` | `remove` | `move` | `status` | `error`) and exported as
`fieldArrayClasses`. Note the class for the error slot is `fieldArrayClasses.errorText`:
MUI reserves `error` as a global state class (`Mui-error`), so only the `styleOverrides`
key is `error`.

## Wizard

One `<Form>` and one schema above every step. `Next` validates only the current step's `fields`; `Submit` on the last step validates everything.

```tsx
const steps = [
  { id: 'account', label: 'Account', fields: ['name', 'email'] },
  { id: 'plan', label: 'Plan', fields: ['plan'] },
  { id: 'review', label: 'Review' },
] as const satisfies WizardStepDef<z.input<typeof schema>>[]

<Form schema={schema} defaultValues={defaults} onSubmit={save} confirm>
  <Wizard steps={steps} orientation="vertical">
    <WizardStepper />
    <WizardStep id="account">…fields…</WizardStep>
    <WizardStep id="plan">…fields…</WizardStep>
    <WizardStep id="review">
      <ReadOnlyField name="email" editStep="account" />
    </WizardStep>
    <WizardNav />
  </Wizard>
</Form>
```

Every field in the schema should appear in exactly one step's `fields`. When Submit fails validation, the wizard moves to the first step (in `steps` order) owning an errored field and focuses that field once it mounts, so an error on a step you have navigated away from is never silent. A field listed in no step is validated only on final submit and its error belongs to the last step: that step is marked in the stepper, and a failed submit lands there.

Each `WizardStep` is a `FormSection` (a fieldset). Horizontally, the step's `title` defaults to its `label` from `steps` and renders as a heading in the legend; pass `title={null}` to render no legend. Vertically, the legend is suppressed and the section is named by the stepper's label via `aria-labelledby`, so the step has no visible legend but is still named for assistive technology; `description` works in both modes.

### Same steps, one page

`layout="page"` renders every `WizardStep` at once, in document order (steps order is by convention the order the `WizardStep`s appear as children, matching `steps`), each as its own named section — the same markup a horizontal step already uses. `WizardStepper` and `WizardNav` render nothing in this layout; wire a plain `<SubmitButton>` instead, which validates the whole schema in one pass, same as the last step of a `steps` wizard. `useWizard()` still works: `current` reports the first step and `layout` reports `'page'`, but `next`/`prev`/`go` are no-ops. It is entirely driven by `steps`/`WizardStep`, so the same array and step markup used for a `steps` wizard can render either layout by only changing the `layout` prop.

```tsx
<Wizard steps={steps} layout="page">
  <WizardStep id="account">…fields…</WizardStep>
  <WizardStep id="plan">…fields…</WizardStep>
  <WizardStep id="review">
    <ReadOnlyField name="email" editStep="account" />
  </WizardStep>
  <SubmitButton />
</Wizard>
```

Nested `FormSection`s (inside a step or anywhere else) get progressively deeper legend headings automatically — `h3` at the top level, `h4` one level in, `h5` the next, capped at `h6` — so a step with its own sub-sections still produces a correct heading hierarchy without hand-picking `slotProps.legend.component` at every level. An explicit `slotProps.legend.component` (your own, or a theme default) always overrides the automatic level.

### One route per step

`Wizard` is controlled through `step` / `onStepChange`; wire those to your router. With react-router, put `<Form>` + `<Wizard>` in a layout route and render the step routes through `<Outlet>`:

```tsx
function SignupLayout() {
  const { step = '' } = useParams()
  const navigate = useNavigate()
  return (
    <Form schema={schema} defaultValues={defaults} onSubmit={save}>
      <Wizard steps={steps} step={step} onStepChange={(s) => navigate(`/signup/${s.id}`)}>
        <WizardStepper />
        <Outlet />
        <WizardNav />
      </Wizard>
    </Form>
  )
}
// routes: { path: '/signup', element: <SignupLayout/>, children: [{ path: ':step', element: <SignupStep/> }] }
```

A URL for a step the user has not reached (a deep link, a reload) makes the wizard call `onStepChange` with the last visited step. To resume across reloads, save `visited` (via `onVisitedChange`) with your draft values and pass both back.

## Confirmations and guards

- `<Form confirm>`: dialog after validation, before `onSubmit`, on every submit path.
- `<ClearButton confirm>`: dialog before reset.
- `<Form guard>`: browser prompt on tab close / reload while dirty.
- `useFormGuard(useBlocker)`: in-app navigation; pass react-router's `useBlocker` and render a `ConfirmDialog` with the result.

## Theming

Every ez-form component registers with MUI's theme under `Ez<Name>` (`defaultProps`, `styleOverrides`, and a `<name>Classes` object for slot class names) — no styling is baked into the component itself, so a theme can override every default.

```tsx
const theme = createTheme({
  components: {
    EzForm: { defaultProps: { slotProps: { title: { component: 'h1', variant: 'h4' } } } },
    EzFormSection: { styleOverrides: { legend: { marginBottom: 8 } } },
    EzWizardNav: {
      defaultProps: { slotProps: { next: { variant: 'outlined' } } },
    },
    EzReadOnlyField: {
      styleOverrides: { label: { textTransform: 'uppercase' } },
    },
    EzNumberField: {
      styleOverrides: { steppers: { borderLeft: 'none' } },
    },
    EzPasswordField: {
      defaultProps: { slotProps: { toggle: { size: 'small' } } },
      styleOverrides: { toggle: { color: 'primary' } },
    },
    EzPasswordStrength: {
      styleOverrides: { bar: { height: 6 } },
    EzOtpField: {
      styleOverrides: { helperText: { marginLeft: 8 } },
    },
    EzFileField: {
      styleOverrides: { fileList: { marginTop: 16 } },
    },
  },
})
```

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

If the async `defaultValues` function rejects, the form re-enables with its fields empty
(no defaults were applied). Pass `onDefaultValuesError` to handle the rejection; without
it, the error rethrows as an unhandled rejection.

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

| rule                      | fields                                                                                                              | default message                                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `required`                | all except Slider                                                                                                   | `<label> is required.` (also renders the asterisk)                                                         |
| `min` / `max`             | TextField, TextareaField, Select, Autocomplete, NumberField, MoneyField, Slider (a number, or both ends of a range) | `<label> must be at least/most <value>.` Numbers, or date strings (compared as dates)                      |
| `minLength` / `maxLength` | TextField, TextareaField, Select, Autocomplete                                                                      | `<label> must be at least/most <value> characters.` (`maxLength` also drives TextareaField's length meter) |
| `pattern`                 | TextField, TextareaField, Select, Autocomplete                                                                      | `<label> is invalid.`                                                                                      |
| `validate`                | all                                                                                                                 | a returned string; `false` gives `<label> is invalid.`                                                     |

`required` fails on empty or `false`; `min`/`max`/length/`pattern` rules are skipped while the value is empty; `validate` always runs (so `validate={(v) => v || 'You must opt in'}` works on an unchecked checkbox). Rules run in hookform's order, first failure wins.

When you pass `validate` as a record, the keys `complete` (OtpField), `picker` (the date pickers), and `min`/`max` (Slider) are reserved for those fields' built-in checks and will override an entry of the same name.

## Date pickers

`DatePicker`, `TimePicker`, `DateTimePicker`, and `DateField` wrap MUI X. Wrap your app in MUI X's `LocalizationProvider` with the adapter you use; the form stores whatever that adapter produces (a `Date` under `AdapterDateFns`, a `Dayjs` under `AdapterDayjs`), so type the field accordingly (`z.date()`, or `z.custom<Dayjs>()`).

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

### When to use which

| Use case                                 | Prefer       | Why                                                                |
| ---------------------------------------- | ------------ | ------------------------------------------------------------------ |
| Birthdays, anniversaries, document dates | `DateField`  | Typing a date beats paging a calendar back 20/30/50+ years         |
| Scheduling near today                    | `DatePicker` | A calendar is faster to scan than typing when the date is close by |

`DateField` is a keyboard-only, sectioned input with no popup — the same `value`/`onChange`/`onError` contract as `DatePicker`, so it drops in wherever a birthday-shaped date is collected:

```tsx
<DateField name="birthday" label="Birthday" disableFuture minDate={new Date(1900, 0, 1)} required />
```

`disableFuture` plus a sane `minDate` catches typos without needing a calendar to navigate.

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

## TextareaField

`TextField` with `multiline` fixed on: a taller default (`minRows: 4`, `maxRows: 12`, both
themeable under `EzTextareaField.defaultProps`) that autogrows in between. Setting the
`maxLength` rule (or passing `showCount`) shows a length meter — `n` alone with no bound,
`n / max` with one — as a trailing element inside the helper text, associated via the same
`aria-describedby` id as the rest of the helper text. Past the limit the meter is replaced
by the normal `maxLength` validation error, never flagged by colour alone.

```tsx
<TextareaField name="bio" label="Bio" maxLength={500} />
```

```ts
const schema = z.object({ bio: z.string().max(500) })
```

Themeable under `EzTextareaField` (`root`, `counter`, exported as `textareaFieldClasses`).

## NumberField

Digits group as you type for every consumer (new in v2.1): typing `1234` shows `1,234` before any blur. Pass `format={{ useGrouping: false }}` to turn grouping off. Pasted numbers group on blur rather than on paste, because Base UI handles the paste itself.

It renders through MUI `TextField` — Base UI owns the value and the stepping, `TextField` owns the label, helper text and outlined look — and is themeable under `EzNumberField` (`root`, `steppers`, `increment`, `decrement`, exported as `numberFieldClasses`).

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

## PasswordField

`TextField` with `type` fixed to `password`/`text` by a show/hide toggle in the end adornment. The reveal state is local UI state only — it never reaches the form value, and it resets to hidden if the field unmounts. `autoComplete` defaults to `'current-password'`; pass `'new-password'` for sign-up/change-password fields.

```tsx
<PasswordField name="password" label="Password" />
<PasswordField name="newPassword" label="New password" autoComplete="new-password" revealable={false} />
```

The toggle is a themeable `IconButton` under `EzPasswordField` (`root`, `toggle`, exported as `passwordFieldClasses`); `slotProps.toggle` reaches it directly, but its `children` is always overridden — swap the reveal icons with `icons?: { show?: ReactNode; hide?: ReactNode }` instead, defaulted through `useDefaultProps` so `theme.components.EzPasswordField.defaultProps.icons` can replace them app-wide.

## PasswordStrength

A meter bound to a password field's live value, read with `useWatch` like `ReadOnlyField` — it never registers a field and never validates. Renders MUI `LinearProgress` as an ARIA `meter` (`role="meter"`, `aria-valuemin={0}`, `aria-valuemax={4}`, `aria-valuenow`, `aria-valuetext`) with a visible label in an `aria-live="polite"` region, so the tier is announced as it changes. An empty password renders the track at 0 with no label.

```tsx
<PasswordField name="password" label="Password" autoComplete="new-password" />
<PasswordStrength name="password" />
```

`score?: (password: string) => 0 | 1 | 2 | 3 | 4` defaults to a small built-in heuristic (length thresholds, character-class variety, a penalty for repeats/sequences) exported as `scorePassword`. Pass your own — `zxcvbn` / `@zxcvbn-ts`, for instance — to score by whatever rules you want:

```tsx
<PasswordStrength name="password" score={(pw) => toEzScore(zxcvbn(pw).score)} />
```

`labels?: readonly [string, string, string, string, string]` defaults to `['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong']`.

**Bundle size**: `PasswordStrength` lives in its own module and `PasswordField` does not import it, so a consumer using only `PasswordField` never pulls in `PasswordStrength` or `scorePassword` — a scorer like zxcvbn (~400 kB) stays opt-in. This is `sideEffects: false` plus a single ESM entry point (`package.json`) doing the work a bundler needs: unused named exports tree-shake out. `dist/index.js` itself, as a single-entry bundle, still contains every export's source (grepping it for `PasswordStrength` finds it) — the tree-shaking happens in the _consumer's_ bundler, not in this package's own build.

Themeable under `EzPasswordStrength` (`defaultProps`, `styleOverrides` for `root` | `bar` | `label`), exported as `passwordStrengthClasses`.

## Develop

```bash
pnpm install
pnpm storybook   # http://localhost:6006 (with the a11y addon panel)
pnpm test        # vitest + Testing Library, plus jest-axe accessibility checks per component
pnpm build
```

`pnpm check:guardrails` enforces rule 2 of `docs/PHILOSOPHY.md`: it scans `src/**/*.tsx`
(excluding stories, tests, `src/examples/**`, `src/test/**`) for `sx=`, `disableRipple`/
`focusRipple`, and literal `variant=`/`size=`/`color=` JSX attributes (a prop-driven value
like `variant={variant}` is fine; a string literal like `variant="contained"` is not), and
checks that every component exported from `src/index.ts` has a row in this README's
Components table. A line that's a deliberate, tracked exception can end with
`// guardrail: allow <reason, ideally an issue number>` to skip it; the script reports how
many lines were allow-listed so they stay visible. It runs in CI (`pnpm test:scripts` runs
its own `node --test` suite first).

MIT
