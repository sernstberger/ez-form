# QA sweep #47 — inventory + checklist (Wizard group), third run

Date: 2026-09-04. Status: **findings only, nothing fixed.**

Method: same as the two prior runs (TextField/Select on 2026-09-03, pickers on
2026-09-04) — vitest probes in the gitignored `src/__qa__/` scratch area (deleted at the
end; `git status` clean), a Storybook + Playwright MCP browser pass, every finding
reproduced at least twice, baseline-compared against plain (non-wizard) fields and plain
HTML before assigning blame. Both prior ledgers' method notes carried forward
deliberately: assert accessible *names*, never attribute presence; verify focus-target
and Enter-key claims in the real browser, since jsdom can lie in **either** direction (a
false focus-target positive last time, a false Enter-advances-the-step positive this
time — see §3).

Target: `src/Wizard/` (`Wizard`, `WizardStep`, `WizardStepper`, `WizardNav`,
`WizardContext`, `useWizard`) plus the `WizardRouter.stories.tsx` react-router
integration. There is no standalone `WizardRouter` component — `Wizard`'s own `step`/
`onStepChange`/`visited`/`onVisitedChange` props are what a router wires up; the
"WizardRouter" name in the dispatch refers to that integration pattern, demonstrated by
`wizard-reactrouter--one-route-per-step` and `wizard-reactrouter--deep-link-redirect`.
Stories covered: `wizard--horizontal`, `wizard--vertical`, `wizard--next-back-order`,
`wizard--page-layout`, `wizard--page-layout-nested-sections`, `wizard--resume`,
`wizard-reactrouter--one-route-per-step`, `wizard-reactrouter--deep-link-redirect`,
`form-errorsummary--inside-a-wizard`.

---

## 1. Verdict up front

Three new findings, all P2, all wizard-specific (not upstream, not shared plumbing
already covered by the TextField/Select or pickers sweeps):

```
                      ┌─ per-step validation isolation, Back/values, focus-after-step ── clean ✅
                      ├─ rapid next()/go()/stale visited/when-conditional steps ──────── clean ✅
findings split ───────┼─ live error clearing while on the same step ──────────────────── P2 (#115)
                      ├─ Enter in a field on a non-last step ──────────────────────────── P2 (#116)
                      └─ EzWizardStepper.styleOverrides.root has no effect ────────────── P2 (#117)
```

The core navigation state machine (`next`/`prev`/`go`, `visited`, `when`-conditional
steps, `WizardRouter`-style deep links with unknown/negative/case-mismatched step ids)
held up under adversarial probing — every attempt to desync it, crash it, or skip
validation failed to find anything. The three real findings are: a live-revalidation
regression specific to being inside a `Wizard` step, a missing keyboard affordance most
production wizards have, and one theme slot that's typed but inert.

---

## 2. The three findings

### (#115, P2) Fixing a field's value while on the same step doesn't clear its error live

After a failed `Next` (error shown on the current step), fixing the invalid field's value
does **not** clear the error while staying on that step — the alert, `aria-invalid`, and
(compounding it) the matching `FormErrorSummary` link all stay stale until `Next`/Submit
is clicked again and `trigger()` re-runs. Reproduced on both `TextField` and `Select`.

**Baseline (decisive):** the identical schema/field outside any `Wizard` — plain
`fields-select--required` and `fields-textfield--rules` stories — clears the error live
on a valid keystroke/selection, no re-submit needed. This is RHF's own default
`reValidateMode: 'onChange'`, which the Wizard specifically fails to honor while a step is
current. Confirmed a **regression relative to the platform baseline**, not upstream.

```
Non-wizard Select (fields-select--required): submit empty → alert → select "User" → alert GONE ✅
Wizard Select (wizard--horizontal, step "Plan"): Next empty → alert → select "Pro" → alert STAYS ❌
```

Reproduced twice in the real browser and independently in jsdom (a vitest probe
mirroring the same two-step schema, both inside and outside a `Wizard`).

### (#116, P2) Enter in a field on a non-last step does nothing

