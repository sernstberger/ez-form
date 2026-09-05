# QA sweep #47 — inventory + checklist (Examples group), fifth run

Date: 2026-09-04. Status: **findings only, nothing fixed.**

Method: same as the four prior runs (TextField/Select on 2026-09-03, pickers/Wizard/Form
on 2026-09-04) — vitest probes in the gitignored `src/__qa__/` scratch area (deleted at the
end; `git status` clean), a Storybook + Playwright MCP browser pass (cut short mid-sweep by
a real `beforeunload` dialog wedging the shared browser session — see §6), every finding
reproduced at least twice, baseline-compared against plain MUI/plain hookform before
assigning blame. Every prior ledger's method note carried forward deliberately: assert
accessible *names*, never attribute presence; verify focus and Enter-key claims in the real
browser (jsdom lies both ways).

Target: the six example forms under `src/examples/` — `Login`, `SignUp`, `Profile`,
`Checkout`, `Insurance`, `Loan` — and `src/examples/fakeApi.ts`, as complete end-to-end
forms a consumer would actually copy and run. Stories covered:
`examples-login--*` (3), `examples-sign-up--*` (5), `examples-profile--*` (3),
`examples-checkout--*` (5), `examples-insurance--*` (6, including `Español` and
`ReactRouter`), `examples-loan--*` (3).

---

## 1. Verdict up front

Two new findings, both real, both distinct from anything the four prior sweeps or the
`qa` label already covered:

```
                      ┌─ keyboard walk, autofill tokens, FormErrorSummary order/focus/live-clear,
                      │  Back/deep-link value preservation, RTL, mobile viewport, es-ES story ── clean ✅
findings split ───────┤
                      ├─ every example's onSubmit (catch + setError, never rethrow) makes
                      │  Form announce "Submitted." on a server-rejected/declined/wrong-
                      │  password/wrong-code failure, and leaves focus on <body> ──────────── P1 (#124)
                      └─ Profile/Insurance have no LocalizationProvider of their own — they
                         only render because Storybook's global decorator supplies one ──── P2 (#125)
```

The examples group is where every other group's component meets a real user end to end,
and that is exactly where these two findings live: neither is a defect in any single field
or in `Form`'s own logic in isolation — both are what happens when a documented,
recommended pattern (`root.server` + `setError`, `DateField` used freely) is followed
literally by every example, six times over, with nothing catching the seam.

---

## 2. The two findings

### (#124, P1) The `onSubmit` catch-and-setError pattern silently defeats `Form`'s own success/failure announcement, and no focus moves on a root-level failure

All seven `onSubmit` call sites across the six examples (`Login`, `SignUp`, `Profile`×2,
`Checkout`, `Insurance`, `Loan`) follow the identical shape `docs/PHILOSOPHY.md`'s "the
form owns the lifecycle" section and every example's own doc comments recommend:

```tsx
onSubmit={async (values, form) => {
  try {
    const result = await loginApi(values)
    form.clearErrors('root.server')
    onSuccess?.(result)
  } catch (error) {
    form.setError('root.server', { message: error instanceof Error ? error.message : '…' })
  }
  // never rethrows
}}
```

`Form.tsx`'s own submit wrapper can only distinguish "settled normally" from "threw" at the
outer promise it awaits — it has no visibility into a consumer catching its own rejection:

```tsx
const submit = methods.handleSubmit(async (submitted) => {
  setSubmitting(true)
  announce(submitPendingText)         // "Submitting…"
  try {
    await onSubmit(submitted, methods)
    announce(submitSuccessText)       // "Submitted." — always reached, every example
  } catch (error) {
    announce(submitErrorText)         // "Submit failed." — never reached, every example
    throw error
  } finally {
    setSubmitting(false)
  }
})
```

Because none of the six examples rethrow, `Form` always sees `onSubmit` resolve normally
and always announces **"Submitted."** — including on the fake login failure, the declined
card, and (by the identical pattern, confirmed by source inspection of all 7 call sites)
the wrong verification code and every other scripted failure path. A screen-reader user
hears "Submitted." in the same breath as the correctly-rendered `<FormError role="alert">`
saying the opposite.

```
examples-login--default, wrong password:
  role=alert  → "Invalid email or password"      (correct)
  role=status → "Submitted."                      ❌ (should not say this)
  document.activeElement → <body>                 ❌ (no focus management at all)

examples-checkout--declined-card:
  role=alert  → "Your card was declined. Try a different payment method."   (correct)
  role=status → "Submitted."                                                 ❌
  document.activeElement → <body>                                            ❌
```

