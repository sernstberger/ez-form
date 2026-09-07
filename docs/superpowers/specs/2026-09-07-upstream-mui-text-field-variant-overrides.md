# Upstream proposal — custom `variant`s on Material UI's text-input family

Date: 2026-09-07. Status: **minimal patch verified in a full mui/material-ui checkout; nothing has been
posted upstream.** Patch: `docs/superpowers/specs/2026-09-07-upstream-mui-variant-overrides-minimal.patch`
(12 files, +149 / −11). Steve ruled the first 39-file draft too big ("I don't understand why you
wouldn't be adding an additional variable to this list"); §5 describes the cut.

Steve: "I really want to be able to have additional variants on the TextField and/or FormControl
more than anything." This memo is what it would take, what stands in the way, and a concrete change
list, so the decision to open anything on mui/material-ui is made with the diff in hand.

## 1. What MUI has today (`@mui/material@9.4.0`, verified in the installed `.d.ts`/`.mjs`)

```
                    variant type                    runtime on an unknown variant
──────────────────  ──────────────────────────────  ───────────────────────────────────────────
Button, Chip, …     OverridableStringUnion + …Overrides   styled `variants` match → theme styles apply
FormHelperText      OverridableStringUnion + …Overrides   `contained` false → no side margins  ✔ (PR #33589, 2022)
TextField           closed 'outlined'|'standard'|'filled' variantComponent[variant] → undefined → React throws
                                                          …unless `slots.input` is given (v6+): then it renders ✔
FormControl         closed                                passes variant into context; no branch  ✔
InputLabel          closed                                filled/outlined style arms miss → standard-ish  ✔
Select              closed (SelectVariants)               {…}[variant] → undefined → cloneElement throws ✘
SelectInput, NativeSelect(+Input), InputAdornment  closed  style lookups miss → harmless  ✔
InputBase, Input, FilledInput, OutlinedInput, Autocomplete   no `variant` prop of their own
x-date-pickers PickersTextField   imports TextFieldVariants; own VARIANT_COMPONENT map (same shape)
```

The maintainers' one stated objection (mnajdova, #37846 and #34690): *the structure of the component
depends on `variant`*. In 9.4.0 that is true of exactly two lookups — `TextField.js:136` and
`Select.js:84-98` — and `TextField`'s is already bypassed by `slots.input`. Everything else falls
through harmlessly, and the theme's `variants: [{ props: { variant: 'x' }, style }]` matcher already
styles any string.

## 2. Landscape (read-only research, 2026-09-07)

| Thread | State | Position |
| --- | --- | --- |
| [#37846](https://github.com/mui/material-ui/issues/37846) Support custom variant to TextField | open, 👍 10 | mnajdova: "structure depends on this prop… tracking in #22259, please upvote" |
| [#22259](https://github.com/mui/material-ui/issues/22259) RFC replace `variant` with `kind` where it alters DOM | closed 2024-11 | no consensus; "aiming for a fresh look for Material UI" |
| [#33510](https://github.com/mui/material-ui/issues/33510) `variant` overrides in all components | open, 👍 3 | tracking/discussion; users report the docs promised this |
| [#34690](https://github.com/mui/material-ui/issues/34690) Select variant overrides | closed dup | "variant is used for rendering different components" |
| [#33589](https://github.com/mui/material-ui/pull/33589) FormHelperText: fix unable to create new variants | **merged** 2022-07-22 | community PR, bug-framed, same form family — the precedent |
| [#27940](https://github.com/mui/material-ui/issues/27940) TextField variant without shrinking label | open, `waiting for 👍` 7 | "not planned at the moment" (2025-04) |

Contribution gate ([CONTRIBUTING.md](https://github.com/mui/material-ui/blob/master/CONTRIBUTING.md)):
issue first for non-trivial changes; PR title `[material-ui][TextField] …`; `pnpm proptypes`,
`pnpm docs:api`, `*.spec.tsx` type tests, docs demo for a common use case; non-breaking.

## 3. The proposal, in one paragraph

Do to `TextField`, `FormControl`, `InputLabel`, `Select`, `SelectInput`, `NativeSelect`, and
`InputAdornment` what #33589 did to `FormHelperText`: an empty `<Component>PropsVariantOverrides`
interface and `OverridableStringUnion`. Then close the two runtime holes: `TextField` renders
`InputBase` for a variant it does not know (with a dev warning naming `slots.input` as the way to
choose another input), and `Select` does the same for its `input` prop. Non-breaking: with no
augmentation the exported types are byte-identical, and the built-in variants take the same code
path they take today. The answer to "structure depends on `variant`" is "since v6 it depends on
`slots.input`; `variant` only picks the default".

## 4. Forks (two closed by the cut, two remain for Steve)

| Fork | Resolution |
| --- | --- |
| Runtime fallback for an unknown variant | **`OutlinedInput`** — the custom value lands in the existing outlined props arm, so its `slotProps.input` keeps MUI's `OutlinedInputProps` typing and no new interface is needed; `TextField` passes `label` to the input only under `'outlined'`, so the notch never opens |
| Scope | **TextField + FormControl only.** Select/NativeSelect/InputAdornment/InputLabel dropped; Select's `cloneElement` throw is a separate, smaller PR if ever wanted |
| Framing | *open* — Option A (recommended): bug, "TextField: unable to create new variants" (#33589's wording), linking #37846 and #33510. Option B: feature |
| Where to speak first | *open* — Option A (recommended): comment on #37846 with the summary and a draft PR from Steve's fork. Option B: new issue |

## 5. The minimal patch

```
TextField.d.ts   +export interface TextFieldPropsVariantOverrides {}
                 TextFieldVariants = OverridableStringUnion<'outlined' | 'standard' | 'filled', TextFieldPropsVariantOverrides>
                 OutlinedTextFieldProps.variant: Exclude<TextFieldVariants, 'standard' | 'filled'>   // custom values resolve here
                 BaseTextFieldProps omits 'variant' from the FormControlProps it extends           // one augmentation is enough
TextField.js     const InputComponent = variantComponent[variant] ?? OutlinedInput;
                 PropTypes: oneOfType([oneOf([...]), string])   (generator-confirmed)
FormControl.d.ts +export interface FormControlPropsVariantOverrides {}; variant?: OverridableStringUnion<…>
FormControl.js   PropTypes as above
tests            TextField.test.js (+1: custom variant renders OutlinedInput, legend carries no label)
                 test/typescript/moduleAugmentation/{textFieldVariants,formControlVariants}.spec.tsx (+tsconfigs)
docs             text-fields.md "Custom variants" section; api/{text-field,form-control}.json regenerated
```

Verified in a full checkout of master (`4d36029`), patch applied to a pristine tree, pnpm 11.24.0 / node 26:

| Check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile`, `git apply` | pass |
| `pnpm --filter @mui/material typescript` | pass |
| `typescript:module-augmentation` | 31/31; both new specs pass in isolation |
| `pnpm proptypes` | no further diff |
| `pnpm docs:api` | two JSON deltas, idempotent; generators reproduce the patch byte-for-byte |
| TextField + FormControl unit tests (jsdom + chromium) | 223 passed, 13 skipped; reverting the fallback fails the new test |
| prettier, eslint (touched files) | pass |

Finding worth citing in the PR: without the `'variant'` omit, augmenting only the TextField interface
fails with `TS2430` because `OutlinedTextFieldProps` no longer satisfies the `FormControlProps` it
inherits. The omit is one token; a negative test proves it is load-bearing.

## 6. What this would mean for ez-form

- Today's `'top' | 'start'` axis (#139) stays valid: it says *where* the label goes; a custom
  `variant` says what the box looks like. They compose (`variant="stacked"` + `labelPlacement="start"`).
- If upstream lands, `createEzFormTheme()` can register `variant: 'stacked'` through
  `TextFieldPropsVariantOverrides` + `theme.components.MuiTextField/MuiInputLabel.variants`, and set
  it as `MuiTextField.defaultProps.variant` — the stacked look becomes a named variant a consumer can
  opt out of per field with `variant="outlined"`, which is the shape Steve asked for.
- `start` cannot become a variant: it is a per-form layout with a breakpoint and a shared label
  column, which a per-field prop cannot coordinate. It stays on `<Form>`.
