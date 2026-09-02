# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## Unreleased

### Added

- `EzNumberField` theme key (`defaultProps`, `styleOverrides` for `root`, `steppers`,
  `increment`, `decrement`) and the `numberFieldClasses` export; NumberField renders
  through MUI `TextField` — #26.
- `ResendCodeButton`: a resend-code helper for `OtpField` (MUI `Button`, `type="button"`).
  `onResend` is awaited if it returns a promise; disabled while pending and then for
  `cooldown` seconds (default 30), the label showing the remaining time
  (`Resend code (27s)`). A rejected `onResend` shows `errorText?` (default "Code could
  not be sent") in the status slot instead of "Code sent", starts no cooldown so the
  user can retry immediately, and calls `onResendError?(error)` for logging — the
  rejection itself is always caught, never left unhandled. A separate `role="status"`
  slot announces "Code sent" (or the error) once per resend without spamming assistive
  tech on every countdown tick. `EzResendCodeButton` theme key (`defaultProps`,
  `styleOverrides` for `root`, `status`) and the `resendCodeButtonClasses` export — #63.

### Changed

- `NumberField` / `NumberFieldControl` `className` is now `string` only (Base UI's
  `(state) => string` form is no longer accepted, because the Base UI root no longer
  renders an element) — #26.

### Notes

- Considering subpath exports (e.g. `ez-form/pickers`) so consumers who use no date
  picker aren't forced to resolve `@mui/x-date-pickers` as a peer. Tracked in #43.

## 0.2.0 — 2026-09-02

### Added

- `Form`: RHF + zod wiring via a schema resolver; `onSubmit(values, form)` receives the
  form methods as a second argument; `defaultValues` may be an object or an async
  function, with `values`, `resetOptions`, `onDefaultValuesError`, `ref`, `mode`, and
  `disabled` props. Fields disable while `onSubmit` is pending or async defaults are
  loading, and re-enable if async defaults reject.
- `Form`: `confirm` prop (`true` or options) shows a confirmation dialog after
  validation, before submit — on every submit path, not just the click handler.
- `Form`: `guard` prop warns on tab close/navigation away while the form is dirty
  (`useFormGuard`, pairable with a router's navigation blocker).
- Per-field hookform-style validation rule props (`required`, `min`, `max`, `minLength`,
  `maxLength`, `pattern`, `validate`) on every field: a bare value uses a label-derived
  default message, or pass `{ value, message }` to override it.
- Field components, each a themeable wrapper with rule props, zod error display as
  live-region helper text, and an accessible label: `TextField`, `Select`,
  `RadioGroup`, `CheckboxGroup`, `ToggleButtonGroup`, `Slider`, `Rating`,
  `Autocomplete` (single/multiple/freeSolo/object values, async options), `NumberField`
  (Base UI, with live digit grouping while typing), `MoneyField` (USD, built on
  `NumberField`), `DatePicker` / `TimePicker` / `DateTimePicker` (MUI X), `OtpField`
  (Base UI), `FileField` (single or multiple, chip removal fires `onChange`),
  `Checkbox`, `Switch`.
- `SubmitButton`: MUI `Button` that shows a loading spinner and disables itself while
  the form submits.
- `ClearButton`: resets the form to its default values or to empty, with an optional
  confirmation dialog; disabled while the form is pristine.
- `ConfirmDialog` and `useConfirm()`: a promise-based confirm dialog for use outside
  `Form`'s built-in `confirm` prop.
- `useFormGuard`: router-agnostic unsaved-changes blocker; pass a router's
  `useBlocker` (e.g. react-router's) to block in-app navigation, plus a native
  `beforeunload` prompt for tab close.
- `Wizard`, `WizardStep`, `WizardStepper`, `WizardNav`, `useWizard`: a multi-step form
  over one `<Form>` and one schema. `Next` validates only the current step's `fields`;
  `Submit` on the last step validates everything. Controlled via `step`/`onStepChange`
  and `visited`/`onVisitedChange` so a consumer can drive it from a router (see the
  react-router pattern in the README). On a failed submit, the wizard navigates to the
  first step owning an errored field and focuses it once mounted.
  `WizardStepper` supports horizontal and vertical orientation.
- `ReadOnlyField`: label-above-value display for review/summary steps, with support
  for option lists, a `format` function, an `empty` placeholder, and an `editStep` link
  back to the owning step.
- Every component exposes MUI theming hooks (`useDefaultProps`, `styled` slots,
  utility classes, `Components` augmentation under `theme.components.Ez<Name>`), so a
  theme can restyle any part without touching component internals.
- README: install instructions, a full component reference table, a numbers/typing
  guide, and a Wizard walkthrough including the one-route-per-step react-router
  pattern.

### Changed

- Raised the `react-hook-form` peer floor to `^7.87.0`.
- Narrowed the `zod` peer to `^4.0.0` (zod 3 is no longer supported).
- Added `@base-ui/react ^1.7.0` as a required peer, for `NumberField` and `OtpField`.
- Added `@mui/x-date-pickers ^9.0.0` as a required peer, for `DatePicker`, `TimePicker`,
  and `DateTimePicker`.
- `min`/`max` rule comparisons now mirror hookform: numeric compare when the value is
  numeric, otherwise a string bound is compared as a `Date` (skipped on an invalid
  date) rather than a raw string/lexicographic compare.
- A consumer's `disabled` merges with the form's own disabled state via `||` everywhere
  (the form lock always wins; a consumer cannot force a field enabled inside a
  disabled form).
- `NumberField` groups digits live while typing (previously only on blur);
  `format={{ useGrouping: false }}` turns that off.

### Fixed

- `Slider`: `min`/`max` rules were silently inert on a range value (a `[min, max]`
  tuple outside bounds could submit without error); range values are now validated
  correctly. `required` was removed from `Slider` (HTML gives it no meaning on a range
  input, and it could fail invisibly with no default value).
- Validation rules on checkboxes and switches: an unchecked/empty value no longer
  short-circuits a custom `validate` rule; `required` fails on empty-or-false,
  `min`/`max`/length/pattern are skipped on an empty value, and `validate` always runs
  — matching hookform's own semantics.
- `FileField`: chip delete now fires the consumer's `onChange` (previously it updated
  the form value silently); `required` and `aria-required` are set correctly on the
  hidden file input.
- Date pickers: the accessibility "helper text" role could be lost when a consumer
  passed `slotProps.textField.slotProps`; the merge is now deep enough to preserve it.
  A consumer's `slotProps.textField.onBlur` now runs after the field's own `onBlur`
  instead of replacing it.
- `MoneyField`: fixed a display/submit mismatch where the field could show `$20.00`
  but submit `19.999`; amounts are now rounded to the cent consistently.
- `MoneyField`/`NumberField`: fixed the caret jumping to the end of the input when
  live digit-grouping deleted a separator during a backspace/delete.
- `Wizard`: stale `visited` step ids (e.g. from a step list that changed) are now
  ignored instead of silently mis-indexing the stepper.
- `Wizard`: async `defaultValues` that reject now re-enable the form instead of
  leaving it permanently disabled; the rejection is rethrown unless
  `onDefaultValuesError` is provided.
- `Wizard`/`Form`: a resolver rejection on the confirm path (validation error while
  confirming a submit) is no longer swallowed.
- `ReadOnlyField`: the root element now correctly carries `aria-labelledby` so its
  accessible name is announced.
- Every field's error helper text is a live region (`role="alert"`), so validation
  errors are announced in `onChange`/`onBlur` modes, not just on submit.
- `NumberField`: pasted grouped numbers under space-group locales (fr-FR's narrow
  no-break space, de-CH's apostrophe) no longer stall live grouping; the grouper now
  accepts the same separator variants Base UI's parser strips (#24).
- `Wizard`: a controlled wizard that declines the failed-submit navigation no longer
  keeps a stale focus target that could focus an old field on a later arrival at that
  step (#40).

## 0.1.0 — 2026-09-01

Initial (unpublished) release: `Form`, `TextField`, `Select`, `Checkbox`, `Switch`,
`SubmitButton`.
