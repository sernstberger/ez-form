# ez-form v4 design — wizard, confirmations, clear, read-only review

Date: 2026-09-02
Status: approved (sections reviewed with Steve in chat)

## Goal

Form-level behaviors that every real app hand-writes on top of react-hook-form:
a multi-step wizard (inline or one route per step), confirmation dialogs at the
moments that need them, a clear/reset button, an unsaved-changes guard, and a
read-only value display for review steps. v3's public API is unchanged except
for additions.

| New | Wraps | Needs `<Form>` |
|---|---|---|
| `Wizard`, `WizardStepper`, `WizardStep`, `WizardNav`, `useWizard` | MUI `Stepper` / `Step` / `StepButton` / `StepLabel` / `StepContent` | yes |
| `ReadOnlyField` | MUI `Typography` + `Stack` | yes |
| `ClearButton` | MUI `Button` | yes |
| `ConfirmDialog`, `useConfirm` | MUI `Dialog` | no |
| `useFormGuard` | — | yes |
| `Form guard` prop | `beforeunload` | — |
| `Form confirm` prop | `ConfirmDialog` | — |

## Decisions Steve made

- **One `<Form>`, many steps.** A single hookform instance and a single zod
  schema sit above every step. Next validates only the current step's fields
  (`trigger(fields)`); the whole schema runs on submit. Per-step forms and
  per-step `schema.pick()` were rejected.
- **Routing is the consumer's.** `Wizard` is controlled (`step` +
  `onStepChange`) or uncontrolled; no router peer. A react-router story shows
  one route per step. An optional adapter and a hard dependency were rejected.
- **All three confirmations**: before submit, before clear, and an
  unsaved-changes guard.
- **Clear means `reset()`** to `defaultValues`; `to="empty"` opts into blank
  values.
- **MUI Stepper**, horizontal and vertical.
- **Review step** gets a read-only component: small label above, larger value.

## Non-goals

- Persisting wizard values across a full page reload (consumer's job; the
  story shows the redirect that happens without it).
- Async per-step server saves. `onStepChange` is the hook for that.
- A `Dialog`-based wizard (modal). It composes from the same pieces.
- Free navigation to unvisited steps with error markers (rejected in favor of
  linear + back-to-visited).

## Facts this design rests on

- hookform's `trigger(names, { shouldFocus })` validates only `names` through
  the resolver (`options.names`), so `ezResolver` runs zod on everything but
  only reports and stores errors for the requested fields; the field rules in
  `ezResolver` already loop over `options.names`.
- `shouldUnregister` defaults to `false`, so a step's fields keep their values
  when the step unmounts (inline mode) or its route unmounts.
- MUI `Step` derives `completed` / `disabled` from `activeStep` only in linear
  mode; with `nonLinear` we own both via props, and `StepButton` gives visited
  steps a real button (`Step.js` lines 77–107 in MUI 9).
- MUI `StepContent` renders only under `orientation="vertical"`, collapsing
  inactive steps.
- `formState.isDirty` and `isSubmitting` are subscribable through
  `useFormState` without re-rendering the whole form.
- A `beforeunload` handler must call `event.preventDefault()` (Chrome ignores
  `returnValue` alone since 119).
- react-router 7's `useBlocker(shouldBlock)` returns
  `{ state: 'blocked' | 'unblocked' | 'proceeding', proceed, reset }`; that
  shape is what `useFormGuard` consumes and it is trivial to fake in tests.

## Section 1 — component map

```
src/
├─ Form/Form.tsx           + `guard` and `confirm` props
├─ ClearButton/            NEW
├─ ConfirmDialog/          NEW  ConfirmDialog + useConfirm
├─ useFormGuard.ts         NEW
├─ Wizard/
│   ├─ Wizard.tsx          context provider; step state
│   ├─ WizardStepper.tsx   MUI Stepper header (and vertical body)
│   ├─ WizardStep.tsx      renders children only when active
│   ├─ WizardNav.tsx       Prev / Next (Next on last step = SubmitButton)
│   └─ useWizard.ts        public hook
├─ fields/ReadOnlyField/   NEW
└─ index.ts                exports all of the above
```

Dependency rules: `Wizard`, `ClearButton`, `ReadOnlyField`, `useFormGuard`
call `useEzFormContext(name)` and throw outside `<Form>`, like `SubmitButton`.
`ConfirmDialog` / `useConfirm` are standalone. No new peer deps;
`react-router` is a devDependency used by one story.

## Section 2 — Wizard

### Types

