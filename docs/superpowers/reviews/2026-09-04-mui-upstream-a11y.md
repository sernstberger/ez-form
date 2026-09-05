# #105 — suspected upstream MUI a11y bugs: confirmed against @mui/material 9.4.0

Date: 2026-09-04. Status: **investigation only, nothing fixed, nothing filed upstream.**
Installed `@mui/material` is **9.4.0**, which is also the current `latest` dist-tag on npm
(checked 2026-09-04; `latest-v7` 7.3.11, `next` 9.0.0-beta.1), so "fixed in a newer release"
is ruled out for all three. axe is `axe-core 4.12.1` via `jest-axe 11.0.0`.

Method: one vitest probe against **plain MUI** — no ez-form component code in the tree —
in the gitignored `src/__qa__/` scratch area (deleted after this was written; the full source
is reproduced in Appendix A so it can be re-run). Every DOM claim below is the probe's own
output. Types were checked with a separate `tsc --noEmit` probe (Appendix B). Upstream code
is cited as `file:line` inside `node_modules/@mui/material/`. Tracker searches used
`gh issue list` / `gh pr list -R mui/material-ui --state all`.

The previous lane's probe (`src/__qa__/mui-upstream.test.tsx`) was read but **not trusted**:
its skeleton was sound, but it asserted the (b) premise instead of testing it. It was
rewritten with a Checkbox control, an InputBase comparison, a Rating `role="radiogroup"`
case, and axe's `incomplete` bucket recorded alongside `violations`. That last addition is
what overturned the (b) premise.

---

## 1. Verdict table

