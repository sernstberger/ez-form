# QA sweep #47 — label placement axis (`labelPlacement`, #9/#66, polish waves #130/#131)

Date: 2026-09-06. Status: **findings only, nothing fixed.**

Method: same as the prior sweeps — vitest probes in the gitignored `src/__qa__/` scratch
area (deleted at the end; `git status` clean apart from the pre-existing untracked
`rtl.png`), a Storybook + Playwright MCP browser pass at 1280px/768px/700px/640px/360px and
under an RTL global, every finding reproduced at least twice, baseline-compared against
plain MUI before assigning blame.

Target: the `labelPlacement: 'floating' | 'stacked' | 'start'` axis (`src/fields/
LabelPlacementContext.ts`, `src/fields/labelPlacementStyles.ts`, `src/fields/FieldFrame.tsx`,
`Form.tsx`'s `EzForm` Root slot) across every field family: `TextField`/`Select`/
`StateSelect`/`Autocomplete`/`NumberField`/`OtpField` (plain `FormControl` boxes),
`Checkbox`/`Switch` (`labelAs="control"`), `RadioGroup`/`CheckboxGroup`/`Rating`/`Slider`/
`ToggleButtonGroup` (`labelAs="legend"`), `FileField` (its own `FormControl`, not
`FieldFrame`), `AddressField` (composite grid of ez-form fields), `ReadOnlyField` and
`FieldArray` (checked for whether the axis applies to them at all), plus `Form`/`Wizard`/
`FormDialog` prop-threading. Stories: all 8 under `Fields/Label placement`
(`fields-label-placement--*`), spot-checked against `fields-*`/`examples-*` for whether the
preset's stacked default holds.

---

## 1. Verdict up front

One new finding — a family this axis's own design doc did not account for — plus
confirmation that the two same-day polish issues (#130 breakpoint fallback, #131 legend
float + floating-story contrast) hold under a fresh, independent sweep and did not
regress:

```
                      ┌─ #130 (start's breakpoint fallback): still holds, re-verified ──── clean ✅
                      ├─ #131 (legend float, RTL mirroring, description gap): holds ─────── clean ✅
                      ├─ floating under stock MUI theme: matches MUI's own default look ─── clean ✅
                      ├─ TextField/Select/StateSelect/NumberField/Autocomplete/OtpField ──── clean ✅
                      ├─ Checkbox/Switch grid opt-out (labelAs="control") ────────────────── clean ✅
                      ├─ RadioGroup/CheckboxGroup/Rating/Slider/ToggleButtonGroup legends ── clean ✅
                      ├─ AddressField: each part gets its own start class, outer grid holds ─ clean ✅
                      ├─ FieldArray rows: inner fields still pick up placement ────────────── clean ✅
                      ├─ ReadOnlyField: correctly outside the axis (not a FormControl box) ── clean ✅ (by design)
                      ├─ per-field override, theme defaultProps, styleOverrides.root reach ── clean ✅
                      ├─ RTL grid mirroring (start column swaps sides correctly) ──────────── clean ✅
                      ├─ labelPlacementBreakpoint override (sm→md), long labels, long help ── clean ✅
                      ├─ disabled + start, size="small" + start, required + start ─────────── clean ✅
                      ├─ SSR renderToString of a start-placement form (incl. AddressField) ── clean ✅
                      └─ FileField under "start": empty label-column gutter ────────────────  P2 (#133, new)
```

## 2. The one new finding

### (#133, P2, area: fields) `FileField` under `labelPlacement="start"` leaves an empty label-column gutter

`FileField` is the one bound field in the library that does not render through
`FieldFrame` — it builds its own `FormControl` (`FileFieldRoot`) directly, and its picker
`Button` (`component="label" htmlFor={id}`) is simultaneously the field's visible label
text *and* its control. Structurally this is closer to `Checkbox`/`Switch`
(`labelAs="control"`: label glued to the one control, no separate legend) than to a
labelled `TextField` — but `Checkbox`/`Switch` are frame-rendered `FormControlLabel`s, and
`controlLabelOptOut`'s selector (`:has(> .MuiFormControlLabel-root)`) only matches that MUI
component. FileField renders no `FormControlLabel` and no `.MuiFormLabel-root` at all, so
neither `startBox`'s column-1 rule (keyed on `.MuiFormLabel-root`) nor the opt-out fires for
it: `startBox`'s `& > *:not(.MuiFormLabel-root)` rule catches the picker button by default,
puts it in grid-column 2, and column 1 — a full `labelWidth`-wide gutter (12rem by default)
— renders permanently empty above `labelPlacementBreakpoint`.

Verified structurally (`FileField.tsx` has no `FormLabel`/`FormControlLabel` import at all)
and by CSS-shape probe (jsdom evaluates no media queries, so the emitted-rule technique
`labelPlacement.test.tsx` itself established for #130 is what pins this): the box gets
`display: grid; grid-template-columns: 12rem 1fr`, and the picker Button is the *only*
child, carrying `grid-column: 2` via the `:not(.MuiFormLabel-root)` rule — nothing occupies
column 1. Reproduced twice (`pnpm exec vitest run` on the scratch probe, both green before
deletion). No a11y impact — the field stays fully labelled and functional, `axe` clean —
this is purely the P2 "wrong visible state" bucket: a dead gutter on every `start`-placement
FileField (and, by the same mechanism, its drop zone under `dropzone`).

Filed as #133 rather than folding into #130/#131 (both closed same-day fixes for different,
unrelated mechanisms — a breakpoint-fallback leak and a rendered-`<legend>` layout quirk,
neither of which involves a field with no `FormLabel` element at all). Preferred outcome
left undecided in the issue: either give FileField its own opt-out (Steve's call whether
that's a `fileFieldClasses.root`-keyed selector alongside `controlLabelOptOut`, or a
documented label-column convention for it) — flagged for a small follow-up, not fixed here
per this agent's mandate (probe only, never fix).

## 3. Confirmed still holding: #130 and #131 (not re-filed, not regressed)

Both closed today; re-checked from a fresh angle (independent probes + browser, not a rerun
of their own regression tests) since the dispatch explicitly asked not to duplicate them:

- **#130** (`start`'s breakpoint fallback): `fields-label-placement--start` at 360px and
  `--start-collapsing-at-md` at 700px both screenshot as the full-width stacked box, not a
  shrunk grid — matches the fix's own acceptance line. `align-items`/`display:grid`/
  `grid-template-columns` etc. all confirmed scoped inside `theme.breakpoints.up(…)` via the
  emitted-CSS technique, so nothing to undo below the breakpoint.
- **#131** (legend float + RTL + description gap + floating-story contrast): `AllThree`
  under `&globals=direction:rtl` screenshots with the `start` column correctly mirrored
  (label column on the physical right, i.e. the RTL start edge) and every legend
  (`RadioGroup`'s "Billing period") level with its first option, no 40px drop. `Floating`
  under the stock-theme wrapper renders MUI's own default look (unshrunk label sitting
  inline in the empty box), distinguishable from the preset's `stacked` sections — the
  contrast the fix was for.

Neither is re-filed; this section exists so the ledger records that the fresh sweep did not
find either had regressed, per the dispatch's explicit instruction.

## 4. Attack lines run, pass/fail

| # | Line | Result |
|---|---|---|
| Every field family at 1280/768/700/640/360px, all 3 placements | **Pass** except FileField/`start` (#133, above). `TextField`/`Select`/`StateSelect`/`NumberField`/`Autocomplete`/`OtpField`/`AddressField`/`FieldArray` rows all correctly grid under `start`, stack under `stacked`, float under `floating`. |
| Checkbox/Switch (`labelAs="control"`) under `start` | **Pass**, both confirmed `display: inline-flex` (opted out of the grid), flush left with the label column's neighbours per #131's own screenshot evidence, not indented into column 2. |
| RadioGroup/CheckboxGroup/Rating/Slider/ToggleButtonGroup legends under `start` | **Pass**, all 5: legend floats (`float: inline-start`, `width: <labelWidth>`), group keeps its accessible name (`getByRole('radiogroup'/'slider'/'group', { name })`), axe clean. ToggleButtonGroup's fieldset+inner-`role=group` double-naming is pre-existing/documented (v3 ledger #58), not a placement-axis finding. |
| AddressField under `start`: parts get their own placement, outer grid does not leak | **Pass.** Each of street/street2/city/state/zip carries its own `EzFieldLayout-start` class and its own two-column grid; `AddressFieldRoot`'s own `display: grid; grid-template-areas` (the four-column part layout) is a separate `styled('div')` at a different DOM depth and does not conflict. axe clean. |
| FieldArray rows: inner fields still pick up placement | **Pass.** A `TextField` inside a `FieldArray` render-prop row still carries `EzFieldLayout-start` — the row is a `FormSection` (fieldset), unrelated to the axis; fields inside it are ordinary ez-form fields reading the same context. |
| ReadOnlyField: does the axis apply at all | **Pass, as a "not applicable" verdict, not a gap.** Read the source: `ReadOnlyField`/`ReadOnlyFieldView` render a plain `styled('div')` tree (`ReadOnlyFieldRoot`/`Header`/`Label`/`Value`), never a `FormControl`, never `FieldFrame`, never `useEzField`'s `layoutClassName`. No `EzFieldLayout-*` class appears anywhere near it under any placement. This matches `labelPlacementStyles.ts`'s own stated scope ("every ez-form field's root is the *same* box: a `.MuiFormControl-root`") — `ReadOnlyField` was never that box, by design (its own label-above-value layout is fixed, not a placement choice), so this is confirmed-intentional and not filed. |
| `theme.components.EzForm.defaultProps.labelPlacement` / per-field override / `styleOverrides.root` | **Pass** (already covered by `labelPlacement.test.tsx`'s own suite, re-verified in this sweep rather than re-litigated): one theme line flips every field; an explicit prop still wins; a `styleOverrides.root` rule reaches the `start` grid's `grid-template-columns`. |
| RTL mirroring of the `start` grid | **Pass**, browser-confirmed (`AllThree` under `&globals=direction:rtl`): label column renders on the physical right with no left/right literal anywhere in `labelPlacementStyles.ts` (logical `inline-start` only) — grid column order follows writing mode on its own, matching the file's own design comment. |
| `labelPlacementBreakpoint` override (`sm`→`md`) | **Pass.** `StartCollapsingAtMd` at 700px (between `sm` and `md`) renders stacked, not gridded — confirms the override reaches `theme.breakpoints.up(…)`, not a hard-coded `sm`. |
| 60+ char label in the `start` column: wrap vs overflow | **Pass.** `unfloatLabel`'s `whiteSpace: 'normal'` confirmed via `getComputedStyle` on a 190-char label; `StartWideLabels` (`labelWidth: '18rem'`) screenshots with no overflow at 640px. |
| Very long helper text under `start`: still in `aria-describedby`, still column 2 | **Pass.** A 260-char helper string round-trips through `toHaveAccessibleDescription`, and the `:not(.MuiFormLabel-root)` column-2 rule (not a separate helper-text rule) is what places it — no third column. |
| `disabled` + `start`, `size="small"` + `start`, `required` + `start` | **Pass**, all three independently probed on `TextField`: disabled removes it from the tab order without touching the grid shape; `size="small"` doesn't change label association; `required` on Checkbox still renders and axe-passes under `start`'s opt-out box. |
| SSR `renderToString` of a `start`-placement form | **Pass.** A form combining a plain field, a legend field (RadioGroup) and a composite (AddressField) under `labelPlacement="start"` renders to a string with no throw and no console noise. |
| Grep for `sx=`/hex/px literals in the placement files (checklist line 18) | **Clean.** No `sx=` in `labelPlacementStyles.ts`/`LabelPlacementContext.ts`. The only `px` literals are `0.01px` (the notch-close trick, matching MUI's own upstream convention for an un-notched outline) and the numeric→`px` conversion for a *consumer-supplied* `labelWidth`/legend-float width — both themeable/consumer-driven, not opinionated defaults. |
| `theme.components.EzForm.styleOverrides.root` with a `letterSpacing`-class probe | **Pass** (existing suite): confirmed the placement rules live on `EzForm`'s Root slot, so a theme override reaches every one, per PHILOSOPHY rule 2. |
| Floating under stock `createTheme()` vs the preset | **Pass.** `Floating` story (wrapped in `StockTheme`, a local `createTheme()`) shows MUI's own unshrunk label sitting inline in the empty input box — matches plain MUI's default, confirming the `floating` placement really is "MUI's own, untouched" as the source comment claims. |
| Console warnings/errors across the whole sweep | **Pass.** Zero warnings/errors across every story load and every vitest probe (18 QA-probe assertions, one `describe` per family, ran together). |
| axe per combination rendered | **Pass** for every combination probed (AddressField/start, FileField/start, RadioGroup+long-label/start, Checkbox+required/start, Rating/Slider/ToggleButtonGroup/start, SSR form) — no violations. |

## 5. Baseline comparisons made

- FileField's missing `.MuiFormLabel-root` is an ez-form-specific CSS selector gap
  (`startBox`'s own rule, keyed on a class only `FieldFrame`-rendered fields carry) — there
  is no plain-MUI equivalent to baseline against (a bare `component="label"` `Button` in a
  hand-rolled CSS grid is not a pattern MUI ships an opinion on), so #133 is filed as
  ez-form's own, not upstream.
- RTL grid mirroring baselined conceptually against CSS Grid's own writing-mode-relative
  column order (not MUI-specific): confirmed the file carries no physical `left`/`right`
  anywhere, which is what makes the mirroring "free" rather than something ez-form computes
  per direction.

## 6. Not covered (budget / out of scope)

- Visual confirmation of #133 in an actual browser tab: Storybook's `FileField` stories use
  the `parameters.form` decorator (constructs its own `<Form>` without exposing
  `labelPlacement` as a story arg), so a live repro would have required editing a story
  file, which probes-only scope forbids. The vitest CSS-shape technique is the same one
  `labelPlacement.test.tsx` itself uses to pin `start`'s shape (jsdom evaluates no media
  queries either way), so this is treated as sufficient evidence, not a gap.
- `prefers-reduced-motion`: `stacked`/`start` already set `transition: 'none'` on the label
  unconditionally (not conditioned on the media query), so there is no motion to gate in
  the first place; `floating`'s label transition is untouched MUI, out of scope for this
  axis.
- 200% zoom via OS-level zoom (only `browser_resize`-equivalent narrow-viewport and a
  640px width were used as its proxy, per the dispatch's own suggested substitution).
- Wizard/FormDialog-specific placement interaction beyond confirming both correctly thread
  `labelPlacement` to an inner `<Form>` (`FormDialog`'s `FORM_PROP_KEYS` includes it;
  `Wizard` has no direct reference because it never needs one — fields inside it read the
  same context as any other child of `<Form>`). No separate finding.

## 7. Duplicates checked, none found

`gh issue list --label qa --state all --limit 200` reviewed in full before filing. #130 and
#131 explicitly excluded per the dispatch (both closed same-day fixes, re-verified as
holding in §3 rather than re-filed). No existing issue mentions FileField's `start`
placement or an empty grid column.

## 8. Issues filed

- **#133** (P2, area: fields) — `FileField`: `labelPlacement="start"` leaves an empty
  label-column gutter (no opt-out selector like `Checkbox`/`Switch`'s
  `controlLabelOptOut`).
