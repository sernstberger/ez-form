# ez-form v2 design

Date: 2026-09-01
Status: approved

## Goal

Add the three fields v1 deliberately left out, each with a binding shape v1
does not have (RadioGroup, Autocomplete, NumberField), let a `<Form>` load
its default values from a server, and do the internal lift the v1 final
review asked for so the a11y wiring lives in one place. v1's public API is
unchanged except for additions.

## Non-goals (v2)

- A Google Places adapter. Autocomplete's seam must support one (async
  options, `freeSolo`, extra option fields reaching `onChange`); the adapter
  itself is a consumer or a later package.
- Subpath exports (`ez-form/NumberField`) to avoid the Base UI peer for
  consumers who do not use NumberField. Single entry for now.
- Autocomplete `disableClearable`. `required` covers emptiness.
- Field arrays, date pickers, file inputs, schema-driven generation, typed
  `name` props (still deferred from v1).

## Architecture

```
consumer JSX
  <Form schema defaultValues | async fn  values? resetOptions? ref? disabled? onSubmit>
    ├─ useForm({ resolver, defaultValues, values, resetOptions, disabled: disabled || submitting || isLoading })
    ├─ useImperativeHandle(ref, () => methods)
    └─ <form noValidate>
         ├─ TextField ─────┐                    MUI TextField renders label/helper text itself
         ├─ Select ────────┤ (v1, unchanged)
         ├─ Autocomplete ──┤  useEzField<TValue>  ← rules normalized, a11y props built here
         ├─ NumberField ───┤                    Base UI Root + vendored MUI recipe
         ├─ Checkbox ──────┤
         ├─ Switch ────────┤  FieldFrame labelAs="control"   FormControl + FormControlLabel + FormHelperText
         ├─ RadioGroup ────┘  FieldFrame labelAs="legend"    FormControl + FormLabel(legend) + control + FormHelperText
         └─ SubmitButton
```

### `useEzField` owns a11y

`useEzField<TValue>(name, componentName, { label, rules })` keeps its v1
return (`field`, `fieldState`, `required`) and adds:

| Member | Value |
|---|---|
| `invalid` | `fieldState.invalid` |
| `errorMessage` | `fieldState.error?.message` |
| `helperTextId` | `useId()` |
| `helperText(consumerText)` | `errorMessage ?? consumerText` |
| `inputA11y(text)` | `{ 'aria-invalid': invalid \|\| undefined, 'aria-describedby': text ? helperTextId : undefined }` |
| `helperTextA11y` | `{ id: helperTextId, role: invalid ? 'alert' : undefined }` |

Fields that render MUI `TextField` (TextField, Select, Autocomplete) already
get `aria-invalid` and `aria-describedby` from MUI (`TextField` generates the
helper-text id with `useId`); they take only `role` from `helperTextA11y`, via
`slotProps.formHelperText`. Fields on `FieldFrame` and NumberField use
`inputA11y` and `helperTextA11y` in full. `role="alert"` is the deferred v1
live-region item: error text is announced in `onChange`/`onBlur` modes.

`useBooleanField` is deleted. Checkbox and Switch derive `checked` from
`Boolean(field.value)` and call `field.onChange(e.target.checked)` themselves.

### `FieldFrame` (internal)

Replaces `BooleanFieldControl`. Not exported.

```ts
interface FieldFrameProps<TValue> {
  componentName: string
  name: string
  label: ReactNode
  helperText?: ReactNode
  disabled?: boolean
  rules: FieldRules<TValue>
  labelAs: 'control' | 'legend'
  renderControl: (bound: BoundField<TValue>) => ReactElement
}
interface BoundField<TValue> {
  field: ControllerRenderProps          // value, onChange, onBlur, ref, name, disabled
  invalid: boolean
  required: boolean
  inputA11y: { 'aria-invalid'?: true; 'aria-describedby'?: string }
  labelId: string                        // set on FormLabel when labelAs="legend"
}
```

