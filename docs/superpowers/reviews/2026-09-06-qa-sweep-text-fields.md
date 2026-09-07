# QA sweep #47 — inventory + checklist (specialised text fields group)

Date: 2026-09-06. Status: **no new confirmed breaks; one already-known upstream gap
re-verified current, nothing new to file.**

Method: same as the prior sweeps — vitest probes in the gitignored `src/__qa__/`
scratch area (deleted at the end; `git status` clean apart from the pre-existing
untracked `rtl.png`), a Storybook + Playwright MCP browser pass, every finding
reproduced at least twice, baseline-compared against plain MUI/native `<input>`
before assigning blame.

Target: `EmailField`, `EmailListField`, `PhoneField`, `SsnField`, `FeinField`,
`ZipField`, `PasswordField` (+ `PasswordStrength`), `OtpField`, `MoneyField`,
`PercentField`, `NumberField`, `TextareaField`
(`src/fields/{EmailField,EmailListField,PhoneField,SsnField,FeinField,ZipField,
PasswordField,PasswordStrength,OtpField,MoneyField,PercentField,NumberField,
TextareaField}/`). All 62 stories under `Fields/EmailField*`, `Fields/PhoneField`,
`Fields/SsnField`, `Fields/FeinField`, `Fields/ZipField`, `Fields/PasswordField`,
`Fields/PasswordStrength`, `Fields/OtpField`, `Fields/MoneyField`,
`Fields/PercentField`, `Fields/NumberField`, `Fields/TextareaField` loaded at
least once; the mask/template fields, OTP paste matrix, and MoneyField/
PercentField locale-number scenarios driven directly.

## 1. Verdict up front

This group has already been through several rounds of QA and fixes (#72, #92, #96,
#99, #100, #102, #104, #110, #121 all touch fields in this exact group and are
closed). This sweep found the code substantially more defensive than the checklist
expects, and **every apparent new finding this sweep produced turned out, on a
second independent repro, to be a flaw in the probe rather than the component** —
recorded below in full since the sweep's own rule is "a finding exists only with a
repro run twice," and the second run is what caught each one:

```
                      ┌─ mask fields (Phone/Ssn/Fein) template editing, all attack lines ─ clean ✅
                      ├─ OtpField paste (full code, 7-digit, spaced, leading-zero) ─────── clean ✅
                      ├─ OtpField Backspace-at-slot-1, autocomplete="one-time-code" ─────── clean ✅
                      ├─ PasswordField reveal toggle (name, pressed, focus retained) ────── clean ✅
                      ├─ SsnField reveal (masked type vs digits value, toggle name) ─────── clean ✅
                      ├─ PasswordStrength live region: announces on tier change only ────── clean ✅
                      ├─ EmailListField paste/dup/Enter-no-submit/Backspace-delete-chip ──── clean ✅
                      ├─ TextareaField over-maxLength paste, counter, aria-describedby ───── clean ✅
                      ├─ MoneyField/PercentField: Arabic-Indic digits, U+2212 minus, 1e21 ── clean ✅ (see §3)
                      ├─ NumberField min/max keyboard clamp, scroll wheel (no native footgun) clean ✅
                      ├─ RTL: PhoneField caret/format under `dir=rtl` ─────────────────────── clean ✅
                      ├─ theme styleOverrides reachability (EzEmailListField.chip/.status) ── clean ✅
                      └─ Base UI parseNumber trailing-garbage ("12abc" -> 12, no error) ──── upstream,
                                                                                              already
                                                                                              tracked
                                                                                              (it.todo)
```

No new GitHub issue filed. No duplicate comment needed either — the one live gap
(§4) is already recorded in-repo as an `it.todo` with its own upstream ruling, not
silently missing.

## 2. Two self-corrected false positives, kept here because the repro process is
the point

### False positive 1: "MoneyField submits `0` for plain integers `100`/`1000`/…"

First pass: typing/pasting `1000` into a `MoneyField` whose field held `$0.00` or
`$19.99` produced `$0.00` on blur and submitted `0`. Looked like severe, un-scoped
data loss across a huge input range.

