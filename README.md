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

React 18 and React 19 are both supported, `ref` included: `<Form ref>` (the form methods) and `<FormSection ref>` (the `<fieldset>`) are populated the same way on either major.

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
| `ZipField`                                     | `TextField`                                   | `name`; same rules as TextField, plus a built-in "5 digits" rule (`invalidMessage?`, default `'Enter a 5-digit ZIP code'`). Digits only, capped at 5 (anything else is stripped on type/paste); `inputMode="numeric"`, `autoComplete` defaults to `'postal-code'`. Value is the digit string                                                                                                                                                                                     |
| `StateSelect`                                  | `Select`                                      | `name`; same rules as Select. Options are the 50 states + DC by default; `territories?` adds PR, GU, VI, AS, MP. `autoComplete` defaults to `'address-level1'`. Value is the USPS abbreviation; also exports `US_STATES`/`US_TERRITORIES` option arrays                                                                                                                                                                                                                          |
| `AddressField`                                 | `TextField` + `StateSelect` + `ZipField`      | `name` (nested object), `legend?`/`description?` (renders a `FormSection`), `autoCompleteSection?` (`'shipping'`/`'billing'`/any section token, prefixes every autofill token), `street2?` (default `true`), `streetLabel?`/`street2Label?`/`cityLabel?`/`stateLabel?`/`zipLabel?`, `required`/`disabled`, `slotProps?`. `required` reaches street/city/state/zip, never street2; `addressSchema()` is the matching zod object                                                   |
| `DatePicker` / `TimePicker` / `DateTimePicker` | MUI X pickers                                 | `name`, `label?`, `helperText?`, `errorMessages?`; rules `required`, `validate`. The picker's own props (`minDate`, `disablePast`, `views`, …) pass through. Value is the adapter's date type or `null`                                                                                                                                                                                                                                                                          |
| `OtpField`                                     | Base UI `OTPField` in MUI's outlined style    | `name`, `label?`, `helperText?`, `length?` (6), `mask?`, `validationType?`, `size?`; rules `required`, `validate`. Value is the code string; a partial code fails with `<label> must be <length> characters.`                                                                                                                                                                                                                                                                    |
| `FileField`                                    | MUI `Button` + hidden `<input type="file">`   | `name`, `label` (button text), `accept?`, `multiple?`, `dropzone?`, `dropText?`, `maxSize?`, `maxFiles?`, `renderFile?`, `onFilesAdded?`, `buttonProps?`, `helperText?`; rules `required`, `validate`. Value is `File \| null`, or `File[]` under `multiple`. `onChange(event, value)` fires on a pick and on a chip delete                                                                                                                                                      |
| `Checkbox`                                     | MUI `Checkbox`                                | `name`, `label`, `helperText?`; rules `required`, `validate`                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `Switch`                                       | MUI `Switch`                                  | `name`, `label`, `helperText?`; rules `required`, `validate`                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `SubmitButton`                                 | MUI `Button`                                  | `loading` while submitting, disabled while the form is                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `Form` (v4 additions)                          | —                                             | `confirm?: true \| ConfirmOptions` asks after validation on every submit path; `guard?: boolean` warns on tab close while dirty; `submitPendingText?`/`submitSuccessText?`/`submitErrorText?` are the submit announcements (`false` suppresses one)                                                                                                                                                                                                                              |
| `ClearButton`                                  | MUI `Button`                                  | `to?: 'defaults' \| 'empty'`, `confirm?`; disabled while pristine                                                                                                                                                                                                                                                                                                                                                                                                                |
| `ConfirmDialog`                                | MUI `Dialog`                                  | `open`, `title`, `message?`, `confirmLabel?`, `cancelLabel?`, `confirmColor?`, `onConfirm`, `onCancel`, `actionsOrder?: 'cancel-confirm' \| 'confirm-cancel'` (default `'cancel-confirm'`; Cancel keeps `autoFocus` either way); `useConfirm()` gives a promise API                                                                                                                                                                                                              |
| `FormDialog`                                   | MUI `Dialog` + `Form`                         | `open`, `onClose(event, reason)`, `title`, `actions?`/`cancelLabel?`/`submitLabel?`, `exitConfirm?: ConfirmOptions \| false`, `closeOnSubmit?`; every `Form` prop (`schema`, `onSubmit`, `confirm`, …) and every `Dialog` prop (`maxWidth`, `fullScreen`, …). Closing while dirty asks first                                                                                                                                                                                     |
| `Wizard`                                       | MUI `Stepper`                                 | `steps`, `step?`/`onStepChange?`, `visited?`/`onVisitedChange?`, `orientation?`, `layout?: 'steps' \| 'page'`; with `WizardStepper`, `WizardStep`, `WizardNav` (`actionsOrder?: 'back-next' \| 'next-back'`, default `'back-next'`), `useWizard`                                                                                                                                                                                                                                 |
| `Wizard`                                       | MUI `Stepper`                                 | `steps`, `step?`/`onStepChange?`, `visited?`/`onVisitedChange?`, `orientation?`, `layout?: 'steps' \| 'page'`, `stepAnnouncement?`; with `WizardStepper`, `WizardStep`, `WizardNav` (`actionsOrder?: 'back-next' \| 'next-back'`, default `'back-next'`), `useWizard`                                                                                                                                                                                                            |
| `ReadOnlyField`                                | MUI `Typography`                              | `name`, `label?`, `options?`, `format?`, `empty?`, `editStep?` — or `value` (a caller-computed value, e.g. from its own `useWatch`) with `label` required and no `name`; never calls `useWatch` in that mode                                                                                                                                                                                                                                                                     |
| `PasswordField`                                | ez-form `TextField`                           | `name`; same rules as TextField. `revealable?` (default `true`) shows a show/hide toggle in the end adornment; `autoComplete` defaults to `'current-password'`; `slotProps.toggle?` reaches the toggle `IconButton`                                                                                                                                                                                                                                                              |
| `PhoneField`                                   | ez-form `TextField`                           | `name`; same rules as TextField, plus `format?` (a `#` template, default `'###-###-####'`) and `invalidMessage?`. The form value is digits only (`'5551234567'`); `type="tel"`, `inputMode="tel"`, `autoComplete` defaults to `'tel'`. A non-empty value shorter than the template's digit count fails with `invalidMessage`                                                                                                                                                     |
| `SsnField`                                     | ez-form `TextField`                           | `name`; same rules as TextField, plus a built-in "9 digits" rule (`invalidMessage?`, default `'Enter a 9-digit Social Security number'`). The form value is digits only (`'123456789'`), displayed as `123-45-6789`; `inputMode="numeric"`, `autoComplete="off"`. `reveal?` (default `true`) shows a show/hide toggle; hidden renders `type="password"`                                                                                                                          |
| `PasswordStrength`                             | MUI `LinearProgress`                          | `name`; `score?: (password) => 0\|1\|2\|3\|4` (default a small built-in heuristic); `labels?` (5 strings). Renders as an ARIA `meter`, never registers or validates                                                                                                                                                                                                                                                                                                              |
| `TextareaField`                                | `TextField` with `multiline` fixed on         | `name`, `showCount?`; the same rules as TextField. Taller default (`minRows: 4`, `maxRows: 12`, both themeable); shows a `n / max` length meter when `maxLength` is set (or `showCount`), which turns into the validation error past the limit                                                                                                                                                                                                                                   |
| `DateField`                                    | MUI X `DateField`                             | Same shape as `DatePicker`, but no popup — a keyboard-only, sectioned date input. Better for birthdays and other far-away dates: typing beats paging a calendar back decades                                                                                                                                                                                                                                                                                                     |
| `ResendCodeButton`                             | MUI `Button`                                  | `onResend` (awaited if a promise; disabled while pending), `cooldown?` (seconds, default 30) shown in the label (`Resend code (27s)`); a rejected `onResend` shows `errorText?` (default "Code could not be sent") in the status slot instead, starts no cooldown, and calls `onResendError?(error)`. `slotProps.status` for the `role="status"` region that announces "Code sent" (or the error) once per resend. Disabled while the form is disabled (which covers submitting) |
| `FormError`                                    | MUI `Alert`                                   | Renders `formState.errors.root` (set via `form.setError('root.<key>', { message })`, e.g. a rejected async `onSubmit`); renders nothing when there is no root error                                                                                                                                                                                                                                                                                                              |
| `FormErrorSummary`                             | —                                             | `title?` (default "There is a problem"), `slotProps?` (`heading`, `list`, `item`, `link`); lists the last failed validation's errors as focusable links, GOV.UK-style — see "Error summary" below                                                                                                                                                                                                                                                                                |
| `LiveRegion`                                   | —                                             | `message`, `announcementKey?` (bump to re-announce identical text), `politeness?` (`polite`/`assertive`), `visuallyHidden?` (default `true`), `component?`; the shared announcement region. `<Form>` renders one for submit status — see "Announcements" below                                                                                                                                                                                                                   |
| `FieldArray`                                   | hookform `useFieldArray`                      | `name`, `label` (array legend), `emptyRow`, `singular?`/`rowLabel?`, `minRows?`/`maxRows?`, `addLabel?`/`removeLabel?`, `reorder?`, `slotProps?`; children is a render prop `(row) => ...` given `row.name('field')` for the array path. Rows are keyed by hookform's `field.id`; Add/Remove/Move move focus and announce in a `role="status"` region                                                                                                                            |

