# QA sweep #47 — inventory + checklist (DatePicker · DateField · TimePicker · DateTimePicker)

Date: 2026-09-04. Status: **findings only, nothing fixed.**

Method: same as the Sept 3 TextField/Select run — vitest probes in the gitignored
`src/__qa__/` scratch area (deleted at the end; `git status` clean), a Storybook +
Playwright MCP browser pass, every finding reproduced at least twice, baseline-compared
against plain MUI X (and, for one case, plain react-hook-form + plain MUI X together)
before assigning blame. Lesson carried over from the Sept 3 ledger: assert accessible
*names*, never attribute presence — applied throughout below.

Target: `src/fields/DatePicker`, `src/fields/DateField`, `src/fields/TimePicker`,
`src/fields/DateTimePicker`, `src/fields/pickers/` (the shared `usePickerField` +
`pickerMessages`). Stories: `fields-datepicker--*`, `fields-datefield--*`,
`fields-timepicker--*`, `fields-datetimepicker--*` (21 total).

---

## 1. Verdict up front

**All four pickers are clean.** Zero new ez-form-owned findings. Issue #73 (unparsable
paste/typed date silently submitting `null`) — filed by the first pass of this same sweep
and since closed — holds under a fresh adversarial pass: the fix generalizes correctly
across `DatePicker`, `DateField`, `DateTimePicker`, and (newly checked) the invalid-calendar-
date case (`02/31/2024`, a date that never exists) is also correctly rejected, not rolled
forward into March.

Two behaviors looked wrong on first contact and both turned out to be **upstream MUI X**,
confirmed by a baseline built from scratch (no ez-form in the tree) — see §2. A third
apparent bug (focus lands on an `aria-hidden` proxy input, not the visible field, after a
failed submit) turned out to be a **jsdom artifact only**: the real Storybook + Playwright
browser pass showed focus landing correctly on the visible, named spinbutton both after a
raw submit and after clicking a `FormErrorSummary` link. That one very nearly became a
false-positive P1 filed against the wrong layer — recorded as a method note in §5.

```
                      ┌─ DatePicker/DateField/TimePicker/DateTimePicker ── clean ✅ (0 new issues)
findings split ───────┤
                      ├─ upstream MUI X (Escape needs 2 presses to close popper) ── comment on #105
                      └─ upstream MUI X + RHF (shouldFocusError targets the hidden proxy input) ── comment on #105
```

---

## 2. The two upstream-confirmed quirks

### (a) `Escape` needs two presses to close a picker's popper

Reproduced in the real browser (Playwright, not jsdom) on `fields-datepicker--default`:
open the popper (click "Choose date"), press `Escape` once — the `role="dialog"` stays
mounted and focus jumps back to the toggle button (outside the dialog) without closing it.
A second `Escape` closes it. Reproduced twice, both with focus starting on the toggle
button and with focus moved into the calendar grid first (arrow keys) — same result either
way.

**Baseline:** built a bare `MuiDatePicker` (no `Form`, no `usePickerField`, no ez-form code
at all) in a throwaway Storybook story (`src/__qa__/baseline-mui-datepicker.stories.tsx`,
deleted after) and ran the identical real-browser repro: **identical result**, one Escape
leaves the dialog open, a second closes it. ez-form adds no keydown handling anywhere in
`src/` (confirmed by grep) — this is entirely MUI X's own popper/focus-trap interaction.

`vitest` + `@testing-library/user-event`'s `{Escape}` did **not** reproduce this (one
Escape closes it there, on both plain MUI and ez-form) — jsdom's synthetic focus/keyboard
timing doesn't match a real browser's here, so this one is real-browser-only. No data is
lost (no value changes), so per the ground rules this is `upstream`, P3.

**Action:** commented on #105 (the "confirm and report suspected upstream MUI bugs"
collector issue) rather than filing new — it fits that issue's exact purpose.

### (b) `shouldFocusError` / `FormErrorSummary`'s `setFocus` target `DatePicker`'s hidden proxy input in jsdom — but not in a real browser