```ts
export interface WizardStepDef<TIn extends FieldValues = FieldValues> {
  id: string
  label: ReactNode
  /** Field paths validated by Next. Omit for steps with nothing to validate (review). */
  fields?: readonly Path<TIn>[]
  /** Optional secondary text under the label (StepLabel `optional`). */
  optional?: ReactNode
}

export interface WizardProps<TIn extends FieldValues> {
  steps: readonly WizardStepDef<TIn>[]
  /** Controlled current step id. Omit for internal state. */
  step?: string
  /**
   * Called with the step the wizard wants to show: after Next / Prev /
   * stepper click, and on mount / `step` change when `step` is unknown or
   * not yet reachable (redirect to the first incomplete step). A controlled
   * wizard does not move until the consumer feeds the new `step` back.
   */
  onStepChange?: (step: WizardStepDef<TIn>) => void
  orientation?: 'horizontal' | 'vertical'
  children: ReactNode
}
```

`steps` is typed against the schema's input so `fields` autocompletes; a
`const` array with `satisfies WizardStepDef<Input>[]` keeps literal ids.

### State (context)

```
{ steps, current: WizardStepDef, index, visited: Set<id>, orientation,
  next(): Promise<boolean>, prev(), go(id): Promise<boolean>, isFirst, isLast,
  stepStatus(id): 'current' | 'completed' | 'visited' | 'upcoming' }
```

- `visited` grows whenever a step becomes current. It is internal state in
  both modes (the router only knows the current step).
- `next()` = `trigger(current.fields, { shouldFocus: true })`; on success
  marks the step visited and moves to `index + 1`. Returns whether it moved.
- `prev()` moves to `index - 1` without validating.
- `go(id)` allowed when `id` is visited or is the step right after the last
  visited step (the same as Next from that step); otherwise it is a no-op and
  returns `false`. Forward `go` validates like `next()`; backward does not.
- "Move" = `setState` when uncontrolled, `onStepChange(step)` always.
- `stepStatus`: `completed` when visited, not current, and none of its
  `fields` currently has an error; `visited` when visited with errors (shown
  with `StepLabel error`); `upcoming` otherwise.
- Redirect: when `step` (controlled) names an unknown id or an `upcoming`
  step that is not reachable, an effect calls `onStepChange(firstIncomplete)`
  where `firstIncomplete` is the first step not `completed`. This is the
  deep-link / refresh case for the router story.

### Components

- `WizardStepper` — `<Stepper nonLinear activeStep={index} orientation>`.
  Each `Step` gets `completed` / `disabled` from `stepStatus`. Visited steps
  render `StepButton` (`onClick={() => go(id)}`); upcoming render
  `StepLabel`. Vertical: each `Step` also renders `<StepContent>` holding the
  matching `WizardStep`'s children, found through context registration (each
  `WizardStep` registers its children under its id); horizontal: header only,
  and the active `WizardStep` renders its children in place.
- `WizardStep id` — registers children with the wizard; renders them when
  active and horizontal, renders `null` when vertical (the stepper renders
  them) or inactive. In router mode the consumer renders `WizardStep` inside
  the route element; the active one is the only one mounted anyway.
- `WizardNav` — `Stack direction="row"`: Prev (`variant="text"`, disabled on
  first) and Next (`variant="contained"`, `loading` while `next()` pends).
  On the last step Next is replaced by `<SubmitButton>`; props `prevLabel`,
  `nextLabel`, `submitLabel`, and `slotProps.{prev,next,submit}` for the rest.
- `useWizard(componentName?)` — returns the context; throws outside `Wizard`.

### Router mode (story, and the docs recipe)

```tsx
<Route path="/signup" element={<SignupLayout />}>   // <Form> + <Wizard step={param} onStepChange={s => navigate(`../${s.id}`)}>
  <Route path=":step" element={<SignupStep />} />   //   <WizardStepper/> <Outlet/> <WizardNav/>
</Route>
```

`SignupStep` reads `useParams().step` and renders the matching `WizardStep`.
The story uses `MemoryRouter`, shows the URL, and demonstrates the redirect
by starting at `/signup/review`.

## Section 3 — ReadOnlyField

```tsx
<ReadOnlyField name="email" label="Email" />
//  Email                 caption, text.secondary
//  steve@example.com     body1, text.primary
```

| Prop | Meaning |
|---|---|
| `name` | Form path; value via `useWatch({ name })`. Never registers, never validates. |
| `label?` | Defaults to a humanized name (`cardNumber` → `Card number`, last path segment). |
| `options?` | `Option[]`; shows the matching label(s) instead of the raw value. |
| `format?` | `(value) => ReactNode`; wins over every default rendering. |
| `empty?` | Shown for `'' \| null \| undefined \| []`; default `—`. |
| `editStep?` | Inside a `Wizard`, renders a small `Edit` `Link` button calling `go(editStep)`; hidden outside a wizard. |
| `slotProps?` | `{ root?: StackProps, label?: TypographyProps, value?: TypographyProps }`. |

Default rendering: arrays comma-joined (after option lookup), booleans `Yes` /
`No`, `Date` via `toLocaleString()`, `File` by name, everything else
`String(value)`. Built on `Typography` + `Stack`, not a disabled `TextField`
(greyed value fails contrast). Root is a `div` with `aria-labelledby` pointing
at the label so screen readers pair them.