`Form`'s `title` / `description` give the form its accessible name and instructions (wired to the `<form>` via `aria-labelledby` / `aria-describedby`); `slotProps.title.component` sets the heading level (default `h2`). `FormSection` groups fields in a `<fieldset>` named by its `title` (`<legend>`, heading level configurable via `slotProps.legend.component`, default `h3`); `description` is helper text wired via `aria-describedby`.

**Required vs optional.** `Form`'s `requiredIndicator` picks how a field's `required` rule is shown: `'asterisk'` (default) is today's behavior — a required field gets MUI's usual `*`. `'optional'` flips the convention: a required field still gets `required` / `aria-required` on its input, but renders no asterisk; a field that is not required gets `optionalText` appended to its label (default `'(optional)'`, override per-field with the field's own `optionalText` prop, or `false` to hide it on that one field). `Form` also states whichever convention is active once via `requiredIndicatorText`, rendered in the same `description` slot — appended as a second sentence when `description` is also set, or alone when it is not. The default text is mode-dependent: `'Required fields are marked with an asterisk (*).'` in `'asterisk'` mode (the `*` is spelled out as a word so it reads sensibly to assistive tech, the way MUI's own `FormLabel` asterisk is `aria-hidden`), `'All fields are required unless marked optional.'` in `'optional'` mode. Pass a string to use it verbatim in either mode, or `requiredIndicatorText={false}` to suppress it. Per field, nothing extra is added beyond `required`/`aria-required` — the input's own required state is what assistive tech announces; an additional hidden "required" string would double-announce it. All three props are theme-defaultable through `theme.components.EzForm.defaultProps`.

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

### Checkbox vs Switch

| Use case                                                                                                                                                      | Prefer     | Why                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------- |
| A yes/no answer or opt-in recorded on submit ("I accept the terms", "Same as shipping", "Insure a vehicle")                                                   | `Checkbox` | Reviewed and only takes effect once the form is submitted |
| One of several independent options                                                                                                                            | `Checkbox` | `CheckboxGroup` — each option is its own recorded opt-in  |
| A setting that takes effect immediately, no submit step (dark mode, notifications on an autosaving settings page, a UI toggle whose `onChange` does the work) | `Switch`   | Nothing to submit — flipping it is the action             |

If the page has a Submit button, it is almost always a `Checkbox`. Both: phrase the label as the state when on ("Marketing emails"), never as a question ("Receive marketing emails?").

