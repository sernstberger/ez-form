# QA sweep #47 — AddressField / FileField / ReadOnlyField (last unswept group)

Date: 2026-09-06. Status: **one new confirmed break, filed as #132; everything
else checked either already fixed by a prior wave (#118/#121/#102/#104/#122),
already covered by an existing test, or a verified platform/upstream baseline
not specific to ez-form.**

Method: vitest probes in the gitignored `src/__qa__/` scratch area (all
deleted at the end; `git status --short` clean apart from the pre-existing
untracked `rtl.png`), a Storybook + Playwright MCP browser pass for the
layout/viewport lines, every finding reproduced twice, baseline-compared
against plain MUI before assigning blame.

Target: `AddressField` (+ `src/address-lookup/`, the Places/lookup provider
and Autocomplete-backed street search), `FileField` (button and `dropzone`
modes), `ReadOnlyField` (display + Edit affordance). Stories covered:
`fields-addressfield--*` (7), `fields-filefield--*` (8),
`fields-readonlyfield--*` (3), plus `wizard--horizontal` for the Edit-button
focus-destination check.

## Browser tooling note

The shared Playwright MCP session this run returned stale/unresolvable
element refs for anything inside the Storybook preview `<iframe>` — both via
the wrapped `/?path=/story/...` UI and via direct `/iframe.html?id=...`
navigation; a `browser_snapshot` would list refs (`f68e40`, …) that the very
next `browser_click`/`browser_type` call reported as "does not match any
elements." Worked around by driving all interaction through
`browser_evaluate` (native `HTMLInputElement` value setter + `dispatchEvent`,
`button.click()`) instead of ref-based actions; MUI `Select`'s listbox would
not open via synthetic `MouseEvent` dispatch (needs a real trusted pointer
event), so the one screenshot-only check (360px layout) used a story with no
`Select` in the click path. Everything state-bearing was moved to vitest
probes per the dispatch's own guidance for exactly this failure mode.

## 1. Confirmed break: filed

**#132 — AddressField: a failed `lookup.resolve()` is silent to the user,
only `console.warn`** (P2, `area: fields`)

Picking a lookup suggestion whose `resolve()` rejects (network error,
provider outage) leaves the street's typed/picked text in place (correct, no
data loss) but never fills city/state/zip, and produces **no user-visible
signal at all** — only a dev-console warning. The field's own
`AddressFieldStatus` live region (already wired for a *successful* fill via
`lookupFilledText`) stays silent on failure. This is checklist line 1's
"round-trip or be rejected with a message" failure mode: a careful user
believes they picked a complete address; the form silently holds an
incomplete one until a later validation pass (if any) catches the empty
city/state/zip.

Notable: this exact behavior — "warn once, leave the picked label, fill
nothing else" — is *already* deliberately implemented and has first-party
test coverage in `AddressField.test.tsx` (`'a failed resolve warns once and
leaves the picked label in place'`, `'a failed search warns and offers
nothing'`), including an assertion that nothing is announced
(`expect(screen.queryByText('Address filled')).toBeNull()`). The gap this
sweep found is that the *documented, tested* status quo is itself the
checklist failure — not an untested corner.

Repro (vitest probe, run twice, both reproduced identically):

```tsx
const failingResolveProvider: AddressLookupProvider = {
  search: async () => [{ id: '1', label: '100 Main St', secondary: 'Springfield, IL' }],
  resolve: async () => { throw new Error('boom: provider resolve failed') },
}
// pick "100 Main St" from the listbox
// -> street shows "100 Main St" (correct), city/state/zip stay '' (correct-per-design)
// -> status live region textContent === '' (the gap)
// -> only console.warn, never surfaced in the UI
```

## 2. Checked, confirmed clean (no finding)