- `labelAs="control"`: `FormControlLabel { label, required, control: renderControl(bound) }`.
- `labelAs="legend"`: `FormLabel component="legend" id={labelId} required` then `renderControl(bound)`.
- Both: `FormControl error={invalid} disabled={mergeDisabled(disabled, field.disabled)} required`, and `FormHelperText {...helperTextA11y}` when there is text.
- The frame does not compose handlers; each field composes its own after `field.onChange`, since the shapes differ (`(e, checked)` vs `(e, value)`).

## Public API

### `Form` additions

| Prop | Type | Behavior |
|---|---|---|
| `defaultValues` | `DefaultValues<TIn> \| (() => Promise<TIn>)` | Passed to `useForm`. While hookform's `formState.isLoading` is true the form is disabled the same way it is while submitting, so fields and `SubmitButton` are inert until the data lands |
| `values` | `TIn \| undefined` | Passed through; hookform resets the form when it changes. For consumers who fetch with a data hook |
| `resetOptions` | hookform `KeepStateOptions` | Passed through; controls what a `values` / async-defaults reset keeps |
| `ref` | `Ref<FormMethods<TIn, TOut>>` | React 19 ref-as-prop; `useImperativeHandle` returns `methods` so a parent can `reset`, `setValue`, `setError` |

`isLoading` is read with `useFormState({ control })` so the disable applies on
the render the promise resolves, not one render late. `Form` is not
generic-forwardRef'd; React 19's ref-as-prop keeps the generics intact.

### `RadioGroup`

Wraps MUI `RadioGroup` on `FieldFrame labelAs="legend"`.

| Prop | Type |
|---|---|
| `name` | `string` |
| `label` | `ReactNode` (the legend) |
| `options` | `readonly Option[]` |
| `helperText?` | `ReactNode` |
| `disabled?` | `boolean` |
| rules | `required`, `validate` typed over `Option['value']` |
| rest | MUI `RadioGroupProps` minus `name`, `value`, `defaultValue`; `row`, `sx`, … pass through; consumer `onChange(e, value)` runs after the form's |

Behavior:
- Form value is `Option['value'] \| null`. MUI radios emit strings, so `onChange` finds the option whose `String(value)` matches and stores the option's typed value. `value={String(field.value ?? '')}` keeps MUI controlled.
- `MuiRadioGroup` gets `aria-labelledby={labelId}` and `inputA11y` (`aria-invalid` / `aria-describedby` are valid on `radiogroup`).
- Each option renders `FormControlLabel control={<Radio />}`; the first radio gets `inputRef={field.ref}` so hookform focuses the group on submit error. `option.disabled` disables its radio.

### `Autocomplete`

Wraps MUI `Autocomplete`; `renderInput` renders a plain MUI `TextField`.

```ts
type FormValue<TValue, Multiple, FreeSolo> =
  Multiple extends true ? (TValue | FreeSoloString)[] : TValue | FreeSoloString | null
// FreeSoloString = FreeSolo extends true ? string : never

interface AutocompleteProps<TOption extends Option, TValue = TOption['value'], Multiple extends boolean = false, FreeSolo extends boolean = false>
  extends Omit<MuiAutocompleteProps<TOption, Multiple, false, FreeSolo>, 'value' | 'defaultValue' | 'onChange' | 'renderInput' | 'options' | 'disableClearable'>,
    FieldRules<FormValue<TValue, Multiple, FreeSolo>> {
  name: string
  label?: ReactNode
  helperText?: ReactNode
  options: readonly TOption[]
  getOptionValue?: (option: TOption) => TValue          // default o => o.value
  onChange?: MuiAutocompleteProps<TOption, Multiple, false, FreeSolo>['onChange']
  textFieldProps?: Omit<MuiTextFieldProps, 'name' | 'value' | 'error' | 'inputRef' | 'required' | 'label' | 'helperText'>
}
```

Value mapping (the whole binding):

```
form → MUI                                            MUI → form
  resolve(v) = options.find(o => Object.is(getOptionValue(o), v))
             ?? (typeof v === 'string' && freeSolo ? v          // typed text
               : isOptionShaped(v) ? v                          // object mode, option no longer in list
               : { value: v, label: String(v) })                // primitive not in list (async options)
  single:   v == null ? null : resolve(v)               x == null ? null : toValue(x)
  multiple: (v ?? []).map(resolve)                      xs.map(toValue)
                                                        toValue(x) = typeof x === 'string' ? x : getOptionValue(x)
```