Reproduced twice in the real browser (Login `wrong-password` and `default` stories typed by
hand; Checkout `declined-card`), and isolated to `Form`'s own announce logic (not anything
Wizard- or example-specific) with a minimal vitest probe: a bare `<Form>` + `<TextField>`
using the identical catch-and-setError shape reproduces the same "Submitted." on a
rejected/mapped submit, no example code involved.

**Baseline:** not applicable — this is entirely ez-form's own `Form.tsx` announce
mechanism, exercised by ez-form's own documented `root.server` convention; there is no
plain-MUI/plain-hookform equivalent to compare against.

Filed as #124, P1 (a11y blocker: a screen-reader user is told the opposite of what
happened, and gets no focus cue to find out otherwise) rather than P2, since the
mis-announcement is not "wrong visible state" — it actively contradicts the visible
`<FormError>` text, which is worse than silence.

### (#125, P2, area: infra) `Profile` and `Insurance` throw when rendered outside Storybook — no `LocalizationProvider` of their own

Both examples use `DateField` (MUI X), which requires an ancestor `LocalizationProvider`.
Neither `Profile.tsx` nor `Insurance.tsx` renders one — both rely entirely on
`.storybook/preview.tsx`'s global decorator. `Loan.tsx`, the sixth rung of the same ladder
and the same `DateField` user, already wraps itself correctly:

```tsx
// Loan.tsx — correct, self-contained
return (
  <LocalizationProvider dateAdapter={AdapterDateFns}>
    <Container …><Paper …><Form …>…</Form></Paper></Container>
  </LocalizationProvider>
)

// Profile.tsx / Insurance.tsx — no such wrapper; only work inside Storybook
return (
  <Container …><Paper …><Form …>…</Form></Paper></Container>
)
```

Every example is documented as "documentation only… not exported from the package" —
reference code meant to be copied into a real app. Copying `Profile` or `Insurance` this
way and rendering it anywhere outside this repo's Storybook throws immediately, client-side
and under SSR, with an MUI X error that gives no hint the actual fix is "the example itself
was missing a provider":

```
Error: MUI X: Can not find the date and time pickers localization context.
It looks like you forgot to wrap your component in LocalizationProvider.
```

**The test suite already worked around this without ever fixing it**: both
`Profile.test.tsx` and `Insurance.test.tsx` define a local `withPickers()` helper and wrap
every `render(<Profile />)` / `render(<Insurance />)` call in it — silent, deliberate
laundering of the exact gap this issue reports, which is why four prior sweeps and this
example's own test suite never surfaced it.

Reproduced twice: `renderToString(<Profile />)` throws, and a plain
`render(<Profile />)` (Testing Library, no ancestor `LocalizationProvider`) throws
identically; confirmed by inspection that `Insurance.tsx` has the same gap for the same
reason.

Filed as #125, P2 (breaks the moment a consumer follows the documented "copy this" advice;
no data loss, but a hard crash with a confusing error, not a graceful degradation).

---

## 3. Checklist, run against the Examples group specifically

