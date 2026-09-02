# ez-form v3 design — the remaining input types

Date: 2026-09-01
Status: approved (sections reviewed with Steve in chat)

## Goal

Bring every remaining MUI input type into the library so a consumer never has
to hand-wire a MUI control to react-hook-form. Nine new components, all on the
three patterns v2 established; v2's public API is unchanged except for
additions.

| New component | Wraps | Pattern |
|---|---|---|
| `Slider` | MUI `Slider` | FieldFrame `labelAs="legend"` |
| `Rating` | MUI `Rating` | FieldFrame `labelAs="legend"` |
| `ToggleButtonGroup` | MUI `ToggleButtonGroup` + `ToggleButton` | FieldFrame `labelAs="legend"` |
| `CheckboxGroup` | MUI `FormGroup` + `Checkbox` | FieldFrame `labelAs="legend"` |
| `DatePicker` | MUI X `DatePicker` | MUI TextField slot (like Select / Autocomplete) |
| `TimePicker` | MUI X `TimePicker` | MUI TextField slot |
| `DateTimePicker` | MUI X `DateTimePicker` | MUI TextField slot |
| `OtpField` | Base UI `OTPField` | NumberField recipe: Base UI behavior, vendored MUI look |
| `FileField` | MUI `Button` + hidden `<input type="file">` | `useEzField` directly (MUI has no file component) |

Names match the wrapped library's component names, as TextField / Select /
Checkbox / NumberField already do.

## Non-goals

- `NativeSelect` (Steve: not wanted). `DateRangePicker` and other Pro pickers.
- Base UI variants of Slider / Select / Checkbox; Material is the styled layer.
- Subpath exports. `@mui/x-date-pickers` is a required peer of the single
  entry (Steve's call over `ez-form/dates`).
- Converting picker values: the form stores whatever the consumer's date
  adapter produces.
- Drag-and-drop or upload progress for `FileField`; it collects `File`s.
- The open v2 / v2.1 follow-ups (generic `BoundField`, paste-on-blur grouping,
  async-defaults rejection) stay open.

## Facts this design rests on

- `ezResolver`'s `required` treats `null`, `undefined`, `''`, and `[]` as
  empty (`src/Form/ezResolver.ts`), so array-valued and nullable fields need
  no special required handling.
- react-hook-form's `cloneObject` keeps non-plain objects (class instances such
  as Dayjs / Luxon) and `Blob` / `FileList` by reference, so adapter-native
  dates and `File`s survive `defaultValues` / `reset`.
- `useController` re-registers its `rules` every render, so a rule built from
  component state (the picker error below) is current at validation time.
- `@mui/x-date-pickers@9.12` peers on `@mui/material ^7.3 || ^9` and renders a
  Material `TextField` through `slotProps.textField`; it accepts `inputRef`,
  `name`, and `onError(code)` where code is a `DateValidationError` /
  `TimeValidationError` / `DateTimeValidationError` string or `null`.
- Base UI 1.7 exports `OTPField.Root` (`value`, `onValueChange`, `length`,
  `mask`, `validationType`, `normalizeValue`, `name`, `required`, `disabled`,
  `id` for the first input) and `OTPField.Input`.
- MUI `ToggleButtonGroup` selects by identity (`===` / `indexOf`), so typed
  option values need no string round-trip (unlike RadioGroup).

## Section 1 — Material fields on `FieldFrame`

```
FormControl(fieldset, error, disabled, required)
 ├ FormLabel(component="legend", id=labelId, required)
 ├ <control aria-labelledby={labelId} {...inputA11y}>
 └ FormHelperText {...helperTextA11y}   (only when there is text)
```

Shared shape, as RadioGroup: `name`, `label` (the legend), `helperText?`,
`disabled?`, the rules listed below, and the wrapped MUI component's props
minus `name` / `value` / `defaultValue` (and `children` where options replace
it). Consumer `onChange` / `onBlur` run after the form's handlers.

### `Slider`

| | |
|---|---|
| Form value | `number`, or `[number, number]` when the form value is an array (range) |
| Rules | `required`, `min`, `max`, `validate` |
| `min` / `max` | One prop each, `ValidationRule<number>`: the slider's bound **and** the rule (`<label> must be at least <value>.`), exactly as NumberField's `bound()` helper. A slider cannot leave its bounds by itself, but a `defaultValues` / `setValue` outside them must still fail validation. |
| Wiring | `slotProps.input` gets `{ ref: field.ref, 'aria-labelledby': labelId, ...inputA11y }` via `mergeSlotProps`. `onChange(e, value)` stores `value` unchanged (number or array). `value={field.value ?? min ?? 0}` keeps MUI controlled when the form value is `null`. |
| Extras | `onChangeCommitted`, `marks`, `step`, `valueLabelDisplay`, `sx` pass through. |

