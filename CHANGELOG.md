# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## Unreleased

### Added

- `FieldArray`: a repeating group of fields over hookform `useFieldArray`, rendered as
  a `FormSection` per array and a nested `FormSection` per row. `name`, `label`,
  `emptyRow` (a value or a per-Add factory), `singular?` / `rowLabel?`, `minRows?` /
  `maxRows?`, `addLabel?` / `removeLabel?`, `reorder?`; `children` is a render prop
  given `row.name('field')` for the array path. Rows are keyed by hookform's stable
  `field.id`, so a middle remove never shuffles typed values. Add focuses the new
  row's first field, Remove the previous row (or Add), Move keeps focus on the
  pressed button as it travels with its row, and a `role="status"` region announces
  each change. Array-level messages (zod `.min`/`.max` on the array, or
  `setError('<name>.root')`) render under Add as a `role="alert"`. `EzFieldArray`
  theme key (`defaultProps`, `styleOverrides` for `root` | `row` | `actions` | `add` |
  `remove` | `move` | `status` | `error`) and the `fieldArrayClasses` export, whose
  error slot is keyed `errorText` because MUI reserves `error` as a global state
  class — #13.
- `FormSection` accepts a `ref` to its `<fieldset>`, so a caller can measure a group
  or move focus into it (`FieldArray` uses it to focus a row) — #13.
- `FormError`: renders `formState.errors.root` (set via `form.setError('root.<key>',
{ message })`, e.g. a rejected async `onSubmit`) as an MUI `Alert`; renders nothing
  when there is no root error. `EzFormError` theme key (`defaultProps`,
  `styleOverrides.root`) and the `formErrorClasses` export — #60.
- `docs/DECISIONS.md`: rulings extracted from every SDD ledger, newest first, with links
  to source documents and the decisions behind each design choice — #45.
- `FormErrorSummary`: a focus-announced list of the last failed validation attempt's errors
  (GOV.UK-style), placed as a child under the form title or inside the current `WizardStep`.
  Each item links to its field (`setFocus`, with `href="#<id>"` when the field's rendered
  element has one); the heading receives focus on each new failed attempt. Inside a `Wizard`
  it scopes to the current step's `fields` via a new `lastFailed` on the wizard context. While
  mounted, `<Form>` suppresses react-hook-form's own first-invalid-field focus
  (`shouldFocusError`) so the two don't compete. `EzFormErrorSummary` theme key (`defaultProps`,
  `styleOverrides` for `root`, `heading`, `list`, `item`, `link`) and the
  `formErrorSummaryClasses` export — #1.
- `Form` `title` / `description` props with `aria-labelledby` / `aria-describedby` wiring;
  `EzForm` theme key (`root`, `title`, `description`) and `formClasses` — #51.
- `FormSection`: `<fieldset>`/`<legend>` group with `EzFormSection` theme key
  (`root`, `legend`, `description`, `content`) and `formSectionClasses` — #51.
- `WizardStep` renders a `FormSection` (`title`, `description`, `slotProps`);
  `WizardStepper` marks the current step with `aria-current="step"` — #51.
- `PasswordField`: ez-form `TextField` with `type` fixed to `password`/`text` and a
  show/hide toggle in the end adornment. `revealable` (default `true`) hides the toggle
  entirely; `autoComplete` defaults to `'current-password'`. `icons?: { show?, hide? }`
  swaps the reveal icons, defaulted through `useDefaultProps` so
  `theme.components.EzPasswordField.defaultProps.icons` can replace them app-wide —
  `slotProps.toggle` still reaches the toggle `IconButton` itself, but its `children` is
  always overridden by `icons` instead — #69. Themeable under `EzPasswordField`
  (`defaultProps`, `styleOverrides` for `root` | `toggle`), exported as
  `passwordFieldClasses` — #58.
- `TextareaField`: `TextField` with `multiline` fixed on, a taller themeable default
  (`minRows: 4`, `maxRows: 12`), and a length meter (`n` or `n / max`) driven by the
  `maxLength` rule or an explicit `showCount` prop — over the limit, the meter is
  replaced by the normal `maxLength` validation error. `EzTextareaField` theme key
  (`defaultProps`, `styleOverrides` for `root`, `counter`) and the `textareaFieldClasses`
  export — #49.
- `.github/PULL_REQUEST_TEMPLATE.md` mirroring the "a component ships when" checklist
  from `docs/PHILOSOPHY.md` — #46.
- `DateField`: MUI X's keyboard-only, sectioned date input, bound through the same
  `usePickerField`-family binding as `DatePicker` (`errorMessages` mapping for
  `invalidDate`, `minDate`, `maxDate`, `disablePast`, `disableFuture`). Recommended
  over `DatePicker` for birthdays and other far-away dates — typing beats paging a
  calendar back decades — #61.
- `EzNumberField` theme key (`defaultProps`, `styleOverrides` for `root`, `steppers`,
  `increment`, `decrement`) and the `numberFieldClasses` export; NumberField renders
  through MUI `TextField` — #26.
- `Form`: `title` and `description` props render an accessible heading and helper text
  wired to the form's `aria-labelledby`/`aria-describedby`. `EzForm` theme key
  (`defaultProps`, `styleOverrides` for `root`, `title`, `description`) — #51.
- `FormSection`: fieldset/legend grouping for related fields, with an optional
  `description`. `EzFormSection` theme key (`defaultProps`, `styleOverrides` for `root`,
  `legend`, `description`, `content`) and the `formSectionClasses` export — #51.
