# Form title and sections (#51) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `<Form title description>` names the form; `<FormSection>` renders a themeable fieldset/legend; every wizard step is a section and the stepper marks the current step.

**Architecture:** Two theme keys (`EzForm`, `EzFormSection`) following the existing `styled` slot + `useDefaultProps` + `generateUtilityClasses` pattern (see `src/fields/ReadOnlyField/ReadOnlyField.tsx`). `Form` grows two props and three slots; `FormSection` is a new component; `WizardStep` wraps children in `FormSection`; `WizardStepper` adds `aria-current` and label ids.

**Tech Stack:** React 19, MUI 9 (`styled`, `useDefaultProps`, `Typography`), react-hook-form, vitest + Testing Library + jest-axe, Storybook.

**Spec:** `docs/superpowers/specs/2026-09-02-form-title-sections-design.md`

## Global Constraints

- No styling in `src/`: no `sx`, no literal colors/spacing. The only allowed default style block is the fieldset reset (`border: 0; margin: 0; padding: 0; minWidth: 0`) on the `EzFormSection` root, documented in a comment like `VerticalStepButton`'s.
- Every component test ends with `expectNoA11yViolations` (`src/test/axe.ts`); test output stays pristine (no act warnings, no console errors).
- Types come from MUI/React: `TypographyProps`, `FormHTMLAttributes`, `FieldsetHTMLAttributes`. Do not re-declare what they already carry.
- Commit after each task with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Run `pnpm typecheck && pnpm test` before every commit.

---

### Task 1: `Form` title and description

**Files:**
- Modify: `src/Form/Form.tsx`
- Modify: `src/theme/augmentation.ts`
- Modify: `src/index.ts` (export `formClasses`)
- Test: `src/Form/Form.test.tsx` (append a `describe('title and description')`)
- Story: `src/Form/Form.stories.tsx` (add `Titled` story)

**Interfaces:**
- Produces: `FormProps` gains `title?: ReactNode`, `description?: ReactNode`, `slotProps?: { root?; title?; description? }`; export `formClasses` with `root | title | description`; theme key `EzForm`.

