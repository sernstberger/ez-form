# QA sweep #47 — inventory + checklist (TextField · Select)

Date: 2026-09-03. Status: **findings only, nothing fixed.** Steve: "lets not fix anything
yet, just make a checklist of things to fix."

Method: vitest probes in the gitignored `src/__qa__/` scratch area, run against `src/`
directly, every finding reproduced at least twice. Baseline-compared against plain MUI so
"our bug" and "MUI's bug" stay separate. Browser pass (Storybook + Playwright) was still
running when this was written — see "Not yet covered".

---

## 1. Verdict up front

The two components asked for are **individually solid**. Keyboard, focus-after-error,
value round-tripping, theme reachability, SSR and error announcement all pass. What the
sweep actually found is **one systemic a11y hole that no single component owns**, plus a
handful of small sharp edges.

```
                      ┌─ TextField/Select behaviour ─────────── clean ✅
findings split ───────┤
                      └─ shared plumbing (useEzField/FieldFrame) ─ 1 × P1 across 15 fields ⚠️
```

So: **not an epic per component.** One P1 fix at the shared-plumbing altitude, one P2 in
`Form`, and a short tail. Issue #47 stays a single issue with a checklist.

---

## 2. The headline finding

### `aria-label` silences the "no accessible name" warning without ever naming anything

`useEzField` reads `aria-label`/`aria-labelledby` only to decide whether to warn
(`devWarn.ts:57-72`). It never forwards them. Most fields then rely on `{...rest}` to carry
them through to MUI — where they land on the `FormControl` **wrapper**, not the control.

```
<TextField name="a" aria-label="Aye" />
                     │
     ┌───────────────┴────────────────┐
     ▼                                ▼
useEzField: `if (ariaLabel) return`   {...rest} → MUI → <FormControl aria-label="Aye">
  → dev warning SUPPRESSED 🤫           → the <input> is still unnamed ❌
```

Measured, label-less + `aria-label` only, 17 fields:

| Result | Fields |
|---|---|
| named ✅ (2) | `OtpField`, `Checkbox` |
| **UNNAMED ❌ (15)** | `TextField`, `TextareaField`, `EmailField`, `PasswordField`, `PhoneField`, `ZipField`, `FeinField`, `PercentField`, `Select`, `StateSelect`, `Autocomplete`, `NumberField`, `Switch`, `Slider`, `Rating`, + `RadioGroup`, `ToggleButtonGroup`, `CheckboxGroup` |

