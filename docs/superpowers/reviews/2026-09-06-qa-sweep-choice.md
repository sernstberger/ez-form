# QA sweep #47 — inventory + checklist (choice fields group)

Date: 2026-09-06. Status: **findings only, nothing fixed.**

Method: same as the prior sweeps (TextField/Select 2026-09-03, pickers and Wizard
2026-09-04) — vitest probes in the gitignored `src/__qa__/` scratch area (deleted at the
end; `git status` clean apart from the pre-existing untracked `rtl.png`), a Storybook +
Playwright MCP browser pass, every finding reproduced at least twice, baseline-compared
against plain MUI before assigning blame.

Target: `Checkbox`, `CheckboxGroup`, `RadioGroup`, `Switch`, `ToggleButtonGroup`,
`Rating`, `Slider` (`src/fields/{Checkbox,CheckboxGroup,RadioGroup,Switch,
ToggleButtonGroup,Rating,Slider}/`). Stories covered: all 35 under `Fields/Checkbox*`,
`Fields/RadioGroup`, `Fields/Switch`, `Fields/ToggleButtonGroup`, `Fields/Rating`,
`Fields/Slider` (full list in the dispatch; every one loaded at least once, error/
disabled/required/row/marks/range/half-stars/immediate-effect variants driven directly).

---

## 1. Verdict up front

Two new findings for this group, plus one confirmed regression of a previously-closed
issue whose fix relied on a pattern proven broken here, plus one upstream-adjacent
documentation gap:

```
                      ┌─ keyboard operation (arrows, Space, Tab order) across all 7 ── clean ✅
                      ├─ required/error aria-describedby + aria-invalid, group vs option ─ clean ✅
                      ├─ disabled/loading propagation from <Form> to every control ────── clean ✅
                      ├─ ClearButton restores every default (defaults + empty) ────────── clean ✅
                      ├─ RTL mirroring (Slider thumb order, ToggleButtonGroup arrows) ──── clean ✅
                      ├─ Rating precision half-values, keyboard, target size (#111) ────── clean ✅
                      ├─ zero/one-option, value-not-in-options edge cases ──────────────── clean ✅
                      ├─ theme Mui* slot overrides (no Ez* keys exist for this group) ──── clean ✅
findings split ───────┼─ Switch ImmediateEffect story nests <form> (regresses #120) ────── P2 (#128)
                      ├─ Slider range: both thumbs share one accessible name ────────────── P3 upstream (#129)
                      └─ Enter-in-field, per-field Enter-submits-once ─────────────────────  already tracked, #122
```

---

## 2. Why this group has no `Ez*` theme slots (not a gap)

Before probing theme overrides, confirmed by reading `src/theme/augmentation.ts` in full:
none of these seven fields register an `Ez<Name>` key. This is **not** a violation of
`docs/PHILOSOPHY.md`'s checklist line ("anything with a visual default registers as
`Ez<Name>`") — the same file's own exemption clause says "a pure pass-through field keeps
MUI's own `Mui*` keys and registers nothing," and all seven are exactly that: each renders
one raw MUI component (`MuiCheckbox`, `MuiRadio`/`MuiRadioGroup`, `MuiSwitch`,
`MuiToggleButtonGroup`, `MuiRating`, `MuiSlider`, `MuiFormGroup`) with no `styled()`
wrapper of its own, same as `TextField`. Fields that *do* compose multiple elements
(`NumberField`, `OtpField`, `PasswordField`, `FileField`, `AddressField`) all have real
`styled(..., { name: 'Ez<Name>', slot: '...' })` wrappers and registered keys — confirmed
by grep as the contrast case. Re-framed checklist line 16 for this group as "does a
`theme.components.Mui<Name>` override reach the field's control" instead, and it does, for
all seven (`MuiCheckbox`, `MuiRadio`, `MuiSwitch`, `MuiToggleButtonGroup`, `MuiRating`,
`MuiSlider`, `MuiFormGroup` `styleOverrides.root` all verified via a `letterSpacing` probe
reaching the real rendered element with `getComputedStyle`).

