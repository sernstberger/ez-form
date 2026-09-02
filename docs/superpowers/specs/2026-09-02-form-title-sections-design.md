# Form title and sections (#51) — design

Date: 2026-09-02. Status: approved shape (Form props + `FormSection`), spec for review.

## Goal

Give every form an accessible name, a place for instructions, and named groups of
fields, using the HTML primitives the platform already has (`aria-labelledby`,
`fieldset`/`legend`) and MUI's theming hooks. Wizard steps become sections. This is
the blocker for the example ladder (#48) and feeds #1, #2, #33.

## Out-of-the-box baseline

```html
<form aria-labelledby="t" aria-describedby="d">
  <h2 id="t">Create your account</h2>
  <p id="d">All fields are required unless marked optional.</p>
  <fieldset><legend>Contact details</legend>…</fieldset>
</form>
```

ez-form adds nothing semantically; it wires the ids, picks heading elements, and
exposes theme slots.

## Anatomy

```
<Form title description slotProps>          EzForm
 ├─ <form aria-labelledby aria-describedby>    root   (the existing <form>)
 │   ├─ Typography component=h2 id           title
 │   ├─ Typography component=p  id           description
 │   └─ children
 │
<FormSection title description>             EzFormSection
 └─ <fieldset aria-describedby>                root
     ├─ <legend><Typography component=h3/>    legend   (heading inside legend: valid HTML)
     ├─ Typography component=p id             description
     └─ <div>{children}</div>                 content
```

## `Form` additions

| Prop | Type | Behaviour |
|---|---|---|
| `title` | `ReactNode` | Rendered as the first child of `<form>` in the `title` slot; the form gets `aria-labelledby={titleId}`. |
| `description` | `ReactNode` | Rendered under the title; the form gets `aria-describedby={descriptionId}`. |
| `slotProps` | `{ title?: TypographyProps; description?: TypographyProps }` | Per-instance slot props; `slotProps.title.component` sets the heading level. |

- Ids come from `useId`. A consumer's own `aria-labelledby` / `aria-describedby` wins over
  the generated one (the attribute is theirs; the slot still renders if `title` is given).
  With no `title` and no `aria-labelledby` nothing changes from today.
- Defaults through `useDefaultProps({ name: 'EzForm' })`: `title` slot `component: 'h2'`,
  `variant: 'h5'`; `description` slot `component: 'p'`, `variant: 'body2'`. All overridable
  from `theme.components.EzForm.defaultProps.slotProps`.
- Slots are `styled(Typography, { name: 'EzForm', slot: 'Title' | 'Description' })({})`
  with `formClasses = generateUtilityClasses('EzForm', ['root','title','description'])`.
  The `<form>` itself becomes `styled('form', { name: 'EzForm', slot: 'Root' })({})`.
- `EzForm` joins `augmentation.ts` (defaultProps, classes, styleOverrides). It is also the
  future home of #33's `requiredIndicator`.

## `FormSection` (new component, `src/FormSection/`)

| Prop | Type | Behaviour |
|---|---|---|
| `title` | `ReactNode` | Legend text, rendered as `<legend><Typography component="h3">` so it is both the group name and a heading. |
| `description` | `ReactNode` | `<p id>` after the legend; fieldset gets `aria-describedby`. |
| `disabled` | `boolean` | Native `fieldset[disabled]`: every control inside is disabled by the browser. Fields still read hookform's `disabled`; nothing to merge. |
| `slotProps` | `{ legend?, description?, content? }` | `legend.component` sets the heading level. |
| `...rest` | `FieldsetHTMLAttributes` | Spread on the fieldset. `aria-labelledby` without `title` names the group from an external element and renders no legend (used by the vertical wizard). |

- Root `styled('fieldset', { name: 'EzFormSection', slot: 'Root' })` carries the minimum
  reset a fieldset needs to look like a plain block (`border: 0; margin: 0; padding: 0;
  min-width: 0`), the same "minimum needed for the element to work" rule as
  `VerticalStepButton`; everything else is the theme's.
- `content` slot is a plain `div`; layout (Stack, Grid) stays the consumer's, as today.
- Defaults via `useDefaultProps({ name: 'EzFormSection' })`: legend `component: 'h3'`,
  `variant: 'h6'`; description `component: 'p'`, `variant: 'body2'`.
- Classes: `formSectionClasses` = `root | legend | description | content`.

## Wizard

- `WizardStep` wraps its children in a `FormSection`. Horizontal: `title` defaults to the
  step's `label` (override with `title`; `title={null}` renders the section without a
  legend, but the fieldset stays). Vertical: the label is already visible in the stepper,
  so the section renders no legend and points `aria-labelledby` at the `StepLabel` id
  instead. `WizardStep` gains `title`, `description`, `slotProps` pass-throughs.
- `WizardStepper` sets `aria-current="step"` on the current step's button (both
  orientations) and an id on each `StepLabel` (`${wizardId}-label-${step.id}`,
  `wizardId` from `useId` in `Wizard`, exposed through context).
- Focus moving to the step heading on change stays #2.

## Testing

- `Form.test.tsx`: `getByRole('form', { name: 'Sign up' })` (the `form` role only exposes
  with a name, so this is the real check); description linked; consumer `aria-labelledby`
  wins; no title → no heading and no attribute; heading level from `slotProps` and from
  theme `defaultProps`.
- `FormSection.test.tsx`: `getByRole('group', { name: 'Address' })`; fields inside are
  found within the group; `disabled` disables a child input; `aria-labelledby` without
  title renders no legend; theme `styleOverrides` reach every slot; jest-axe.
- `Wizard.test.tsx`: one `heading` per current step; `aria-current="step"` on the current
  button; vertical step group named by the stepper label; jest-axe.
- Stories: `Form/Title`, `FormSection/*`, wizard stories updated. `Introduction.mdx`/README
  Theming gains the two keys.

## Rulings

- Ruling: title/description are `Form` props, not a `FormTitle` child — Steve chose it;
  one surface, the form already owns the lifecycle — cost if wrong: a consumer who wants
  the heading elsewhere passes `aria-labelledby` and renders their own.
- Ruling: legend contains a heading element — WCAG 2.4.6/2.4.10 want a heading outline,
  HTML allows heading content in `legend` — cost if wrong: double announcement in some
  AT ("Address, group" then "Address, heading"), which axe accepts and is the documented
  pattern.
- Ruling: vertical wizard uses `aria-labelledby` to the stepper label, no legend — avoids
  the label appearing twice a few pixels apart — cost if wrong: no heading in the step
  content; the stepper label carries the name.
- Ruling: `WizardStep` always renders a fieldset — steps are groups by definition — cost if
  wrong: an extra element in existing consumers' DOM; the reset keeps it invisible.
- Ruling: `EzForm` is the theme key for the form element itself, reserved for #33 too —
  cost if wrong: renaming a public theme key later.