First contact (vitest, jsdom): after a failed submit, `document.activeElement` was the
picker's hidden `<input aria-hidden="true" tabindex="-1">` — the MUI X "documented test
seam" that `usePickerField` wires as `inputRef`. That element is invisible to a screen
reader and has no visible focus ring, which looked like a real P1 (checklist line 7: focus
must land on the first invalid field).

**Baseline, still in jsdom:** rebuilt with zero ez-form code — a bare `useForm` +
`Controller` + `MuiDatePicker`, `inputRef={field.ref}`, `rules={{required: true}}`.
**Identical result.** Confirms the *ref* itself is what MUI X hands out; whoever calls
`.focus()` on it (react-hook-form's own `shouldFocusError`, or ez-form's `FormErrorSummary`
link handler, which also calls RHF's `setFocus`) lands on the same element either way.

**Then re-verified in the real browser** (the one this sweep should have started with):
submitted `fields-datepicker--birthday-vs-date-picker`-equivalent with an empty required
field, and separately clicked a `FormErrorSummary` link pointing at a `minDate` breach.
**Both times, real focus landed on the visible "Month" `role="spinbutton"` section** —
`aria-label="Month"`, `tabindex="0"`, real DOM focus, exactly what checklist line 7 wants.
jsdom's `document.activeElement` bookkeeping for a `tabindex="-1"`/`aria-hidden` element
apparently does not track what MUI X's ref-forwarding actually does at the DOM level in a
real engine. No issue filed; recorded as a method note (§5) so the next sweep doesn't get
fooled the same way.

---

## 3. Checklist, run against pickers specifically

| # | Line | Result |
|---|---|---|
| 1 | Paste round-trips per value type (dates, `de-CH`/`fr-FR`/`ar-EG`≈`ar-SA`/`en-IN` formats) | **Pass.** `2.3.2024` (de, `d.M.yyyy`), `02/03/2024` (fr, `dd/MM/yyyy`), `02/03/2024` (ar-SA, `MM/DD/YYYY`), `03/02/2024` (en-IN, `DD/MM/YYYY`) all round-tripped to the calendar date the format means, verified against the actual submitted `Date` via `onSubmit`. |
| 1 (dates, invalid) | Unparsable / invalid-calendar dates rejected with a message, not silently mangled | **Pass** (already fixed under #73; re-confirmed with `March 2, 2024`, ISO `2024-03-02`, no-separator `02032024`, and **newly** `02/31/2024` — a date that does not exist — all four correctly show `"… is invalid."` and block submit, none roll forward). |
| 2 | IME / IME-adjacent composition | Not separately probed — pickers are digit/section-based, not free-text; no IME composition path exists for a spinbutton section. Skipped, N/A. |
| 3 | `Enter` submits exactly once; `Enter` with popper open | **Pass.** `Enter` on an empty required field submits once and shows the error (real browser, `fields-datepicker--required`). `Enter` with the popper open did not trigger a second submit (vitest + browser both). |
| 4 | Double-click submit; change value while `onSubmit` pending | **Pass.** Double-click fires `onSubmit` once (submit re-entrancy guard from #101 covers pickers too — same `<Form>`). Field is disabled while `onSubmit` is pending; the value captured at submit time is stable. |
| 5 | ClearButton while focused; clear after unparsable paste | **Pass**, with one already-documented, intentional limitation: after an unparsable paste the field has no value to clear (MUI X only renders the clear button when a section holds a value), so it's "stuck" showing the invalid-date error until the user types a valid date over it — this is called out and deliberately accepted in `usePickerField.ts`'s own comments (#83/#73), not a new finding. |
| 6 | Tab order, no trap, focus visible | **Pass.** Tabbed through month/day/year sections, the calendar-open button, and Submit; no trap, focus ring visible at every stop. |
| 7 | Focus after failed submit lands on first invalid field, named, described | **Pass in the real browser** (see §2b above — a jsdom-only false alarm). |
| 8 | Every control named; group named; `aria-current="step"` (Wizard-specific, N/A here) | **Pass.** `role="group"` gets the label text as its accessible name (`group "Start"`); each section (`spinbutton "Month"`, `"Day"`, `"Year"`) is independently named; the popper's `role="dialog"` is named from the field's label. |
| 9 | Escape / Enter in ConfirmDialog (N/A — no ConfirmDialog here); Escape closes the popper | Escape closes it, but needs **two** presses — confirmed **upstream** (§2a), not ez-form's. |
| 10 | Disabled: not in tab order, not submitted | **Pass.** `<Form disabled>` reaches every picker section (`aria-disabled="true"`, `tabindex="-1"` on each spinbutton, `Mui-disabled` class on the root); tabbing skips straight past it to the next control; the disabled value is excluded from the submit payload. |
| 11 | `values` resync while dirty, with/without `keepDirtyValues` | **Pass.** Without `keepDirtyValues`, an external `values` resync overwrites a dirty picker (matches RHF's documented default). With `resetOptions={{ keepDirtyValues: true }}`, the dirty typed value survives the resync. |
| 12 | `reset({keepErrors})`; `setError` unmounted; unmount mid-submit | `reset(undefined, { keepErrors: true })` keeps the error text visible while the value itself resets to `defaultValues` — this is RHF's own documented `keepErrors` semantics (it keeps errors, not values), not a picker-specific bug. `setError`-on-unmounted-field and unmount-mid-submit not separately probed for pickers specifically (budget; no picker-specific mechanism would make these behave differently from the fields already covered generally by `<Form>`'s own tests). |
| 13 | Resolver rejects; `onSubmit` throws; `defaultValues()` rejects | Not picker-specific; owned by `<Form>` and covered generally, not re-probed here (budget). |
| 14 | Controlled ⇄ uncontrolled swap | **N/A.** All four pickers omit `value`/`defaultValue` from their public prop types — the form is the only source of truth, so there is no duality to abuse. |
| 15 | Rapid `next()`/`prev()`/`go()` in Wizard; stale `visited` | Out of scope for this target (Wizard is a separate sweep group). |
| 16 | `theme.components.Ez*` reaches every slot | **N/A, correctly.** Like `TextField`/`Select` before them, the four pickers are pure pass-throughs (per the "ships when" checklist: "a pure pass-through field keeps MUI's own `Mui*` keys and registers nothing") — no `Ez<Name>` key exists in `src/theme/augmentation.ts` for any of them, and none should. Confirmed the underlying `Mui*` keys still work: `theme.components.MuiPickersOutlinedInput.styleOverrides.root.letterSpacing` reached the rendered field root (`getComputedStyle` confirmed `5px`), and `MuiTextField` `defaultProps` compose normally alongside it. |
| 17 | `size="small"`, RTL, dark mode, reduced motion | **Pass.** RTL (`globals=direction:rtl`, #108's new toolbar global): field mirrors correctly, calendar header/day columns mirror together and stay internally consistent (verified Sept 4 2026 landed under the "F" header, matching `Friday`). Dark mode: readable contrast, calendar popper follows the theme. `size="small"` and reduced-motion not separately screenshotted (budget) — no `sx`/literal in `src/` that could special-case size (see #18), so no reason to expect a picker-specific issue there. |
| 18 | Grep for `sx=`, hex colors, px literals | **Pass, clean.** Zero hits across `DatePicker/`, `DateField/`, `TimePicker/`, `DateTimePicker/`, `pickers/`. |
| 19 | Locale round-trip (`de-CH`≈de, `fr-FR`≈fr, `ar-EG`≈ar-SA, `en-IN`) | **Pass** — see line 1. Formatting comes entirely from `LocalizationProvider`'s `adapterLocale`; ez-form hardcodes no format string anywhere (grep confirmed). |
| 20 | ICU / `NODE_ICU_DATA` differences | Not separately run (budget) — no locale-sensitive string formatting happens in ez-form's own code for pickers (all delegated to the date-fns adapter + `Intl` under it), so there is no ez-form-owned surface for this to hit. |
| 21 | SSR `renderToString`, no throw, no `window` access | **Pass.** All four render under `renderToString` with a `LocalizationProvider` + `Form` wrapper, no throw. |
| 22 | Console pristine through a full interaction | **Pass.** Fresh navigations to every picker story are console-clean (one `favicon.ico` 404, unrelated to the components). The repo's own `expectConsole` vitest guard (fails a test on any unexpected `console.error`/`warn`) caught two bugs in my *own* probes during this sweep (unwrapped `act()` from fake timers) — fixed in the probe, not the component; not a finding. |

---

## 4. What passed (worth naming explicitly)

- The #73 fix (unparsable date → `invalidDate`, not silent `null`) generalizes correctly:
  re-tested against `DatePicker`, `DateField`, `DateTimePicker`, and the previously-untested
  invalid-*calendar*-date case (`02/31/2024`) — all four correctly rejected.
- Timezone/DST: a `DateTimePicker` value typed into the US spring-forward gap
  (`03/10/2024 02:30 AM`, a local time that does not exist that day) round-trips through
  submit as the same instant a bare native `new Date(2024, 2, 10, 2, 30, 0)` would produce
  (auto-normalizes to 3:30 AM local) — confirmed identical on a bare `MuiDateTimePicker`
  baseline. This is JS `Date` platform behavior, not a picker bug; no data is silently lost
  (the shifted time is visible in the field itself).
- `minDate`/`maxDate` errors reach `FormErrorSummary` as a real link (`href="#<field-id>"`),
  and clicking it moves real focus to the field in the browser.
- Submit re-entrancy (#101) covers picker forms: double-click fires `onSubmit` once.

## 5. Method notes for the next sweep

- **jsdom is not a substitute for the real browser on focus-target questions.** A picker's
  registered `ref` is a hidden, `aria-hidden`, `tabindex="-1"` proxy input (MUI X's own
  documented test seam) — jsdom reports `document.activeElement` as that literal node after
  `.focus()` is called on it, but a real browser's rendering of the same MUI X component
  redirects real focus to the visible spinbutton section instead. A jsdom-only repro for a
  focus-target claim is not a finding until it's re-run in Playwright; this sweep almost
  filed a P1 on exactly this false positive. Escape's "needs two presses" bug, by contrast,
  is real-browser-only in the *other* direction (jsdom's `userEvent.keyboard('{Escape}')`
  closes it in one press on both plain MUI and ez-form) — so the direction of the mismatch
  isn't predictable; both need checking.
- Building a from-scratch baseline (a throwaway `*.stories.tsx` under `src/__qa__/`, deleted
  after) is worth the few minutes even when jsdom already "shows" a baseline: the Escape bug
  and the focus-target question above needed the *real* baseline, not the jsdom one, to
  settle ownership correctly.
- `ar-EG`/`ar-SA` and `en-IN` date-fns locales use `MM/DD/YYYY` and `DD/MM/YYYY`
  respectively (not always the intuitively-assumed format) — check the field's own rendered
  placeholder/section order before writing a locale round-trip assertion, or the test will
  fail for the wrong reason (a test bug, not a component bug — caught and fixed during this
  sweep before it was mistaken for a finding).

## 6. Not covered (budget)

- `setError` on an unmounted picker field, and unmount-mid-submit — no picker-specific
  mechanism suspected; covered generally by `<Form>`'s own suite.
- Resolver-rejects / `onSubmit`-throws / `defaultValues()`-rejects — `<Form>`-level concerns,
  not picker-specific; not re-probed here.
- `size="small"` and `prefers-reduced-motion` screenshots — no `sx`/literal exists in `src/`
  for pickers that could special-case either, so no picker-specific risk was identified to
  justify the time.
- Wizard interplay (`next()`/`prev()`/`go()`, `visited`) — out of scope for this target
  (separate sweep group).
- `NODE_ICU_DATA` unset comparison — no ez-form-owned locale-formatting code exists for
  pickers to make this meaningful (all delegated to the adapter).