This follows [Material Design's selection-controls guidance](https://m3.material.io/components/switch/guidelines) and WCAG: MUI's `Switch` sets `role="switch"`, and assistive tech announces "on/off" for it — correct for a setting that takes effect immediately, wrong for an answer that is only recorded when the surrounding form is submitted.

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

## Announcements

Screen reader users get no feedback from a button that quietly starts an async submit, so
`<Form>` announces the submit lifecycle in a live region it renders itself — no wiring, and
nothing visible changes:

```tsx
<Form schema={schema} onSubmit={save}>   {/* announces "Submitting…", then "Submitted." or "Submit failed." */}
```

Each string is a prop, so it can be localised or turned off individually
(`false` suppresses just that one):

```tsx
<Form
  schema={schema}
  onSubmit={save}
  submitPendingText="Saving your answers…"
  submitSuccessText="Saved."
  submitErrorText={false}          // the page shows its own error banner instead
>
```

A _validation_ failure is deliberately not announced here: `onSubmit` never ran, and
`<FormErrorSummary />` already announces and lists what needs fixing. "Submit failed." is
reserved for a submit that started and then rejected.

The region itself is `<LiveRegion />`, exported for your own announcements:

```tsx
<LiveRegion message={saved ? 'Draft saved' : ''} />
```

It is visually hidden by default, `polite` by default (`politeness="assertive"` renders an
`alert` instead of a `status`), and takes `component` to render as something else — MUI's
`Typography`, say, when the text is also visible UI (`visuallyHidden={false}`).

Assistive tech only announces a live region when its _content changes_, so setting the same
text twice is silent. Pass a counter as `announcementKey` to force a re-announcement — it keys
the node, so an identical message mounts a fresh region and is heard again:

```tsx
<LiveRegion message="Could not save" announcementKey={attempt} />
```

Render a `LiveRegion` unconditionally with an empty `message` at rest, rather than mounting it
alongside its text: a region that appears in the same commit as its content has nothing to
change _from_, and that first announcement is unreliable. `Form`, `Wizard`, `FieldArray`,
`ResendCodeButton` and `PasswordStrength` all use this same component internally.

Because several of them can be on screen at once, one form may hold more than one
`role="status"` region — so in a test, query the one you mean by its slot class rather than by
role. The form's own submit-status region is `formClasses.status`:

```tsx
document.querySelector(`.${formClasses.status}`) // the form's, not a field's
```

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

### Step changes are announced and focused

Changing step swaps the page's content without moving the caret, so a screen reader user is left reading the old step. On every `Next` / `Back` / stepper click, the wizard moves focus to the new step's **heading** and announces the move in a live region it renders itself — no wiring:

```tsx
<Wizard steps={steps}>   {/* announces "Step 2 of 3, Plan" and focuses that step's heading */}
```

Focus goes to the step's container, not its first field: focusing an input announces the input and skips the step's name and position, so the user would hear "Email, edit" with no idea they had moved. It lands on the legend heading horizontally, on the stepper label the step is named by vertically (there is no legend there), and on the `<fieldset>` itself for a `title={null}` step, which has no naming element to reach.

The announcement is a function prop, so it can be localised or turned off:

```tsx
<Wizard
  steps={steps}
  stepAnnouncement={({ index, count, label }) => `Paso ${index + 1} de ${count}: ${label}`}
>

<Wizard steps={steps} stepAnnouncement={false} />   {/* silent; focus still moves */}
```

`index` and `count` are positions in the **effective** step list — a step hidden by `when` is not counted, so what the user hears matches what the stepper shows. `stepAnnouncement={false}` suppresses only the announcement; focus management is not optional.

Four cases deliberately stay quiet: initial mount (nothing changed, and stealing focus on load is hostile), a failed `Next` (the step did not change — `<FormErrorSummary />` announces and focuses instead), the failed-submit jump to the first errored step, which is `<FormErrorSummary />`'s arrival to own, and a controlled wizard's declined move. `layout="page"` never navigates, so it never announces.

That last case matters when `step`/`onStepChange` are wired to a router: both the announcement and the focus move wait until the wizard has actually _arrived_ on the requested step, so a transition your own code vetoes — or one that resolves a tick later through `navigate()` — never announces a step the user is not looking at.

Because a form can hold several `role="status"` regions at once, query this one by its slot class in a test:

```tsx
document.querySelector(`.${wizardClasses.status}`) // the wizard's, not the form's
```

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

### Conditional steps

A step can hide itself based on the form's own values: `WizardStepDef.when?: (values) => boolean`. Pass the full step list, including the conditional ones — `Wizard` derives the visible list itself, so you never filter `steps` by hand:

```tsx
const steps = [
  { id: 'account', label: 'Account', fields: ['name', 'email'] },
  { id: 'hasVehicle', label: 'Vehicle?', fields: ['hasVehicle'] },
  { id: 'vehicle', label: 'Vehicle', fields: ['vehicle'], when: (v) => v.hasVehicle },
  { id: 'review', label: 'Review' },
] as const satisfies WizardStepDef<z.input<typeof schema>>[]
```

A wizard with no `when` anywhere subscribes to nothing extra: `useWatch` is not called at all, not even in a disabled form — the subscription only exists once at least one step defines `when`. A wizard that does have a `when` re-renders on every form value change (it has to, to re-evaluate the predicates), but the effective `steps` array itself keeps its reference across a change that doesn't flip any predicate's answer — only a render where some step's `when` actually flips gets a new array, so a `WizardStepper`/`WizardNav`/`useWizard()` consumer memoized on `steps` doesn't re-run on every keystroke.

A hidden step disappears from the stepper and from `next`/`prev`/`go` navigation and `page` layout, and its `fields` are skipped by Next; if it was the current step, the wizard moves to the nearest visible step before it (or the first, if none qualify). `visited` still remembers a hidden step's id, so it comes back as completed — not upcoming — if it becomes visible again, and a saved `visited`/`step` that names a currently-hidden step resumes on the nearest visible one instead.

`when` only controls navigation and per-step validation — final submit still validates the whole schema, so a hidden step's fields need to be genuinely optional at the schema level (a `superRefine` that only requires them when the gate is true, or a discriminated union) the same way a field listed in no step's `fields` already does. If a hidden step's field still manages to fail final submit (a schema this loose lets it), the wizard treats it exactly like an error on a field listed in no step: it reports against the last step rather than the (unreachable, unmounted) step that owns it, and since that field was never mounted there's no input for `setFocus` to land on — the summary/error still renders, just without a working focus target. Keep a hidden step's fields truly optional in the schema and this never comes up in practice.

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

## Conditional fields

Show, hide, or require a field based on another field's value with `useWatch` + conditional JSX; the schema, not a hookform rule prop, decides what actually gets validated. `Form/ConditionalFields` in Storybook is a working reference for six patterns — checkbox reveal, select-value reveal, switch-toggled section, threshold, cascading selects, and mutually-exclusive fields — and `Checkout` (same-as-shipping, country → region), `SignUp` (referral source → "Other"), and `Loan` (employment "Other", income-below-threshold co-signer) use them in full examples.

```tsx
function BillingSection() {
  const sameAsShipping = useWatch<Input, 'sameAsShipping'>({ name: 'sameAsShipping' })
  return (
    <FormSection title="Billing address">
      <Checkbox name="sameAsShipping" label="Same as shipping address" />
      {!sameAsShipping && (
        <>
          <TextField name="billing.street" label="Street address" />
          {/* …rest of the address, no `required` prop… */}
        </>
      )}
    </FormSection>
  )
}
```

**Schema side.** A hookform `required` (or any rule prop) always wins over zod's message for that field (see the Validation rules section), so a field that is required only sometimes should carry no rule prop at all — express "required when" once, in the schema:

- **`superRefine`** for "required only when shown": check the controlling value and `ctx.addIssue` with an explicit `path` when the dependent field is empty. This is the right tool whenever the branches mostly share the same shape (`Checkout`'s billing address, `SignUp`'s referral-other, `Loan`'s co-signer note).
- **`z.discriminatedUnion`** reads better when the branches genuinely don't share fields — "contact by phone" needs a phone number, "contact by email" needs an email address, and neither needs the other's field. Tag the union on the controlling field (`contactBy`) and let each branch declare only what it needs; `ConditionalFields`'s pattern 6 is a worked example.

Either way, the message shown to the user comes from the schema, not from a rule prop that can't tell "hidden" from "shown but empty" apart.

> **Zod gotcha:** by default, zod skips a top-level `.refine()`/`.superRefine()` entirely once anything else in the same object produced a "non-continuable" issue — a `z.enum`/`z.literal`/discriminated-union mismatch, among others — even in a completely unrelated field on a completely unrelated step. A blank `purpose` `Select` three steps away can silently swallow your `superRefine`'s messages, and an unchecked "accept terms" `z.literal(true)` can just as easily swallow a `.refine()` checking two other fields match. Pass `{ when: () => true }` as the second argument to make the refinement run regardless of what else in the object failed: `.refine(fn, { when: () => true, ... })` / `.superRefine(fn, { when: () => true })`. Every top-level `refine`/`superRefine` in `ConditionalFields`, `Checkout`, `SignUp`, and `Loan` does this for exactly that reason — a `.refine()` chained directly on a single field's own schema (not the object) is unaffected, since it runs as part of that field's own type resolution rather than the object's post-parse checks. Where the field itself is the thing that starts "empty," consider sidestepping the whole issue: a placeholder-select value can be typed as `z.union([z.enum([...]), z.literal('')])` so the empty state is a valid (if still-incomplete) member of the type rather than an aborting mismatch — trade-off is that "required" then has to be enforced by a separate check instead of the enum's own validation.

**Hidden values.** react-hook-form's default `shouldUnregister: false` means an unmounted field's value is **not** cleared when it disappears from the JSX — re-checking the box brings back what was typed before, which is usually what you want. Two cases call for clearing it on purpose instead:

- **The hidden value would be stale and wrong if left in the payload** — a state chosen for the old country no longer matches the new one's option list. Reset it explicitly with `resetField` (or `setValue`) in the change handler of the field that controls visibility, as `ConditionalFields`'s cascading-select pattern does:
  ```tsx
  <Select
    name="address.country"
    label="Country"
    options={COUNTRY_OPTIONS}
    onChange={() => resetField('address.region', { defaultValue: '' })}
  />
  ```
- **The hidden value must not be submitted at all** — omit it from the schema's output (a discriminated union already does this: the non-matching branch's fields are simply not part of that variant's type), or strip it in `onSubmit` before calling your API.

**Accessibility.** A revealed field gets focus only on an explicit user action (never automatically on reveal) — the section's `<legend>` already names the group, so a screen reader user tabbing in hears the group name before the new field, with no extra announcement needed. Nothing here uses a live region: a `role="status"`/`role="alert"` announcement is for something the user didn't directly cause (a server response, an array add/remove elsewhere on the page — see Field arrays); a field appearing directly under the control the user just operated needs no separate announcement. The one exception is a cascading reset (country → region): that clears a value the user can't see change, so keep the reset visible in the UI (the newly-emptied field renders with its placeholder, not a stale label) rather than trying to announce it.

## Confirmations and guards

- `<Form confirm>`: dialog after validation, before `onSubmit`, on every submit path.
- `<ClearButton confirm>`: dialog before reset.
- `<Form guard>`: browser prompt on tab close / reload while dirty.
- `useFormGuard(useBlocker)`: in-app navigation; pass react-router's `useBlocker` and render a `ConfirmDialog` with the result.
- `<FormDialog>`: a form in a dialog, which asks before closing with unsaved changes — see below.

## Form in a dialog

`FormDialog` is a `<Form>` inside a MUI `Dialog`, with the heading, the scrolling
content area and the action buttons already wired. It takes every `Form` prop and
every `Dialog` prop; you own `open` and `onClose`.

```tsx
const [open, setOpen] = useState(false)

<FormDialog
  open={open}
  onClose={() => setOpen(false)}
  title="Edit contact"
  schema={contactSchema}
  defaultValues={contact}
  onSubmit={async (values) => save(values)}
>
  <Stack spacing={2}>
    <TextField name="name" label="Name" />
    <TextField name="email" label="Email" />
  </Stack>
</FormDialog>
```

**Closing asks first.** Escape, a backdrop click, and the Cancel button all go
through the same gate: if the form is dirty, a `ConfirmDialog` appears
(`Discard changes?` / `Discard` / `Keep editing`) and `onClose` is called only if
it is confirmed — so `onClose` always means "it really is closing". A pristine
form closes with no prompt, and neither does one that has just been submitted
successfully (the same `isDirty && !isSubmitting && !isSubmitSuccessful` rule the
other guards use). Pass `exitConfirm` to change the copy, or `exitConfirm={false}`
to drop the prompt.

**Submitting closes it.** A successful submit calls `onClose(event, 'submit')`
after your `onSubmit` settles — so a save that rejects, or one that calls
`form.setError`, leaves the dialog open with its values intact.
`closeOnSubmit={false}` keeps it open for an "add another" flow.

`onClose`'s `reason` is MUI's own (`'escapeKeyDown'`, `'backdropClick'`) plus
`'cancelClick'` and `'submit'`.

**Actions.** The default footer is a Cancel `Button` and a `SubmitButton`, in that
DOM order; `cancelLabel` / `submitLabel` rename them and `slotProps.cancel` /
`slotProps.submit` reach them. Pass `actions` to replace both with your own — a
`type="submit"` button inside still submits the form. Cancel is disabled while a
submit is pending, since cancelling then would abandon a save already in flight.
A `slotProps.cancel.onClick` runs _before_ the close gate and does not replace it;
call `event.preventDefault()` in it to veto the close and keep the dialog open.

**Layout.** ARIA does not allow `role="dialog"` on a `<form>`, so the dialog's
paper stays a `div` and the `<form>` sits just inside it, carrying the paper's
flex layout through — long content still scrolls inside `DialogContent` while the
title and actions stay put. `title` names the dialog (`aria-labelledby`) and
whatever `Form` renders in its description slot describes it (`aria-describedby`) —
that includes the required-fields convention `Form` states by default, so the
dialog is described even when you pass no `description` of your own.

Theme it through `theme.components.EzFormDialog` (`defaultProps`, and
`styleOverrides` for the `root`, `form`, `title`, `content`, `actions`, `cancel`
and `submit` slots).

## Timeouts (OTP codes, sessions)

WCAG 2.2.1 Timing Adjustable requires that if a timeout — an OTP code expiry, a session timeout, or any server-side time limit — affects the user, you must either disable it, let the user adjust it to ≥20 seconds, or warn them ≥20 seconds before it expires so they can extend it for at least 10× longer. Form values are never lost across timeouts: `<Form>` holds them until submission or reset, so a user can resubmit after resending a code or re-authenticating.

A recommended pattern for OTP codes uses `<ResendCodeButton>` (which announces success/error via `role="status"`) and a countdown announced in a separate status region (not live, so it doesn't tick into assistive tech every second). Warn when ≥20 seconds remain; if the user doesn't act, show a `<FormError>` with the root error and offer resend via `<ResendCodeButton>` or a `Keep me signed in` action for session timeouts. A visible countdown built with native `setInterval` and state (the example shows the pattern) is simpler than a library hook; ez-form ships no timer on purpose, since codegen only if a real flow drives it.

```tsx
import { useEffect, useRef, useState } from 'react'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { Form, FormMethods, OtpField, ResendCodeButton, FormError, SubmitButton } from 'ez-form'
import { z } from 'zod'

const schema = z.object({ code: z.string().min(6) })

function VerifyOtpContent({ onCodeSent }: { onCodeSent: () => void }) {
  const [expiry, setExpiry] = useState<number | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [warningAnnounced, setWarningAnnounced] = useState(false)
  const form = useRef<FormMethods<z.input<typeof schema>>>(null)

  useEffect(() => {
    if (!expiry) return
    const interval = setInterval(() => {
      const now = Date.now()
      const remaining = Math.max(0, Math.ceil((expiry - now) / 1000))
      setSecondsLeft(remaining)
      if (remaining === 0) {
        // Timeout: set root error, clear expiry to stop the countdown, user can resend
        form.current?.setError('root.timeout', { message: 'Code expired. Send a new one below.' })
        setExpiry(null)
        setWarningAnnounced(false)
      } else if (remaining === 20 && !warningAnnounced) {
        setWarningAnnounced(true)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [expiry, warningAnnounced])

  return (
    <Stack spacing={2}>
      <FormError />
      <OtpField name="code" label="Verification code" length={6} required />
      {expiry && secondsLeft > 0 && (
        <Stack spacing={1}>
          {secondsLeft >= 20 ? (
            <Typography variant="body2" color="warning.main">
              Code expires in {secondsLeft}s
            </Typography>
          ) : (
            <Typography variant="body2" color="error.main">
              Code expires in {secondsLeft}s
            </Typography>
          )}
          {warningAnnounced && secondsLeft < 20 && (
            <Typography component="span" variant="body2" role="status">
              Warning: 20 seconds left to enter code.
            </Typography>
          )}
        </Stack>
      )}
      <ResendCodeButton
        onResend={async () => {
          // Your API call here
          onCodeSent()
          setExpiry(Date.now() + 5 * 60 * 1000) // 5-minute expiry
          setWarningAnnounced(false)
        }}
        cooldown={30}
      />
      <SubmitButton />
    </Stack>
  )
}

export function VerifyOtp({ onCodeSent }: { onCodeSent: () => void }) {
  const form = useRef<FormMethods<z.input<typeof schema>>>(null)

  return (
    <Form ref={form} schema={schema} defaultValues={{ code: '' }} onSubmit={console.log}>
      <VerifyOtpContent onCodeSent={onCodeSent} />
    </Form>
  )
}
```

The `sign-up` example (a multi-step form with a verification step) shows this pattern in practice; see `src/examples/SignUp/SignUp.tsx`.

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
      styleOverrides: { fileList: { marginTop: 16 }, dropZone: { borderStyle: 'solid' } },
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

When you pass `validate` as a record, the keys `complete` (OtpField, PhoneField), `picker` (the date pickers), and `min`/`max` (Slider) are reserved for those fields' built-in checks and will override an entry of the same name.

Every rule message is a **string**, including the per-field message props (`invalidMessage` on `PhoneField`, `errorMessages` on the date pickers). react-hook-form's `Message` type is `string`, so a message has to survive the trip through `useController`'s rules to `fieldState.error.message` — a `ReactNode` cannot. Rich markup in an error belongs in your own `validate` or in `helperText`.

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

### Required dates

Use `z.date().nullable()` in the schema and `required` on the field — the same pattern as any other field. The `required` rule handles non-null enforcement and shows "Birthday is required." when empty. Do not reach for `z.date().nullable().refine(v => v !== null, { message })` — a schema-level non-null check would fight the `required` rule's message rather than compose with it.

```tsx
<Form
  schema={z.object({ birthday: z.date().nullable() })}
  defaultValues={{ birthday: null }}
  onSubmit={save}
>
  <DateField
    name="birthday"
    label="Birthday"
    disableFuture
    minDate={new Date(1900, 0, 1)}
    required
  />
</Form>
```

`disableFuture`, `minDate`, and other picker validations compose with `required` — compose them freely.

One ordering to know: paste something unparsable (`March 2, 2024`, say) into a **required** picker that is still empty and the message is `Birthday is required.`, not `Birthday is invalid.` MUI X parses an unrecognisable string to `null`, so the field really is empty, and `ezResolver` runs `required` before the picker's own code. Submit is blocked either way, and the message becomes `Birthday is invalid.` as soon as the field is not required or already holds a date. Nothing to configure — just don't be surprised by which of the two you see.

### Clearing a picker

MUI X's own `clearable` works as it does outside a form. Pass it — and any `onClear` of your own — where MUI X types it for the component you are using, which is not the same slot for both:

```tsx
// Popup pickers (DatePicker, TimePicker, DateTimePicker): the field slot.
<DatePicker name="start" label="Start" slotProps={{ field: { clearable: true, onClear } }} />

// DateField *is* the text field, so both are flat props.
<DateField name="birthday" label="Birthday" clearable onClear={onClear} />
```

(MUI X omits `clearable`/`onClear` from the popup pickers' `slotProps.textField` type, which is why they go on `slotProps.field` there.)

Clearing resets the picker's validation state along with the value, so an `invalidDate` left over from an unparsable paste goes away with it, and your `onChange` is called with `null` either way. Note that MUI X only renders the clear button while the field shows something — after an unparsable paste it blanks every section, so the button stays hidden until the user types into one.

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

## FileField

The default is a picker button over a hidden `<input type="file">`. `dropzone` wraps
it in a drop area; the button inside stays the keyboard and screen-reader path, so the
zone is deliberately not focusable and carries no role — drag-and-drop adds no second
tab stop. `dropText` (default `'Drag files here, or'`) is the zone's visible
instruction, and `dragActive` is a visual cue only.

```tsx
<FileField name="photos" label="Choose photos" multiple dropzone accept="image/*" />
```

`accept`, `maxSize` (bytes) and `maxFiles` (under `multiple`) are validation, not just
filtering: a picked _or dropped_ file that fails one is rejected — it never enters the
value — and the reason surfaces as the field's error through a built-in rule, so it
fails a submit too. Any change to the value clears it: an accepted pick or drop, or
removing a file with its chip (which is how you answer a `maxFiles` rejection). `accept` still goes on the
input as the native attribute, and it is matched the way the native input matches it
(`.ext` by suffix, `type/subtype` exactly, `type/*` by prefix).

| Prop       | Rejection message prop | Default                          |
| ---------- | ---------------------- | -------------------------------- |
| `maxSize`  | `maxSizeMessage`       | `'File is larger than {size}'`   |
| `accept`   | `acceptMessage`        | `'File type not accepted'`       |
| `maxFiles` | `maxFilesMessage`      | `'Choose at most {count} files'` |

`{size}` is replaced with the limit humanized (`1500000` → `1.5 MB`) and `{count}` with
the limit; both messages are props, so they translate.

Under `multiple`, a pick or drop **appends** to the value rather than replacing it, so a
drop zone used twice accumulates and `maxFiles` means "at most n in total"; files come
off with their chips. A single-file field still replaces.

The library uploads nothing. `onFilesAdded(files)` fires once per pick or drop with the
files that passed — start your upload there — and `renderFile(file, index)` replaces the
default chip so you can render your own progress:

```tsx
<FileField
  name="photos"
  label="Choose photos"
  multiple
  dropzone
  maxSize={2_000_000}
  onFilesAdded={(files) => files.forEach(upload)}
  renderFile={(file) => <LinearProgress variant="determinate" value={percent(file)} />}
/>
```

Themeable under `EzFileField` (`root`, `fileList`, `deleteIcon`, `dropZone`, `dragActive`,
`dropText`, exported as `fileFieldClasses`).

## Mobile keyboards & autofill

`TextField`, `NumberField`, `MoneyField`, and `OtpField` set `autoComplete` / `inputMode` defaults so mobile keyboards and password managers do the right thing without per-field wiring. A default only applies when the consumer sets neither the prop nor its `slotProps.htmlInput` equivalent — an explicit value always wins.

| Component     | Condition                                                             | `autoComplete`  | `inputMode`     |
| ------------- | --------------------------------------------------------------------- | --------------- | --------------- |
| `TextField`   | `type="email"`                                                        | `email`         | `email`         |
| `TextField`   | `type="tel"`                                                          | `tel`           | `tel`           |
| `TextField`   | `type="url"`                                                          | `url`           | `url`           |
| `TextField`   | `type="search"`                                                       | — (not guessed) | `search`        |
| `TextField`   | any other `type` (including no `type`)                                | — (not guessed) | — (not guessed) |
| `NumberField` | integer-only (no fractional `step`, no `format` with fraction digits) | —               | `numeric`       |
| `NumberField` | otherwise (fractional `step`, or a `format` with fraction digits)     | —               | `decimal`       |
| `MoneyField`  | always (currency has cents)                                           | —               | `decimal`       |
| `OtpField`    | first slot only, from Base UI itself, not duplicated here             | `one-time-code` | `numeric`       |
| `PhoneField`  | always — set by the field itself, not the `type="tel"` fallback       | `tel`           | `tel`           |
| `SsnField`    | always — an SSN has no autofill token, so `off` is deliberate         | `off`           | `numeric`       |

`TextField` never guesses a token from `name` — a wrong guess is worse than none, so only these unambiguous `type`s get a default. `PasswordField` covers `autoComplete="current-password"` / `"new-password"` on its own, above. `PhoneField` sets `type="tel"`, `inputMode="tel"` and its `autoComplete` default itself rather than relying on the `type`-derived fallback — the two agree, but the field owns them — and its `autoComplete` takes a sectioned token (`"shipping tel"`, `"work tel"`) for forms with more than one number. `SsnField` pins `autoComplete="off"` rather than offering it as a prop: there is no autofill token for a Social Security number, and inviting a browser to store one is the wrong default. The remaining v8 date/time/address fields (#18–#19) will extend this table.

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

## US fields

`PhoneField` and `SsnField` are the template-driven US fields. They share one rule: **the form value is the bare digits, and the template only decides how they are displayed.** So a zod schema stays a plain `z.string()` with no regex — the field itself owns completeness — and the value you submit, store and compare is always canonical, whatever the user typed or pasted.

```tsx
const schema = z.object({ phone: z.string() })

<PhoneField name="phone" label="Phone" required />
// user types 5551234567 → shows "555-123-4567", submits { phone: '5551234567' }
```

`format` is a `#` template: every `#` is a digit slot, every other character is a separator inserted between them. It also sets the field's capacity — the number of `#`s is how many digits the input accepts and how many the built-in completeness rule requires:

```tsx
<PhoneField name="phone" label="Phone" format="(###) ###-####" />
```

Typing formats progressively (`555`, then `555-5`), so a separator only appears once a digit follows it. Pasting normalises: `(555) 555-5555`, `555.555.5555` and `+1 555 555 5555` all land as `5555555555` — a leading `1` on an eleven-digit paste is read as the country code and dropped. Anything that is not a digit is ignored, and extra digits past the template's capacity never make it in.

The caret stays with the digit being edited rather than jumping to the end: the field records how many digits sit to the left of the caret _before_ reformatting and restores that position afterwards. Backspace onto a separator deletes the digit that separator follows, so the key does what it looks like it should instead of silently doing nothing.

A value that is non-empty but incomplete fails on submit with `invalidMessage`, which defaults to `Enter a <n>-digit phone number` with `<n>` derived from the template. An empty value is left to `required` (so an optional phone field can simply be left blank), and the value is `''` rather than `undefined` when empty, so `required` still applies:

```tsx
<PhoneField name="phone" label="Phone" invalidMessage="We need all ten digits" />
```

`autoComplete` defaults to `'tel'`; pass a sectioned token when the form has more than one number:

```tsx
<PhoneField name="homePhone" label="Home" autoComplete="home tel" />
<PhoneField name="workPhone" label="Work" autoComplete="work tel" />
```

`format`, `invalidMessage` and `autoComplete` are all settable app-wide through `theme.components.EzPhoneField.defaultProps`; a prop on the element always wins. `PhoneField` adds no styled slot of its own — it renders a `TextField`, so MUI's own `MuiTextField` / `MuiOutlinedInput` style keys reach it unchanged.

### SsnField

The same template machinery, with the template fixed at `###-##-####` — an SSN has one canonical rendering, so there is no `format` prop to get it wrong with. The form value is the bare nine digits; `123-45-6789`, `123 45 6789` and `123456789` all paste to `'123456789'`.

```tsx
const schema = z.object({ ssn: z.string() })

<SsnField name="ssn" label="Social Security number" required />
```

**It is hidden by default.** While hidden the input is `type="password"`, so the browser masks the formatted text and the number survives a shoulder-surf; the toggle switches to `type="text"` to check an entry, and the reveal state is local to the field — it never reaches the form value and resets on unmount. `reveal={false}` removes the toggle entirely.

```tsx
<SsnField name="ssn" label="Social Security number" reveal={false} />
```

Masking hides the digits, not the shape: nine dots plus two separators is what `type="password"` renders. That is the same trade every masked field makes, and it is what lets the field be a plain `<input>` with real caret, paste and screen-reader behaviour rather than a custom widget.

A value that is non-empty but shorter than nine digits fails on submit with `invalidMessage`, default `Enter a 9-digit Social Security number`. An empty value is left to `required`, and the value is `''` rather than `undefined` when empty, so `required` still applies. The field validates _length_, not issuance — it does not reject the ranges the SSA never assigned (`000`/`666`/`9xx` area numbers, and so on); add a `validate` of your own if you need that.

`autoComplete` is pinned to `'off'` and is not a prop: there is no autofill token for an SSN, and inviting a browser to store one is the wrong default.

The toggle is a themeable `IconButton` under `EzSsnField` (`root`, `toggle`, exported as `ssnFieldClasses`); `slotProps.toggle` reaches it, `icons?: { show?, hide? }` swaps its icons, and `showLabel`/`hideLabel` set its accessible name (defaults `'Show Social Security number'` / `'Hide Social Security number'`). `invalidMessage`, `reveal`, `icons` and the labels are all settable app-wide through `theme.components.EzSsnField.defaultProps`; a prop on the element always wins.

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

## US fields

Small, US-specific conveniences on top of `TextField` and `Select` — for a non-US audience, build the equivalent with plain `TextField`/`Select`.

**ZipField**: digits only, capped at 5 — anything else (letters, the ZIP+4 dash) is stripped as you type or paste. The form value is always the digit string (`'90210'`), never a formatted one. `inputMode="numeric"` brings up the numeric keypad on mobile; `autoComplete` defaults to `'postal-code'`. A non-empty value shorter than 5 digits fails a built-in rule (`invalidMessage?`, default `'Enter a 5-digit ZIP code'`), composed with any `validate` you pass the same way `required`/`pattern` are — a built-in key is never silently replaced by yours.

```tsx
<ZipField name="zip" label="ZIP code" required />
```

```ts
const schema = z.object({ zip: z.string().min(1) })
```

**StateSelect**: `Select` pre-loaded with the 50 states + DC (`US_STATES`, exported as an `Option[]`); pass `territories` to add PR, GU, VI, AS, MP (`US_TERRITORIES`). Values are USPS abbreviations (`'CA'`), labels are full names (`'California'`). `autoComplete` defaults to `'address-level1'`.

```tsx
<StateSelect name="state" label="State" required />
<StateSelect name="state" label="State or territory" territories />
```

**AddressField**: the five US address parts as one bound composite under a nested object `name` — `street`, an optional `street2`, `city`, `state` (a `StateSelect`) and `zip` (a `ZipField`). Each part is the real field component, so a per-part error, `required`, `disabled` and focus-on-error behave exactly as they do when you write the five fields out by hand; the composite supplies the names, the autofill tokens, the labels and the layout.

```tsx
<AddressField name="shipping" legend="Shipping address" autoCompleteSection="shipping" required />
```

```ts
const schema = z.object({ shipping: addressSchema() })
```

`required` applies to street, city, state and ZIP — never `street2`, which is optional by definition. `autoCompleteSection` prefixes every token at once (`shipping street-address`, `shipping address-level2`, …), which is what lets a browser fill a shipping and a billing address on the same page separately. `legend` (with optional `description`) wraps the group in a `FormSection` fieldset; without one the parts sit in a plain container named by their own labels. `street2={false}` hides the second line — pair it with `addressSchema({ street2: false })` so the schema does not declare a key nothing writes.

Every label is a prop with a default (`streetLabel` `'Street address'`, `street2Label` `'Apartment, suite, etc.'`, `cityLabel` `'City'`, `stateLabel` `'State'`, `zipLabel` `'ZIP code'`), and `slotProps.street` / `.street2` / `.city` / `.state` / `.zip` reach the individual field components for anything else (per-part `helperText`, an extra rule, a `size`).

`addressSchema({ street2?, messages? })` returns the matching `z.object` so a form does not restate the five keys: all four required parts are non-empty strings with `'<Part> is required'` messages (override via `messages`), and `street2` is `z.string().optional()`. ZIP is only checked for presence — `ZipField`'s own 5-digit rule already covers the format, and duplicating it in zod would show two messages for one mistake. The messages have no trailing period, matching every other zod message in this codebase; the built-in `required` _rule_ messages do end with one (`'City is required.'`), so pass `messages` if a form surfaces both and you want them identical.

Themeable under `EzAddressField` (`defaultProps`, `styleOverrides` for `root` | `street` | `street2` | `city` | `state` | `zip`), exported as `addressFieldClasses`. The root is a CSS grid with named areas (`street` / `street2` / `city state zip`, one column below `sm`); re-order or re-span any part by overriding `gridTemplateAreas` on `root`.

**Mobile keyboards & autofill**: each field sets sensible defaults, always overridable by your own `autoComplete` prop:

| Field          | `inputMode` | `autoComplete` default                   |
| -------------- | ----------- | ---------------------------------------- |
| `ZipField`     | `numeric`   | `postal-code`                            |
| `StateSelect`  | —           | `address-level1`                         |
| `AddressField` | per part    | per part, `autoCompleteSection`-prefixed |

`inputMode="numeric"` on `ZipField` brings up the numeric keypad on mobile without changing the underlying `type` (still `text`, so a leading zero like `02134` is never dropped). `StateSelect`'s `autoComplete` reaches the hidden native `<input>` MUI's `Select` renders for autofill via `slotProps.htmlInput` — the same slot a plain `TextField` uses (MUI 9 has no `SelectProps`/native `inputProps` shortcut for this).

## Developer warnings

Three mistakes leave a form that renders and submits perfectly while quietly failing the
people using it. There is nothing to throw on and nothing a type can catch, so ez-form
writes them to the console in development:

| Warning                                                          | Fires when                                                                                                            | Why it matters                                                                                        |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `<Field name="…"> has no accessible name`                        | a field mounts with no `label`, `aria-label` or `aria-labelledby`                                                     | a screen-reader user hears an unlabelled edit box; axe reports it, but only if you run axe            |
| `<Field name="…"> has duplicate option values`                   | `Select`, `RadioGroup`, `Autocomplete`, `ToggleButtonGroup` or `CheckboxGroup` gets two options with the same `value` | the duplicates collapse: two radios look checked at once, and a `Select` shows the wrong label        |
| `<Wizard> step "…" lists field(s) … that the form does not know` | a step's `fields` names something absent from the schema and the values                                               | `trigger` on an unknown name returns valid, so **Next** advances past the field you meant to validate |

Each fires **once per mistake** (keyed on the component and field name), so a field
re-rendering on every keystroke reports once, while two different fields with the same
problem both get reported.

The last one is deliberately narrow: it asks whether the form _knows_ the name, not whether
the field is mounted right now. Listing an unmounted field is normal and correct — that is
exactly how [conditional fields](#conditional-fields) validate, and how a step naming an
empty `FieldArray` validates the array-level schema. Only a name the form has never heard of
— a typo, or a field renamed on one side only — warns.

### Silencing them

Fix the cause; there is no mute. A field genuinely named somewhere ez-form cannot see (a
label rendered by a wrapper, say) should say so with `aria-labelledby`, which is both the fix
and the thing that makes the warning stop.

### They cost nothing in production

Every warning sits behind a module-level `const isDev = process.env.NODE_ENV !== 'production'`.
Bundlers substitute that expression before dead-code elimination, so a production build drops
the call sites _and_ the message strings — no runtime check, no bytes. This is the same
mechanism React uses for its own development warnings, and it requires nothing of you beyond
building for production the way you already do.

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