### `Rating`

| | |
|---|---|
| Form value | `number \| null` (clearing the current star gives `null`) |
| Rules | `required`, `validate` |
| Wiring | `name={field.name}` (MUI groups its radios by name), `value={field.value ?? null}`, `onChange(e, value)` → `field.onChange(value)`. The first radio input gets `field.ref` through `slotProps`. The group root gets `aria-labelledby={labelId}` and `inputA11y`. |
| Extras | `max`, `precision`, `size`, `icon`, `emptyIcon` pass through. |

### `ToggleButtonGroup`

| | |
|---|---|
| Props | `options: readonly Option[]` renders one `ToggleButton` per option (`disabled` per option honored); `exclusive?` |
| Form value | `exclusive`: `Option['value'] \| null`; otherwise `Option['value'][]` |
| Rules | `required`, `validate` |
| Wiring | `value={field.value ?? (exclusive ? null : [])}`, `onChange(e, value)` → `field.onChange(value)`. MUI passes typed values back unchanged. Group root gets `aria-labelledby={labelId}` and `inputA11y`; the first button gets `field.ref`. |
| Extras | `size`, `color`, `orientation`, `fullWidth` pass through. |

### `CheckboxGroup`

| | |
|---|---|
| Props | `options: readonly Option[]`; `row?` |
| Form value | `Option['value'][]`; `required` means at least one checked |
| Rules | `required`, `validate` |
| Wiring | `FormGroup role="group" aria-labelledby={labelId} {...inputA11y}`; each option is `FormControlLabel control={<Checkbox />}` with `checked={value.includes(o.value)}`. Toggling adds or removes the option's typed value, preserving `options` order in the stored array. The first checkbox gets `field.ref`; `onBlur` on any checkbox calls `field.onBlur`. Consumer `onChange(e, value[])` runs after. |

## Section 2 — date pickers on MUI X

### Value

Adapter-native: the form stores `TDate | null`, where `TDate` is whatever the
consumer's `LocalizationProvider` adapter produces (`Date` under date-fns,
`Dayjs` under dayjs). ez-form converts nothing and renders no
`LocalizationProvider`; the consumer wraps their app, exactly as with MUI X on
its own. The consumer's zod schema types the field (`z.date()` under date-fns,
`z.custom<Dayjs>()` otherwise).

### Shape (one implementation, three exports)

```
<MuiDatePicker
  {...rest}
  value={field.value ?? null}
  onChange={(value, ctx) => { field.onChange(value); onChange?.(value, ctx) }}
  onError={(code) => { setPickerError(code); onError?.(code) }}
  inputRef={field.ref}
  disabled={mergeDisabled(disabled, field.disabled)}
  slotProps={{ ...slotProps,
    textField: mergeSlotProps(slotProps?.textField, {
      name: field.name, label, required, helperText: text, error: invalid,
      onBlur: field.onBlur,
      slotProps: { formHelperText: { role: helperTextA11y.role } } }) }}
/>
```

`DatePicker`, `TimePicker`, `DateTimePicker` share one internal
`bindPicker`-style helper (a hook returning the props above) and differ only
in the wrapped MUI component and the error-code type. Props: `name`, `label`,
`helperText?`, `disabled?`, rules, `errorMessages?`, plus the MUI picker's own
props minus `name` / `value` / `defaultValue`.

### Picker validation → the field's error

The picker validates its own constraints (`minDate`, `disablePast`, typed
garbage, …) and reports a code through `onError`. That code is kept in state
and fed to `useEzField` as one more `validate` entry, so picker errors and rule
errors share one channel: helper text, `aria-invalid`, `role="alert"`, and the
submit block.

```ts
rules: { required, validate: { ...toRecord(validate), picker: () => pickerMessage ?? true } }
```

Default messages, label-derived like `rules.ts`:

| Code | Message |
|---|---|
| `invalidDate` | `<label> is invalid.` |
| `minDate`, `minTime`, `minutesStep`, `minDateTime` | `<label> is too early.` |
| `maxDate`, `maxTime`, `maxDateTime` | `<label> is too late.` |
| `disablePast` | `<label> must be in the future.` |
| `disableFuture` | `<label> must be in the past.` |
| `shouldDisableDate`, `shouldDisableMonth`, `shouldDisableYear`, `shouldDisableTime-*` | `<label> is not available.` |

`errorMessages?: Partial<Record<code, string>>` overrides per code. A `null`
code clears the entry.

### Rules

`required` and `validate` only. `minDate` / `maxDate` / `disablePast` /
`disableFuture` are the picker's props and pass through; ez-form's numeric
`min` / `max` do not apply to adapter-native values.