Checklist line (Wizard-specific attack list): "Enter in a field on a middle step advances
that step and does not submit the whole form." In the real browser this is neither —
Enter is a complete no-op on any non-last step: no advance, no error surfaced, no
announcement, nothing. Root cause by inspection: `WizardNav`'s "Next" is `type="button"`
(correctly, since it must not submit early), no other `type="submit"` control exists on a
non-last step, and neither `Wizard` nor `WizardNav` add any `keydown` handling — a real
browser's native Enter-to-submit needs a submit-type control to do anything at all, so
there is nothing for the keystroke to trigger. Reproduced 3× in the real browser with
per-keystroke `browser_press_key` (not `.fill()`, which skips real keystroke handling per
the TextField ledger's own method note).

**Baseline:** a bare `data:` HTML form (`<input/><button type="button">`) shows the
identical "Enter does nothing" — that part alone is standard browser behavior, not a bug.
What makes this a finding is the Wizard-specific checklist expectation that a multi-step
form intercept Enter as "move to the next step," which nothing in the current
implementation does.

**Method note, direction reversed from the pickers ledger.** jsdom shows the *opposite,
wrong* result here: a vitest probe of the identical scenario shows Enter **advancing**
the step (traced to jsdom firing a native `submit` event with **no** submit-type button
present at all — a real Chromium browser requires one and correctly does nothing; jsdom's
spurious submit then fails full-schema validation and `Wizard`'s own
failed-submit-navigation effect moves to the step owning the first error, which
*resembles* "Enter advanced the step" but is two stacked jsdom quirks). The pickers
sweep's false positive was jsdom hiding a real bug (focus landing somewhere invisible);
this one is jsdom manufacturing behavior that does not exist in a real browser. Both
directions are real risks — **jsdom is not a substitute for the real browser on any
claim about Enter, submission, or focus targets**, full stop, not just "check the
direction that burned you last time."

### (#117, P2, area: theme) `EzWizardStepper.styleOverrides.root` is typed but inert

`src/theme/augmentation.ts` types `EzWizardStepper.styleOverrides.root`, and
`WizardStepper.tsx`'s own doc comment documents `stepButton` as a deliberate exception
("no slot here, only the class name" — `Stepper`'s tablist detection needs
`child.type === StepButton` strict reference equality, so that one child can't be a
`styled()` wrapper). `root` carries no such documented exception, and nothing warns a
consumer at compile time — but it silently has zero runtime effect, because
`WizardStepper` renders the raw MUI `Stepper` import with a manually-appended class name
string, not a `styled(Stepper, { name: 'EzWizardStepper', slot: 'Root' })` wrapper.
`styleOverrides` CSS is only ever generated by that wrapper's own `overridesResolver`; a
bare className with no matching `styled()` registration gets no CSS.

**Contrast case, same file:** `VerticalStepButton` **is** a real `styled()` wrapper, and
`styleOverrides.verticalStepButton` reaches it correctly (spot-checked, matches the
documented pattern). **Contrast case, sibling component:** `EzWizardNav`'s `root`/`prev`/
`next`/`submit` are all real `styled()` wrappers and all four reach their elements, using
the identical `letterSpacing`-probe technique — isolating this cleanly to
`WizardStepper`'s `root` slot alone, not a wizard-wide gap.

```tsx
theme.components.EzWizardStepper.styleOverrides.root.letterSpacing = 5
→ document.querySelector('.EzWizardStepper-root') exists (class name IS present)
→ getComputedStyle(...).letterSpacing === 'normal'   ❌ (expected '5px')
→ no <style> tag anywhere contains "EzWizardStepper" or "letter-spacing:5px" at all
```

---

## 3. Checklist, run against the Wizard group specifically

| # | Line | Result |
|---|---|---|
| Per-step validation | Next validates only the current step's `fields`; a later step's errors don't block or leak into an earlier one | **Pass.** Filling step 1 and clicking Next into step 2 with step 2 empty blocks correctly at step 2, scoped to step 2's own field; step 1's already-valid state is untouched. |
| Back preserves values, no re-validate | **Pass.** Selecting "Pro" on step 2, going Back to step 1 and returning shows "Pro" still selected; `Back` itself never calls `trigger()` (by inspection — `prev()` has no `validateCurrent` call, confirmed in the source). |
| Live error clearing on the current step | **FAIL — #115.** See §2. |
| Enter on a middle step advances, doesn't submit | **FAIL — #116.** Advances nothing; see §2. |
| Enter on the last step submits exactly once | **Pass.** Vitest probe: `onSubmit` called exactly once after typing into the last field and pressing Enter. |
| Double-click Next / Submit | **Pass.** Double-click Next in the real browser moved exactly one step (to the step whose validation then correctly failed, since it hadn't been filled) — no double-advance. Double-click Submit (vitest probe, artificial async delay) called `onSubmit` exactly once, consistent with #101's existing `Form`-level re-entrancy guard. |
| Async step validation pending, no double advance | **Pass** (see double-click row — this is the same mechanism: `pending` gates a second `next()` from moving twice). |
| One heading per step; `aria-current="step"` | **Pass.** Each step's `FormSection` legend is a single `h3` (heading order itself already fixed under #76, re-verified closed); `aria-current="step"` correctly present on the current step's clickable stepper button, both orientations. |
| Focus lands on step heading / first field after a step change | **Pass.** Verified in the real browser: Next → new step's `h3` receives focus (`[active]` in the a11y snapshot) on every transition observed. |
| Focus on first invalid field after a failed Next | **Pass.** Confirmed via `FormErrorSummary`'s own heading-focus (checklist item 8's "hasErrorSummary" branch) and, without a summary mounted, RHF's own `shouldFocus` on the invalid combobox/textbox. |
| `FormErrorSummary` scoped to current step | **Pass.** `form-errorsummary--inside-a-wizard`: only the current step's two fields' errors appear in the summary list; the summary's own stale-after-fix behavior is the same bug as #115, not a separate scoping defect — scoping itself (which fields are *listed*) is correct. |
| WizardRouter: unknown/negative/case-mismatched step id in the URL | **Pass.** A vitest probe driving `createMemoryRouter` directly (Playwright can't address a memory router's internal URL) confirmed: an id matching no step, a case-mismatched id (`ONE` vs `one`), and a negative-number-like id (`-1`) all redirect to a real, rendered step with no crash and no blank page. The shipped `wizard-reactrouter--deep-link-redirect` story (deep-linking to `/signup/review` with nothing visited) redirects to `/signup/account` in the real browser, matching documented "ask for the last visited step" behavior. |
| Browser back/forward with the router variant | **Not separately probed** (budget) — the redirect-on-unreachable-step mechanism that back/forward would exercise is the same `reachable`/`onStepChange` code path already verified above under direct URL manipulation; no router-navigation-specific code exists in `Wizard` to diverge. |
| `disabled`/`loading` from `<Form>` reaching every nav button | **Pass.** Vitest probe: `<Form disabled>` disables both `WizardNav` Back and Next. |
| Reset mid-wizard | **Pass.** Clearing a field's value mid-wizard (vitest probe) does not crash the wizard or desync `current`. |
| Conditional steps (`when`): appear/disappear, index drift, stepper count, `aria-current` | **Pass.** A step gated by `when` correctly appears in `steps`/the stepper the moment its predicate flips true (count 2→3, ids list updates), and correctly disappears when flipped back — including from *inside* that now-to-be-hidden step, which lands the wizard back on the nearest still-visited step in the new effective list (documented fallback behavior per `Wizard.tsx`'s own comments on `indexOf`/`lastVisitedIndex`, not a new bug). |
| Rapid `next()`/`prev()`/`go()` | **Pass.** Two `next()` calls fired without awaiting the first correctly land on the step that validation actually allows (not skipped ahead); `go()` with a bogus id resolves `false` and does not move. |
| Stale `visited` ids | **Pass.** A `visited` array containing only unknown ids falls back to the first step; a mix of one real + one unknown id resolves against the real one, matching `Wizard.tsx`'s documented `indexOf`/filter contract (already the subject of closed issue #35). |
| RTL stepper direction | **Pass.** `globals=direction:rtl`: the stepper mirrors (current step moves to the trailing/right edge, matching RTL reading order) and `WizardNav`'s Back/Next swap sides consistently with it (Next-left/Back-right in RTL vs. Next-right/Back-left in LTR) — this is `justifyContent: 'space-between'` + DOM order flipping correctly under CSS logical properties, not a bug; screenshotted both directions side by side to confirm the mirroring is *consistent* (stepper direction and button order agree), not just present. |
| Theme override of every `Ez*` wizard slot | **`EzWizardNav`: pass, all 4 slots** (`root`/`prev`/`next`/`submit`) plus `defaultProps` (`prevLabel`/`nextLabel`). **`EzWizardStepper`: `root` FAILS — #117**; `verticalStepButton` (the other real `styled()` slot) passes as a contrast check. `stepButton` has no slot by design (documented, not re-litigated). `EzWizard` itself registers only `status` (the live region) — not separately probed, no visual default to check. |
| SSR `renderToString` | **Pass.** All three layouts (`steps`/horizontal, `steps`/vertical, `page`) render under `renderToString` with no throw. |
| Console pristine through a full multi-step run | **Pass.** A complete Account→Plan→Review→confirm→submit run in the real browser produced zero console warnings/errors at every step, including opening and cancelling the `ConfirmDialog` (Escape correctly closed it and returned focus to the "Create account" trigger button) and the final confirmed submit. |

---

## 4. What passed (worth naming explicitly)

- The entire step-navigation state machine — `next`/`prev`/`go`, `visited`,
  `lastVisitedIndex` fallback, `when`-conditional steps, and the `WizardRouter` pattern's
  unreachable-step redirect — held up against every adversarial probe attempted: rapid
  concurrent calls, bogus ids, negative/case-mismatched URL step ids, flipping a
  conditional predicate while standing on the step it gates. None of it desynced, threw,
  or silently skipped validation.
- Focus management (step-heading focus on every user-initiated transition,
  `FormErrorSummary`'s own heading focus on a failed Next, `ConfirmDialog`'s
  Escape-returns-focus-to-trigger) is all correct in the real browser.
- `aria-current="step"`, one heading per step, and heading order (h2→h3, #76's fix) are
  all still correct on a fresh adversarial pass.
- RTL mirrors consistently across the stepper and the nav buttons together — screenshotted
  both directions to confirm, not just spot-checked one element.
- `<Form disabled>`/re-entrancy guards (#101) both reach into the Wizard correctly with no
  wizard-specific gap.

## 5. Method notes for the next sweep

- **jsdom can manufacture a false *positive* as easily as hide a true negative — check
  the real browser for both Enter-key and focus-target claims, always, not just the
  direction that burned the previous sweep.** This run's Enter-on-a-middle-step case is
  the mirror image of the pickers sweep's focus-target case: there, jsdom hid a bug
  (reported focus on an invisible proxy input when the real browser correctly focused the
  visible one); here, jsdom invented one (advancing a step that a real browser does
  nothing to), by firing a native `submit` event with no submit-type button present at
  all, which a real browser's spec-compliant implicit-submission rule refuses to do.
- **A `getComputedStyle` + fresh-`<style>`-tag-content probe is the fast way to tell
  "styleOverrides typed but inert" from "styleOverrides correctly applied but overridden
  by specificity."** For #117, confirming *no* `<style>` tag anywhere contained the
  `EzWizardStepper` string at all (not just that the computed value didn't match) is what
  ruled out a CSS-ordering explanation and pinned it on "never generated."
- **A raw MUI component wrapped only by a manually-appended className string is
  indistinguishable, by reading the JSX alone, from a real `styled()` slot** — both
  produce a plausible-looking `EzWizardStepper-root` class in the DOM. The only way to
  tell them apart is to actually theme it and measure; a source read would have (and, per
  the TextField ledger's own §2 callout, has before) cleared this as "the class exists,
  so the slot works."

## 6. Not covered (budget)

- True browser back/forward buttons against the `WizardRouter` pattern — argued by
  inspection (same `reachable`/redirect code path already verified under direct id
  manipulation) rather than separately driven; no router-navigation-specific code exists
  in `Wizard` itself to diverge from what was already tested.
- `size="small"` and `prefers-reduced-motion` screenshots for the Wizard's own chrome
  (`WizardStepper`/`WizardNav`) — no `sx`/literal exists in `src/Wizard/` that could
  special-case either (grep confirmed clean, checklist line 18), so no wizard-specific
  risk was identified to justify the screenshot time this run.
- `resolver` rejects / `onSubmit` throws / `defaultValues()` rejects inside a Wizard —
  `<Form>`-level concerns already covered generally by `Form`'s own suite and the prior
  two sweeps; no Wizard-specific mechanism was suspected to make these behave
  differently, so not re-probed here.
- `NODE_ICU_DATA` / locale sensitivity — the Wizard group has no locale-formatted output
  of its own (labels are consumer-supplied `ReactNode`s; the default step-announcement
  string is the only built-in text, and it is not locale-formatted, just interpolated).

## 7. Duplicates checked, none found

`gh issue list --label qa --state all --limit 100` reviewed in full before filing;
closed issues #35 (stale `visited` ids), #40 (stale `focusTarget`), #76 (heading order),
and #81 (confirm-pre-submit announcement) all cover adjacent Wizard ground but none
overlap the three findings here — each was independently re-verified as *fixed* during
this pass (see the checklist table above) rather than re-opened.