- `PasswordStrength`: a meter bound to a password field's live value via `useWatch`
  (never registers, never validates), with a pluggable `score` (default a small
  built-in heuristic, exported as `scorePassword`) and `labels`. Renders MUI
  `LinearProgress` as an ARIA `meter` with a live-region label. Lives in its own
  module — `PasswordField` does not import it — so consumers of `PasswordField` alone
  never pull it or a scorer like zxcvbn into their bundle. Themeable under
  `EzPasswordStrength` (`defaultProps`, `styleOverrides` for `root` | `bar` | `label`),
  exported as `passwordStrengthClasses` — #59.
- `EzOtpField` theme key (`defaultProps`, `styleOverrides` for `root`, `helperText`) and
  the `otpFieldClasses` export; `EzFileField` theme key (`defaultProps`, `styleOverrides`
  for `root`, `fileList`) and the `fileFieldClasses` export — the last `sx` usages in
  `src/` (`OtpFieldControl`, `FileField`) now go through styled slots — #50.
- `pnpm check:guardrails`: a dependency-free CI script that fails on `sx=`, ripple props,
  and literal `variant`/`size`/`color` JSX attributes in `src/`, and on exported components
  missing a README Components row; allow-listed via a trailing `// guardrail: allow <reason>`
  comment. Wired into CI alongside its own `pnpm test:scripts` suite — #44.
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
- WCAG 2.5.8 Target Size (Minimum): `NumberField`'s steppers and `FileField`'s chip
  delete icon now declare `minWidth`/`minHeight: 24` (the two controls whose rendered
  box could fall under 24×24 CSS px); `src/test/targetSize.ts` exports
  `expectTargetSize`, a shared test helper asserting a control's declared CSS
  guarantees the floor, called from every affected component's test file — #12.
- `Wizard` `layout?: 'steps' | 'page'` (default `'steps'`), defaulted through
  `useDefaultProps`/`EzWizard.defaultProps` (no slots, so no `EzWizard` class key).
  `'page'` renders every `WizardStep` at once, in document order, each as its own
  `FormSection` — the same markup a horizontal step already uses — while
  `WizardStepper` and `WizardNav` render nothing and `useWizard()`'s
  `next`/`prev`/`go` become no-ops (`current` stays the first step). A plain
  `<SubmitButton>` validates the whole schema, same as the last step of a `steps`
  wizard — #64.
- `FormSection` legend heading level now defaults one level deeper per nesting
  (`h3` at the top level, `h4` inside another `FormSection`, `h5` inside that, capped
  at `h6`) via a new `FormSectionDepthContext`, so nested sections — including
  sub-sections inside a `layout="page"` step — produce a correct heading hierarchy
  without hand-picking `slotProps.legend.component` at every level. An explicit
  `slotProps.legend.component`, or a theme default for it, still overrides the
  automatic level — #64.

### Changed

- `NumberField` / `NumberFieldControl` `className` is now `string` only (Base UI's
  `(state) => string` form is no longer accepted, because the Base UI root no longer
  renders an element) — #26.
- `PasswordField`, `NumberFieldControl`, and `FileField` now render icons from
  `@mui/icons-material` (`VisibilityOutlined`/`VisibilityOffOutlined`,
  `KeyboardArrowUp`/`KeyboardArrowDown`, `UploadFile`/`Close`) instead of hand-rolled
  inline `SvgIcon` paths; `@mui/icons-material` is a new peer and dev dependency.
  `check:guardrails` gained a `no-inline-svg` rule (`<path `/`createSvgIcon(`) — #67.

### Fixed

- `Form`: `guard`'s `beforeunload` warning no longer re-arms after a successful submit.
  `isDirty` stays `true` after a submit unless the form is explicitly `reset()`, so the
  guard effect now also checks `isSubmitSuccessful` before arming — the same
  `isDirty && !isSubmitting && !isSubmitSuccessful` formula `useFormGuard` already used,
  now shared as `shouldBlockUnsavedChanges` so the two guards can't drift apart. A later
  `reset()` (the common submit-then-reset pattern) clears `isSubmitSuccessful` again, so
  editing after that still re-arms the guard — #74.
- `ClearButton`: the consumer's `onClick` no longer fires when `confirm` is set and the
  dialog is Cancelled. It now runs only after the confirm gate passes, right after
  `reset()`, matching `Form`'s `confirm`/`onSubmit` contract (`onSubmit` never runs on a
  cancelled confirm either); without `confirm` there is nothing to gate on, so `onClick`
  still fires immediately on click, same as a plain `Button` — documented on the prop — #75.
- `Form`: a `setError` called synchronously inside `onDefaultValuesError` (for example
  `ref.current?.setError('root.server', …)`) no longer gets wiped by hookform's own
  post-rejection `reset({})`. `onDefaultValuesError` now runs after that reset has
  settled instead of from inside the wrapper's own `.catch()`, and `Form` reads
  `formState.errors` once so hookform re-renders for a form-wide error even when no
  field is bound to its path. The form still re-enables either way, and omitting
  `onDefaultValuesError` still rethrows the rejection unchanged — #70.
- `FileField`'s picker `Button` `variant="outlined"` default is no longer a bare JSX
  literal: it now reads from a new `slotProps.button` prop, which `useDefaultProps`
  deep-merges key-by-key against `theme.components.EzFileField.defaultProps.slotProps.button`
  (the same mechanism `ConfirmDialog`'s `slotProps.confirm` uses), so a theme can override
  it globally and a per-instance override still wins over the theme default. The previous
  flat `buttonProps` prop is a deprecated alias — it still works, but (being a flat, non-
  slot prop) a theme can never reach into it. Removed the guardrail allow-comment
  tracking the old literal — #62.

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
