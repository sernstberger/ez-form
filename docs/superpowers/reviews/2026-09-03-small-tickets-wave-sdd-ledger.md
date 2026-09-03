# 2026-09-03 small-tickets wave — SDD ledger

Started from a clean `main` (401b66e) with the post-v5 backlog. Subagent-driven, one worktree per
issue under `.worktrees/issue-<n>`, one review per task, merged to `main` as each review came back
clean. Per-task briefs, reports and reviews live in `.superpowers/sdd/2026-09-03-small-tickets-wave/`.

## Outcome

| Issue | What landed | Review | Merge |
|---|---|---|---|
| #93 | FieldArray announces the post-update row count (`getValues` in the handler) | clean | ab06329 |
| #92 | Phone/Ssn/Fein keep the consumer ref in callback-form `slotProps.htmlInput` via ez TextField's internal `inputRef` | clean (+1 comment fix) | c9f4a13 |
| #94 | SignUp example models `<LiveRegion>` | clean | eb8a985 |
| #90 | one shared `ChipDeleteIcon` (named, 24×24) for Autocomplete `multiple`, EmailListField, FileField | clean | 3f980b1 |
| #96 | PasswordField, same fix as #92 | clean | f0af08d |
| #95 | Storybook chunk limit stays; the warning gate was **never wired** (Vite 8 drops a `rollupOptions` override when `rolldownOptions` exists) — now on `rolldownOptions`, reporter advisories forwarded | changes → clean | d5d8f22 |
| #25 | Storybook `form` parameter per-story overrides with documented merge semantics | clean | 8054d34 |
| #21 | Google Places: `AddressLookupProvider` seam, `useAddressLookup`, AddressField `lookup` prop (freeSolo street combobox), zero-dep `googlePlaces()` adapter over Places API (New) REST, `WithGooglePlaces` story | A: changes → clean; B: clean; C: gates only | 03d3c8f, a74bc91, 81dbb1d |
| #10 (+#11) | opt-in `createEzFormTheme` preset adapted from MUI's dashboard template, reduced motion, `DESIGN.md` as the agent-readable form, Storybook toggle Modern / Modern (dark) / Stock MUI | clean | bdf2066 |
| #23 | `enUS`/`esES` locale objects shaped like MUI's; rule messages as `EzForm.defaultProps.messages`; Insurance Español story | changes → clean | 627e723 |
| #43 | closed without code: peers stay plain deps (Steve) | — | — |
| #91 | skipped: eslint-plugin-react-hooks 7.1.1 is installed and latest; nothing to re-enable | — | — |

Filed: #96 (done above), #97 (stories repeat the meta schema), #98 (FormErrorSummary items for
Base UI fields render `<a>` without `href`).

## Rulings

- Ruling: skip #91 this wave — upstream 7.1.1 is installed and latest — cost if wrong: a lint rule off one wave longer.
- Ruling: #93 reads the count from `getValues(name)` in the handler, no effect/ref — RHF writes `_formValues` synchronously on append/remove — cost if wrong: batched tests catch a future change.
- Ruling: #92/#96 route the hook ref through an `@internal` `inputRef` on ez TextField and let MUI's `useSlot` + `InputBase` fork it — a hook cannot run inside MUI's slot callback — cost if wrong: an undocumented prop leaks (same as `componentName`).
- Ruling: one `EzChipDeleteIcon` slot replaces three per-field copies; FileField's `Close` glyph becomes MUI's default `Cancel` — cost if wrong: an icon prop later.
- Ruling: #95 keeps `chunkSizeWarningLimit: 1500` — the three oversized chunks are single pre-bundled Storybook/axe modules; Vite's advisory names no chunk so a per-chunk allow-list is inexpressible — cost if wrong: ~20% headroom before the now-visible advisory.
- Ruling: `onwarn` goes on `build.rolldownOptions` in Storybook's `viteFinal`; the library config stays on `rollupOptions` where the alias works — cost if wrong: a future Vite fails `pnpm build` loudly.
- Ruling: #21 is a `lookup` prop on AddressField, not a new field — one value shape, manual entry stays — cost if wrong: a single-input variant on the same seam.
- Ruling: Google transport is REST fetch, zero deps; Places API (New); the field owns the session token as an opaque ≤36-char string — cost if wrong: a loader-based provider on the same seam.
- Ruling: adapter exported from the main entry; no subpath (#43 closed) — cost if wrong: trivial move.
- Ruling: ez `Autocomplete` stores `''` (not `null`) when a single `freeSolo` field is cleared — freeSolo text is a string; keeps RHF's validation mode intact without re-implementing it — cost if wrong: a freeSolo consumer expecting `null` (none in-repo).
- Ruling: on a pick, `street` is `parts.street ?? suggestion.label`; every other rendered part is written, absent → `''` — cost if wrong: none identified.
- Ruling: #43 closed — peers stay as-is before first publish (Steve) — cost if wrong: reopen when a consumer asks.
- Ruling: #10 preset = MUI dashboard template primitives + stacked labels via theme + reduced motion + `DESIGN.md`; #9 (a real stacked variant) stays separate — cost if wrong: one L ticket unchanged.
- Ruling: naming a colour scheme pins the preset to it; naming none follows the OS (MUI's `ThemeProvider` uses its own `defaultMode`) — cost if wrong: a `defaultMode` prop on the consumer's provider.
- Ruling: #23 has no `ez-form/locales` subpath; `enUS`/`esES` export from the main entry — cost if wrong: trivial move.
- Ruling: rule messages travel through a `RuleMessagesContext` from `EzForm.defaultProps.messages` to `ezResolver`/fields — least-invasive theme-reachable path — cost if wrong: a provider wrapper later.
- Ruling: #21C had no separate review (story + type declaration; gates green; Steve called wind-down) — cost if wrong: a story bug.
- Ruling: the whole-branch final review was skipped at Steve's wind-down; gates on `main` (typecheck, lint, guardrails, 1564 tests, prettier) stand in — cost if wrong: an integration issue between #21, #23 and #10 that a per-task review could not see.
- Ruling (process): subagents pin `model` — Opus implementers, Sonnet reviewers; Fable only in the main session — cost if wrong: more review round-trips.
- Ruling (process): exactly one Storybook, port 6006, from `main` — cost if wrong: none.

## Open for Steve

- Verify the live Google round trip once on 6006: Fields/AddressField → WithGooglePlaces, type `1600 Amphitheatre`.
- Taste on the preset: neutral-gray contained button vs brand blue; stock vs redrawn checkbox/radio glyphs; borders vs shadows on Dialog/Menu.
- Test suite under parallel load: several example tests (Loan, Insurance, FormDialog axe) tripped the 5 s cap or OOM'd when three lanes ran suites at once; all pass alone. Candidate for #47.