## 3. The two new findings (plus one regression note)

### (#128, P2, area: infra) `parameters: { form: undefined }` does not opt a story out; `#120` is still broken

`Switch.stories.tsx`'s `ImmediateEffect` story sets `parameters: { form: undefined }` to
stop the `.storybook/preview.tsx` decorator from wrapping it in a second `<Form>` (the
story already renders its own, for a dark-mode `Paper` demo the shared decorator can't
express). That opt-out has never worked: Storybook's parameter merge (project → meta →
story) — documented in `preview.tsx`'s own comment — **skips `undefined`** rather than
using it to clear an inherited key, so the meta's `form: { schema, defaultValues }`
survives onto the story unchanged. The decorator then wraps the story's own `<Form>` in
its own `<Form>`: two real, invalid nested `<form>` elements, 2 React console errors
("cannot be a descendant of" / "cannot contain a nested `<form>`"), plus a duplicate,
unrelated "Required fields…" line and Submit button outside the real form.

This is the same symptom as the now-**closed** #120 (`FormSection`'s `TwoSections`
story) — but #120's fix commit explicitly copied "the Switch `ImmediateEffect` pattern"
as the citation for correctness, and that pattern is what's broken. Re-checked
`formsection--two-sections` directly in this sweep: **it is observably still broken right
now**, identical 2 nested forms and 2 console errors. Filed #128 rather than reopening
#120 unilaterally; left a comment on #120 cross-referencing it. Reproduced twice, both in
the real browser (`document.querySelectorAll('form').length === 2`) and via
`composeStories` in jsdom (matching console errors), per `PercentField.stories.test.tsx`'s
established pattern for testing `parameters.form` merge behavior.

### (#129, P3, area: fields, upstream) Range `Slider`: both thumbs share one accessible name

`fields-slider--range` (`label="Range"`, values `[9, 17]`) gives both thumbs the identical
accessible name via the shared `aria-labelledby` pointing at the legend — a screen-reader
user tabbing between them hears "Range, 9" then "Range, 17" with no per-thumb
distinction. **Baseline-confirmed upstream**: a plain MUI `Slider` with an external
`aria-labelledby` and no `getAriaLabel` produces the identical shared name (MUI's own docs
require `getAriaLabel` for a distinguishable range-slider name). `SliderProps` already
passes `...rest` through to the underlying `MuiSlider`, so a consumer can already supply
`getAriaLabel` today — nothing in ez-form blocks it. Filed at P3 (no data lost, both
thumbs work correctly, purely a naming/documentation gap): no story or README row
demonstrates the fix, so a consumer building a range slider has to already know MUI's own
escape hatch unassisted.

### Noted, not filed: Enter-key behavior (#122, already tracked)

Per dispatch: issue #122 (in progress) already covers "Enter submits once" /
"focus-first-invalid" as a `describeFieldContract` follow-up. Not independently probed
per-field here to avoid duplicating that tracked work; no new Enter-key finding specific
to any of the seven fields surfaced during the rest of the sweep (submit-button click
paths, double-click, and Form-level re-entrancy were all exercised instead — see below).

## 4. Attack lines run, pass/fail