| Area | Check | Result |
|---|---|---|
| AddressField | Nested-path errors land on the right part after a failed submit | Already covered by `describeFieldContract` + composite-specific cases in `AddressField.test.tsx`; not re-litigated. |
| AddressField | `street2={false}` drops the key from the value and from a lookup fill | Already covered (`'street2={false} hides the second street line and drops it from the value'`, `'a hidden street2 is never written'`). |
| AddressField | `disabled`/`required` cascade to every part; lookup street included | Already covered (`'disables every part under <Form disabled>'`, `'required and disabled reach the lookup street'`). |
| AddressField | Slow/failing search: abort-on-fast-typing, network error, empty result | Already covered (`'a newer query aborts the older one and drops its late result'`, `'an empty query clears the list…'`, `'a failed search warns and offers nothing'`). |
| AddressField | Autocomplete tokens per part (`address-line1`, `postal-code`, …) | Verified via `token()`/`resolveAutoComplete` composition in source; per-part tests assert the rendered `autoComplete` attribute. |
| AddressField | Axe with the listbox open (incl. the portaled popper, separately) | Already covered (`'has no accessibility violations with the list open and attributed'`) — passing. |
| AddressField | RTL: the lookup listbox opens and stays axe-clean under `dir="rtl"` | **New probe, clean** — `createTheme({ direction: 'rtl' })` + `dir="rtl"` wrapper; listbox opened, option matched, axe clean on both `container` and the portaled popper. Run once (unambiguous pass, no flake risk in this assertion shape). |
| AddressField | Keyboard-only pick (ArrowDown + Enter), Escape closes | Already covered (`'ArrowDown + Enter picks; Escape closes the list'`). |
| AddressField | Narrow viewport (360px): four/five-part grid collapses to one column | **New check, clean** — screenshot at 360×800 on `fields-addressfield--with-lookup`; single-column stack, no clipping or overlap, matches the `AddressFieldRoot` grid's `theme.breakpoints.up('sm')` rule exactly. |
| FileField | Drop a file in button mode (no `dropzone`) | **New probe, clean-by-design** — no `onDrop`/`onDragOver` exists anywhere in the tree without `dropzone`; a `fireEvent.drop` on the picker button produces no `onChange` call and no chip. Matches MUI's own documented button+hidden-input upload pattern, which has no drop handling either — not a finding. |
| FileField | Drop multiple when `multiple` is false | Already covered (`'single: a multi-file drop keeps only the first'`). |
| FileField | `maxSize` rejection; `accept` rejection by extension and by declared MIME | Already covered for both; **new probe** for the specific "content vs. declared type/extension mismatch" (a `.pdf`-content file named `.png` with `type: 'image/png'`, and vice versa) — both pass `accept` checks, confirmed **upstream/platform**: `matchesAccept` (and the native `<input accept>` it mirrors) can only see the extension and the browser-supplied `File.type`, never the real bytes, and no MUI component exists to baseline against (there is no sniff-resistant path in the File API at all). Not filed. |
| FileField | `maxFiles` exceeded across two picks | Already covered (`'maxFiles: counts what is already stored and rejects the whole drop'`). |
| FileField | Delete a chip via keyboard; `onChange(event, value)` shape | Already covered (multiple existing cases use `getByRole('button', { name: 'Remove …' })` + keyboard). |
| FileField | Same file picked twice | Already covered (`'fires change again when the same file is picked twice'`). |
| FileField | Zero-byte file: `required` + `maxSize` both treat it as present | **New probe, clean** — a zero-byte `File` satisfies `required` (a `File` object is always truthy regardless of `.size`) and correctly submits; verified via `onSubmit`, not just DOM presence. |
| FileField | `renderFile` returning a Fragment | Not separately probed — the render path always wraps whatever `renderFile` returns in its own keyed `<Fragment>`, and React fragments nest without incident; low enough risk given the time budget that a dedicated probe was not added. |
| FileField | Drag-over state class toggling; its theme override on a non-inherited property | Already covered, exactly matching #121's own audit pattern (`letterSpacing` on `dragActive`, not `borderColor`/`backgroundColor`). |
| FileField | Focus after chip delete (where does it land?) | **New probe: focus falls to `<body>`** after deleting the only/last-focused chip's delete icon — **verified upstream**: an equivalent plain MUI `Chip` list (a home-grown `deleteIcon` given the identical `role="button"`/`aria-label` treatment ez-form's own `ChipDeleteIcon` uses, zero ez-form code involved) reproduces the exact same `<body>`-focus outcome. React/MUI provide no focus-restoration-on-removal behavior anywhere in this codebase (`EmailListField`'s chip delete was already checked clean-of-a-*worse*-outcome in the prior text-fields sweep, same underlying gap). Not filed as an ez-form-specific bug; noted in #132's "Not in scope" section for visibility. |
| FileField | Axe in both modes (button, dropzone) | Already covered (`'has no axe violations with the zone rendered'` and the base suite's own axe case). |
| ReadOnlyField | Value types: string/number/boolean/array/null/undefined/Date/File | Already covered exhaustively (`display()`'s branches all have direct tests, including the mixed-array composition case that guards against `[object Object]`). |
| ReadOnlyField | Edit control's accessible name | Already covered (`editAriaLabel`, default `` `Edit ${label}` ``, tested). |
| ReadOnlyField | Where does focus go on Edit (inside a Wizard)? | **New probe** — focus lands on the destination step's `<h3>` heading, not the specific field. Verified this is **`Wizard`'s own deliberate, uniform step-change behavior** (`WizardStep`'s `headingRef`/`focusMe` mechanism fires identically for Next/Prev/stepper navigation, confirmed by reading `Wizard.tsx`'s `go()`/`focusRequest` machinery) — not a `ReadOnlyField`-specific gap. Not filed; this is the Wizard's existing, tested contract applied consistently. |
| ReadOnlyField | `disabled` vs read-only semantics | N/A by design — `ReadOnlyField` renders `Typography`, never an input; there is no disabled state to have (a static display has no interactive control to disable, aside from the Edit button, which already has its own `disabled`-adjacent "hidden when meaningless" rule for `layout="page"`, already tested). |
| ReadOnlyField | Theme `Ez*` slots reach every documented element | **New probe, clean** — `root`, `header`, `label`, `value`, and `edit` (rendered inside a Wizard so the Edit button exists) all pick up a `letterSpacing` override from `theme.components.EzReadOnlyField.styleOverrides`; run twice, both clean. No #121-style inert slot here. |
| ReadOnlyField | Axe | Already covered, both `name` and `value` modes. |
| ReadOnlyField | Long values wrapping | Not independently probed — `Typography` with no `noWrap`/`overflow` styling in source (grep-confirmed), so long text wraps by the browser's normal block-level default; no literal in `src/` prevents it. |

## 3. Baseline comparisons made

- FileField `accept` extension/MIME mismatch: matches native `<input
  accept>`'s own inherent limitation (no content sniffing possible from the
  File API) — no MUI component exists in this space to compare against
  directly; scoped as platform-inherent, not filed.
- FileField chip-delete focus loss: reproduced identically with a bare MUI
  `Chip` + a hand-labelled `deleteIcon` (matching ez-form's own
  `ChipDeleteIcon` pattern exactly), zero ez-form code involved — confirmed
  upstream/consumer-owned, not an ez-form regression.
- ReadOnlyField Edit-button focus destination: confirmed as `Wizard`'s own
  uniform navigation-focus contract (heading-first, same for every
  navigation trigger), not something `ReadOnlyField` controls or should
  override on its own.

## 4. Duplicates checked, none found

`gh issue list --label qa --state all --limit 200` reviewed in full. Do-not-
refile list from the dispatch respected: #118/#121 (FileField ARIA + inert
styleOverrides, re-verified still fixed, §2), #102/#104 (describedby family-
wide, not re-litigated here), #122 (Enter-submits-once/focus-first-invalid,
not re-probed for this group per the dispatch's own note that it already
covers AddressField's nested paths), #128 (Storybook opt-out, not
encountered — no story in this group sets `parameters.form: undefined`).

## 5. Issues filed

- **#132** — AddressField: a failed `lookup.resolve()` is silent to the
  user, only `console.warn` (P2, `area: fields`).

## 6. Out of scope / not this group

- None observed outside the target group this sweep — the Playwright
  friction (§ browser tooling note) consumed time that would otherwise have
  gone toward a live-browser pass of other groups, but no cross-group defect
  was seen.