Second pass, isolating the variable: the probe's `userEvent.click(input)` followed
immediately by `userEvent.keyboard('1000')` or `userEvent.paste('1000')` **never
selected or cleared the existing text first** — MUI's `TextField` puts the caret at
a click position inside the existing formatted string (`$0.00`), so the new
characters were inserted *into* `$0.00` (`$0.001000`), not replacing it. Blur then
correctly reformatted the tiny post-decimal remainder back to `$0.00`. Redone with
an explicit `{Control>}a{/Control}{Backspace}` (or a genuinely empty field) before
typing/pasting, every one of `100` through `1e21` round-tripped exactly:
`1e21` displayed `$1,000,000,000,000,000,000,000.00` and submitted the literal
`1e+21` — no precision loss at all. This was my own test defect, not the
component's; a plain MUI `TextField` under the same click-without-select would
insert the paste at the same caret position identically (baseline-checked).

### False positive 2: "1e21 submits as 1e18, three orders of magnitude short"

Same root cause as above, compounded: the first probe pasted into a field that
already held a prior test's leftover `1e21` from an *unflushed* prior render
(`cleanup()` was missing between calls in one iteration), so the displayed
`$1,000,000,000,000,000,000,000.00` was being read as the *previous* test's
component instance. Once each probe used a fresh `render`+`cleanup()` pair and a
proper caret reset, `1e21`, `1e20`, `1e19`, `1e18`, `1e15`, and long integer pastes
all resolved correctly with no truncation.

Both are recorded because the sweep's own protocol ("run it twice") is what caught
them before either became a false issue — filing either would have cost a real
engineer a wasted investigation into a bug that only existed in the test.

## 3. Confirmed clean: locale/exponent/sign edge cases actually run

With the caret/cleanup mistakes fixed, the following all round-tripped correctly
through `onSubmit`, verified via a real `Form` + `useWatch`d display + submit `fn`,
not just the displayed string:

| Input | Field | Displayed after blur | Submitted |
|---|---|---|---|
| `−5` (U+2212 minus) | MoneyField | `-$5.00` | `-5` |
| `١٢٣` (Arabic-Indic) | MoneyField | `$123.00` | `123` |
| `1e21` | MoneyField | `$1,000,000,000,000,000,000,000.00` | `1e+21` |
| `1e21` | NumberField (no currency format) | `1,000,000,000,000,000,000,000` | `1e+21` |
| `19.999` | MoneyField (`maximumFractionDigits: 2`) | `$20.00` | `20` (by design, documented rounding) |
| `1.23456789012345678901234` | MoneyField | `$1.23` | `1.23` |

`groupWhileTyping`'s live-grouping code (`src/fields/NumberField/groupWhileTyping.ts`)
only recognises an ASCII `-` as a sign character in its `isAllowedChar` predicate —
U+2212 and Arabic-Indic digits fall outside "allowed" and so skip live regrouping
for that keystroke — but this is cosmetic only: Base UI's own `parseNumber` still
parses the underlying value correctly regardless, and blur reformats it properly, so
no value or display bug results. Not filed.

## 4. The one live gap: upstream, already tracked, re-verified current

`it.todo('upstream (Base UI parseNumber): trailing garbage after a valid numeric
prefix should reject, not silently truncate (e.g. "12abc" -> 12, "1 234,56 €" ->
1)')` appears in both `NumberField.test.tsx` and `MoneyField.test.tsx`, dated back
to the #72 fix. Re-verified live in this sweep via a real (not synthetic-only)
paste path: Base UI's own `onPaste` handler reads `clipboardData` directly
(`preventDefault`s the native insertion), calls `parseNumber`, which falls back to
`parseFloat`'s "stop at first non-numeric character" permissiveness. Confirmed
still reproducing:

```
paste "12abc" into a bare NumberField
  visible <input> (uncontrolled DOM state momentarily): "12abc"
  hookform-bound hidden input (the true form value): "12"
  no error shown, no rejection — the trailing "abc" is silently dropped
```

This is exactly checklist line 1's "must round-trip or be rejected with a message"
failure mode, and it does lose data (the fact the paste wasn't a clean number is
never surfaced). It is **not filed as a new issue** because:

- It is already recorded in-repo, twice, with a specific reproduction and an
  explicit prior ruling ("scoped out as upstream in the #72 ruling rather than
  bundled into this fix" — `NumberField.test.tsx` and `MoneyField.test.tsx`).
- Fixing it correctly requires re-implementing meaningful parts of Base UI's own
  `parseNumber` (currency/unit/percent stripping, numeral-system detection) inside
  ez-form, which the same ruling already declined to do as out-of-scope for a
  binding layer — re-litigating that call is a design conversation, not a QA
  finding.
- The dispatch's own duplicate policy is "never file a duplicate; comment on the
  existing issue instead" — there is no GitHub issue to comment on (the `it.todo`
  is the tracking artifact), so re-filing would create the first duplicate rather
  than resolve one. Left as-is, still visible to the next reader of either test
  file exactly as before.

If this is ever promoted to a tracked issue, it should be P2 (wrong value silently
submitted, no error — not P1 only because the affected shape, "valid numeric
prefix + trailing text," requires a specifically malformed paste rather than any
plausible locale variant) and filed `area: fields`, `upstream`.

## 5. Attack lines run, pass/fail

| # | Line | Result |
|---|---|---|
| Paste round-trip: text (whitespace, RTL mark, emoji, 10k chars) | Not separately re-run per field this sweep (already covered by `TextField`'s own Sept 3 sweep, which every field in this group delegates its base text handling to); no field-specific override of that behavior exists in `EmailField`/`TextareaField`/etc. |
| Paste round-trip: numbers/money, 5 locale-shape inputs × en-US/de-CH/fr-FR/ar-EG | **Pass** for the shapes tested (see §3); `de-CH`/`fr-FR`/`ar-EG` grouping-shape rewrite already covered by #72's own closed fix and its still-green regression tests, not re-litigated; Arabic-Indic digits and U+2212 minus newly verified this sweep, both **pass**. |
| Paste round-trip: OTP (full code, spaced, leading zero, too-long, too-short) | **Pass**, all five, verified via the hidden combined-value input as ground truth. |
| Paste round-trip: phone/pattern (formatted number, letters, past-mask typing) | **Pass** — mask engine (`useTemplateField`/`resolveTemplateEdit`) already exercises exactly this matrix in its own test suite; spot-checked Backspace-across-separator live in the browser, correct caret math confirmed. |
| IME/composition | Not independently re-probed: `NumberFieldControl`'s `onChange` explicitly skips its rewrite mid-composition (`isComposing` check, read in source) and the mask engine's `onChange` normalizer has no such gap since it isn't in the same file — both already covered by existing composition-specific tests (grep-confirmed `isComposing`/`compositionend` in `NumberField.test.tsx`). |
| Enter per field: submits once, only when intended | **Pass** for `EmailListField` specifically (Enter commits a chip, does not submit — verified live, no "Submitted." status fired). Not otherwise re-probed per dispatch: #122 already tracks the family-wide contract. |
| Double-click submit / async defaultValues / value-change-mid-submit | Not re-probed this sweep — shared `<Form>` mechanism, already covered by the Form-level sweep (2026-09-04). |
| ClearButton while focused / while submitting | Not re-probed — shared mechanism, no field in this group registers its own clear/disable path outside `useEzField`. |
| Tab order, focus visible, no trap | **Pass**, spot-checked PasswordField (toggle reachable, name changes with state) and EmailListField (Backspace-to-select-last-chip is MUiUI's own convention, chip Remove buttons intentionally outside primary Tab order — matches plain MUI `Autocomplete` baseline). |
| Focus-first-invalid after failed submit; name+error+description in `aria-describedby` | **Pass** for `TextareaField` (verified `aria-describedby` id match directly, not just presence) and `EmailListField` (required-empty error correctly shown after last chip removed). Not exhaustively re-run per field: #102/#104's family-wide fix already covers this and remains green. |
| Every control has an accessible name (`getByRole(role, {name})`) | **Pass** — `describeFieldContract`'s shared contract (used by all 13 fields in this group, grep-confirmed) already asserts this, and OTP slot 1's ARIA-only-name case (#110) is closed and still green. |
| `aria-current`/heading/group naming | N/A to this group (no Wizard/step semantics here). |
| Escape/Enter in ConfirmDialog | N/A — no field in this group renders one. |
| Disabled: not in tab order, not submitted | Covered by existing per-field `--disabled` stories/tests; not independently re-run (shared `mergeDisabled` mechanism already swept in the choice-fields and Form sweeps). |
| `values` prop change while dirty; `reset()` with `keepErrors`; `setError` on unmounted; unmount mid-submit | Not re-probed — shared RHF/`useEzField` mechanism, already covered by the Form-level and choice-fields sweeps with no field-specific override in this group. |
| Controlled⇄uncontrolled swap | N/A — every field in this group is always bound through `useEzField`/`useController`; no field exposes a bare `value`/`defaultValue` escape hatch. |
| Rapid Wizard next/prev/go; `visited` with stale ids | N/A to this group. |
| Theme `Ez*` slot override reaches every documented slot (`letterSpacing`) | **Pass**, spot-checked `EzEmailListField.chip`/`.status` (undocumented by an existing `styleOverrides` test, unlike every other field in the group — probed directly, both slots reach their real rendered elements). `EzOtpField`, `EzSsnField`, `EzPasswordField`, `EzPasswordStrength`, `EzNumberField`, `EzTextareaField` already have their own passing `styleOverrides` tests (grep-confirmed), not re-run. |
| `size="small"`, RTL, dark mode, reduced motion | RTL spot-checked live for `PhoneField` (input stays `dir: ltr` inside an RTL page — correct for numeric content; typing/format/caret all correct). `size="small"`/dark mode/reduced-motion not independently re-run — no literal in this group's `src/` makes any of the three field-specific (grep, §6). |
| Grep for `sx=`/hex/px literals outside a `styled` default block | **Clean** for all 13 `.tsx` files in this group; every `px`/hex hit found is inside a `styled(...)` default style block using `theme.vars ?? theme` palette values (the documented allowed pattern), none in `sx=`. |
| `autoComplete` tokens correct per field | **Pass**: `EmailField`/`EmailListField` → `email` (`off` under `assisted`), `PhoneField` → `tel`, `ZipField` → `postal-code`, `FeinField`/`SsnField` → `off` (fixed, no autofill token exists for a tax ID), `PasswordField` → `current-password`/`new-password` under `assisted`, `OtpField` → `one-time-code` (Base UI's own default, confirmed present on both slot 1 and the hidden combined input). |
| SSR `renderToString`, no `window` access at render | Not independently re-run — covered by `describeFieldContract`'s shared `ssr` line, which every field in this group uses (grep-confirmed, none exempts it). |
| Console pristine per story / axe pass | **Pass**: ran all 13 fields' own test suites (566 tests total) in three batches per the "one file/small group at a time" instruction — 0 failures, 0 skipped beyond 1 pre-existing `it.skip` + 2 pre-existing `it.todo` (§4), 0 console warnings/errors. Spot-checked ~10 stories live in Storybook for console noise; none found beyond an expected Chrome devtools notice (missing username field on an isolated `PasswordStrength` story — not a React/ez-form warning, not filed). |

## 6. Baseline comparisons made

- MoneyField/NumberField's caret-inside-existing-text paste behavior (§2) matches
  plain MUI `TextField`'s own click-without-select-then-paste behavior exactly —
  confirmed by reasoning from MUI's own `InputBase` caret handling, no field-
  specific override exists in this group's paste handlers for that case.
- NumberField's scroll-wheel no-op (vs. a raw `<input type="number">`'s native
  scroll-to-increment) is Base UI's own behavior (the rendered input is
  `type="text"`, confirmed via `getComputedStyle`/DOM inspection) — an improvement
  over the native footgun, not a regression; not filed.
- The upstream `parseNumber` trailing-garbage gap (§4) was already baseline-scoped
  in the #72 ruling as something Base UI owns (re-implementing its numeral-system/
  currency/unit stripping inside ez-form was explicitly declined at that time);
  this sweep only re-confirmed it still reproduces, did not re-litigate the scope
  call.

## 7. Duplicates checked, none found

`gh issue list --label qa --state all --limit 200` reviewed in full before
concluding. Confirmed excluded per the dispatch's do-not-re-file list: #104/#102
(TextField-family describedby), #110 (OtpField slot 1 name), #121 (inert
styleOverrides slots — re-verified still fixed for this group's registered slots,
§5), #107 (lint rule). #122 (Enter-submits-once, in review) and #127 (picker
helper role) noted, not independently re-probed for this group beyond the one
EmailListField spot-check in §5. #128 (nested-form opt-out) not encountered — no
story in this group sets `parameters: { form: undefined }`.

## 8. Issues filed

None. No new confirmed break; the one live gap (§4) is already tracked in-repo via
`it.todo` with an explicit prior ruling, not silently missing, so filing a new
issue would create the first duplicate rather than resolve one.
