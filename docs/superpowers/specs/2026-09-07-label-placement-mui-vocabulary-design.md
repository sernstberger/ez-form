# Label placement in MUI's vocabulary — `'top' | 'start'`, floating is the theme's (#9, #66 rework)

Date: 2026-09-07. Status: design approved by Steve in session (one fork, three options, "MUI
vocabulary" chosen). Build follows via three lanes. Supersedes the `'floating' | 'stacked' | 'start'`
axis from #9/#66 and the belt-and-braces `EzForm.defaultProps.labelPlacement` ruling.

## Why

Steve: "I really don't like the stacked setting — having two separate label settings: stacked and
floating or whatever (there's a default). I'd really like to use the built-in mechanisms for the
various types of input label placements."

Verified against `@mui/material@9.4.0`:

| MUI mechanism                                                       | What it decides                       | Where it lives           |
| ------------------------------------------------------------------- | ------------------------------------- | ------------------------ |
| `InputLabel` `shrink` + `disableAnimation`, `OutlinedInput` `notched` | whether a top label **floats**        | props / theme defaults + `styleOverrides` |
| `FormControlLabel.labelPlacement: 'end' \| 'start' \| 'top' \| 'bottom'` | where a checkbox/switch/radio label sits | prop                     |
| `TextFieldVariants` / `FormControl.variant` / `InputLabel.variant`  | the **box** (outlined/filled/standard) | closed union, no `*VariantOverrides` |

There is no MUI mechanism for a label **beside** a text input. Two defects in today's axis follow:

1. `'stacked'` duplicates the theme: `createEzFormTheme()` already shrinks `MuiInputLabel` and
   un-notches `MuiOutlinedInput`, and DECISIONS admits the two are "belt-and-braces".
2. `Checkbox`/`Switch` accept `labelPlacement` typed as the ez axis — inert on them (they opt out
   of `start`) — while shadowing MUI's real `FormControlLabel.labelPlacement`, which `BoundField`
   never forwards. A consumer cannot put a label before a Switch at all.

## Rulings (Steve, 2026-09-07)

- Ruling: **`labelPlacement` takes `FormControlLabel`'s vocabulary, `'top' | 'start'`; `'floating'`
  and `'stacked'` are deleted** — the axis says *where* the label is; whether a `top` label floats
  is `InputLabel`'s `shrink`, a theme concern, exactly as in vanilla MUI — cost if wrong: a
  stock-theme consumer who wants static labels writes the same three theme lines a vanilla MUI
  consumer writes today.
- Ruling: **`start` below `labelPlacementBreakpoint` applies no CSS** — the box is MUI's own:
  floating under a stock theme, static under the preset — cost if wrong: a stock-theme `start`
  form shows floating labels on a phone and in-flow labels on a desktop; documented, and the
  preset never shows it.
- Ruling: **the preset drops `EzForm.defaultProps.labelPlacement`** and carries the description
  gap as `EzForm.styleOverrides.description` (`marginBottom: spacing(2)`), because under the
  preset every label is static and touches the description — cost if wrong: none; the theme
  overrides were already the half that reached bare `<MuiTextField>`s.
- Ruling: **`Checkbox`/`Switch` `labelPlacement` *is* MUI's `FormControlLabel` prop**
  (`'end' | 'start' | 'top' | 'bottom'`), forwarded through `BoundField` `labelAs="control"` as
  `controlLabelProps`; they no longer take the form axis — cost if wrong: a consumer who passed
  the form axis to a Checkbox gets a type error naming the right values.
- Ruling: **`'top'` is a real class value and the context default; `undefined` resolves to
  `'top'`** — every field box keeps exactly one placement class, so tests and themes can still
  select "every box under `top`" — cost if wrong: nothing; `top` emits no rules.
- Ruling: **`EzFieldLayout-cell` / `-cellHelperHidden` and `FieldArray layout="stacked" | "table"`
  are untouched** — a different axis with the same word — cost if wrong: none.

## 1. Surface

```tsx
<Form labelPlacement="start" labelWidth="14rem" labelPlacementBreakpoint="md">
  <TextField name="email" label="Email" />                       // label in column 1
  <TextField name="nick" label="Nickname" labelPlacement="top" /> // this row: label above
  <Switch name="alerts" label="Email alerts" labelPlacement="start" /> // MUI's prop: label before the switch
</Form>
```

| Prop                                   | Type                                  | Default   | Notes                                                                    |
| -------------------------------------- | ------------------------------------- | --------- | ------------------------------------------------------------------------ |
| `Form.labelPlacement`                  | `'top' \| 'start'`                    | `'top'`   | theme-defaultable via `EzForm.defaultProps`                              |
| `Form.labelPlacementBreakpoint`        | `Breakpoint`                          | `'sm'`    | unchanged                                                                |
| `Form.labelWidth`                      | `string \| number`                    | `'12rem'` | unchanged                                                                |
| `<AnyField>.labelPlacement`            | `'top' \| 'start'`                    | form's    | per-row escape hatch; **removed from `Checkbox` and `Switch`**           |
| `Checkbox.labelPlacement`, `Switch.labelPlacement` | `FormControlLabelProps['labelPlacement']` | MUI's `'end'` | forwarded to `FormControlLabel`                                      |
| `BoundField.controlLabelProps`         | `Omit<FormControlLabelProps, 'control' \| 'label' \| 'required'>` | —  | only read under `labelAs="control"`; dev-warn otherwise (`warnUnused…` pattern) |

`fieldLayoutClasses`: `root`, `top`, `start`, `selfLabelled`, `cell`, `cellHelperHidden`.
`floating` and `stacked` are gone.

## 2. CSS (`src/fields/labelPlacementStyles.ts`)

```
labelPlacementStyles(theme, bp, labelWidth) = {
  [`& .EzFieldLayout-start`]: {
    [theme.breakpoints.up(bp)]: {
      ...startBox(theme, labelWidth),   // grid + unfloatLabel + closeNotch on the column-1 label
      ...selfLabelledOptOut(theme),     // Checkbox/Switch/FileField: no grid, flush left
      // description gap, start-only, inside the same media block
    },
  },
  ...cellBox,                            // unchanged (#14)
}
```

- `stackedBox`, the `stacked` rule and the unconditional description-gap rule are deleted.
- `unfloatLabel` and `closeNotch` survive **only inside `startBox`**: a label in a grid column has
  to be in flow, which is layout, not taste. `selfLabelledOptOut` resets to MUI's own box (no
  `stackedLabel` re-application).
- The description gap becomes `&:has(.EzFieldLayout-start) .EzForm-description { marginBottom }`
  under `up(bp)` in `src/`, plus `EzForm.styleOverrides.description` in the preset.
- `top` emits nothing. A field rendered under `top` is byte-for-byte MUI's `FormControl` box.

## 3. Lanes

| Lane | Branch                          | Touches                                                                                                                                                                    | Verifies in its worktree                                 |
| ---- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| A    | `feat/label-placement-top-start` | `LabelPlacementContext.ts`, `labelPlacementStyles.ts`, `Form.tsx` (docs + default), `useEzField.tsx` (if needed), `ezFormTheme.ts`, `augmentation.ts` comments, `describeFieldContract.tsx`, `labelPlacement.test.tsx`, `examples/labelPlacement.test.tsx`, `ezFormTheme.test.tsx`, `LabelPlacement.stories.tsx` + its test, `Insurance.stories.tsx` | typecheck, lint, vitest on touched files, jest-axe intact |
| B    | `feat/checkbox-switch-mui-label-placement` | `BoundField.tsx` (`controlLabelProps`), `Checkbox.tsx`, `Switch.tsx`, their tests + stories, `BoundField.test.tsx`; **does not** touch `LabelPlacementContext.ts` — it drops the import | same                                                     |
| C    | `docs/label-placement-top-start` | `README.md` (§Label placement, prop tables, the ~L1770 note), `DESIGN.md` (Inputs bullets), `docs/DECISIONS.md` (new section with the rulings above), `CHANGELOG.md`         | `pnpm format`, prose reads against this spec              |

A and B are independent (B removes Checkbox/Switch's import of `LabelPlacementProps`; A shrinks
that type). C depends only on this spec. Merge order: B, A, C; then one whole-branch review on
`main` on an idle machine, then the six-command gate.

## 4. Out of scope (follow-ups to file)

- `RadioGroup` / `CheckboxGroup` per-option `FormControlLabel.labelPlacement` (they render their
  own `FormControlLabel`s; expose through `slotProps.option` or similar).
- An upstream MUI proposal (variant overrides or a `labelPlacement` prop on `TextField`) — being
  investigated separately; nothing here depends on it, and a future upstream prop of the same
  name would make ez-form's a pass-through.