| # | Line | Result |
|---|---|---|
| Tab order, no trap, focus visible | **Pass**, all 7. `CheckboxGroup`/`RadioGroup` tab per-checkbox/one-per-group (native radiogroup); `ToggleButtonGroup` is a single roving-tabindex stop (correct toolbar pattern, confirmed against plain MUI); `Slider`/`Rating` are single/dual tab stops. |
| Arrow keys: RadioGroup/ToggleButtonGroup/Slider/Rating | **Pass.** RadioGroup arrows move + select and correctly skip/wrap around a disabled option. ToggleButtonGroup arrows move focus only (Space/Enter selects) — verified this is MUI's own toolbar pattern by baseline, not a radiogroup. Slider arrows step by 1, `End`/`Home` jump to max/min. Rating arrows move by the configured `precision` (0.5 verified). |
| Space on Checkbox/Switch | **Pass**, both toggle correctly via real keyboard `Space`. |
| Accessible names, group AND each option | **Pass**, `getByRole(role, {name})` used throughout; every group and every option/thumb/star/button has a name (Slider range's *shared* name is #129, not a missing name). |
| Required/error: `aria-invalid`, `aria-describedby` group vs option | **Pass**, all 7. Verified the alert's `id` matches the control's `aria-describedby` directly (not just presence) for CheckboxGroup, ToggleButtonGroup, Rating, Slider (bounded min/max story). `requiredNotAnnounced` correctly used for the `role="group"` fields per `describeFieldContract`'s own documented ARIA constraint. |
| `disabled`/`readOnly` at form level | **Pass.** `<Form disabled>` (vitest) and each field's own `--disabled` story (browser) both confirmed: native `disabled` attribute on Checkbox/Radio/Switch/Slider, `disabled` prop on ToggleButton (FormControl context doesn't reach it, handled via `mergeDisabled` explicitly in source), Rating's radios disabled — all correctly removed from tab order, none submit a changed value. |
| `disabled-option` (one option inside an otherwise-enabled group) | **Pass**, CheckboxGroup and RadioGroup: the one disabled option is skipped by Tab and by arrow-key wrap, others unaffected. |
| Form `loading` state | **Pass** by inspection + shared mechanism: `Form.tsx` merges `loading` into the same `disabled` context already proven to reach all 7 controls; no separate per-field code path exists to diverge. |
| Reset/ClearButton restores defaults | **Pass**, all 7 in one fixture: dirtied every field, clicked `ClearButton to="defaults"`, all 7 restored (including Slider's numeric default and Rating's radio selection). Also verified disabled-when-pristine and clear-while-focused don't throw or leave a stale value. |
| RTL (Slider, ToggleButtonGroup) | **Pass.** Confirmed via DOM measurement (not just a screenshot, which was visually ambiguous at first glance): Slider's min-thumb renders at a larger x than its max-thumb in RTL (correctly mirrored), `theme.direction`/`CacheProvider` RTL plugin both engaged. ToggleButtonGroup: button DOM order unchanged, visual order mirrored, arrow-key direction flips to match (Left→Right in RTL moves focus the same visual direction as LTR) — all upstream MUI RTL handling, working correctly through ez-form's pass-through. |
| Theme `Mui*` slot overrides (no `Ez*` exists, see §2) | **Pass**, all 7 root slots (`MuiCheckbox`, `MuiRadio`, `MuiSwitch`, `MuiToggleButtonGroup`, `MuiRating`, `MuiSlider`, `MuiFormGroup`) verified via `letterSpacing` + `getComputedStyle`, not just class-name presence (per the Wizard ledger's own caution about that false-positive shape). |
| `Rating` `precision` half-values + keyboard | **Pass.** Half-star radios render with distinct names ("0.5 Stars"…"5 Stars"); arrow key from empty moves to 0.5; a 2.5 default value round-trips through submit unchanged. |
| `Slider` `marks`/range (two thumbs) + touch target | **Pass** for marks/range mechanics and touch target (#106's existing audit already covers the thumb; re-confirmed, not re-litigated). Range's shared-name gap is #129, filed separately (not a target-size or mechanics issue). |
| `CheckboxGroup` zero/one option, value not in options | **Pass**, all three: zero options renders with no crash and the group keeps its legend-derived name; one option renders and is togglable; a default value absent from `options` (CheckboxGroup and RadioGroup both) renders nothing selected, does not crash, and submits the stale value verbatim rather than silently coercing it — correct "don't mangle data you don't understand" behavior. |
| `Switch` labelled by a sentence vs a word | **Not separately probed** (budget; no Switch-specific wrapping/truncation risk was identified — no `sx`/literal width exists in `Switch.tsx`, confirmed by the same grep as checklist line 18 below). |
| Controlled ⇄ uncontrolled swap | **Pass** for `Switch` (the representative case; all 7 are always-controlled through `useEzField`/RHF, so this is a shared mechanism, not per-field). |
| `values` prop change while dirty (no `keepDirtyValues`) | **Pass** (i.e., behaves as documented): an external `values` update overwrites a dirtied `CheckboxGroup`, matching RHF's own documented default — not a bug. |
| `reset()` with `keepErrors` | **Pass**: a required `CheckboxGroup`'s error survives `reset(undefined, { keepErrors: true })`. |
| Grep for `sx=`/hex/px literals in `src/` (checklist line 18) | **Clean** for all 7 field `.tsx` files (only `Switch.stories.tsx` uses `sx=`, which is a story, explicitly allowed). |
| SSR `renderToString` | **Pass**, all 7 — covered by `describeFieldContract`'s shared `ssr` line; none of the seven exempts it (grep-verified). |
| Console pristine per story | **Pass** for every story loaded except `fields-switch--immediate-effect` (#128). |
| axe per story | **Pass** — covered by `describeFieldContract`'s shared axe pass (default state + error state) for all 7; not independently re-run per story given the existing coverage is already comprehensive and green in CI. |
| Duplicate option values (`warnDuplicateOptions`) | **Pass** (as a documented-misuse case, not a bug): CheckboxGroup/RadioGroup/ToggleButtonGroup all fire the dev warning and do not crash; RadioGroup's resulting checked state with two identically-valued radios is an acknowledged React-key-collision implementation detail, not asserted as a specific outcome — the warning existing is the point. |

## 5. Baseline comparisons made

- Range `Slider`'s shared-thumb-name (#129): reproduced identically on a plain MUI
  `Slider` with `aria-labelledby` and no `getAriaLabel` — confirmed upstream.
- `ToggleButtonGroup`'s single-roving-tabindex-stop + Space-to-select (not
  radiogroup-style arrow-select) confirmed as MUI's own toolbar pattern, not an ez-form
  omission, by reasoning from the rendered `role="group"` + `aria-pressed` shape (no
  separate bare-MUI harness needed; the component under test *is* the unwrapped
  `MuiToggleButtonGroup`).
- Rating's radio input being an unreliable `userEvent.click` target (clip-path 1×1px) but
  a correct real-browser click target via its associated `<label>`: verified directly in
  Storybook (`document.elementFromPoint` at the label's real box resolves to the label,
  and `label.click()` correctly checks the radio) — a jsdom/testing-library method
  artifact, not a Rating bug; all probes were adjusted to click the label or use
  `fireEvent.click` on the radio directly, matching the real-browser outcome.

## 6. Not covered (budget / out of scope)

- Exhaustive per-story axe re-runs beyond `describeFieldContract`'s existing default +
  error-state coverage: that coverage is comprehensive (label, required, disabled,
  described-by, group semantics) and already green in CI; no gap was identified that
  would justify re-running axe manually story-by-story in the time available.
- `Switch` sentence-vs-word label wrapping: no styling literal exists to make this
  Switch-specific; deferred as low-risk given the `sx=`/literal grep came back clean.
- Enter-in-field / Enter-submits-once: intentionally not probed per dispatch instruction,
  already tracked as #122.

## 7. Duplicates checked, none found (except the one regression)

`gh issue list --label qa --state all --limit 200` reviewed in full before filing. #111
(Rating small target size), #110 (OtpField — different group), #115/#117/#121 (Wizard/
theme slots — different components), #104/#102 (TextField-family describedby — different
group) all excluded per the dispatch's do-not-re-file list. #120 (closed) is the one
overlap: its fix is proven not to hold by this sweep, hence #128 plus a comment on #120
rather than a duplicate filing.

## 8. Issues filed

- **#128** (P2, area: infra) — `parameters.form: undefined` doesn't opt a story out;
  `Switch` `ImmediateEffect` nests `<form>`; `#120`'s fix confirmed still broken.
- **#129** (P3, area: fields, upstream) — Range `Slider`: both thumbs share one
  accessible name; no `getAriaLabel` demo/docs.
- Comment left on **#120** cross-referencing #128.
