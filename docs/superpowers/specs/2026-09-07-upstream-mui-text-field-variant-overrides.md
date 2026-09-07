# Upstream proposal — custom `variant`s on Material UI's text-input family

Date: 2026-09-07. Status: **draft for Steve's review; nothing has been posted upstream.** A local
patch exists at `scratchpad/mui-upstream` (branch `feat/text-field-variant-overrides`) and as
`mui-variant-overrides.patch`; see §5 once the drafter reports.

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

## 4. Forks for Steve

| Fork | Option A (recommended) | Option B | Why it matters |
| --- | --- | --- | --- |
| Runtime fallback for an unknown variant | `InputBase` — the unstyled root the three built-ins share; the theme's `variants` dress it | `OutlinedInput` — "inherits the default variant's structure" | A decides what `variant="stacked"` looks like before any theme rule: A = bare input, B = outlined box with the notch permanently closed (TextField only passes `label` under `'outlined'`) |
| Scope of the first PR | TextField + FormControl + InputLabel + InputAdornment (one PR, ~40 type lines + 2 runtime lines) | …plus Select/SelectInput/NativeSelect (second PR; Select needs the `cloneElement` guard) | Smaller first PR mirrors #33589's size and framing; Select has its own closed dup (#34690) to reopen |
| Framing | Bug: "TextField: unable to create new variants" (#33589's wording) linking #37846 and #33510 | Feature: "Support custom variants" | Bug framing is what got #33589 merged; feature framing routes to `waiting for 👍` |
| Where to speak first | Comment on #37846 with the diff summary + link to a draft PR | New issue | #37846 is the canonical thread the maintainer pointed at; a new issue would be duped to it |
| x-date-pickers | Follow-up in mui/mui-x after the material PR lands (`PickersTextField.types.d.ts` imports `TextFieldVariants`, so the type flows; only its literal fields and `VARIANT_COMPONENT` fallback need the same two changes) | Same PR | Different repo |

## 5. Change list (from the local patch)

Patch: `docs/superpowers/specs/2026-09-07-upstream-mui-variant-overrides.patch` (1101 lines; 39 files,
+500 / −47). Local branch `feat/text-field-variant-overrides` in the scratchpad clone, commit `a20b2d2`.
**Not pushed, not posted.**

```
types (7 .d.ts)                      runtime (7 .js)                      tests / docs
──────────────────────────────────   ──────────────────────────────────   ─────────────────────────────────
TextField.d.ts   +VariantOverrides    TextField.js   ?? InputBase +        TextField.test.js  +3 (fallback,
                 +CustomTextFieldProps               dev warning naming    dev warning, no notch)
                 4th conditional arm                 slots.input; PropTypes
FormControl.d.ts +VariantOverrides    FormControl.js PropTypes oneOfType    Select.test.js     +2
InputLabel.d.ts  +VariantOverrides    InputLabel.js  PropTypes             test/typescript/moduleAugmentation/
InputAdornment.d.ts +VariantOverrides InputAdornment.js PropTypes            {textField,formControl,inputLabel,
Select.d.ts      +VariantOverrides    Select.js      ?? <StyledInputBase/>   select}Variants.spec.tsx (+tsconfig)
                 +CustomSelectProps                  + dev warning naming  docs text-fields.md  "Custom variants"
SelectInput.d.ts reuses SelectVariants               `input`; PropTypes    api/*.json + translations (hand-applied
NativeSelect(+Input).d.ts widened     NativeSelect(+Input).js PropTypes    `pnpm docs:api` deltas, 12 files)
```

Type design (probe-verified with ez-form's `tsc --strict` against the real `@mui/types`):

```ts
export interface TextFieldPropsVariantOverrides {}
export type TextFieldVariants = OverridableStringUnion<'outlined' | 'standard' | 'filled', TextFieldPropsVariantOverrides>
export interface CustomTextFieldProps extends BaseTextFieldProps, TextFieldSlotsAndSlotProps<InputBaseProps> {
  onChange?: InputBaseProps['onChange']
  variant: Exclude<TextFieldVariants, 'outlined' | 'standard' | 'filled'>   // `never` until augmented
}
export type TextFieldProps<V extends TextFieldVariants = TextFieldVariants> =
  V extends 'filled' ? FilledTextFieldProps
  : V extends 'standard' ? StandardTextFieldProps
  : V extends 'outlined' ? OutlinedTextFieldProps      // new explicit arm — was the else-branch
  : CustomTextFieldProps
```

Probe results: built-in instantiations unchanged; `'dashed'` rejected unaugmented, accepted augmented;
`Variant` infers to the custom literal; `onChange` types are identical (`expectType`) per arm; the new
type-only import cycle `Select.d.ts ↔ SelectInput.d.ts` resolves.

Drafter's rulings worth knowing: explicit `'outlined'` arm so the else-branch is not silently retyped;
`Select` gets a fourth union arm rather than a conditional rewrite; dev warnings fire per render like the
adjacent `select && !children` warning; augmentation specs live in `test/typescript/moduleAugmentation/`
(the repo's script says co-located augmentations leak across the TS program); `Select`'s fallback is a
`styled(InputBase)` under `styledRootConfig` so `variant` is not forwarded to the DOM.

**Unverified locally** (no monorepo install): `pnpm proptypes`, `pnpm docs:api`, the 5 new runtime tests,
the 4 type-spec files, prettier/eslint. The hand-written PropTypes and JSON follow the
`FormHelperText`/`Button` output exactly, so regeneration should be a no-op, but that is a claim to check
in a real checkout before anything is opened.

## 6. What this would mean for ez-form

- Today's `'top' | 'start'` axis (#139) stays valid: it says *where* the label goes; a custom
  `variant` says what the box looks like. They compose (`variant="stacked"` + `labelPlacement="start"`).
- If upstream lands, `createEzFormTheme()` can register `variant: 'stacked'` through
  `TextFieldPropsVariantOverrides` + `theme.components.MuiTextField/MuiInputLabel.variants`, and set
  it as `MuiTextField.defaultProps.variant` — the stacked look becomes a named variant a consumer can
  opt out of per field with `variant="outlined"`, which is the shape Steve asked for.
- `start` cannot become a variant: it is a per-form layout with a breakpoint and a shared label
  column, which a per-field prop cannot coordinate. It stays on `<Form>`.
