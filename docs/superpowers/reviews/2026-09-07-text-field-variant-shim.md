# Review ledger — custom text-field variants: local shim + minimal upstream patch (#142)

Date: 2026-09-07. Spec: `docs/superpowers/specs/2026-09-07-text-field-variant-shim-design.md`.
Upstream memo: `docs/superpowers/specs/2026-09-07-upstream-mui-text-field-variant-overrides.md`;
patch `…-minimal.patch` (12 files, +149 / −11), verified in a full mui/material-ui checkout, **not posted**.

## Lanes

| Lane | Scope | Implementer | Review | Result |
| --- | --- | --- | --- | --- |
| S | augmentation under upstream names, `EzTextFieldVariants`, `customVariantSlots`, wrappers (TextField, Autocomplete, NumberField), pickers via `MuiPickersTextField.defaultProps`, preset keyed on `variant === 'stacked'`, tests, story | Opus, 6 commits | Sonnet: 3 fixes (story field names, picker comment placement, limitation note) + **found the bare-`filled` regression** | fixed by a variant-switching slot (`VariantInput` / `PickersVariantInput`) reading the resolved variant from `FormControl` context; merged `98b8ddc` |
| D | README "Custom variants", label-placement wording, DESIGN.md, DECISIONS `## #142`, CHANGELOG | Opus, 1 commit | Sonnet: reconciled with the built code (pickers theme-only, Select free, NumberField gains `variant`, `@mui/types`, #143, 7 code-lane rulings) | merged `7e9a02b`; slot-name touch-up `b4b6072` |
| U | cut the 39-file upstream draft to 12 files; verify in a full checkout | Opus | — | typescript ✔, module-augmentation 31/31 ✔, proptypes no-op ✔, docs:api idempotent ✔, 223 unit tests ✔, prettier/eslint ✔; one-augmentation contract (`BaseTextFieldProps` omits `variant`) proven by a negative test |

## Whole-branch review (Fable, idle machine)

- `src/theme/augmentation.ts` declares `TextFieldPropsVariantOverrides { stacked: true }` in `'@mui/material/TextField'` and `FormControlPropsVariantOverrides {}` — the upstream names, so the deletion is a grep for `UPSTREAM SHIM (#142)` (16 marked lines, file list pinned by a test).
- `EzTextFieldVariants = OverridableStringUnion<TextFieldVariants, TextFieldPropsVariantOverrides>` from `@mui/types` (devDependency; the same import MUI's own `.d.ts` uses).
- Casts: two in the preset (`'stacked' as TextFieldVariants`), one at each wrapper's `<MuiTextField>` boundary; nothing else re-declares a MUI union.
- Preset: `MuiInputLabel` static rules under `variants: [{ props: p => p.variant === 'stacked' }]`; `shrink`/`disableAnimation`/`notched` defaults dropped with a test proving the legend never carries the label for a custom variant; `defaultProps.slots.input` is the switching slot, so bare `<MuiTextField variant="filled">` under the preset renders `MuiFilledInput-root` (test) and `variant="outlined"` floats its label (test).
- `useSlot` passes no `variant` prop to the input slot; `FormControl` context is the channel, for both `TextField` and `PickersTextField` (styled MUI `FormControl`).
- `labelPlacement` (#139) untouched; `start`'s grid still un-floats by class.

Gate (six commands, idle main): typecheck ✔ lint ✔ test ✔ (82 files, 2547 passed, 9 skipped, 2 todo) build ✔ build-storybook ✔ check:guardrails ✔. Typecheck and lint first failed on main because the new `@mui/types` devDependency had not been installed there; `pnpm install --frozen-lockfile` fixed it (lockfile was committed by the lane).

## Rulings

`docs/DECISIONS.md` `## #142` (spec's seven + the code lane's seven + the switching-slot ruling).

## Open

- Upstream posting: Steve decides framing (bug vs feature) and venue (comment on mui/material-ui#37846 vs new issue) and posts from his account. #142 stays open for that.
- #143 preset notched look for `variant="outlined"`.