| # | Line | Result |
|---|---|---|
| Keyboard-only, first Tab to success | Login, SignUp step 1 | **Pass, both.** Tab order visits every control in visual/DOM order, no trap, focus visible throughout. |
| Every control has an accessible name | Login, SignUp, Insurance (Español + English), Loan | **Pass, all sampled.** `getByRole(role, { name })` resolved every control in every snapshot taken — Email/Password/Remember me (Login), Email/Password/Confirm password/Display name/checkbox/referral combobox (SignUp), First/Last name/Birthday segmented spinbuttons (Insurance, both locales), Loan amount/Purpose/Term slider (Loan). |
| `<form>` name, one heading, `aria-current="step"` | Login ("Sign in" `h2`), Insurance/Loan wizards (`aria-current="step"` on the selected tab, one `h3` per step) | **Pass.** Consistent with the Wizard sweep's own finding that this mechanism (shipped under #51/#76) holds; nothing example-specific regressed it. |
| Submit empty → summary order matches DOM order, first link focuses the right control, count announced once | SignUp (no summary; each field's own `role="alert"`), Loan (`FormErrorSummary` scoped to current wizard step) | **Pass, both shapes.** SignUp: 5 fields (Email, Password, Confirm password, Display name, terms checkbox) all flagged in DOM order, focus lands on Email (first invalid). Loan step "Loan": 1-item summary ("Purpose is required."), heading focused, link's `href` targets the real combobox. |
| Fix fields one by one, summary shrinks live | Loan, inside a Wizard step | **Fails exactly as #115 already describes** (not re-filed): fixing "Purpose" while still on the "Loan" step does not clear its `FormErrorSummary` entry or field alert live; matches the already-open Wizard finding precisely, confirming #115's regression reaches every wizard-based example, not just the synthetic `wizard--*` stories. |
| Enter in a field on a non-last wizard step | Loan step "Loan", real per-keystroke `browser_press_key` on the Loan amount field | **No-op**, matching #116 exactly (not re-filed) — confirms #116's finding generalizes to a real, full example, not just the minimal Wizard story. |
| Async success/failure paths of fakeApi: `FormError` + field errors mapped, re-enable, focus | Login (`wrong-password`), Checkout (`declined-card`) | **Found #124.** `FormError` renders correctly and the form correctly re-enables (fields are interactive again, `SubmitButton` is not stuck in a busy state) — but the live region contradicts the visible alert ("Submitted." over a failure), and focus lands on `<body>`, not on the error or the first actionable control. |
| Double submit | Not independently re-derived for the examples group | **Not newly probed** — `Checkout.test.tsx`'s own existing suite already covers "asks for confirmation … and only submits on Confirm" with a precise `toHaveBeenCalledTimes(1)` assertion, and the Form sweep's own #101 fix (submit re-entrancy gated by a ref, not state) applies to every example's submit path with no example-specific override. A probe attempting to re-derive this from scratch produced `act()` warnings traced to the probe's own typing speed against `MoneyField`/`NumberField` (confirmed by comparing against the identical, clean-passing pattern already in `Checkout.test.tsx`'s `fillCompleteForm`/`setValue` helpers) — a probe artifact, not a finding, and not worth re-deriving what the existing suite already asserts precisely. |
| Browser autofill attribute audit | Login, SignUp, Checkout (shipping/billing/payment), Insurance (Applicant/Contact), Loan (applicant), Profile | **Pass, with one example-only inconsistency (not filed).** Every WHATWG-spec token sampled was correct: `email`/`current-password` (Login), `email`/`new-password`×2/`nickname` (SignUp), `shipping name`/`shipping street-address`/`shipping address-level2`/`shipping address-level1`/`shipping postal-code`/`cc-number`/`cc-exp`/`cc-csc` (Checkout), `given-name`/`family-name` via `resolveAutoComplete` (Insurance). One inconsistency spotted but not filed as a bug: `Profile`'s `displayName` (plain `TextField`) carries no `autoComplete` token at all, while `Loan`'s equivalent `applicantName` explicitly sets `autoComplete="name"` — both are plain `TextField`s with no default to inherit (confirmed: plain `type="text"` gets no autoComplete default, per the TextField sweep), so this is a missed opportunity in one example's own copy, not a component defect; below the bar for a filed issue. |
| Paste abuse: grouped/formatted phone into `PhoneField` | Insurance Contact step, real OS paste (scratch field → ⌘C → focus target → ⌘V, not a synthetic `ClipboardEvent`) | **Pass.** Pasting `+1 (555) 010-0000` correctly normalized to `555-010-0000` — the leading country code and all formatting punctuation stripped, the ten significant digits kept and reformatted through the field's own template. No mangling, no silent truncation of a real digit. |
| Locale switch (Storybook global / `esES` composition) | `examples-insurance--español` | **Pass, and correctly scoped.** ez-form's own strings (rule messages, "Atrás"/"Siguiente" nav, the required-fields note) are in Spanish; the example's own consumer-supplied copy (step labels, field labels, the schema's own messages) deliberately stays English — this is not a bug, it's the story's own documented purpose ("the example's own copy … stays English here, which is exactly the split a real app sees"), and matches PHILOSOPHY's "the form owns the lifecycle, the consumer owns the copy" split. A validation message read as "First name es obligatorio." — correctly interpolating a Spanish template with the consumer's own English field label, exactly as designed. |
| RTL: layout doesn't break, numeric fields stay usable | Checkout, `globals=direction:rtl` | **Pass, no filing.** The whole form mirrors correctly (labels, required asterisks, section headings all flip to the right consistently). Card number input inherits `direction: rtl` from the ambient context and right-aligns its digits — the digit *order* itself stays correct (typed `4111111111111111` displays and round-trips unchanged; the browser's bidi algorithm keeps numeral runs in visual left-to-right order even under `dir=rtl`), just right-aligned rather than left-aligned. No `dir="ltr"` override exists anywhere in `src/fields/` for any numeric field — consistent with this being the browser's own standard `dir=rtl` + numeric-input behavior, not an ez-form regression; below the bar for a filed issue absent an actual mangled value. |
| Mobile viewport (375px): no overflow, targets ≥24px | Checkout, full form | **Pass.** `scrollWidth === clientWidth` (no horizontal overflow) at 375×700; zero interactive elements (`button`, checkbox, radio, link) measured under 24×24px. |
| Checkout/Insurance wizard step deep-links and Back preserving values | `examples-insurance--react-router`: typed First/Last name + Birthday on `/insurance/applicant`, Next → `/insurance/contact`, Back → `/insurance/applicant` | **Pass.** URL updates correctly on every transition (`/insurance/applicant` ⇄ `/insurance/contact`); all three typed values (`Ada`, `Lovelace`, `03/15/1990`) survive the round trip unchanged; Back does not re-trigger validation (no error shown on return, matching the Wizard sweep's own "`prev()` never calls `trigger()`" finding). |
| SSR `renderToString` | All six examples | **Found #125** for `Profile`/`Insurance` (throw, no `LocalizationProvider`). `Login`, `SignUp`, `Checkout` render cleanly under SSR with no throw and no `window` access. `Loan` also renders cleanly — it already wraps its own `LocalizationProvider`, confirming the fix pattern #125 asks for already exists, correctly, elsewhere in the same file tree. |
| Console pristine, happy + failure path | Login (empty submit, wrong-password), SignUp (empty submit) | **Pass, no unexpected console output** in the real browser for both. The mis-announcement in #124 is a live-region *content* bug, not a console error — it produces no warning of its own, which is part of why it would otherwise go unnoticed. |

---

## 4. What passed (worth naming explicitly)

- **The full keyboard-and-names surface is clean across every example sampled**: every
  control in Login, SignUp, Insurance (both locales), and Loan resolves by accessible role
  + name, tab order has no trap, and focus is visible throughout — the "assert names, not
  attributes" method note from every prior sweep held up with zero surprises here.
- **`FormErrorSummary` order, scoping, and the first-link-focuses-the-right-control
  guarantee are correct in two structurally different real examples** (SignUp's flat
  per-field alerts with no summary; Loan's step-scoped summary inside a 7-step wizard with
  a `FieldArray`-heavy schema) — the Form sweep's general finding generalizes to a real,
  full-schema example without a new gap appearing at the integration seam.
- **Deep-linking + Back value preservation is correct end to end** in the one example that
  wires up `react-router` for real (`Insurance`) — URL, wizard step, and three independently
  typed field values (a plain text field, a nested address field is untouched here, and a
  three-segment date field) all survive a full round trip.
- **Paste-abuse normalization is correct for `PhoneField`** inside a real multi-step
  example, using a real OS paste rather than a synthetic event, confirming the "genuine
  abuse needs a trusted paste" method note from the dispatch didn't hide a masking bug here.
- **The locale (`esES`) and RTL stories are both exactly as their own doc comments
  describe** — no gap between what the story claims to demonstrate and what it actually
  renders, in either direction.
- **`Loan.tsx` already contains the fix for #125** (`LocalizationProvider` wrapping the
  whole example) — the remaining work is applying an existing, working, same-codebase
  pattern to two siblings, not inventing one.

## 5. Method notes for the next sweep

- **A recommended pattern followed identically by every example is exactly the kind of bug
  no single component's own test suite can see.** #124 is not a defect in `Form.tsx` in
  isolation (its announce logic does exactly what its own doc comment says: "this callback
  only runs when validation passed, so its catch is unambiguously a submit failure" — true,
  but only because it assumes `onSubmit` rethrows, which none of the six examples do) and
  not a defect in any one example (each one is doing what `docs/PHILOSOPHY.md` and the
  others already do). It only exists at the intersection the examples group is built to
  probe: six independent call sites making the identical choice, none of which is wrong on
  its own.
- **A helper quietly added to a test file to make a component work at all is a confession,
  not a fix.** `withPickers()` in `Profile.test.tsx`/`Insurance.test.tsx` is the same
  signal the Form sweep's own §5 flagged for `formsection--two-sections`'s missing
  `parameters.form` opt-out: a workaround that lets the test suite pass while leaving the
  thing under test broken for anyone who doesn't happen to import the same workaround.
  Worth grep'ing for test-only wrapper helpers (`withX`, decorator-only fixes) whenever a
  component "documentation only" or "not exported" claims independence it may not actually
  have.
- **The shared Playwright session can be wedged by a real, correct browser behavior with no
  recovery path in this toolset.** Pasting into `PhoneField` inside `examples-insurance--horizontal`
  (a `guard`-enabled form) correctly dirtied the form and armed `beforeunload`; the very next
  `browser_navigate` call triggered Chromium's native "Leave site?" dialog, and every
  subsequent tool call (`browser_navigate`, `browser_snapshot`, `browser_evaluate`,
  `browser_press_key`, `browser_resize`) failed with "Tool does not handle the modal
  state… can be handled by `browser_handle_dialog`" — a tool not available in this session's
  kit. The browser was unavailable for the remainder of this sweep as a result. Flagging for
  whoever configures the next session: either ensure `browser_handle_dialog` (or an
  equivalent auto-dismiss option) is available, or budget for exactly this failure mode
  whenever a sweep target has `guard`/`beforeunload` and the probe plan includes leaving a
  dirty, guarded form via navigation.

## 6. Not covered (budget / tooling)

- **Everything downstream of the `beforeunload` wedge** (§5's last note) — the browser
  became unusable roughly two-thirds through the planned browser-pass list. Specifically
  not completed in the real browser: Profile's async `defaultValues` pending-disable state
  and "Reload from server" `keepDirtyValues` re-sync, Profile's `LoadFails`
  `onDefaultValuesError` story, SignUp's `WrongCode`/`Verified` async paths, Checkout's
  `CascadingRegionOptions` and `OrderPlaced` full confirm-then-submit real-browser walk,
  Insurance's `Agent` mode (`assisted`, no confirm/guard) and `Vertical`/`Page` layouts,
  Loan's `WithCoApplicants`/`HighDti` `FieldArray`-heavy stories, and reduced-motion /
  dark-mode / Modern-theme-toggle screenshots for any example. None of these were "found
  broken and skipped" — they were simply never reached once the session's one browser tab
  stopped responding to any tool call. The two filed findings (#124, #125) were both
  confirmed independently via vitest probes as well as the real browser, so neither depends
  on further browser access to stand; anything in this list is a genuine gap, not a
  soft-pass.
- **Double-submit for the examples group specifically** was not re-derived from scratch —
  argued from `Checkout.test.tsx`'s own existing precise assertion plus the Form sweep's
  general #101 fix, both already covering the same re-entrancy guard every example's submit
  path goes through with no per-example override. A fresh vitest probe attempting this
  produced `act()` warnings traced to the probe's own typing speed, not a real regression
  (see the checklist table); not worth re-deriving what the existing suite already proves.
- **`NODE_ICU_DATA` / locale sensitivity beyond the one `Español` story** — not
  independently probed; the examples group's only locale-formatted output is `Intl`-backed
  currency formatting in `Checkout`/`Loan`/`Insurance`'s own `format` callbacks
  (`toLocaleString('en-US', …)`, hardcoded to `en-US` deliberately, by the examples' own
  design — a real app would parameterize this), which is consumer code, not a component
  concern this sweep's target owns.
- **Reduced motion / dark mode / Modern-theme-toggle** for any example — planned but not
  reached before the browser wedge; no example-specific `sx`/literal was spotted by
  inspection that would make this group's own risk higher than the Form/Wizard sweeps'
  already-clean findings for the same theme mechanisms, but this is an inference, not a
  verified pass.

## 7. Duplicates checked, none found

`gh issue list --repo sernstberger/ez-form --label qa --state all --limit 200` reviewed in
full before filing, plus targeted searches for `"Submitted"`, `"announce"`, and
`"LocalizationProvider"` in the qa-labeled backlog. No existing issue covers either finding
here. (Two searches surfaced adjacent-sounding but unrelated issues — #74, "guard's
beforeunload warning re-arms after a successful submit," and #104, "TextField consumer
slotProps/aria-describedby/rest-spread" — neither overlaps #124's announce-content bug or
#125's missing-provider crash; not commented on, since neither is a duplicate.) Filed as
#124 and #125, new.
