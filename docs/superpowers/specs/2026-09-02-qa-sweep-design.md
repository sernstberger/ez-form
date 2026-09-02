# QA sweep (#47) — design

Date: 2026-09-02. Decided with Steve: packaging **A** (persisted agent definition, the
session fans out), severity reuses `priority: P1–P3` plus a `qa` label, first run covers
everything in five groups.

## Shape

```
"run the QA breaker on <target|all>"
        │
        ▼
controller (this session)        ──▶  .claude/agents/qa-breaker.md  ×N in parallel
   picks groups + story ids              browser (Playwright MCP → Storybook :6006)
   passes scratch dir per agent          vitest probes in scratch (never committed)
        │                                 gh issue create … --label qa
        ▼
 reads N reports → ledger doc docs/superpowers/reviews/<date>-qa-sweep.md
 fix waves pull `label:qa`, P1 first
```

## Groups for the first sweep

| Group | Components | Stories |
|---|---|---|
| form | Form, SubmitButton, ClearButton, ConfirmDialog, useFormGuard | `Form/*`, `ClearButton/*`, `ConfirmDialog/*` |
| text | TextField, NumberField, MoneyField, OtpField | `Fields/TextField…OtpField` |
| choice | Select, Autocomplete, RadioGroup, Checkbox, CheckboxGroup, Switch, ToggleButtonGroup, Slider, Rating | `Fields/…` |
| pickers | DatePicker, TimePicker, DateTimePicker, FileField | `Fields/…` |
| wizard | Wizard, WizardStepper, WizardNav, WizardStep, ReadOnlyField | `Wizard/*`, `Fields/ReadOnlyField` |

## Contract

- One issue per confirmed break, task-template shape with a Repro section, labels `qa` +
  `area:*` + `priority:*`. Duplicates become comments on the existing issue.
- Breakers never modify `src/`; probes live in a per-agent scratch directory.
- Baseline comparison against plain MUI/hookform; upstream behaviour is tagged and P3.
- The sweep re-runs against every example form as #48's rungs land.

## Rulings

- Ruling: agent definition over Workflow script — Steve chose it; no opt-in per run and it
  matches the subagent-driven rule — cost if wrong: dedupe across agents is manual (the
  "existing `qa` issues" input mitigates).
- Ruling: `model: sonnet` in the agent — attack lists are mechanical once written — cost if
  wrong: subtle state bugs missed; escalate a group to a stronger model on re-run.
- Ruling: Playwright MCP against the running Storybook, no Playwright dependency added to
  the repo — cost if wrong: browser probes are not reproducible in CI; issues carry manual
  repro steps instead.
- Ruling (after the first sweep, Sept 2): the Playwright MCP browser is a single shared session,
  so five parallel breakers hijacked each other's tabs. Next sweep: run browser-heavy groups
  sequentially (or one breaker at a time per browser) and let vitest probes carry the parallel
  load — cost if wrong: a longer sweep wall-clock.