### Dev and test setup

`date-fns` + `AdapterDateFns` (Steve: not dayjs). The Storybook global
decorator gains a `LocalizationProvider`; tests wrap the same way. Tests drive
the text input (typing `01/15/2030`), not the calendar popup, which stays
MUI's.

## Section 3 — `OtpField` and `FileField`

### `OtpField`

```
FormControl(error, disabled, required)
 ├ FormLabel(htmlFor = first input id)
 ├ OTPField.Root(id, length, mask, validationType, normalizeValue, name, value, onValueChange,
 │               disabled, required)
 │   └ OTPField.Input × length   {...inputA11y}; styled as small OutlinedInput boxes; the first carries field.ref
 └ FormHelperText
```

| | |
|---|---|
| Form value | `string` (`''` when empty) |
| Props | `length` (default 6), `mask?`, `validationType?`, `normalizeValue?`, `size?`, `autoFocus?` and the other Root props pass through; `label`, `helperText?`, `disabled?` |
| Rules | `required`, `validate`, plus a built-in completeness rule: `''` or exactly `length` characters passes; anything else fails with `<label> must be <length> characters.` A half-typed code is never valid. |
| Styling | Vendored from `NumberFieldControl`'s recipe: MUI outlined look via `styled` on the Base UI parts, reacting to `FormControl`'s focused / error / disabled state. No `@mui/icons-material` import. |
| a11y | Base UI puts Root's `aria-describedby` on the group `<div>` and derives each input's `aria-invalid` from its own Field context, which ez-form does not use. So `inputA11y` is spread on every `OTPField.Input` (element props are applied last and win), as NumberField does with its Base UI input. Inputs after the first carry `aria-label="Character n of length"` as in Base UI's demo. |

### `FileField`

```
FormControl(error, disabled, required)
 ├ Button(component="label", variant="outlined", startIcon=upload)  [label]
 │   └ <input type="file" hidden accept multiple ref={field.ref} onChange>
 ├ Chips: one per selected file, onDelete removes it (hidden when empty)
 └ FormHelperText
```

| | |
|---|---|
| Form value | `File \| null`; `File[]` under `multiple` |
| Props | `accept?`, `multiple?`, `label`, `helperText?`, `disabled?`, `buttonProps?` (MUI `ButtonProps` minus `component`) |
| Rules | `required`, `validate` |
| Behavior | A cancelled dialog yields an empty `FileList`; the previous value is kept. The input's own value is reset after every pick so re-picking the same file fires `change` again. `multiple`: a new pick replaces the selection (browser semantics), chip delete removes one. |
| a11y | The button is the `<label>` for the hidden input, so the input's accessible name is the label text; `inputA11y` goes on the input; a submit error focuses the input, which the browser shows on the button. |

## Packaging

- `peerDependencies`: add `@mui/x-date-pickers: ^9.0.0` (required).
- `devDependencies`: add `@mui/x-date-pickers`, `date-fns`.
- `src/index.ts`: export the nine components and their prop types; also
  `PickerErrorMessages` (the `errorMessages` type).
- `.storybook/preview.tsx`: wrap the tree in `LocalizationProvider` with
  `AdapterDateFns`.
- README: nine rows in the component table; a "Date pickers" section stating
  the `LocalizationProvider` requirement and the adapter-native value.

## Testing

Every field: `describeFieldContract` (outside-Form throw, form-level disable,
one consumer `onChange` per interaction, required message, helper-text
association, axe) plus its own cases:

| Field | Specific cases |
|---|---|
| Slider | number and range submit; `min` / `max` as bound and rule (out-of-range default fails) |
| Rating | select, clear → `null`, required on `null` |
| ToggleButtonGroup | exclusive `T \| null` and multi `T[]`; typed values survive (number stays number) |
| CheckboxGroup | toggling adds / removes in `options` order; required on `[]`; `row` |
| Date / Time / DateTimePicker | typed value submits as a `Date` (date-fns); `minDate` breach shows `<label> is too early.` and blocks submit; `errorMessages` override; cleared value is `null` |
| OtpField | full code submits; partial fails with the length message; `mask`; paste of a whole code |
| FileField | pick → `File`; cancel keeps value; `multiple` + chip delete; required on `null` / `[]`; re-pick same file |

Stories: one file per component under the shared Form decorator, with a
`Required` and a `Disabled` story each, mirroring the existing field stories.

## Delivery

Plan via the writing-plans skill; nine independent field tasks run in
parallel worktrees (the v2 pattern), with the packaging task (peer, devDeps,
Storybook provider) landing first since the three picker tasks depend on it.