- [ ] **Step 1: Write the failing tests** (append to `src/Form/Form.test.tsx`; reuse that file's existing `schema`/imports, add `import { createTheme, ThemeProvider } from '@mui/material/styles'` and `formClasses` if missing)

```tsx
describe('title and description', () => {
  it('names the form from title and links description', () => {
    render(
      <Form schema={schema} onSubmit={() => {}} title="Sign up" description="All fields required">
        <TextField name="email" label="Email" />
      </Form>,
    )
    const form = screen.getByRole('form', { name: 'Sign up' })
    expect(form).toHaveAccessibleDescription('All fields required')
    expect(screen.getByRole('heading', { level: 2, name: 'Sign up' })).toBeInTheDocument()
  })

  it('renders no heading and no aria attributes without a title', () => {
    render(
      <Form schema={schema} onSubmit={() => {}} data-testid="f">
        <TextField name="email" label="Email" />
      </Form>,
    )
    expect(screen.queryByRole('heading')).toBeNull()
    expect(screen.getByTestId('f')).not.toHaveAttribute('aria-labelledby')
    expect(screen.getByTestId('f')).not.toHaveAttribute('aria-describedby')
  })

  it("keeps the consumer's aria-labelledby", () => {
    render(
      <>
        <h1 id="mine">Mine</h1>
        <Form schema={schema} onSubmit={() => {}} title="Ignored" aria-labelledby="mine">
          <TextField name="email" label="Email" />
        </Form>
      </>,
    )
    expect(screen.getByRole('form', { name: 'Mine' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Ignored' })).toBeInTheDocument()
  })

  it('heading level comes from slotProps, and from the theme', () => {
    const { unmount } = render(
      <Form schema={schema} onSubmit={() => {}} title="T" slotProps={{ title: { component: 'h1' } }}>
        <TextField name="email" label="Email" />
      </Form>,
    )
    expect(screen.getByRole('heading', { level: 1, name: 'T' })).toBeInTheDocument()
    unmount()
    const theme = createTheme({
      components: {
        EzForm: {
          defaultProps: { slotProps: { title: { component: 'h3' } } },
          styleOverrides: { title: { letterSpacing: '9px' } },
        },
      },
    })
    render(
      <ThemeProvider theme={theme}>
        <Form schema={schema} onSubmit={() => {}} title="T">
          <TextField name="email" label="Email" />
        </Form>
      </ThemeProvider>,
    )
    const h = screen.getByRole('heading', { level: 3, name: 'T' })
    expect(h).toHaveClass(formClasses.title)
    expect(getComputedStyle(h).letterSpacing).toBe('9px')
  })

  it('has no a11y violations', async () => {
    const { container } = render(
      <Form schema={schema} onSubmit={() => {}} title="Sign up" description="Hint">
        <TextField name="email" label="Email" />
      </Form>,
    )
    await expectNoA11yViolations(container)
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm vitest run src/Form/Form.test.tsx -t "title and description"`
Expected: FAIL (`title` unknown prop / no heading / `formClasses` undefined).

- [ ] **Step 3: Add the `EzForm` theme key** in `src/theme/augmentation.ts`

```ts
import type { FormProps } from '../Form'
// ComponentsPropsList
EzForm: Partial<FormProps<any, any>>
// ComponentNameToClassKey
EzForm: 'root' | 'title' | 'description'
// Components
EzForm?: {
  defaultProps?: ComponentsProps['EzForm']
  styleOverrides?: ComponentsOverrides<Theme>['EzForm']
}
```
(`FormProps` is generic; `Partial<FormProps<any, any>>` is the same erasure the wizard context uses. Add `// eslint-disable-next-line @typescript-eslint/no-explicit-any` if lint complains.)

- [ ] **Step 4: Implement in `src/Form/Form.tsx`**

Imports to add:
```tsx
import { useId, type ElementType } from 'react'
import { useDefaultProps } from '@mui/material/DefaultPropsProvider'
import generateUtilityClasses from '@mui/material/generateUtilityClasses'
import { styled } from '@mui/material/styles'
import Typography, { type TypographyProps } from '@mui/material/Typography'
```

Above `FormProps`:
```tsx
export const formClasses = generateUtilityClasses('EzForm', ['root', 'title', 'description'])

/** Typography plus `component`, so a slot can pick its element (heading level). */
export type FormTextSlotProps = TypographyProps & { component?: ElementType }

const FormRoot = styled('form', { name: 'EzForm', slot: 'Root' })({})
const FormTitle = styled(Typography, { name: 'EzForm', slot: 'Title' })({})
const FormDescription = styled(Typography, { name: 'EzForm', slot: 'Description' })({})
```

`FormProps` extends `Omit<FormHTMLAttributes<HTMLFormElement>, 'onSubmit' | 'title'>` (the HTML `title` tooltip attribute is replaced) and gains:
```tsx
  /**
   * Accessible name of the form, rendered as a heading (`h2` by default,
   * `slotProps.title.component` changes the level) and wired to the `<form>`
   * through `aria-labelledby`. A consumer's own `aria-labelledby` wins.
   */
  title?: ReactNode
  /** Instructions under the title, wired through `aria-describedby`. */
  description?: ReactNode
  slotProps?: {
    title?: FormTextSlotProps
    description?: FormTextSlotProps
  }
```

Component: rename the parameter to `inProps`, then
```tsx
  const {
    schema, onSubmit, defaultValues, values, resetOptions, onDefaultValuesError, ref,
    mode = 'onSubmit', disabled = false, confirm, guard = false,
    title, description, slotProps, className, children,
    'aria-labelledby': ariaLabelledBy, 'aria-describedby': ariaDescribedBy,
    ...formProps
  } = useDefaultProps({ props: inProps, name: 'EzForm' }) as FormProps<TIn, TOut>
  const baseId = useId()
  const titleId = `${baseId}-title`
  const descriptionId = `${baseId}-description`
  const titleProps = { component: 'h2', variant: 'h5', ...slotProps?.title } as const
  const descriptionProps = { component: 'p', variant: 'body2', ...slotProps?.description } as const
```
Render (replace `<form` … `</form>` with `FormRoot`, keep `noValidate`, `{...formProps}`, the `onSubmit` expression unchanged):
```tsx
      <FormRoot
        noValidate
        {...formProps}
        className={`${formClasses.root}${className ? ` ${className}` : ''}`}
        aria-labelledby={ariaLabelledBy ?? (title != null ? titleId : undefined)}
        aria-describedby={ariaDescribedBy ?? (description != null ? descriptionId : undefined)}
        onSubmit={/* unchanged */}
      >
        {title != null && (
          <FormTitle id={titleId} {...titleProps}
            className={`${formClasses.title}${titleProps.className ? ` ${titleProps.className}` : ''}`}>
            {title}
          </FormTitle>
        )}
        {description != null && (
          <FormDescription id={descriptionId} {...descriptionProps}
            className={`${formClasses.description}${descriptionProps.className ? ` ${descriptionProps.className}` : ''}`}>
            {description}
          </FormDescription>
        )}
        {children}
        {dialog}
      </FormRoot>
```
Export `formClasses` and `FormTextSlotProps` from `src/index.ts` next to `Form`.

- [ ] **Step 5: Run the tests**

Run: `pnpm typecheck && pnpm vitest run src/Form`
Expected: PASS, no warnings. If `useDefaultProps` complains about the generic, cast as shown.

- [ ] **Step 6: Story** — in `src/Form/Form.stories.tsx` add:
```tsx
export const Titled: Story = {
  render: () => (
    <Form schema={schema} onSubmit={() => {}} title="Create your account"
      description="All fields are required unless marked optional.">
      <Stack spacing={2}>
        <TextField name="email" label="Email" />
        <SubmitButton />
      </Stack>
    </Form>
  ),
}
```
(match the file's existing story shape and schema; the point is a visible heading + hint.)

- [ ] **Step 7: Commit**
```bash
git add src/Form src/theme/augmentation.ts src/index.ts
git commit -m "feat(Form): title and description with aria wiring; EzForm theme key (#51)"
```

---

### Task 2: `FormSection`

**Files:**
- Create: `src/FormSection/FormSection.tsx`, `src/FormSection/index.ts`
- Create: `src/FormSection/FormSection.test.tsx`, `src/FormSection/FormSection.stories.tsx`
- Modify: `src/theme/augmentation.ts`, `src/index.ts`

**Interfaces:**
- Consumes: `FormTextSlotProps` from Task 1.
- Produces: `FormSection`, `FormSectionProps`, `formSectionClasses` (`root | legend | description | content`); theme key `EzFormSection`. Props: `title?`, `description?`, `disabled?`, `slotProps?: { legend?; description?; content? }`, plus `Omit<FieldsetHTMLAttributes<HTMLFieldSetElement>, 'title'>`.

- [ ] **Step 1: Failing tests** — `src/FormSection/FormSection.test.tsx`

```tsx
import { createTheme, ThemeProvider } from '@mui/material/styles'
import { render, screen, within } from '@testing-library/react'
import { z } from 'zod'
import { Form } from '../Form'
import { TextField } from '../fields/TextField'
import { expectNoA11yViolations } from '../test/axe'
import { FormSection, formSectionClasses } from './FormSection'

const schema = z.object({ street: z.string(), city: z.string() })
const wrap = (ui: React.ReactNode) =>
  render(
    <Form schema={schema} defaultValues={{ street: '', city: '' }} onSubmit={() => {}}>
      {ui}
    </Form>,
  )

describe('FormSection', () => {
  it('is a named group containing its fields, with a heading legend', () => {
    wrap(
      <FormSection title="Address" description="Where we ship">
        <TextField name="street" label="Street" />
      </FormSection>,
    )
    const group = screen.getByRole('group', { name: 'Address' })
    expect(group.tagName).toBe('FIELDSET')
    expect(group).toHaveAccessibleDescription('Where we ship')
    expect(within(group).getByRole('textbox', { name: 'Street' })).toBeInTheDocument()
    const heading = screen.getByRole('heading', { level: 3, name: 'Address' })
    expect(heading.closest('legend')).not.toBeNull()
  })

  it('disabled disables every control inside (native fieldset)', () => {
    wrap(
      <FormSection title="Address" disabled>
        <TextField name="street" label="Street" />
      </FormSection>,
    )
    expect(screen.getByRole('textbox', { name: 'Street' })).toBeDisabled()
  })

  it('aria-labelledby without a title names the group externally and renders no legend', () => {
    wrap(
      <>
        <span id="ext">External</span>
        <FormSection aria-labelledby="ext">
          <TextField name="city" label="City" />
        </FormSection>
      </>,
    )
    expect(screen.getByRole('group', { name: 'External' })).toBeInTheDocument()
    expect(document.querySelector('legend')).toBeNull()
    expect(screen.queryByRole('heading')).toBeNull()
  })

  it('theme defaultProps and styleOverrides reach every slot', () => {
    const theme = createTheme({
      components: {
        EzFormSection: {
          defaultProps: { slotProps: { legend: { component: 'h4' } } },
          styleOverrides: {
            root: { letterSpacing: '1px' },
            legend: { letterSpacing: '2px' },
            description: { letterSpacing: '3px' },
            content: { letterSpacing: '4px' },
          },
        },
      },
    })
    render(
      <ThemeProvider theme={theme}>
        <Form schema={schema} onSubmit={() => {}}>
          <FormSection title="A" description="D">
            <TextField name="city" label="City" />
          </FormSection>
        </Form>
      </ThemeProvider>,
    )
    const root = screen.getByRole('group', { name: 'A' })
    expect(getComputedStyle(root).letterSpacing).toBe('1px')
    expect(screen.getByRole('heading', { level: 4, name: 'A' })).toBeInTheDocument()
    expect(getComputedStyle(root.querySelector(`.${formSectionClasses.legend}`)!).letterSpacing).toBe('2px')
    expect(getComputedStyle(root.querySelector(`.${formSectionClasses.description}`)!).letterSpacing).toBe('3px')
    expect(getComputedStyle(root.querySelector(`.${formSectionClasses.content}`)!).letterSpacing).toBe('4px')
  })

  it('has no a11y violations', async () => {
    const { container } = wrap(
      <FormSection title="Address" description="Where we ship">
        <TextField name="street" label="Street" />
        <TextField name="city" label="City" />
      </FormSection>,
    )
    await expectNoA11yViolations(container)
  })
})
```

- [ ] **Step 2: Run to verify failure** — `pnpm vitest run src/FormSection` → FAIL (module not found).

- [ ] **Step 3: Theme key** in `src/theme/augmentation.ts`
```ts
import type { FormSectionProps } from '../FormSection'
EzFormSection: Partial<FormSectionProps>                       // ComponentsPropsList
EzFormSection: 'root' | 'legend' | 'description' | 'content'   // ComponentNameToClassKey
EzFormSection?: { defaultProps?: ComponentsProps['EzFormSection']; styleOverrides?: ComponentsOverrides<Theme>['EzFormSection'] }
```

- [ ] **Step 4: Implement** `src/FormSection/FormSection.tsx`

```tsx
import { useId, type FieldsetHTMLAttributes, type ReactNode } from 'react'
import { useDefaultProps } from '@mui/material/DefaultPropsProvider'
import generateUtilityClasses from '@mui/material/generateUtilityClasses'
import { styled } from '@mui/material/styles'
import Typography from '@mui/material/Typography'
import type { FormTextSlotProps } from '../Form'

export interface FormSectionProps extends Omit<FieldsetHTMLAttributes<HTMLFieldSetElement>, 'title'> {
  /**
   * Group name, rendered as `<legend>` wrapping a heading (`h3` by default;
   * `slotProps.legend.component` changes the level). With no `title`, pass
   * `aria-labelledby` to name the group from an element you render yourself.
   */
  title?: ReactNode
  /** Text after the legend, wired to the fieldset through `aria-describedby`. */
  description?: ReactNode
  slotProps?: {
    legend?: FormTextSlotProps
    description?: FormTextSlotProps
    content?: React.ComponentProps<'div'>
  }
}

export const formSectionClasses = generateUtilityClasses('EzFormSection', [
  'root', 'legend', 'description', 'content',
])

// A fieldset's UA stylesheet draws a border and inset padding; removing it is
// the minimum for the section to read as a plain block, the same rule as
// `VerticalStepButton`. Overridable via `EzFormSection.styleOverrides.root`.
const FormSectionRoot = styled('fieldset', { name: 'EzFormSection', slot: 'Root' })({
  border: 0, margin: 0, padding: 0, minWidth: 0,
})
const FormSectionLegend = styled('legend', { name: 'EzFormSection', slot: 'Legend' })({ padding: 0 })
const FormSectionDescription = styled(Typography, { name: 'EzFormSection', slot: 'Description' })({})
const FormSectionContent = styled('div', { name: 'EzFormSection', slot: 'Content' })({})

/** A named group of fields: `<fieldset>` + `<legend>` with MUI theming hooks. */
export function FormSection(inProps: FormSectionProps) {
  const {
    title, description, slotProps, className, children,
    'aria-describedby': ariaDescribedBy, ...rest
  } = useDefaultProps({ props: inProps, name: 'EzFormSection' })
  const descriptionId = `${useId()}-description`
  const legendProps = { component: 'h3', variant: 'h6', ...slotProps?.legend } as const
  const descriptionProps = { component: 'p', variant: 'body2', ...slotProps?.description } as const
  return (
    <FormSectionRoot
      {...rest}
      aria-describedby={ariaDescribedBy ?? (description != null ? descriptionId : undefined)}
      className={`${formSectionClasses.root}${className ? ` ${className}` : ''}`}
    >
      {title != null && (
        <FormSectionLegend className={formSectionClasses.legend}>
          <Typography {...legendProps}>{title}</Typography>
        </FormSectionLegend>
      )}
      {description != null && (
        <FormSectionDescription id={descriptionId} {...descriptionProps}
          className={`${formSectionClasses.description}${descriptionProps.className ? ` ${descriptionProps.className}` : ''}`}>
          {description}
        </FormSectionDescription>
      )}
      <FormSectionContent {...slotProps?.content}
        className={`${formSectionClasses.content}${slotProps?.content?.className ? ` ${slotProps.content.className}` : ''}`}>
        {children}
      </FormSectionContent>
    </FormSectionRoot>
  )
}
```
Notes: the legend slot is the `<legend>` itself (so `styleOverrides.legend` styles the element the theme sees); the heading inside is plain `Typography` taking `slotProps.legend`'s Typography props. `padding: 0` on legend is part of the same UA reset. The accessible name of a fieldset comes from its `legend` text, so the heading inside is fine.

`src/FormSection/index.ts`: `export * from './FormSection'`. In `src/index.ts`: `export { FormSection, formSectionClasses, type FormSectionProps } from './FormSection'`.

- [ ] **Step 5: Run** `pnpm typecheck && pnpm vitest run src/FormSection` → PASS.

- [ ] **Step 6: Story** `src/FormSection/FormSection.stories.tsx` (title `'FormSection'`, use the `FormParameters` decorator like `ReadOnlyField.stories.tsx`): `Default` (title + description + two TextFields in a `Stack`), `Disabled`, `TwoSections` inside a titled Form (`Form title` prop is set via `parameters.form` if the decorator supports it; otherwise render a full `<Form title>` in the story).

- [ ] **Step 7: Commit** — `git add src/FormSection src/theme/augmentation.ts src/index.ts && git commit -m "feat(FormSection): fieldset/legend group with EzFormSection theme slots (#51)"`

---

### Task 3: `WizardStepper` `aria-current` and label ids

**Files:**
- Modify: `src/Wizard/WizardContext.ts` (add `id: string`), `src/Wizard/Wizard.tsx` (provide `id` from `useId`), `src/Wizard/WizardStepper.tsx`
- Test: `src/Wizard/Wizard.test.tsx`

**Interfaces:**
- Produces: `WizardContextValue.id: string`; exported helper `stepLabelId(wizardId: string, stepId: string): string` from `WizardContext.ts` = `` `${wizardId}-label-${stepId}` ``. The `StepLabel` label span of every step carries that id.

- [ ] **Step 1: Failing tests** (append inside the existing `describe` in `Wizard.test.tsx`, using its `Wrapper`/render helper that mounts `<WizardStepper />` + `<Steps />`; if the file has separate horizontal/vertical helpers, add one test per orientation)

```tsx
it('marks the current step with aria-current="step" and labels each step', async () => {
  renderWizard() // whatever helper renders <WizardStepper/> horizontally
  const current = screen.getByRole('tab', { name: /Account/ })
  expect(current).toHaveAttribute('aria-current', 'step')
  expect(screen.getByRole('tab', { name: /Plan/ })).not.toHaveAttribute('aria-current')
  const id = screen.getByText('Account', { selector: 'span' }).id
  expect(id).toMatch(/-label-account$/)
})
```
Vertical: same assertions on the `button` role (`VerticalStepButton`) instead of `tab`.

- [ ] **Step 2: Run** `pnpm vitest run src/Wizard -t aria-current` → FAIL.

- [ ] **Step 3: Implement**

`WizardContext.ts`: add `/** Stable id prefix for this wizard (`useId`), used for step label ids. */ id: string` to `WizardContextValue` and
```ts
export const stepLabelId = (wizardId: string, stepId: string) => `${wizardId}-label-${stepId}`
```
`Wizard.tsx`: `const id = useId()`; add `id` to the memo value and its deps.
`WizardStepper.tsx`: `stepLabel(step, status, labelId)` renders
```tsx
<StepLabel optional={step.optional} error={status === 'visited'} slotProps={{ label: { id: labelId } }}>
```
and both `StepButton` and `VerticalStepButton` get `aria-current={status === 'current' ? 'step' : undefined}`. Pull `id` from `useWizard` and compute `stepLabelId(id, step.id)` per step. Export `stepLabelId` from `src/Wizard/index.ts` (internal use by Task 4; keep it out of `src/index.ts`).

- [ ] **Step 4: Run** `pnpm typecheck && pnpm vitest run src/Wizard` → PASS.
- [ ] **Step 5: Commit** — `git commit -am "feat(WizardStepper): aria-current=step and step label ids (#51)"`

---

### Task 4: `WizardStep` renders a `FormSection`

**Files:**
- Modify: `src/Wizard/WizardStep.tsx`
- Test: `src/Wizard/Wizard.test.tsx`; fix any existing test that now finds duplicate text (stepper label + legend) by scoping with `within(...)` or `getByRole`.
- Stories: `src/Wizard/Wizard.stories.tsx`, `src/Wizard/WizardRouter.stories.tsx` — remove any ad-hoc step headings that now duplicate the legend.

**Interfaces:**
- Consumes: `FormSection` (Task 2), `stepLabelId` + `WizardContextValue.id` (Task 3).
- Produces: `WizardStepProps` gains `title?: ReactNode | null`, `description?: ReactNode`, `slotProps?: FormSectionProps['slotProps']`.

- [ ] **Step 1: Failing tests**

```tsx
it('horizontal: a step is a group named by its label with one heading', () => {
  renderWizard()
  const group = screen.getByRole('group', { name: 'Account' })
  expect(within(group).getByRole('textbox', { name: 'Name' })).toBeInTheDocument()
  expect(screen.getAllByRole('heading')).toHaveLength(1)
  expect(screen.getByRole('heading', { name: 'Account' })).toBeInTheDocument()
})

it('vertical: the step group is named by the stepper label and renders no legend', () => {
  renderWizard({ orientation: 'vertical' })
  const group = screen.getByRole('group', { name: 'Account' })
  expect(within(group).getByRole('textbox', { name: 'Name' })).toBeInTheDocument()
  expect(document.querySelector('legend')).toBeNull()
})

it('title={null} keeps the fieldset but drops the legend; title overrides the label', () => {
  // render two custom steps: <WizardStep id="account" title={null}> and <WizardStep id="plan" title="Pick a plan">
  // assert: no legend on account; group name 'Pick a plan' on plan after next()
})
```

- [ ] **Step 2: Run** → FAIL (no group role).

- [ ] **Step 3: Implement** `src/Wizard/WizardStep.tsx`

```tsx
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import { FormSection, type FormSectionProps } from '../FormSection'
import { stepLabelId } from './WizardContext'
import { useWizard } from './useWizard'

export interface WizardStepProps {
  id: string
  /** Legend of the step's section. Defaults to the step's `label`; `null` renders no legend. */
  title?: ReactNode | null
  description?: ReactNode
  slotProps?: FormSectionProps['slotProps']
  children: ReactNode
}

/**
 * One step's content, always a `FormSection` (a step is a group). Horizontal:
 * the legend is the step label (a heading). Vertical: the label is already
 * visible in the stepper, so the section is named by it via `aria-labelledby`
 * and renders no legend.
 */
export function WizardStep({ id, title, description, slotProps, children }: WizardStepProps) {
  const { current, orientation, contentEl, id: wizardId } = useWizard('WizardStep')
  if (current.id !== id) return null
  if (orientation === 'vertical') {
    if (!contentEl) return null
    return createPortal(
      <FormSection aria-labelledby={stepLabelId(wizardId, id)} description={description} slotProps={slotProps}>
        {children}
      </FormSection>,
      contentEl,
    )
  }
  return (
    <FormSection title={title === undefined ? current.label : title} description={description} slotProps={slotProps}>
      {children}
    </FormSection>
  )
}
```

- [ ] **Step 4: Run the whole suite** `pnpm typecheck && pnpm test` → fix duplicate-text queries in `Wizard.test.tsx`, `ReadOnlyField.test.tsx`, `useFormGuard.test.tsx` etc. by scoping (`within(screen.getByRole('group', …))`, `getByRole('tab'|'button', { name })`). Output must be pristine.
- [ ] **Step 5: Stories** — open `pnpm storybook` (or the running instance) and check `Wizard/*`: no doubled headings; remove ad-hoc `<Typography variant="h6">` step titles if present.
- [ ] **Step 6: Commit** — `git commit -am "feat(WizardStep): every step is a FormSection; vertical named by stepper label (#51)"`

---

### Task 5: Docs

**Files:**
- Modify: `README.md` (Components table row for `FormSection`; Form title/description sentence in the `Form` section; Theming example gains `EzForm` / `EzFormSection`), `CHANGELOG.md` (Unreleased → Added), `docs/PHILOSOPHY.md` only if its ship checklist references a list of theme keys (check; likely no change).

- [ ] **Step 1: README** — under `## Components` add `FormSection` with one line: "`<fieldset>`/`<legend>` group; `title` is a heading, `description` links via `aria-describedby`, `disabled` disables the whole group." Under the Form description add: "`title` / `description` give the form its accessible name and instructions (`aria-labelledby` / `aria-describedby`); heading level via `slotProps.title.component`." Add to the Theming code block:
```tsx
    EzForm: { defaultProps: { slotProps: { title: { component: 'h1', variant: 'h4' } } } },
    EzFormSection: { styleOverrides: { legend: { marginBottom: 8 } } },
```
- [ ] **Step 2: CHANGELOG** Unreleased → Added:
```md
- `Form` `title` / `description` props with `aria-labelledby` / `aria-describedby` wiring;
  `EzForm` theme key (`root`, `title`, `description`) and `formClasses` — #51.
- `FormSection`: `<fieldset>`/`<legend>` group with `EzFormSection` theme key
  (`root`, `legend`, `description`, `content`) and `formSectionClasses` — #51.
- `WizardStep` renders a `FormSection` (`title`, `description`, `slotProps`);
  `WizardStepper` marks the current step with `aria-current="step"` — #51.
```
- [ ] **Step 3: Commit** — `git commit -am "docs: Form title, FormSection, wizard step sections (#51)"`

---

## Self-review

- Spec coverage: Form props/slots/theme (T1); FormSection with disabled, external label, slots (T2); `aria-current` + label ids (T3); WizardStep wrapping, vertical `aria-labelledby`, `title={null}` (T4); README/CHANGELOG (T5). Focus-on-step-change is explicitly #2, not here.
- Type consistency: `FormTextSlotProps` defined in T1, consumed in T2; `stepLabelId(wizardId, stepId)` and `WizardContextValue.id` defined in T3, consumed in T4; `FormSectionProps['slotProps']` reused in T4.
- Known risk: `useDefaultProps` on a generic component may need the `as FormProps<TIn, TOut>` cast shown in T1; `StepLabel slotProps.label` exists in MUI 9 (verify in node_modules if the id does not land on the label span, fall back to `id` on `StepLabel` root).