| # | Suspicion (from #105 / 09-03 review §5) | Verdict | One-line evidence | Upstream |
|---|---|---|---|---|
| a1 | `Switch inputProps={{'aria-label'}}` is **dropped entirely** | **INTENDED** — removed by design in v9 | Removed in 9.0.0-beta.0 by mui/material-ui#48059 (tracking #47987); migration guide + codemod; types reject it (`TS2322`); docs demos switched to `slotProps.input` in Jul 2025 (#46622). The runtime "drop" is React's ordinary unknown-prop leak (`inputprops="[object Object]"` on the `<span>` + console warning). | [PR #48059](https://github.com/mui/material-ui/pull/48059) |
| a2 | `Switch aria-label="…"` (root prop) lands on a `<span>` | **INTENDED (root-spread contract), not silent** | Types accept it (`SwitchBaseProps extends ButtonBaseProps`); `SwitchBase.js:117-120,175-186` spreads every unknown prop onto the ButtonBase `<span>`. axe reports **two violations** (`aria-prohibited-attr` serious + `label` critical). Documented channel `slotProps.input` works and is what MUI's a11y docs prescribe. Same for Checkbox. | none needed |
| b | `TextField`/`Autocomplete` root `aria-label` names the `FormControl` **and axe passes** | **REAL BUG (unreported) — but the "axe passes" half is FALSE** | `TextField.js:164-172` forwards `...other` to the root; `FormControl.js:222-228` puts it on the `<div>`; input unnamed. axe reports **`aria-prohibited-attr` + `label`** — it is *not* invisible. MUI fixed the identical shape for `InputBase` in 9.0.1 ([#48283](https://github.com/mui/material-ui/pull/48283): "ended up on the input wrapper. It should be added on the input element instead") and did not touch `TextField`, so `<OutlinedInput aria-label>` names the input while `<TextField aria-label>` names a `<div>`. No open or closed issue covers TextField post-v9. | **draft ready** (§5) |
| c | `Rating` has **no `aria-label` support** on the radiogroup | **INTENDED / design gap — premise imprecise** | There is **no radiogroup**: interactive root is a role-less `<span>` (`Rating.js:551-553`, `role: readOnly ? 'img' : null`). A consumer `aria-label` **does** reach that span (`mergeSlotProps.js:63-68` precedence), but with no role it names nothing; axe files it under `incomplete`, not `violations`. Passing `role="radiogroup"` yourself makes `aria-label` name the group, and that is precisely the pattern a maintainer recommends in the open thread [#42562](https://github.com/mui/material-ui/issues/42562). | [#42562](https://github.com/mui/material-ui/issues/42562) (open, adjacent) |

**Recommendation: report (b) only**, scoped to `TextField` with an `Autocomplete` note, citing
#48283 as MUI's own precedent. (a1) is a finished migration, (a2) is the documented root-spread
contract with a working documented channel, and (c) is an enhancement whose live venue is
#42562, where the maintainers have already said the component is "backed into a corner" by the
0-star radio.

Two statements in #105 and the 09-03 review are **retracted** by this investigation:

1. "`inputProps` — which MUI's own docs recommend" — the docs stopped recommending it in July
   2025 (#46622); every current Switch/Checkbox demo and the Accessibility section use
   `slotProps.input`.
2. "axe then reports clean" for (b) — axe-core 4.12.1 reports two violations on a bare
   `<TextField aria-label>`. The failure is fully visible to tooling; the bug is the misplaced
   attribute, not tooling blindness.

---

## 2. (a) Switch — evidence

### What the probe shows

```
<MuiSwitch aria-label="Root channel" />
  input aria-label        = null            input role = switch
  .MuiSwitch-switchBase   = "Root channel"  (the ButtonBase <span>, role = null)
  queryByRole('switch', {name}) → null
  axe: violations [ aria-prohibited-attr[serious] .MuiButtonBase-root, label[critical] input ]

<MuiSwitch inputProps={{ 'aria-label': 'InputProps channel' }} />   // @ts-expect-error
  React warning: "does not recognize the `inputProps` prop on a DOM element"
  <span … inputprops="[object Object]">   input aria-label = null

<MuiSwitch slotProps={{ input: { 'aria-label': 'SlotProps channel' } }} />
  input aria-label = "SlotProps channel"   role = switch   → getByRole('switch', {name}) ✓

CONTROL <MuiCheckbox …> — identical on all three channels.
```

### Responsible code

- `Switch/Switch.js:254-263` destructures `className, color, edge, size, sx, slots,
  slotProps, ...other` and (`:302-310`) passes `...other` straight into `SwitchSwitchBase`.
  `inputProps` is no longer a named prop, so it rides along in `other`.
- `internal/SwitchBase.js:114-120` — `...other` is renamed `buttonBaseProps` and (`:175-186`)
  spread into the **root** slot's `externalForwardedProps`, i.e. the ButtonBase `<span>`.
  Nothing routes anything from `other` to the `input` slot (`:205-231`); the input receives
  only `slotProps.input` plus the internally-owned attributes.
- `Switch/Switch.js:321-325` — `slotProps.input` is merged with `{ role: 'switch' }` via
  `mergeSlotProps`, which is the (9.0.1, #48469) fix for the earlier `role="checkbox"` leak.

### Types

- `inputProps` — **rejected**: `Property 'inputProps' does not exist on type
  'IntrinsicAttributes & SwitchProps'` (same for `CheckboxProps`). `Switch.d.ts:71` extends
  `StandardProps<SwitchBaseProps, …>`; `internal/SwitchBase.d.ts:29-95` has no `inputProps`.
- root `aria-label` — **accepted**, because `SwitchBaseProps extends
  StandardProps<Omit<ButtonBaseProps, 'nativeButton'>, …>` and ButtonBase carries the full
  `HTMLAttributes`. This is the general MUI root-slot contract ("unknown props go to the root"),
  not a Switch-specific type.

### Deprecation trail (this is why a1 is INTENDED)

- `CHANGELOG.md` `## 9.0.0-beta.0` (Mar 25 2026) → Breaking Changes:
  "[checkbox][radio][switch] Remove deprecated inputProps and inputRef (#48059)".
- PR #48059 body: "`inputProps` prop removed — use `slotProps.input` instead … Added codemods
  for Checkbox, Radio and Switch." Tracking issue #47987 "[material-ui] Remove deprecated
  props from all components" (closed 2026-03-25).
- `docs/data/material/migration/upgrade-to-v9/upgrade-to-v9.md` §"Switch props" (and the
  Checkbox/Radio twins) show the exact `- inputProps … + slotProps={{ input: … }}` diff.
- Current docs (`master`): `switches/ControlledSwitches.tsx:15` uses
  `slotProps={{ input: { 'aria-label': 'controlled' } }}`; `switches.md` §Accessibility:
  "When a label can't be used … apply the additional attribute (for example `aria-label`,
  `aria-labelledby`, `title`) via the `slotProps.input` prop."
- MUI's own `Switch.test.js:106-116` pins `slotProps.input` + `aria-label` →
  `getByRole('switch', { name })`.

### Why a2 is not worth reporting on its own

Everything MUI documents for naming a Switch works. The root `aria-label` case is the generic
"consumer put an attribute on the wrong slot" shape, and axe catches it loudly. The only
argument for hoisting it (as InputBase now does — see (b)) is consistency, and that argument is
already carried by the (b) draft; a Switch-specific issue would be closed as by-design.

---

## 3. (b) TextField / Autocomplete — evidence

### What the probe shows

```
<MuiTextField aria-label="TF name" />
  input aria-label        = null
  .MuiFormControl-root    = "TF name"
  queryByRole('textbox', {name}) → null
  axe: violations [ aria-prohibited-attr[serious] .MuiFormControl-root, label[critical] #input ]
       incomplete []

<MuiTextField />                                   (control: no name at all)
  axe: violations [ label[critical] ]              ← the misplaced label ADDS a violation

<MuiTextField slotProps={{ htmlInput: { 'aria-label': 'TF works' } }} />
  getByRole('textbox', {name}) ✓                   (ez-form's workaround, #99)

<MuiOutlinedInput aria-label="OI name" />          (InputBase family, same version)
  input aria-label = "OI name"   root = null   → getByRole('textbox', {name}) ✓

<MuiAutocomplete aria-label="AC name" options renderInput={p => <MuiTextField {...p} />} />
  input = null   .MuiAutocomplete-root = "AC name"   .MuiFormControl-root = null
  queryByRole('combobox', {name}) → null
  axe: violations [ label[critical] ]  incomplete [ aria-prohibited-attr .MuiAutocomplete-root ]
```

### Responsible code

- `TextField/TextField.js:88-117` destructures the TextField-owned props and leaves everything
  else in `...other`; `:164-176` builds the root slot with
  `externalForwardedProps: { ...externalForwardedProps, ...other }` → `TextFieldRoot`, which
  is `styled(FormControl)` (`:42`).
- `FormControl/FormControl.js:222-228` spreads `...other` onto `FormControlRoot`, a plain
  `styled('div')` (`:33`). So the attribute ends on a `<div>` with no role.
- The `<input>` gets `htmlInputProps` (`:224`), which is built **only** from
  `slotProps.htmlInput` (`:195-199`). `aria-describedby` is the one ARIA attribute TextField
  routes itself (`:206`).
- **The precedent:** `InputBase/InputBase.js:259-261` now destructures `'aria-label': ariaLabel`
  and (`:524`) puts it on the `<input>`. That is PR #48283 (merged 2026-04-14, shipped 9.0.1,
  changelog "[input base] Place aria-label on the input element"). Its body: "The aria-label was
  not parsed from the props, and ended up on the input wrapper. It should be added on the input
  element instead." MUI's `InputBase.test.js:52-63` pins
  `<InputBase aria-label="label" />` → `toHaveAccessibleName('label')`. `TextField.test.js`
  has no equivalent case; its only `aria-label*` assertions are the `select` combobox's
  `aria-labelledby` (`:285,307`).
- `Autocomplete/Autocomplete.js:588-598`: `...other` → `AutocompleteRoot` (`styled('div')`,
  `:77`). The `renderInput` params carry no `aria-label`, so the inner TextField never sees it.

### Types

- `BaseTextFieldProps extends StandardProps<FormControlProps, …>` (`TextField.d.ts:87-89`);
  `FormControlProps` is `OverrideProps<…, 'div'>` (`FormControl.d.ts:118`), so `aria-label`
  is **accepted** and typed as a `<div>` attribute — the "accepts and silently misplaces" case
  the task asked about. `inputProps` on TextField is **rejected** in v9 (`TS2322`; removed by
  #47878, see changelog "[textfield] Remove deprecated props"), so the pre-v9 answer MUI gave in
  #42627 ("use `inputProps`") no longer exists — `slotProps.htmlInput` is the only channel.
- The doc comment on `FormControl.d.ts:44-50` (`hiddenLabel`) says "Be sure to add
  `aria-label` to the `input` element" without saying how through TextField. `text-fields.md`
  §Accessibility (`:362-384`) covers only the labelled case.

### Tracker

- #42627 "[autocomplete] Impossible to set aria-label on html input of TextField" — closed
  2024-06-24 as support: same DOM observation ("on the TextField component … it's on
  `MuiFormControl-Root`, not the `<input>`"), answered with `inputProps` (v5). Not a v9 answer.
- #48283 (above) fixed InputBase only. No issue or PR found for TextField/FormControl with
  searches: "TextField aria-label FormControl", "TextField aria-label input element",
  "FormControl aria-label", "aria-label wrapper div input unnamed".
- #48941 (Railing conformance results, Aug 2026) covers Dialog/Combobox/Tabs/Accordion/Menu
  only — it does not touch this.

### Why the "axe passes" premise was wrong, and why it matters less than it looked

axe-core's `aria-prohibited-attr` rule fails an element that has no valid role and carries
`aria-label` ("aria-label attribute cannot be used on a div with no valid role attribute"),
and `label` fails the unnamed `<input>` independently. The 09-03 sweep most likely ran axe
through ez-form's `expectNoA11yViolations` on ez-form fields — which already route the name
correctly (#99) — rather than on a bare MUI render. Either way, plain MUI is **not** clean.
The upstream report should therefore be framed as "misplaced attribute, inconsistent with
InputBase since 9.0.1", not as "tooling-invisible".

Where axe *is* softer: on `Autocomplete` the root `<div>` has text content (the clear/open
buttons), so `aria-prohibited-attr` lands in `incomplete` ("not well supported … with no valid
role") instead of `violations`; the `label` violation on the input still fires.

---

## 4. (c) Rating — evidence

### What the probe shows

```
<MuiRating aria-label="Rating name" name="r1" />
  .MuiRating-root role = null        aria-label = "Rating name"   (it DOES pass through)
  queryByRole('radiogroup') → null   (there is none)
  radios: 6 inputs (values 1-5 + "" for the empty/0 star); each named by its <label>
          ("1 Star" … "5 Stars"); the empty one has no text
  axe: violations []   incomplete [ aria-prohibited-attr .MuiRating-root ]

<MuiRating role="radiogroup" aria-label="Rating group" name="r2" />
  getByRole('radiogroup', { name: 'Rating group' }) ✓  (= .MuiRating-root)   axe clean

<MuiRating value={3} readOnly />                  role = img   aria-label = "3 Stars"
<MuiRating value={3} readOnly aria-label="My rating" />  role = img   aria-label = "My rating"
```

### Responsible code

- `Rating/Rating.js:530-554` root slot: `externalForwardedProps: { …, ...other, component }`
  and `additionalProps: { role: readOnly ? 'img' : null, 'aria-label': readOnly ?
  getLabelText(value) : null }`.
- Merge precedence in `@mui/utils/mergeSlotProps/mergeSlotProps.js:63-68`:
  `{ ...internalSlotProps, ...additionalProps, ...otherPropsWithoutEventHandlers,
  ...componentsPropsWithoutEventHandlers }` — consumer root props (`other`) **override**
  `additionalProps`. That is why the consumer's `aria-label` survives on the interactive root
  (overriding the `null`) and why it also overrides the generated "3 Stars" on a read-only
  Rating. So the literal claim "no `aria-label` support" is wrong; the accurate claim is "no
  group role by default, so a root name has nothing to name".
- No `role="radiogroup"` is rendered anywhere (`Rating.js:302-330` per-item labels + inputs,
  `:623` the empty-value label); the six `<input type="radio">` share only a `name`.

### Types

`RatingProps = OverrideProps<RatingTypeMap<…, 'span'>, 'span'>` (`Rating.d.ts:155-173`) —
`aria-label` and `role` are **accepted** as span attributes. Given the precedence above,
accepted-and-forwarded, not accepted-and-misplaced.

### Tracker / docs

- #42562 "[rating] Screen reader announces incorrect value for maximum amount of stars" —
  **open**. mj12albert (2024-06-24): "have you tried using the `getLabelText` prop … 
  `<Rating defaultValue={3} getLabelText={…} role="radiogroup" />`"; later (2024-12-05):
  "this component seems backed into a corner, I think it needs that hidden input because
  unlike a `role="radiogroup"`, it allows unsetting the group value to empty (0 stars)".
  silviuaavram (2026-06-17) reaffirmed `getLabelText` as the intended lever. This is the live
  design discussion; the missing group role is known there.
- `rating.md` §Accessibility describes "A radio group with its fields visually hidden" and
  points at the WAI star-rating tutorial, but ships no `radiogroup` role and no group-name
  channel. `Rating.test.js` asserts only `role="img"` for read-only (`:284`).
- Searches "Rating aria-label", "Rating radiogroup", "Rating role group label", "Rating
  accessible name group" found nothing else relevant (#40529 is a localisation error, closed).

### Verdict reasoning

Not a bug in the sense #105 stated: `aria-label` is honoured on the root; what is missing is
the `radiogroup` role that would give it something to name, and MUI knowingly leaves that to
the consumer (maintainer-suggested `role="radiogroup"`). If ez-form wants to push, the venue is
a comment on #42562 proposing `role="radiogroup"` by default — not a new issue, and not now.

---

## 5. Upstream draft — (b) only

**Title:** `[TextField] Root aria-label / aria-labelledby land on the FormControl div, not the input (InputBase fixed this in 9.0.1)`

**Body (CodeSandbox-ready):**

> ### Steps to reproduce
>
> ```tsx
> import * as React from 'react';
> import TextField from '@mui/material/TextField';
> import OutlinedInput from '@mui/material/OutlinedInput';
>
> export default function App() {
>   return (
>     <>
>       <TextField aria-label="Search" />
>       <OutlinedInput aria-label="Search (InputBase)" />
>     </>
>   );
> }
> ```
>
> Inspect the DOM, or run axe / `getByRole('textbox', { name: 'Search' })`.
>
> ### Current behavior
>
> `<TextField aria-label="Search" />` renders
> `<div class="MuiFormControl-root MuiTextField-root" aria-label="Search"><div class="MuiInputBase-root …"><input …></div></div>`.
> The `aria-label` ends up on the FormControl `<div>` (a role-less element), and the
> `<input>` has no accessible name: `screen.queryByRole('textbox', { name: 'Search' })` is
> `null`. axe-core 4.12 reports `aria-prohibited-attr` (serious) on the div **and** `label`
> (critical) on the input.
>
> `<OutlinedInput aria-label="Search (InputBase)" />` in the same version puts the attribute
> on the `<input>` and the textbox is named — that is #48283 ("Place aria-label on the input
> element", 9.0.1). TextField was not included in that change, so the two components now
> disagree, and `TextFieldProps` (via `FormControlProps`) types `aria-label` as accepted, which
> makes the misplacement silent at compile time.
>
> ### Expected behavior
>
> `aria-label` (and `aria-labelledby`) passed to `TextField` should reach the `<input>` —
> the same way TextField already routes `aria-describedby` to it and the same way InputBase
> does since #48283 — so that `getByRole('textbox', { name })` resolves. Same for
> `Autocomplete`, whose root `<div class="MuiAutocomplete-root">` receives the attribute
> while the combobox input stays unnamed.
>
> The v5-era workaround `inputProps={{ 'aria-label' }}` (#42627) no longer exists in v9;
> `slotProps.htmlInput` works but is undocumented as the label-less naming channel
> (`text-fields.md` Accessibility covers only the labelled case; the `hiddenLabel` doc
> comment says "Be sure to add `aria-label` to the `input` element" without saying how).
>
> ### Context
>
> Label-less inputs (search boxes, table filters, inputs named by external text via
> `aria-labelledby`) are common; WAI-ARIA 1.2 prohibits `aria-label` on elements with no role
> (`generic`), which is what the FormControl div is:
> https://www.w3.org/TR/wai-aria-1.2/#generic ("Prohibited States and Properties:
> aria-label, aria-labelledby"). WCAG 4.1.2 Name, Role, Value requires the control itself to
> carry the name.
>
> ### Your environment
>
> `@mui/material` 9.4.0 · react 19.2.8 · jsdom + axe-core 4.12.1 (also reproduces in
> Chrome — inspect the DOM).
>
> **Search keywords**: TextField aria-label FormControl input accessible name InputBase 48283

If Steve prefers one issue per component, the Autocomplete paragraph becomes its own issue
titled `[Autocomplete] Root aria-label lands on .MuiAutocomplete-root, combobox input stays unnamed`
with the same body shape.

---

## 6. What ez-form does today, and whether it should stay

| Item | ez-form workaround | Where | After an upstream fix |
|---|---|---|---|
| a | `Switch`/`Checkbox` read `rest['aria-label']`/`['aria-labelledby']` for the dev warning and route the name into `slotProps.input` via `inputA11y` (`mergeSlotProps(slotProps?.input, { ref, required, ...inputA11y })`). `rest` is still spread on the root, so a consumer root `aria-label` also lands on the span — same DOM as plain MUI for that attribute, but the input is named, so axe's `label` rule passes. | `src/fields/Switch/Switch.tsx:44-70`, `src/fields/Checkbox/Checkbox.tsx:42-68`, `src/fields/FieldFrame.tsx:18,99` | **Stays.** Upstream is not going to change this (a1 is finished, a2 is by design). Optional tidy-up, not required: strip `aria-label`/`aria-labelledby` from `rest` before the root spread so the span does not also carry a prohibited attribute — that is a separate small ticket if `expectNoA11yViolations` ever starts flagging `aria-prohibited-attr` on the ButtonBase span. |
| b | `TextField` destructures `aria-label`/`aria-labelledby` out of `rest` on purpose and routes them through `useEzField` → `f.nameA11y` → `slotProps.htmlInput` (or `slotProps.select` under `select`). `Autocomplete` does the same into the rendered TextField's `slotProps.htmlInput`. | `src/fields/TextField/TextField.tsx:92-115,149-165`, `src/fields/Autocomplete/Autocomplete.tsx:113-136,241-264`, `src/fields/useEzField.tsx:17-43,98-138` | **Stays even if MUI fixes it.** Explicit routing to the element that carries the role is correct regardless of MUI's forwarding, and the dev-mode missing-name warning needs the props read in one place anyway. When/if MUI hoists the attribute itself, the only thing to revisit is the comment text ("MUI puts a root `aria-label` on the wrapper") so it does not describe a version that no longer does that. |
| c | `Rating` spreads `inputA11y`, adds `role="radiogroup"`, and sets `aria-labelledby={labelId ?? rest['aria-labelledby']}` so the legend (or the consumer's reference) names the group. | `src/fields/Rating/Rating.tsx:42-51` | **Stays.** This is the maintainer-endorsed pattern from #42562; nothing upstream is queued to replace it. |

Coverage that pins all three: `src/fields/accessibleName.test.tsx:167-230` ("field accessible
name from ARIA alone": named by `aria-label` / `aria-labelledby` on the control itself, axe
clean, Autocomplete via `textFieldProps`) and `src/fields/FieldFrame.test.tsx:64-130`
(`unlabelled:` variants for Checkbox, Switch, Slider, Rating, RadioGroup, CheckboxGroup).

---

## 7. Rulings

- Ruling: (a1) `inputProps` on Switch/Checkbox is INTENDED, not a deprecation-migration bug —
  because it was removed deliberately in 9.0.0-beta.0 with a codemod, a migration-guide diff,
  a type rejection and updated docs; the DOM leak is React's generic unknown-prop behaviour —
  cost if wrong: an unreported cosmetic console warning MUI would close as "use `slotProps.input`".
- Ruling: (b)'s "axe reports clean" premise is recorded as **refuted** in this report rather
  than quietly dropped — because #105 and the 09-03 review both carry it and a future reader
  would re-derive the wrong urgency — cost if wrong: one paragraph.
- Ruling: recommend reporting **only (b)**, scoped to TextField (+ Autocomplete note), with
  #48283 as precedent — because it is the one item where MUI's own maintainer has already
  classified the identical placement as a bug and fixed it at a neighbouring altitude — cost
  if wrong: one upstream issue closed as by-design; ez-form's workaround is unaffected.
- Ruling: (c) is filed as INTENDED / design gap and **not** drafted — because the root does
  honour `aria-label`, the missing piece is a default `radiogroup` role, and the live
  discussion (#42562) already has maintainers on record about why it is hard — cost if wrong:
  a missed enhancement that a one-line comment on #42562 can raise later.
- Ruling: all three ez-form workarounds **stay** after any upstream fix — because they route
  the name to the element that carries the role, which is correct independent of MUI's
  forwarding, and the dev warning depends on reading the props in one place — cost if wrong:
  a few redundant lines.
- Ruling: the inherited probe was rewritten, not trusted — because it asserted the (b) premise
  (`toHaveNoViolations`) instead of measuring it; the rewrite added a Checkbox control, the
  InputBase comparison, the Rating `role="radiogroup"` case and axe's `incomplete` bucket —
  cost if wrong: none; the probe is scratch.

---

## Appendix A — the plain-MUI probe (deleted from `src/__qa__/`, reproduced verbatim)

```tsx
/* Plain-MUI probes for issue #105. No ez-form component code in the tree; only the
 * test-infra console guard (setup.ts fails any test that logs) is shared. */
import { render, screen } from '@testing-library/react'
import { axe } from 'jest-axe'
import { describe, expect, it } from 'vitest'
import MuiSwitch from '@mui/material/Switch'
import MuiCheckbox from '@mui/material/Checkbox'
import MuiTextField from '@mui/material/TextField'
import MuiOutlinedInput from '@mui/material/OutlinedInput'
import MuiRating from '@mui/material/Rating'
import MuiAutocomplete from '@mui/material/Autocomplete'
import { expectConsole } from '../test/expectConsole'

const attr = (el: Element | null, name: string) => el?.getAttribute(name) ?? null
const fmt = (rs: import('axe-core').Result[]) =>
  rs.map((v) => `${v.id}[${v.impact}]: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)
const axeIds = async (el: Element) => {
  const r = await axe(el)
  return { violations: fmt(r.violations), incomplete: fmt(r.incomplete) }
}

describe('(a) Switch aria-label channels', () => {
  it('root aria-label: lands on the ButtonBase <span>, input stays unnamed', async () => {
    const { container } = render(<MuiSwitch aria-label="Root channel" />)
    const input = container.querySelector('input')!
    console.log('[a-root] input aria-label   =', attr(input, 'aria-label'))
    console.log('[a-root] .MuiSwitch-switchBase =', attr(container.querySelector('.MuiSwitch-switchBase'), 'aria-label'))
    console.log('[a-root] axe                =', await axeIds(container))
    expect(attr(input, 'aria-label')).toBeNull()
    expect(attr(container.querySelector('.MuiSwitch-switchBase'), 'aria-label')).toBe('Root channel')
    expect(screen.queryByRole('switch', { name: 'Root channel' })).toBeNull()
  })

  it('inputProps aria-label: prop is unknown to v9, spread onto the <span> as a DOM attribute', async () => {
    expectConsole('error', /does not recognize the `inputProps` prop/)
    const { container } = render(
      // @ts-expect-error `inputProps` was removed from SwitchProps in v9 (#48059)
      <MuiSwitch inputProps={{ 'aria-label': 'InputProps channel' }} />,
    )
    const input = container.querySelector('input')!
    console.log('[a-inputProps] switchBase has inputprops attr =', container.querySelector('.MuiSwitch-switchBase')?.hasAttribute('inputprops'))
    expect(attr(input, 'aria-label')).toBeNull()
    expect(screen.queryByRole('switch', { name: 'InputProps channel' })).toBeNull()
  })

  it('slotProps.input aria-label: names the input, role=switch', () => {
    const { container } = render(<MuiSwitch slotProps={{ input: { 'aria-label': 'SlotProps channel' } }} />)
    expect(screen.getByRole('switch', { name: 'SlotProps channel' })).toBe(container.querySelector('input'))
  })

  it('CONTROL: Checkbox root aria-label and inputProps behave the same way', () => {
    expectConsole('error', /does not recognize the `inputProps` prop/)
    render(
      <>
        <MuiCheckbox aria-label="Checkbox root" />
        {/* @ts-expect-error removed in v9 (#48059) */}
        <MuiCheckbox inputProps={{ 'aria-label': 'Checkbox inputProps' }} />
      </>,
    )
    expect(screen.queryByRole('checkbox', { name: 'Checkbox root' })).toBeNull()
    expect(screen.queryByRole('checkbox', { name: 'Checkbox inputProps' })).toBeNull()
  })
})

describe('(b) TextField / Autocomplete root aria-label', () => {
  it('TextField aria-label lands on the FormControl <div>; input unnamed; axe is NOT clean', async () => {
    const { container } = render(<MuiTextField aria-label="TF name" />)
    const input = container.querySelector('input')!
    const fc = container.querySelector('.MuiFormControl-root')!
    console.log('[b-tf] axe =', await axeIds(container))
    expect(attr(input, 'aria-label')).toBeNull()
    expect(attr(fc, 'aria-label')).toBe('TF name')
    expect(screen.queryByRole('textbox', { name: 'TF name' })).toBeNull()
    expect((await axe(container)).violations.map((v) => v.id).sort()).toEqual(['aria-prohibited-attr', 'label'])
  })

  it('CONTROL: TextField with NO name at all', async () => {
    const { container } = render(<MuiTextField />)
    console.log('[b-tf-noname] axe =', await axeIds(container)) // → violations [label]
  })

  it('TextField slotProps.htmlInput works (the workaround)', () => {
    const { container } = render(<MuiTextField slotProps={{ htmlInput: { 'aria-label': 'TF works' } }} />)
    expect(screen.getByRole('textbox', { name: 'TF works' })).toBe(container.querySelector('input'))
  })

  it('INCONSISTENCY: OutlinedInput (InputBase) root aria-label DOES reach the input since 9.0.1 (#48283)', () => {
    const { container } = render(<MuiOutlinedInput aria-label="OI name" />)
    expect(screen.getByRole('textbox', { name: 'OI name' })).toBe(container.querySelector('input'))
  })

  it('Autocomplete root aria-label lands on .MuiAutocomplete-root; combobox unnamed', async () => {
    const { container } = render(
      <MuiAutocomplete aria-label="AC name" options={['a', 'b']} renderInput={(params) => <MuiTextField {...params} />} />,
    )
    console.log('[b-ac] axe =', await axeIds(container))
    expect(attr(container.querySelector('input'), 'aria-label')).toBeNull()
    expect(attr(container.querySelector('.MuiAutocomplete-root'), 'aria-label')).toBe('AC name')
    expect(screen.queryByRole('combobox', { name: 'AC name' })).toBeNull()
  })
})

describe('(c) Rating aria-label', () => {
  it('interactive Rating: root has no role; aria-label passes through to the role-less <span>; no radiogroup', async () => {
    const { container } = render(<MuiRating aria-label="Rating name" name="r1" />)
    const root = container.querySelector('.MuiRating-root')!
    console.log('[c-root] axe =', await axeIds(container)) // → violations [], incomplete [aria-prohibited-attr]
    expect(attr(root, 'role')).toBeNull()
    expect(attr(root, 'aria-label')).toBe('Rating name')
    expect(screen.queryByRole('radiogroup')).toBeNull()
    expect(screen.queryAllByRole('radio')).toHaveLength(6)
  })

  it('interactive Rating with role="radiogroup" + aria-label (maintainer-suggested pattern, #42562): group gets named', async () => {
    const { container } = render(<MuiRating role="radiogroup" aria-label="Rating group" name="r2" />)
    expect(screen.getByRole('radiogroup', { name: 'Rating group' })).toBe(container.querySelector('.MuiRating-root'))
    expect((await axe(container)).violations).toEqual([])
  })

  it('readOnly Rating: role=img; consumer aria-label OVERRIDES the generated value label', () => {
    const { container } = render(
      <>
        <MuiRating value={3} readOnly />
        <MuiRating aria-label="My rating" value={3} readOnly />
      </>,
    )
    const roots = container.querySelectorAll('.MuiRating-root')
    expect(attr(roots[0], 'aria-label')).toBe('3 Stars')
    expect(attr(roots[1], 'aria-label')).toBe('My rating')
  })
})
```

Run: `pnpm --dir <wt> exec vitest run <wt>/src/__qa__/mui-upstream.test.tsx --reporter=verbose`
(the verbose reporter is needed to see `console.log` from passing tests). Result on 9.4.0:
12/12 pass.

## Appendix B — type-acceptance probe

```tsx
// src/__qa__/types-probe.tsx — run with:
// pnpm --dir <wt> exec tsc --noEmit --ignoreConfig --jsx react-jsx --strict --skipLibCheck \
//   --moduleResolution bundler --module esnext --target es2022 --esModuleInterop <file>
export const probes = [
  <MuiSwitch aria-label="x" />,                                   // OK  (accepted, misplaced)
  <MuiCheckbox aria-label="x" />,                                 // OK  (accepted, misplaced)
  <MuiSwitch inputProps={{ 'aria-label': 'x' }} />,               // TS2322 — rejected
  <MuiCheckbox inputProps={{ 'aria-label': 'x' }} />,             // TS2322 — rejected
  <MuiSwitch slotProps={{ input: { 'aria-label': 'x' } }} />,     // OK  (works)
  <MuiTextField aria-label="x" />,                                // OK  (accepted, misplaced)
  <MuiTextField inputProps={{ 'aria-label': 'x' }} />,            // TS2322 — rejected (removed v9, #47878)
  <MuiTextField slotProps={{ htmlInput: { 'aria-label': 'x' } }} />, // OK (works)
  <MuiAutocomplete aria-label="x" options={['a']} renderInput={(p) => <MuiTextField {...p} />} />, // OK (accepted, misplaced)
  <MuiRating aria-label="x" />,                                   // OK  (accepted, forwarded to root span)
  <MuiRating role="radiogroup" aria-label="x" />,                 // OK  (works)
]
```
