# Custom `variant`s on ez-form's text fields — a local shim that mirrors the upstream API (#142)

Date: 2026-09-07. Status: approved in session ("the local change + the real lib fix, that's what I
want, as the real lib fix might never get merged"). Companion to
`2026-09-07-upstream-mui-text-field-variant-overrides.md` (the minimal upstream patch).

## Why

Steve: "I really want to be able to have additional variants on the TextField and/or FormControl more
than anything." MUI's `TextFieldVariants` is a closed union with no `TextFieldPropsVariantOverrides`
to augment, and `TextField` throws at render for a value outside its `variantComponent` map. The
upstream fix is eight lines but may never merge. So ez-form ships the same eight lines' worth of
behaviour locally, **using the exact names upstream would use**, so that when (if) MUI ships it the
shim is deleted and no consumer changes a character.

## Rulings

- Ruling: **the shim declares the upstream interfaces by module augmentation** —
  `declare module '@mui/material/TextField' { interface TextFieldPropsVariantOverrides {} }` and the
  `FormControl` twin — rather than inventing `EzTextFieldVariantOverrides`. A consumer adds a variant
  with the same `declare module` line the MUI docs will show; when upstream ships, the two empty
  interfaces merge and ez-form's declaration is deleted — cost if wrong: if upstream ships under a
  different name, ez-form renames its declaration and consumers follow one rename.
- Ruling: **a custom variant renders `OutlinedInput`**, matching the upstream patch's fallback:
  `TextField` only passes `label` to the input under `'outlined'`, so the notch never opens — cost if
  wrong: a consumer wanting another input passes `slots.input`, as upstream.
- Ruling: **`'stacked'` is a variant ez-form declares, and its look is the preset's.** The type is
  global anyway (module augmentation), so the declaration sits in `src/theme/augmentation.ts` next to
  the `Ez*` keys; under a stock `createTheme()` it is an outlined box with a floating label and no
  notch, exactly what MUI would render — cost if wrong: a stock-theme consumer who writes
  `variant="stacked"` expecting a look gets MUI's plain box; the README says the look is the preset's.
- Ruling: **the preset moves the static-label rules under `variant === 'stacked'`** and sets
  `MuiTextField.defaultProps.variant = 'stacked'` (and `MuiPickersTextField`), so a consumer opts a
  single field back to MUI's floating label with `variant="outlined"` — the per-field opt-out Steve
  asked for. The preset's *box* rules (root border, focus ring, padding) stay theme-wide in this pass
  — cost if wrong: under the preset `variant="outlined"` floats its label over the root's solid
  border, because `notchedOutline` is `border: none` there; filed as a follow-up ("preset: a real
  notched look for `variant="outlined"`").
- Ruling: **every shim line carries the marker `UPSTREAM SHIM (#142)`** in a comment, and a test
  asserts the marker count so the deletion is a grep — cost if wrong: none.
- Ruling: **`Form.labelPlacement` (#139) is unchanged.** The axis says *where* (`top` | `start`);
  the variant says what the box is and whether a `top` label floats. `start`'s grid un-floats the
  label in CSS regardless of variant — cost if wrong: none; the two compose.
- Ruling: **casts are confined to the preset and the one MUI boundary in each wrapper**, each with the
  marker. The preset's `variants` use the function-predicate form
  (`props: (p) => p.variant === 'stacked'`) rather than an object, because `props` is typed
  `Partial<TextFieldProps>` off MUI's closed union — cost if wrong: two or three `as` casts to delete
  with the shim.

## 1. Surface

```tsx
// consumer, once, in a .d.ts (identical to what the MUI docs will say after upstream):
declare module '@mui/material/TextField' {
  interface TextFieldPropsVariantOverrides { dashed: true }
}
// theme:
components: { MuiTextField: { variants: [{ props: (p) => p.variant === 'dashed', style: {…} }] } }
// usage:
<TextField name="a" label="A" variant="dashed" />      // typechecks; renders OutlinedInput
<TextField name="b" label="B" />                       // preset: 'stacked' (static label)
<TextField name="c" label="C" variant="outlined" />    // preset: MUI's floating label
```

| Surface | Change |
| --- | --- |
| `src/theme/augmentation.ts` | `declare module '@mui/material/TextField' { interface TextFieldPropsVariantOverrides { stacked: true } }`; `declare module '@mui/material/FormControl' { interface FormControlPropsVariantOverrides {} }` |
| `src/fields/textFieldVariants.ts` (new) | `export type EzTextFieldVariants = OverridableStringUnion<TextFieldVariants, TextFieldPropsVariantOverrides>`; `isBuiltInTextFieldVariant(v)`; `customVariantSlots(variant, slots)` → merges `{ input: OutlinedInput }` under the consumer's `slots` when the variant is custom |
| `TextField`, `NumberFieldControl`, `Autocomplete` (`textFieldProps`) | `variant?: EzTextFieldVariants`; pass `variant` through with one cast; `slots={customVariantSlots(variant, slots)}` |
| pickers (`usePickerField`) | same for `slotProps.textField` (`PickersTextField` has the same `VARIANT_COMPONENT` map and `slots.input`); fallback input is `PickersOutlinedInput` |
| any field whose root is a `FormControl` with `variant` | audit; widen the type where a consumer can pass `variant` |
| preset `ezFormTheme.ts` | `MuiTextField.defaultProps.variant: 'stacked'`, `MuiPickersTextField.defaultProps.variant: 'stacked'` (cast); `MuiInputLabel`: drop `defaultProps.shrink/disableAnimation`, move `position/transform/maxWidth/padding/pointerEvents/whiteSpace` + `transition: 'none'` under `variants: [{ props: p => p.variant === 'stacked', style }]`; `MuiOutlinedInput.defaultProps.notched` dropped (no `label` reaches the input under a custom variant); `MuiFormHelperText` margins likewise keyed on `stacked` or left theme-wide (lane decides; MUI already drops the 14px inset for a non-outlined/filled variant) |

`InputLabel` receives `variant` through `FormControl` context (`useFormControlState`), so the preset's
predicate sees `'stacked'` on the label's `ownerState` without any prop plumbing.

## 2. Tests

- `<TextField variant="stacked">` under stock `createTheme()`: renders (no throw), root has
  `outlinedInputClasses.root`, notched-outline legend is the collapsed one, label `position: absolute`.
- Under `createEzFormTheme()`: default field's label is static (`transform: none`, `position: relative`);
  `variant="outlined"` field's label is `position: absolute`.
- Pickers: `DateField` renders under both themes without throwing; label static under the preset.
- `expectTypeOf<EzTextFieldVariants>()` includes `'stacked'` and every built-in; a field prop type
  accepts `variant="stacked"`.
- `UPSTREAM SHIM (#142)` marker count pinned (so a stray shim line is caught, and the deletion is one
  grep).
- jest-axe on every touched component test; pristine output.
- `describeFieldContract` runs unchanged.

## 3. Lanes

| Lane | Branch | Scope |
| --- | --- | --- |
| S | `feat/text-field-variant-shim` | augmentation, `textFieldVariants.ts`, wrappers, pickers, preset, tests, one story (`TextField` "Variants": stacked / outlined / a consumer `dashed`) |
| D | `docs/text-field-variant-shim` | README (a "Custom variants" section; the label-placement section's "whether a `top` label floats" sentence now names the variant), DESIGN.md (static label = `variant: 'stacked'`), DECISIONS.md `## #142`, CHANGELOG |

Merge S, then D; whole-branch review; six-command gate; push.

## 4. Deletion plan (when upstream ships)

grep `UPSTREAM SHIM (#142)` → delete each line: the two `declare module` interfaces (keep the
`stacked: true` member, now augmenting MUI's own interface), `customVariantSlots` and its call sites,
the casts. `EzTextFieldVariants` becomes an alias of MUI's `TextFieldVariants`. Consumers change nothing.

## 5. Follow-ups to file

- Preset: a real notched look for `variant="outlined"` (box rules keyed on variant).
- `Select`, `ToggleButtonGroup`, others whose root `FormControl` takes `variant`: extend if a consumer
  can reach it.