> **Correction (2026-09-03, during the #99 fix).** The `Select` row above was wrong: I
> baseline-tested a bare `<MuiSelect aria-label>`, which *is* named, but ez-form's `Select`
> renders through `<MuiTextField select>`, which is **not**:
>
> ```
> bare <MuiSelect aria-label="X">        → NAMED ✅   ← what I measured
> <MuiTextField select aria-label="X">   → UNNAMED ❌  ← what ez Select actually wraps
> ```
>
> So `Select` was never a regression — MUI drops the name the same way. Only `Slider` is a
> true regression. After #99 ez-form is *better* than the baseline here, so the acceptance
> bullet ("no longer worse than plain MUI") still holds.
>
> The lesson generalises and is worth more than the correction: **baseline-compare the
> construction the component actually renders, not the one with the same name.** A baseline
> against the wrong upstream widget is as misleading as no baseline at all.

Two distinct mechanisms, and they need different fixes:

**(a) `aria-label` never reaches the control** — the TextField family, `Select`,
`Autocomplete`, `NumberField`, `Switch`. Works when routed to `slotProps.htmlInput`
(proven). Plain MUI behaves the same way, so the *dropping* is upstream — but ez-form turns
an MUI quirk into a silent a11y failure by accepting `aria-label` as proof of a name.

**(b) `aria-labelledby` points at an EMPTY element** — the `FieldFrame` family. These set
`aria-labelledby={labelId}` unconditionally; with no `label`, the legend renders empty.
`aria-labelledby` beats `aria-label` in the accname algorithm, so the name resolves to `""`.

```
LBL Slider      named=NO ❌  aria-label="X"  labelledby="_r_2_"  target text=""
LBL Rating      named=NO ❌  aria-label="X"  labelledby="_r_5_"  target text=""
LBL RadioGroup  named=NO ❌  aria-label="X"  labelledby="_r_e_"  target text=""
LBL ToggleButtonGroup named=NO ❌ aria-label=null labelledby=null  (dropped entirely)
LBL CheckboxGroup     named=NO ❌ aria-label=null labelledby=null  (dropped entirely)
```

`Slider` and `Select` are true **regressions vs. MUI** — plain MUI names them correctly and
ez-form loses the name:

| | plain MUI | ez-form | verdict |
|---|---|---|---|
| `Slider` | NAMED ✅ | UNNAMED ❌ | **ez-form regression** (empty-legend `labelledby` wins) |
| `Select` | ~~NAMED ✅~~ **UNNAMED ❌** | UNNAMED ❌ | ~~regression~~ **upstream — corrected, see below** |
| `TextField` | UNNAMED ❌ | UNNAMED ❌ | upstream MUI; works via `slotProps.htmlInput` |
| `Switch` | UNNAMED ❌ | UNNAMED ❌ | **suspected MUI bug** — see §5 |
| `Autocomplete` | UNNAMED ❌ | UNNAMED ❌ | upstream MUI |
| `Rating` | UNNAMED ❌ | UNNAMED ❌ | upstream (no `aria-label` support) |

> **Challenged and re-verified.** A source-audit agent disputed this finding, arguing "most
> fields correctly forward `aria-label` via the `...rest` spread." That is *true about the
> prop* and *wrong about the outcome*. Re-ran the DOM check:
>
> | component | `aria-label` lands on | `getByRole(role, {name})` |
> |---|---|---|
> | TextField | `<div>` (FormControl wrapper) | NOT FOUND ❌ |
> | Select | `<div>` (FormControl wrapper) | NOT FOUND ❌ |
> | Switch | `<span>` (SwitchBase root) | NOT FOUND ❌ |
> | Slider | **`<input>` — forwarded correctly** | NOT FOUND ❌ |
>
> `Slider` is the decisive case: it forwards to the real `<input>` and *still* has no name,
> because the empty `aria-labelledby` outranks `aria-label` in the accname algorithm.
> **"The prop is forwarded" is not the test; "the control has an accessible name" is.**
> Audit by reading found a narrow type-`Omit` nit; audit by querying the DOM found a P1.
> Lesson for the next sweep: assert accessible *names*, never attribute presence.

Why this is P1: it is the documented escape hatch for a visually-label-less field, the dev
warning's own message recommends it, axe cannot catch it (the wrapper *has* a name), and
`describeFieldContract` never asserts it. Every existing test passes.

**Fix altitude:** `useEzField` should own and return the a11y name the way it already owns
`aria-describedby` — one shared change, then each field routes it to its real control.
`FieldFrame` separately must not emit `aria-labelledby` for an empty legend.

---

## 3. Checklist — TextField

- [ ] **P1** `aria-label`/`aria-labelledby` never reach the `<input>` → no accessible name, dev warning suppressed. *Altitude: `useEzField` + `TextField`.* (§2)
- [ ] **P2** `slotProps.formHelperText.role` from a consumer overwrites `role="alert"` → the error is never announced. `mergeSlotProps` merges the object but the consumer's `role` wins. *Altitude: `TextField` (merge order) or `useEzField` (own the role).*
- [ ] **P2** A consumer `aria-describedby` is silently dropped — MUI replaces it with the helper-text id, so a consumer's extra description is lost. *Altitude: `TextField`.*
- [ ] **P2** `{...rest}` is spread **last** (`TextField.tsx:156`), after `disabled`/`helperText`/`type`/`autoComplete`/`slotProps`. `Omit` protects only `name`/`value`/`error`/`inputRef`/`required`, so those five are runtime-clobberable by a consumer prop. Propagates to every TextField wrapper. *Altitude: `TextField` (move the spread first, as `Autocomplete`/`NumberField`/`OtpField` already do).*
- [ ] **P3** `defaultValue` is not in the `Omit` → React "both value and defaultValue" error. One-line type fix. *Altitude: `TextField`.*
- [ ] **P3** `min`/`max` on `type="number"` set no HTML `min`/`max` attribute (rule only). `Slider`/`NumberField` treat them as bound **and** rule; `TextField` does not. Decide whether that is intended asymmetry. *Altitude: `TextField`. Design question, not clearly a bug.*
- [ ] **P3** `type="email"` etc. should steer consumers to `EmailField`. Cannot be blocked in types (wrappers pass `type` themselves). Candidate lint rule — see §6.

Verified clean on TextField, do not re-test: Enter submits exactly once · focus lands on the first invalid field after a failed submit · `role="alert"` fires once and clears when fixed, helper text returns · RTL mark + emoji + 10k chars round-trip exactly · `maxLength` rule blocks submit with the right message · `renderToString` does not throw · `multiline` Enter does not submit · theme `MuiTextField.defaultProps`, `slotProps.htmlInput`, and `MuiFormHelperText.styleOverrides` all reach through · `slotProps.htmlInput.onChange` survives the merge.

## 4. Checklist — Select

- [ ] **P1** inherits the `aria-label` hole (§2), and is a **regression vs. plain MUI**, which names its combobox correctly.
- [ ] **P2** inherits TextField's `{...rest}`-last clobber risk one hop down.
- [ ] **P3** A form value not present in `options` renders a blank combobox. MUI logs an out-of-range warning, so it is dev-visible, not silent — but the async-options case (value arrives before options) is a real consumer scenario with no ez-form-level guidance. *Altitude: `Select` (docs, or a `devWarn`).*

Verified clean on Select, do not re-test: `Enter` opens the listbox and does **not** submit the form · `Escape` closes and returns focus to the combobox · typeahead selects · numeric option values round-trip as `number`, not `"2"` · `aria-required` on the combobox **and** `required` on the hidden input · a disabled Select is out of the tab order · empty `options` renders without throwing · `MuiTextField.defaultProps` reaches it through TextField · axe clean with the listbox open (existing test).

## 5. Suspected MUI (upstream) bugs

Flagged separately so they are not fixed at the wrong altitude. Each needs an upstream repro
before filing.

- [ ] **`Switch` ignores `aria-label` on every documented channel.** Root `aria-label` lands on a `<span>`, not the input; `inputProps={{'aria-label'}}` — which MUI's own docs recommend — is **dropped entirely**; only `slotProps={{input:{...}}}` works. *Confidence: high that `inputProps` is broken; that is a deprecation-migration bug in MUI.*
- [ ] **`TextField`/`Autocomplete` put a root `aria-label` on the `FormControl`**, producing a named wrapper and an unnamed control — arguably worse than dropping it, because axe then reports clean. *Confidence: medium that MUI considers this a bug rather than intended.*
- [ ] **`Rating` has no `aria-label` support at all** on the radiogroup. *Confidence: medium.*
- [ ] `type="number"` discarding non-numeric input is **browser** behaviour, correct, not a bug — listed here only so nobody "fixes" it.

## 6. Cross-cutting — fix once, fixes everywhere

- [ ] **P1** The `aria-label` name-ownership fix in `useEzField` (§2) — one change, 15 fields.
- [ ] **P1** `FieldFrame` must omit `aria-labelledby` when the legend is empty — one change, 7 fields (`Slider`, `Rating`, `RadioGroup`, `ToggleButtonGroup`, `CheckboxGroup`, `Checkbox`, `Switch`).
- [ ] **P2** **`Form` submit re-entrancy guard.** A raw `<button type="submit">` double-submits (`dblClick` → `onSubmit` ×2). `SubmitButton` already guards itself (→ ×1), and `Form` already disables all fields while `submitting`, but its `onSubmit` has no re-entrancy check. A ~3-line ref gate makes **any** button safe. Proven in a harness mirroring `Form.tsx`: `dblClick` → 1 ✅, two sequential submits → 2 ✅ (no permanent lock), after a throwing `onSubmit` → 2 ✅ (gate releases). *Altitude: `Form.tsx` (~line 491-540).*
- [ ] **P2** **`name` is `name: string`, not `Path<T>`** (`TextField.tsx:20`, `useEzField.tsx:77`). A typo submits the untouched default with no error and no warning — proven: `name="emial"` against schema `{email}` typed "typed", submitted `{"email":"a"}`, `onSubmit` called once. The philosophy quotes `{ name: Path<T> }` as the pattern; the code does not do it. Generic `name` is the real fix; a lint rule is the fallback. *Altitude: field prop types + `Form`.*
- [ ] **P3** Spread-order audit. `{...rest}` lands after binding props in `TextField:156`, `TextareaField:82`, `MoneyField:30`, `PercentField:78`. Safe by construction: `Autocomplete:210`, `NumberField:182`, `OtpField:84`, every `FieldFrame` field, the pickers (`{...rest} {...bound}`), `FileField`, `AddressField`. *Altitude: a lint rule or a review convention, not 4 separate fixes.*

### API-surface finding — per-field `optionalText` is a layer too many

Raised by Steve during the sweep: "this seems like something that should be done theme
level or some higher config — maybe its even form level. we should stay consistent and
this screams easy to get inconsistent." Investigated, and the evidence agrees.

Three higher layers **already exist and work**:

```
theme.components.EzForm.defaultProps.optionalText   ← theme  ✅ exists
locales/enUS.ts · esES.ts → '(optional)'/'(opcional)' ← i18n   ✅ exists
<Form optionalText="…"> → RequiredIndicatorContext   ← form   ✅ exists
<TextField optionalText={…}>                         ← FIELD  ⚠️ the question
```

What the fourth layer costs, measured:

| | count |
|---|---|
| Fields declaring the prop | **20** |
| Pass-through lines across `src/` | **~50** |
| Places the *identical* doc comment is duplicated | **14** |
| Stories using it | **0** |
| Example forms using it | **0** |
| README sections | **0** |
| Tests using it | 2 — both exist only to test the prop itself (`Form.test.tsx:926,941`) |

- [ ] **P2** Consider removing `optionalText` from the per-field API (`useEzField`,
  `FieldFrame`, `usePickerField`, and the 20 field prop types), keeping theme / locale /
  `<Form>` as the only ways to set it. Two arguments beyond the dead weight:
  1. **It is an inconsistency generator.** Nothing prevents one field reading `(optional)`
     while its neighbour reads `(if you like)` — the label suffix is a form-wide
     convention, not a per-control decision, and a11y-wise an inconsistent suffix is worse
     than none.
  2. **The 14 duplicated doc comments are the tell.** Philosophy rule 1 — an identical copy
     of something that already exists upstream (here, one layer up) should not ship.

  *Altitude: `useEzField` + `FieldFrame` + `usePickerField` own it; the 20 fields only
  forward it, so deletion is mechanical.*

  **Decided (Steve, 2026-09-03): drop it entirely** — including `optionalText={false}`.
  Theme / locale / `<Form>` become the only ways to set the suffix. A field whose label
  already implies optional ("Middle name, if any") is a label-wording choice, not an API
  surface worth 20 declarations.

### Proposed new `describeFieldContract` lines
Highest leverage in the repo: one line added tests ~30 fields at once. Ranked.

| # | Proposed contract line | Would catch | Fields suspected to fail today |
|---|---|---|---|
| 1 | **`aria-label` alone yields an accessible name on the control** | §2, the P1 | 15 of 17 — **verified**, not suspected |
| 2 | No console output through a full interaction (contract's `expectConsole` covers only the outside-`<Form>` throw today) | act warnings, controlled/uncontrolled churn | any field with effect cleanup |
| 3 | Value round-trips through a real submit payload (not just "onChange was called") | transform-field mangling | `AddressField`, `EmailListField`, `Autocomplete`, `NumberField`/`PercentField`/`MoneyField` |
| 4 | `Enter` submits exactly once, including with a popper/listbox open | double submit, swallowed Enter | DatePicker family, `Autocomplete`, `EmailListField` |
| 5 | Focus lands on the first invalid field after a failed submit | a11y blocker | `FieldArray` rows, `AddressField` nested paths |
| 6 | A `theme.components.Ez<Name>.defaultProps` value reaches the field | theme-unreachable defaults | the `defaultProps`-only wrappers: `EmailField`, `FeinField`, `PercentField`, `ZipField`, `StateSelect`, `PhoneField` |
| 7 | `renderToString` does not throw | SSR | `useId` fields, `FileField`, `AddressField` debounce |
| 8 | `aria-describedby` survives a consumer-supplied one | the TextField P2 above | TextField family |

Rows 2-8 are **suspicion** (source-audit only, not probed). Row 1 is measured.

---

## 7. Things we should NOT "fix"

- **`SubmitButton` vs a raw button.** Not a library bug — `SubmitButton` guards double-submit correctly and the story decorator + README already use it. Only `FormDialog.stories.tsx:201` uses a raw MUI `Button type="submit"`. Fix `Form` (§6) for defence in depth; do **not** throw or error on a raw button — it is legitimate HTML and consumers may want it.
- **`type="number"` discarding `12abc`.** Browser behaviour. `12abc` → `12` in the DOM, `{age: 12}` submitted, no data loss.
- **`type="email"` trimming `" a@b.com "` → `"a@b.com"`.** Browser behaviour on `type=email`. Correct.
- **The error message *replacing* helper text** (`useEzField.helperText`). Deliberate: one description slot, error takes priority, helper text returns when fixed (verified). Announcing both would double-speak. Design choice, documented.
- **`min`/`max` as bound **and** rule.** Scoped to `Slider` and `NumberField` on purpose (they have a `bound()` helper); the philosophy line refers to those. `TextField` differing is not automatically a bug — see the P3.
- **`TextField.inputRef` and `componentName`** (`TextField.tsx:26-52`). Deliberate internal channels, documented against #92; `componentName` exists so a warning names `Select`, not `TextField`. Do not "simplify" either away.
- **`displayValue`.** Working as designed: display and stored value deliberately differ (`PhoneField` stores `5555555555`, shows `555-555-5555`). Typing against a static `displayValue` looks desyncing but the field is documented to map text back in its own `onChange`.
- **Select out-of-range value.** MUI already warns loudly in dev. Do not add a duplicate ez-form warning; docs only.
- **The `act()` warnings in the scratch probes.** Artifacts of raw `.focus()` outside `act`, not component bugs — the real tests open Select by click with no warning.

## 8. Not yet covered

- ~~Browser pass~~ — **done, see Appendix C.** No new ez-form findings; one upstream-only
  `type="number"` observation. RTL remains untestable (no Storybook direction global).
- The other three groups from the sweep design (choice, pickers, wizard) — this pass was TextField + Select only, per Steve.
- The consumer-lint-plugin investigation (§6's `type="email"` and `name` items) — running separately.

## 9. Rulings

- Ruling: **findings only, no fixes, no issues filed** — Steve asked for a checklist first so the fix altitude could be chosen once, not per component — cost if wrong: a second pass to file tickets.
- Ruling: **#47 stays one issue, not an epic** — the findings concentrate in shared plumbing, so the fix list is short and mostly high-altitude — cost if wrong: split later if the a11y-name fix fans out per field.
- Ruling: **`useEzField` owns the accessible name, not each field** — it already owns `aria-describedby`, `role="alert"` and the required/label logic, and 15 fields failing the same way is the definition of a shared-plumbing bug — cost if wrong: per-field routing still needed for controls MUI names differently (`Switch`, `Rating`), so the shared fix may not be sufficient alone.
- Ruling: **baseline-compare every a11y finding against plain MUI before calling it ours** — it split 15 identical-looking failures into 2 regressions, 3 upstream quirks and 1 suspected MUI bug, which have different owners — cost if wrong: filing upstream behaviour as our bug, or vice versa.
- Ruling: **prefer a runtime guard in `Form` over a lint rule for double-submit** — a lint rule only helps consumers who install it, in CI, while the guard protects everyone at runtime — cost if wrong: a consumer relying on two rapid submits (no such use case known).
- Ruling: **probes live in `src/__qa__/` and are not committed** — vitest's `include` is `src/**/*.test.{ts,tsx}` so scratch probes cannot live in `/tmp`; the dir is already gitignored and excluded from tsconfig/eslint for exactly this — cost if wrong: none, `git status` stays clean.
- Ruling: **per-field `optionalText` is removed entirely, `false` included** — three higher layers (theme, locale, `<Form>`) already set it, no story/example/README used the per-field prop, and a label suffix is a form-wide convention whose per-field override can only create inconsistency — cost if wrong: a consumer wanting to suppress the suffix on one field must reword that field's label instead, which is the better fix anyway.
- Ruling: **ship only `prefer-specific-field`, reject the other four lint rules** — a lint rule is the one mechanism that sees across sibling components at authoring time, while every other candidate already has a cheaper runtime or `Form`-level fix — cost if wrong: ~4x effort on rules that duplicate existing dev warnings.
- Ruling: **`name` gets a runtime `devWarn` against `control._names`, not generic `Path<T>` types** — there is no structural path from `<Form>`'s generic through `children: ReactNode`, so generics would force a breaking per-field type argument; `warnUnmountedStepFields` already proves the runtime pattern — cost if wrong: typos are caught at runtime in dev rather than at compile time.
- Ruling: **a11y findings are asserted as accessible *names*, never as attribute presence** — a source audit cleared 15 fields that a `getByRole(role, {name})` query fails, and `Slider` forwards the attribute correctly while still having no name — cost if wrong: the P1 stays invisible behind 1564 passing tests.

---

## Appendix A — component inventory

Measured 2026-09-03 by grep/count, not by eye. `contract` = calls `describeFieldContract`
(which itself includes a jest-axe pass, so those fields are axe-covered indirectly);
`axe` = an additional explicit `expectNoA11yViolations` in the component's own test file;
`tgt` = asserts `expectTargetSize` (the ≥24×24px checklist line).

| Component | Group | Built on | Binding | stories | contract | axe | tgt |
|---|---|---|---|---|---|---|---|
| TextField | text | MUI TextField | `useEzField` | 5 | Y | – | – |
| TextareaField | text | ez TextField | via TextField | 3 | Y | – | – |
| EmailField | text | ez TextField | via TextField | 5 | Y | Y | – |
| PasswordField | text | ez TextField | via TextField | 5 | Y | Y | Y |
| PhoneField | text | ez TextField | via TextField | 6 | Y | Y | – |
| SsnField | text | ez TextField | via TextField | 7 | Y | Y | Y |
| FeinField | text | ez TextField | via TextField | 4 | Y | Y | – |
| ZipField | text | ez TextField | via TextField | 3 | Y | – | – |
| OtpField | text | own control | `useEzField` | 9 | Y | Y | Y |
| NumberField | numeric | own control | `useEzField` | 7 | Y | – | Y |
| MoneyField | numeric | ez NumberField | via NumberField | 3 | Y | – | – |
| PercentField | numeric | ez NumberField | via NumberField | 5 | Y | Y | – |
| Select | choice | ez TextField | via TextField | 3 | Y | Y | – |
| StateSelect | choice | ez Select | via Select | 3 | Y | – | – |
| Autocomplete | choice | MUI Autocomplete | `useEzField` | 7 | Y | Y | Y |
| EmailListField | choice | ez Autocomplete | via Autocomplete | 6 | Y | Y | Y |
| Checkbox | choice | MUI + FieldFrame | `FieldFrame` | 4 | Y | – | – |
| CheckboxGroup | choice | MUI + FieldFrame | `FieldFrame` | 6 | Y | – | – |
| RadioGroup | choice | MUI + FieldFrame | `FieldFrame` | 6 | Y | – | – |
| Switch | choice | MUI + FieldFrame | `FieldFrame` | 5 | Y | – | – |
| ToggleButtonGroup | choice | MUI + FieldFrame | `FieldFrame` | 5 | Y | – | – |
| Slider | choice | MUI + FieldFrame | `FieldFrame` | 5 | Y | – | – |
| Rating | choice | MUI + FieldFrame | `FieldFrame` | 5 | Y | – | – |
| DateField | pickers | MUI X | `usePickerField` | 6 | Y | – | – |
| DatePicker | pickers | MUI X | `usePickerField` | 5 | Y | – | – |
| TimePicker | pickers | MUI X | `usePickerField` | 5 | Y | – | – |
| DateTimePicker | pickers | MUI X | `usePickerField` | 5 | Y | – | – |
| FileField | other | MUI | `useEzField` | 9 | Y | Y | Y |
| AddressField | other | ez fields | ctx + per-part | 7 | Y | Y | – |
| ReadOnlyField | other | MUI | ctx + `useWatch` | 3 | – | Y | – |
| PasswordStrength | other | MUI | ctx + `useWatch` | 3 | – | Y | – |
| Form | form | own | owns lifecycle | 18 | n/a | Y | – |
| Wizard | wizard | own | ctx | 10 | n/a | Y | – |
| FormSection | form | own | ctx | 3 | n/a | Y | – |
| FormError | form | own | ctx | 2 | n/a | Y | – |
| FieldArray | form | own | ctx | 3 | n/a | Y | Y |
| FormDialog | form | MUI Dialog | ctx | 7 | n/a | Y | – |
| ConfirmDialog | form | MUI Dialog | props | 4 | n/a | Y | – |
| SubmitButton | form | MUI Button | ctx | 0 | n/a | Y | – |
| ClearButton | form | MUI Button | ctx | 3 | n/a | Y | – |

Observations worth a ticket of their own:

- [ ] **P3** `src/fields/pickers/usePickerField.ts` is ~17KB of shared picker logic with **no test file of its own** — exercised only indirectly through the four picker components. The highest-blast-radius file without direct tests. (`pickerMessages.ts` beside it does have one.)
- [ ] **P3** `SubmitButton` has **no stories** (0), though it is the component the docs tell every consumer to use.
- [ ] **P3** `expectTargetSize` (a philosophy checklist line) is asserted in only 9 of 31 field dirs. Whether that is deliberate — many fields have no custom-sized target — should be recorded either way.

## Appendix B — shared-mechanism blast radius

The "fix once, fixes everywhere" map. A bug in the top rows is a bug in every field.

| File | Owns | Blast radius |
|---|---|---|
| `fields/useEzField.tsx` | binding, rule normalization, `aria-describedby`, `role="alert"`, required/label logic, the accessible-name *warning* | **every field** (~31) |
| `Form/Form.tsx` | submission, `submitting`/`loading` lock, confirm, guard, announcements | **every component** |
| `rules.ts` | the rule vocabulary + every default message | every field with a rule |
| `Form/ezResolver.ts` | how field rules compose with zod | every field with a rule |
| `fields/FieldFrame.tsx` | legend/group semantics, `aria-labelledby` | 7 choice fields |
| `fields/TextField/TextField.tsx` | the text input path | 10 fields render through it |
| `fields/pickers/usePickerField.ts` | picker binding + date parsing | 4 pickers |
| `fields/mergeDisabled.ts` | "the form's lock always wins" | every field |
| `devWarn.ts` | dev-mode warnings | every field |
| `test/describeFieldContract.tsx` | the behaviour contract asserted for every field | **every field's test** — a *missing* line here is a gap in ~30 test files at once |

---

## Appendix C — browser pass (Storybook + Playwright, real Chrome)

Ran 2026-09-03 against stories `--default`, `--with-helper-text`, `--disabled`,
`--with-error`, `--rules`. **Result: no new ez-form findings.** Everything jsdom said was
clean is clean in a real browser too, and the one browser-only difference is platform
behaviour we must not fix.

### Verified clean in real Chrome (do not re-test)
Accessible name, `aria-invalid`, and `aria-describedby` → matching visible error text ·
focus lands on the first invalid field after a failed submit · `--disabled` has the native
`disabled` attribute and is out of the tab order · 320×600 viewport on `--rules`: long
helper text wraps, nothing clipped or overlapping · dark mode (`modernDark` global):
contrast readable throughout · `browser_fill_form` bulk-fill registers all three fields
through RHF's `onChange`, no bypass · **console: zero React/MUI warnings or errors across
the whole session** (only a favicon 404).

### The one browser-only difference — `type="number"`, and why it is NOT ours

- [ ] **P3 / upstream** `TextField type="number"`: typing `1,5` one keystroke at a time
  silently becomes `15` (comma dropped, digits concatenated), no error, `badInput=false`.
  Real OS-clipboard paste of U+2212 or Arabic-Indic digits (`١٢٣`) is silently discarded
  (`value=""`, `badInput=false`). Typing `--3` leaves `value=""` with `badInput=true`, but
  the visible message is the generic "Age is required." — indistinguishable from an
  untouched field.

  **All three reproduce identically on a zero-JS `<input type="number">` baseline.** The DOM
  never exposes the raw invalid keystring to JS, so **no `src/` fix is possible.** This is
  exactly what `NumberField` exists for — it intercepts `onPaste`/`clipboardData` itself.
  *Action: a docs/story note steering numeric input to `NumberField`, nothing more.* Note
  the `Rules` story itself uses `type="number"` for `age`, so the story is teaching the
  weaker pattern.

  Correct, not findings: `1e3`, `.5`, and `99999999999999999999` all round-trip through
  `z.coerce.number()` and validate correctly against `min`/`max`.

### Method notes for the next sweep (saves an hour)
- `browser_type` on `type=number` calls Playwright's `.fill()`, which refuses non-numeric
  characters and skips real keystroke filtering. Genuine abuse needs `browser_press_key`
  one character at a time.
- A synthetic `ClipboardEvent` dispatched via `browser_evaluate` **does not insert text** in
  Chromium — only a trusted OS paste does. Real paste = type into a scratch field →
  `Ctrl+C` → focus target → `Ctrl+V`.
- `file://` navigation is blocked; use `data:text/html,...` for zero-JS baselines.

### Still not covered
- True Chrome-native autofill (its heuristic field-matching UI) — no Playwright MCP surface
  for it; `browser_fill_form` only synthesizes `.fill()`.
- RTL — `.storybook/preview.tsx` `globalTypes` exposes only a `theme` toggle
  (modern/modernDark/stockMui), with no direction global. *Adding an RTL global to the
  Storybook preview would unblock checklist line 17 for every future sweep — worth a P3
  ticket of its own.*

---

## Appendix D — consumer lint plugin: mostly rejected

Investigated at Steve's prompt ("i expect textfield to not allow things like type=email
since we have an email input… maybe a lint rule for consumers?"). Verdict: **one rule is
worth shipping, four are not** — each of the rejects already has a cheaper fix.

| Candidate | Verdict | Why |
|---|---|---|
| `prefer-specific-field` — `<TextField type="email\|tel\|password\|number">` | **SHIP** | The only mechanism that can see across sibling components at the moment you type `type="email"`. AST-only, no type info needed. |
| `no-raw-submit-button` | **reject** | The `Form` re-entrancy guard (§6) protects every submit path, not just consumers who install a linter. |
| `require-field-label` | **reject** | `devWarn.warnMissingLabel` already covers the no-name case at runtime. The real bug is that `aria-label` *suppresses* it while naming nothing — a code fix, not a lint rule. |
| `no-duplicate-option-values` | **reject** | `warnDuplicateOptions` already covers it, *including* runtime-computed option arrays that a lint rule cannot see. |
| `field-name-matches-schema` | **reject for now** | Real gap (§6 P2), wrong tool — see below. |

### `prefer-specific-field` — graduated strength, not uniform

The message should say what you gain, and that differs per `type`:

```
type="password" → PasswordField   STRONG: reveal toggle, autoComplete, strength meter
type="number"   → NumberField     STRONG: locale-aware paste interception (see App. C)
type="email"    → EmailField      WEAKER: TextField already derives inputMode+autoComplete;
                                          EmailField adds the pattern rule + message
type="tel"      → PhoneField      WEAKER: same — adds formatting + caret restore
type="url"/"search" → (none)      DROP: no dedicated field exists
```

`type="number"` is the strongest case of all, because Appendix C proves raw
`<input type=number>` silently mangles `1,5` → `15` and discards U+2212 / Arabic-Indic
digits, and `NumberField` is the component that intercepts `onPaste` to fix it.

### On `name` not being type-checked

The agent verified something important: making `name` a generic `Path<T>` is **not
viable** — there is no structural path from `<Form>`'s generic `TIn` through
`children: ReactNode` to a field, so it would force a breaking per-field type argument.
Correcting my earlier framing in §6: the better fix is a **runtime `devWarn`** using
`control._names`, the same mechanism `warnUnmountedStepFields` already uses for Wizard
steps. Cheaper than a lint rule and it catches computed names too.

- [ ] **P3** Ship `prefer-specific-field` as a single-rule plugin via an
  `ez-form/eslint-plugin` subpath export (not a separate package) with a `recommended`
  preset. Size: **S**. The full 5-rule plugin would be **L** and mostly wasted.
- [ ] **P2** (revises §6) Add a `devWarn` for a `name` not present in `control._names`,
  rather than pursuing generic `Path<T>` types.

Also verified as a dead end: **JSDoc `@deprecated` cannot express "this prop is discouraged
only when another prop has a certain value"**, so it cannot cover the `type="email"` case.

## Appendix E — method notes for the next sweep

Both worth carrying forward, both learned the hard way today.

1. **Assert accessible *names*, not attribute presence.** The source audit checked "is
   `aria-label` forwarded?" and cleared 15 fields that a `getByRole(role, {name})` query
   fails. See the callout in §2.
2. **Baseline-compare against plain MUI before assigning blame.** It split 15
   identical-looking failures into 2 ez-form regressions, 3 upstream quirks and 1 suspected
   MUI bug — three different owners, three different fixes.
3. **Browser vs jsdom.** Playwright's `browser_type` on `type=number` calls `.fill()`,
   which refuses non-numeric characters; use `browser_press_key` per character. Synthetic
   `ClipboardEvent` does not insert text in Chromium — real paste needs a scratch field plus
   `Ctrl+C`/`Ctrl+V`. Details in Appendix C.
4. **Opus was 529-saturated during this sweep**; three agents died mid-run. Sonnet completed
   the same work. Prefer Sonnet for mechanical inventory/audit lanes regardless.