Defaults the consumer can override: `isOptionEqualToValue` compares
`getOptionValue` of both sides (a string side compares as itself);
`getOptionLabel` returns `o.label`, or the string under `freeSolo`.

The `renderInput` TextField gets `label`, `required` (from the rule),
`error={invalid}`, `helperText={helperText(consumerText)}`,
`inputRef={field.ref}`, `onBlur` composed with the consumer's, and
`slotProps.formHelperText` merged with `helperTextA11y`. MUI's `InputBase`
forks `inputRef` with the Autocomplete's own input ref and calls `onBlur`
alongside the Autocomplete's handler, so nothing from `params` is overridden.
`textFieldProps` is spread last onto that TextField.

Async options are entirely pass-through: `options`, `onInputChange`,
`loading`, `filterOptions`. Because `TOption extends Option`, extra fields
(`placeId`) survive to the consumer's `onChange(event, value, reason, details)`.
`multiple` with an `undefined` form value renders as `[]`.

### `NumberField`

Wraps Base UI `NumberField` in the MUI docs recipe, vendored as
`src/fields/NumberField/NumberFieldControl.tsx` (`FormControl` + `InputLabel`
+ `OutlinedInput` + increment/decrement `IconButton`s in an end adornment +
`FormHelperText`). Arrow icons are two inline `SvgIcon` paths; no
`@mui/icons-material`.

| Prop | Type |
|---|---|
| `name` | `string` |
| `label?` | `ReactNode` |
| `helperText?` | `ReactNode` |
| `size?` | `'small' \| 'medium'` |
| `disabled?` | `boolean` |
| rules | `required`, `min`, `max`, `validate` typed over `number \| null` |
| `onValueChange?` | Base UI's `(value, eventDetails)`; runs after the form's |
| `onBlur?` | input blur; runs after the form's |
| rest | Base UI `NumberField.Root` props minus `name`, `value`, `defaultValue`, `onValueChange`, `required`, `disabled`, `min`, `max`, `invalid`: `step`, `largeStep`, `smallStep`, `format`, `locale`, `allowWheelScrub`, `snapOnStep`, `onValueCommitted`, `allowOutOfRange`, … |

Behavior:
- Form value is `number \| null`; empty input is `null`, so `z.number()` works and `min`/`max` hit the resolver's numeric branch. `value={field.value ?? null}`.
- `min` / `max` are single props: the rule's value is passed to Base UI as the bound (arrow keys, buttons, wheel and scrub stop there) and drives the validation message. `allowOutOfRange` defaults to `true` so typed out-of-range input shows the rule message instead of being clamped on blur; a consumer sets it `false` to clamp.
- The visible input's ref is `useForkRef(props.ref, field.ref)` (Base UI's `inputRef` on Root is its hidden input, not the one to focus). `inputA11y` goes on the `OutlinedInput`'s `slotProps.input`; `FormHelperText` gets `helperTextA11y`. `FormControl` gets `error`, `required`, `disabled` via `mergeDisabled`.
- `@base-ui/react ^1.7.0` becomes a peer dependency (React 17+, tree-shakeable) and a dev dependency.

### `Option`

`{ value: string | number; label: string; disabled?: boolean }`. `SelectOption`
stays exported as an alias. `Select` passes `disabled` to its `MenuItem`.

### Exports added

`RadioGroup`, `Autocomplete`, `NumberField`, their `*Props` types, `Option`.
`FormProps` gains the new props. Nothing removed.

## Error handling

Unchanged from v1: zod first, then each mounted field's rules, a rule error
replacing zod's for that field. New value shapes and how the resolver already
treats them:

| Field | Empty value | `required` | `min`/`max` |
|---|---|---|---|
| RadioGroup | `null` / `undefined` | fails on empty | n/a |
| Autocomplete single | `null` | fails on empty | n/a |
| Autocomplete multiple | `[]` | fails on `[]` (resolver's `isEmpty`) | n/a |
| NumberField | `null` | fails on empty | numeric compare; skipped when empty |

Async defaults: a rejected `defaultValues` promise is hookform's to surface
(`isLoading` stays false and the form renders empty); `Form` does not catch it.

## Layout

```
src/
  Form/Form.tsx                     + async defaultValues, values, resetOptions, ref, isLoading disable
  fields/
    useEzField.ts                   + a11y members; useBooleanField.ts removed
    FieldFrame.tsx                  replaces BooleanFieldControl.tsx
    Option.ts                       Option type (SelectOption alias re-exported from Select)
    Checkbox/, Switch/              on FieldFrame labelAs="control"
    RadioGroup/{RadioGroup,RadioGroup.test,RadioGroup.stories}.tsx, index.ts
    Autocomplete/{Autocomplete,Autocomplete.test,Autocomplete.stories}.tsx, index.ts
    NumberField/{NumberField,NumberFieldControl,NumberField.test,NumberField.stories}.tsx, index.ts
  test/describeFieldContract.tsx    shared contract tests
```

## Testing conventions

Same as v1 (Vitest + Testing Library + user-event, KCD queries, one jest-axe
test per component in error state), plus `describeFieldContract`:

```ts
describeFieldContract({
  name: 'RadioGroup',
  render: (props) => <RadioGroup name="x" label="X" options={opts} {...props} />,
  schema, validDefaults, interact: async (user) => { /* pick a value */ },
})
```

It runs: throws outside `<Form>` naming the component; disabled under
`<Form disabled>` and `disabled={false}` does not override it; consumer
`onChange` runs after the form value updates; consumer helper text is the
accessible description and error text replaces it with `role="alert"`; no axe
violations in error state. v1 test files switch to it where their test is the
same and keep their component-specific cases.

Component-specific cases:

| Component | Cases |
|---|---|
| Form | async `defaultValues` disables fields and submit until resolved, then fills; `values` change resets; `ref.current.reset()` works |
| RadioGroup | numeric option value round-trips as a number; required message; legend labels the group; first radio focused after a failed submit |
| Autocomplete | single submits primitive; multiple submits array; freeSolo submits typed text; `getOptionValue={o => o}` submits the object; value not in options still renders its label; consumer `onChange` receives the option with its extra fields |
| NumberField | typing submits a number; clearing submits `null`; `z.number()` schema passes; `min` rule message below bound; increment button and ArrowUp step; focused after failed submit |

## Stories

| File | Stories |
|---|---|
| `Form.stories` | AsyncDefaults (fake 800ms fetch, fields disabled meanwhile), ValuesProp (re-sync on button click), RefReset |
| `RadioGroup.stories` | Default, Required, Row, DisabledOption, Error |
| `Autocomplete.stories` | Single, Multiple, FreeSolo, ObjectValue, AsyncOptions (Places-shaped: debounced fake predictions, `placeId` logged from `onChange`) |
| `NumberField.stories` | Default, MinMax, Step, Formatted (currency `format`), Disabled, Error |

All use hoisted `fn()` for handlers, as in v1.

## Housekeeping

- `vite-plugin-dts` `rollupTypes: true` (deferred v1 item).
- README: three new components with their rule props, `defaultValues` async
  and `values`, `ref`, Base UI peer, and the `z.coerce` note narrowed to
  TextField.

## Success criteria

- `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm build-storybook` pass.
- A consumer can write `<Autocomplete name="address" freeSolo options={predictions} onInputChange={fetch} onChange={(e, v) => …placeId…} />` with a `z.string()` schema, and `<Autocomplete getOptionValue={o => o} />` with a `z.object()` schema.
- `<NumberField name="age" min={18} />` with `z.number()` submits a number, shows `Age must be at least 18.` for 17, and submits `null` when cleared (schema decides whether that is an error).
- `<Form defaultValues={async () => fetchUser()} />` renders disabled, then filled.
- No v1 test changes other than moving shared cases into `describeFieldContract`.