## Section 4 — buttons, confirmations, guard

### ConfirmDialog / useConfirm

```ts
interface ConfirmOptions {
  title: ReactNode
  message?: ReactNode
  confirmLabel?: ReactNode   // 'Confirm'
  cancelLabel?: ReactNode    // 'Cancel'
  confirmColor?: ButtonProps['color']
}
interface ConfirmDialogProps extends ConfirmOptions, Omit<DialogProps, 'title' | 'onClose'> {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
}
function useConfirm(): { confirm: (opts: ConfirmOptions) => Promise<boolean>; dialog: ReactNode }
```

`ConfirmDialog` is MUI `Dialog` with `role="alertdialog"`, `aria-labelledby`
the title, `aria-describedby` the message, initial focus on Cancel, Escape and
backdrop = cancel. `useConfirm` keeps one pending promise; the caller renders
`dialog` once. Both are exported for consumers' own flows.

### Form `confirm?: true | ConfirmOptions`

Confirmation lives on `Form`, not on the button, because every submit path
(button click, Enter in a text field, `form.requestSubmit()`) funnels through
`handleSubmit`. Inside the `handleSubmit` callback, after zod has validated:
`confirm(opts)` → `true`: run `onSubmit`; `false`: nothing, form stays as is.
So an invalid form never opens the dialog, and no path bypasses it. `Form`
renders the `useConfirm` dialog itself. Default copy: title `Submit?`, no
message. `SubmitButton` and `WizardNav` gain no `confirm` prop; `WizardNav`
on the last step simply renders `SubmitButton`.

### ClearButton

```ts
interface ClearButtonProps extends Omit<ButtonProps, 'type'> {
  to?: 'defaults' | 'empty'          // 'defaults'
  confirm?: true | ConfirmOptions    // default copy: 'Discard changes?'
}
```

Disabled when `!isDirty` or the form is disabled. `type="button"`,
`variant="text"`, children `Clear`. `to="empty"` walks `defaultValues`
(from `control._defaultValues`) and maps each leaf by its current type:
string → `''`, number → `null`, boolean → `false`, array → `[]`, `Date` /
object / `File` → `null`; then `reset(empty)` — the form is dirty against
its real defaults afterwards, which is what a user expects from "clear".

### Form `guard?: boolean`

While `guard && isDirty && !isSubmitting`, a `beforeunload` listener calls
`preventDefault()`. Removed on unmount and whenever the condition turns false.

### useFormGuard

```ts
interface Blocker { state: 'blocked' | 'unblocked' | 'proceeding'; proceed(): void; reset(): void }
function useFormGuard(useBlocker: (shouldBlock: boolean) => Blocker):
  { blocked: boolean; proceed(): void; cancel(): void; shouldBlock: boolean }
```

`shouldBlock = isDirty && !isSubmitting && !isSubmitSuccessful`. The hook
calls the consumer's `useBlocker(shouldBlock)` (react-router's hook has that
signature) and adapts the result for a `ConfirmDialog`. Story: react-router
`MemoryRouter` with a second route, dirty form, nav link → dialog.

## Testing

vitest + RTL + axe, matching the existing test style.

| Area | Cases |
|---|---|
| Wizard | Next validates only the step's fields and focuses the first error; Prev never validates; visited steps clickable, upcoming disabled; `completed` clears when a field on a visited step becomes invalid; controlled `step` / `onStepChange` round trip; unknown or unreachable `step` triggers redirect to first incomplete; last-step Next is the SubmitButton; vertical renders `StepContent` and passes axe, horizontal passes axe; throws outside `<Form>` |
| ReadOnlyField | raw value; options label; array join; boolean; empty; `format`; `editStep` shows Edit inside Wizard and nothing outside; label default humanization; axe |
| ClearButton | disabled pristine; `defaults` resets to defaultValues; `empty` blanks by type; `confirm` cancel keeps values; confirm accept resets |
| Form confirm | invalid form shows errors and no dialog; cancel never calls onSubmit; confirm calls onSubmit once; Enter in a field and `requestSubmit()` both go through the dialog; `confirm` object copy appears |
| ConfirmDialog / useConfirm | alertdialog roles, initial focus on Cancel, Escape resolves false, promise resolves true/false once; axe |
| Form guard | listener attached only while dirty and not submitting; removed on unmount |
| useFormGuard | fake blocker: `shouldBlock` follows dirty; `proceed` / `cancel` forward |

Stories: `Wizard/Horizontal`, `Wizard/Vertical`, `Wizard/ReactRouter`,
`Buttons/ClearButton`, `Form/ConfirmSubmit`, `ReadOnlyField`,
`Form/UnsavedChangesGuard`. Each story with interaction (`play`) for Next
validation and confirm cancel.

## Open questions parked

- Whether `Wizard` should expose `visited` persistence (`initialVisited` /
  `onVisitedChange`) for consumers who save progress server-side. Not needed
  for the stories; add when a real flow asks.
