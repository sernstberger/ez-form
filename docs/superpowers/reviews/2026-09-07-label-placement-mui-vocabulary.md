# Review ledger — label placement in MUI's vocabulary (#139)

Date: 2026-09-07. Spec: `docs/superpowers/specs/2026-09-07-label-placement-mui-vocabulary-design.md`.
Base `dffe5e6` → head after three merges (B `d11b3cf`, A `0c8c854`, C `4afa1a7`); 29 files, +1375 / −465.

## Lanes

| Lane | Scope | Implementer | Review | Result |
| --- | --- | --- | --- | --- |
| A | `LabelPlacement = 'top' \| 'start'`, styles, Form default, preset, tests, stories | Opus, 4 commits | Sonnet, clean, no fixes | merged `0c8c854` |
| B | `BoundField.controlLabelProps`; Checkbox/Switch forward MUI `FormControlLabel.labelPlacement`; `warnUnusedControlLabelProps` | Opus, 3 commits | Sonnet, clean, no fixes | merged `d11b3cf` |
| C | README, DESIGN.md, DECISIONS.md, CHANGELOG | Opus, 1 commit | Sonnet, 2 fixes (README names the cell classes; `## #131` superseded note) | merged `4afa1a7` |

Merge conflict: `BoundField.test.tsx` (A vs B) resolved to A's assertion, which names the `'top'` default.

## Whole-branch review (Fable, idle machine)

- `top` emits no CSS; `start` emits CSS only inside `theme.breakpoints.up(bp)`; `cellBox` untouched.
- `selfLabelledOptOut`'s `unset` block on `.MuiFormLabel-root` is inert for Checkbox/Switch/FileField (their boxes contain no `FormLabel`) and correct for the consumer-`FormControlLabel` arm.
- Preset: `EzForm.defaultProps.labelPlacement` removed; `EzForm.styleOverrides.description.marginBottom` = 16px.
- Checkbox/Switch: MUI 9.4.0 `FormControlLabel` keeps control-then-label DOM order under every placement (CSS `flex-direction` only), so reading order is unchanged; tests pin the class + emitted rule.
- No `'floating'`/`'stacked'` values remain outside DECISIONS history and FieldArray's unrelated `layout` axis.

Gate (six commands, idle main): typecheck ✔ lint ✔ test ✔ (81 files, 2528 passed, 9 skipped, 2 todo) build ✔ build-storybook ✔ check:guardrails ✔.

## Rulings

See `docs/DECISIONS.md` `## #139`. Lane-level rulings recorded in `.superpowers/sdd/2026-09-07-label-placement-mui-vocabulary/LEDGER.md`.

## Follow-ups filed

- RadioGroup/CheckboxGroup per-option `FormControlLabel.labelPlacement`.
- Checkbox/Switch do not route through `useDefaultProps`, so a theme cannot default their `labelPlacement`.
- Upstream MUI proposal (custom TextField variants) — memo + local patch in `docs/superpowers/specs/`.
