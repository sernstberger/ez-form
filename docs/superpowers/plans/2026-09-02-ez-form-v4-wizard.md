# ez-form v4 Implementation Plan — wizard, confirmations, clear, read-only review

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a multi-step `Wizard` (inline or one route per step, MUI Stepper horizontal/vertical), `ConfirmDialog`/`useConfirm`, `Form confirm` + `Form guard`, `useFormGuard`, `ClearButton`, and `ReadOnlyField` for review steps.

**Architecture:** One `<Form>` and one zod schema sit above every wizard step; `Wizard` keeps step/visited state (controlled or internal) in a React context and validates a step with hookform's `trigger(fields)`. Confirmations are one MUI `Dialog` wrapper plus a promise hook; `Form` runs the submit confirmation inside its own submit handler so every submit path (button, Enter, `requestSubmit`) is covered. Routing stays the consumer's: `Wizard` is controlled through `step`/`onStepChange`, and one story wires it to react-router.

**Tech Stack:** React 19, TypeScript 7, MUI Material 9 (`Stepper`, `Dialog`), react-hook-form 7.87, zod 4, Vitest + Testing Library + jest-axe, Storybook 10, react-router 7 (devDependency, stories only).

**Spec:** `docs/superpowers/specs/2026-09-02-ez-form-v4-wizard-design.md`

## Global Constraints

- No new peer dependencies. `react-router` is a **devDependency** used only by stories.
- No `@mui/icons-material` import anywhere in `src/`.
- Every component that needs the form calls `useEzFormContext('<Name>')` and throws `ez-form: <Name> must be rendered inside <Form>` outside one, exactly like `SubmitButton`.
- Form-level `disabled` wins via `mergeDisabled` (`src/fields/mergeDisabled.ts`).
- All three confirmations are **opt-in**: `Form confirm`, `Form guard`, `ClearButton confirm` are `undefined` by default and change nothing when unset.
- Every new component ships `Component.tsx`, `Component.test.tsx`, `Component.stories.tsx`, `index.ts`, and an export line in `src/index.ts`.
- **No styling in `src/`** (spec Section 5, added Sept 2 mid-implementation): no `sx`, ripple props, or literal `variant`/`size`/`color`/`direction`/`spacing` in JSX. Defaults go through `useDefaultProps({ props, name: 'Ez<Component>' })`, structural styles through `styled(Base, { name, slot })`, class hooks through `generateUtilityClasses`, and every `Ez*` name is added to MUI's `ComponentsPropsList` / `ComponentNameToClassKey` / `Components` in `src/theme/augmentation.ts`. Tasks 7 and 8 build to this; Task 6b retrofits Tasks 1, 3, 6 and v1's `SubmitButton`.
- Tests: `pnpm test` (vitest, jsdom). Types: `pnpm typecheck`. Format: `pnpm format`.
- Commit messages end with:
  ```
  Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01DpPL2RK2FesFKMA2Q4soGt
  ```

## Verified facts (do not re-derive)

- `useEzFormContext(name)` (`src/useEzFormContext.ts`) returns hookform's `UseFormReturn` or throws.
- hookform `trigger(names?, { shouldFocus })` returns `Promise<boolean>`; with `names` it validates only those paths and focuses the first invalid one. `trigger()` with no names validates the whole form.
- hookform `formState.defaultValues` is public and readable from `useFormState({ control })`.
- `useFormState({ control })` exposes `isDirty`, `isSubmitting`, `isSubmitSuccessful`, `disabled`, `errors` and only re-renders subscribers.
- `useWatch({ name })` returns the live value of one path.
- hookform `get(obj, path)` is exported (`import { get } from 'react-hook-form'`) and already used in `src/Form/ezResolver.ts`.
- MUI `Button` accepts `loading` (used by `SubmitButton`).
- MUI `Dialog` forwards `aria-labelledby` / `aria-describedby` to its Paper (the `role="dialog"` element); `slotProps.paper.role` overrides that role. `onClose(event, reason)` fires for Escape and backdrop click.
- MUI `Stepper` with `nonLinear`: `Step` `completed` / `disabled` come only from props. `StepButton` renders a real `<button>` inside `Step`; `StepLabel` accepts `error` and `optional`. `StepContent` is vertical-only and collapses when the step is not active.
- `createPortal(children, element)` keeps React context (the form context reaches portaled fields).
- react-router 7 (`react-router` package): `createMemoryRouter(routes, { initialEntries })` + `RouterProvider`; `useBlocker(shouldBlock: boolean)` returns `{ state: 'unblocked' | 'blocked' | 'proceeding', proceed?(): void, reset?(): void }` and needs a data router (not `<MemoryRouter>`). `useParams`, `useNavigate`, `useLocation`, `Outlet` as usual.
- A `beforeunload` handler must call `event.preventDefault()`.

## File structure

```
src/
  ConfirmDialog/     ConfirmDialog.tsx (ConfirmDialog + ConfirmOptions), useConfirm.tsx, *.test.tsx, ConfirmDialog.stories.tsx, index.ts
  Form/Form.tsx      + confirm, guard props;  Form.test.tsx + cases;  Form.stories.tsx + ConfirmSubmit, UnsavedChangesGuard stories
  ClearButton/       ClearButton.tsx, emptyOf.ts, ClearButton.test.tsx, ClearButton.stories.tsx, index.ts
  useFormGuard.ts    + useFormGuard.test.tsx
  Wizard/            WizardContext.ts, Wizard.tsx, useWizard.ts, WizardStep.tsx, WizardStepper.tsx, WizardNav.tsx,
                     Wizard.test.tsx, Wizard.stories.tsx (Horizontal, Vertical, Resume), WizardRouter.stories.tsx (ReactRouter), index.ts
  fields/ReadOnlyField/  ReadOnlyField.tsx, humanize.ts, ReadOnlyField.test.tsx, ReadOnlyField.stories.tsx, index.ts
src/index.ts         exports
README.md            rows + sections
package.json         devDependency react-router
```

**Parallelism (three worktrees, then integrate):**

```
Worktree A (confirm chain):  Task 1 ─► Task 2 ─► Task 3
Worktree B (guard):          Task 4
Worktree C (wizard chain):   Task 5 ─► Task 6 ─► Task 7 ─► Task 8 ─► Task 9
Then on main:                Task 10 (integration)
```

Each worktree appends its own lines to `src/index.ts` and rows to the README table; merge conflicts there are adjacent additions, keep all lines. Task 4 and Task 9 both add `react-router` as a devDependency; whichever merges second re-runs `pnpm install` and keeps one entry.

---

### Task 1: ConfirmDialog + useConfirm

**Files:**
- Create: `src/ConfirmDialog/ConfirmDialog.tsx`
- Create: `src/ConfirmDialog/useConfirm.tsx`
- Create: `src/ConfirmDialog/ConfirmDialog.test.tsx`
- Create: `src/ConfirmDialog/useConfirm.test.tsx`
- Create: `src/ConfirmDialog/ConfirmDialog.stories.tsx`
- Create: `src/ConfirmDialog/index.ts`
- Modify: `src/index.ts`

**Interfaces:**
- Produces:
  ```ts
  interface ConfirmOptions { title: ReactNode; message?: ReactNode; confirmLabel?: ReactNode; cancelLabel?: ReactNode; confirmColor?: ButtonProps['color'] }
  interface ConfirmDialogProps extends ConfirmOptions, Omit<DialogProps, 'title' | 'onClose' | 'open'> { open: boolean; onConfirm: () => void; onCancel: () => void }
  function ConfirmDialog(props: ConfirmDialogProps): JSX.Element
  function useConfirm(): { confirm: (options: ConfirmOptions) => Promise<boolean>; dialog: ReactNode }
  ```
  Tasks 2 and 3 call `useConfirm()` and render `dialog`.

- [ ] **Step 1: Write the failing ConfirmDialog tests**

`src/ConfirmDialog/ConfirmDialog.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfirmDialog } from './ConfirmDialog'
import { expectNoA11yViolations } from '../test/axe'

describe('ConfirmDialog', () => {
  it('renders an alertdialog named by the title and described by the message', () => {
    render(
      <ConfirmDialog open title="Send invoice?" message="This emails the client." onConfirm={() => {}} onCancel={() => {}} />,
    )
    const dialog = screen.getByRole('alertdialog', { name: 'Send invoice?' })
    expect(dialog).toHaveAccessibleDescription('This emails the client.')
  })

  it('focuses Cancel initially and calls onCancel / onConfirm from the buttons', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(<ConfirmDialog open title="Sure?" onConfirm={onConfirm} onCancel={onCancel} />)
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('treats Escape as cancel', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    render(<ConfirmDialog open title="Sure?" onConfirm={() => {}} onCancel={onCancel} />)
    await user.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('uses custom labels and color', () => {
    render(
      <ConfirmDialog open title="Delete?" confirmLabel="Delete" cancelLabel="Keep" confirmColor="error" onConfirm={() => {}} onCancel={() => {}} />,
    )
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveClass('MuiButton-colorError')
    expect(screen.getByRole('button', { name: 'Keep' })).toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    const { baseElement } = render(
      <ConfirmDialog open title="Sure?" message="Really." onConfirm={() => {}} onCancel={() => {}} />,
    )
    await expectNoA11yViolations(baseElement)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run src/ConfirmDialog/ConfirmDialog.test.tsx`
Expected: FAIL, cannot resolve `./ConfirmDialog`.

- [ ] **Step 3: Implement ConfirmDialog**

`src/ConfirmDialog/ConfirmDialog.tsx`:

```tsx
import { useId, type ReactNode } from 'react'
import Button, { type ButtonProps } from '@mui/material/Button'
import Dialog, { type DialogProps } from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'

/** Copy and styling for one confirmation; shared by `ConfirmDialog`, `useConfirm`, `Form confirm`, and `ClearButton confirm`. */
export interface ConfirmOptions {
  title: ReactNode
  message?: ReactNode
  /** Default `Confirm`. */
  confirmLabel?: ReactNode
  /** Default `Cancel`. */
  cancelLabel?: ReactNode
  confirmColor?: ButtonProps['color']
}

export interface ConfirmDialogProps extends ConfirmOptions, Omit<DialogProps, 'title' | 'onClose' | 'open'> {
  open: boolean
  onConfirm: () => void
  /** Also called for Escape and backdrop click. */
  onCancel: () => void
}

/**
 * MUI Dialog as an `alertdialog`: named by the title, described by the
 * message, initial focus on Cancel so Enter never confirms by accident.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmColor,
  onConfirm,
  onCancel,
  slotProps,
  ...rest
}: ConfirmDialogProps) {
  const titleId = useId()
  const messageId = useId()
  return (
    <Dialog
      {...rest}
      open={open}
      onClose={onCancel}
      aria-labelledby={titleId}
      aria-describedby={message ? messageId : undefined}
      slotProps={{ ...slotProps, paper: { role: 'alertdialog', ...slotProps?.paper } }}
    >
      <DialogTitle id={titleId}>{title}</DialogTitle>
      {message && (
        <DialogContent>
          <DialogContentText id={messageId}>{message}</DialogContentText>
        </DialogContent>
      )}
      <DialogActions>
        <Button onClick={onCancel} autoFocus>
          {cancelLabel}
        </Button>
        <Button onClick={onConfirm} variant="contained" color={confirmColor}>
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
```

If `slotProps.paper` is typed as a function in MUI 9, use `slotProps={{ ...slotProps, paper: { role: 'alertdialog', ...(typeof slotProps?.paper === 'object' ? slotProps.paper : {}) } }}`; check the `DialogProps['slotProps']` type in `node_modules/@mui/material/Dialog/Dialog.d.ts`.

- [ ] **Step 4: Run the ConfirmDialog tests**

Run: `pnpm vitest run src/ConfirmDialog/ConfirmDialog.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Write the failing useConfirm tests**

`src/ConfirmDialog/useConfirm.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useConfirm } from './useConfirm'

function Harness({ onResult }: { onResult: (ok: boolean) => void }) {
  const { confirm, dialog } = useConfirm()
  return (
    <>
      <button type="button" onClick={() => void confirm({ title: 'Really?' }).then(onResult)}>
        Ask
      </button>
      {dialog}
    </>
  )
}

describe('useConfirm', () => {
  it('opens the dialog on confirm() and resolves true on Confirm', async () => {
    const user = userEvent.setup()
    const onResult = vi.fn()
    render(<Harness onResult={onResult} />)
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ask' }))
    expect(screen.getByRole('alertdialog', { name: 'Really?' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Confirm' }))
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(true))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  })

  it('resolves false on Cancel and on Escape, once each', async () => {
    const user = userEvent.setup()
    const onResult = vi.fn()
    render(<Harness onResult={onResult} />)
    await user.click(screen.getByRole('button', { name: 'Ask' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(false))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Ask' }))
    await user.keyboard('{Escape}')
    await waitFor(() => expect(onResult).toHaveBeenCalledTimes(2))
    expect(onResult).toHaveBeenLastCalledWith(false)
  })
})
```

- [ ] **Step 6: Run it to verify it fails**

Run: `pnpm vitest run src/ConfirmDialog/useConfirm.test.tsx`
Expected: FAIL, cannot resolve `./useConfirm`.

- [ ] **Step 7: Implement useConfirm**

`src/ConfirmDialog/useConfirm.tsx`:

```tsx
import { useCallback, useRef, useState, type ReactNode } from 'react'
import { ConfirmDialog, type ConfirmOptions } from './ConfirmDialog'

export interface UseConfirmReturn {
  /** Opens the dialog; resolves `true` on Confirm, `false` on Cancel / Escape / backdrop. */
  confirm: (options: ConfirmOptions) => Promise<boolean>
  /** Render this once, anywhere in the tree. */
  dialog: ReactNode
}

/**
 * Promise-style confirmation. One pending request at a time; a second
 * `confirm()` while one is open resolves the first as `false`.
 */
export function useConfirm(): UseConfirmReturn {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const [open, setOpen] = useState(false)
  const resolveRef = useRef<((ok: boolean) => void) | null>(null)

  const settle = useCallback((ok: boolean) => {
    resolveRef.current?.(ok)
    resolveRef.current = null
    setOpen(false)
  }, [])

  const confirm = useCallback(
    (next: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        resolveRef.current?.(false)
        resolveRef.current = resolve
        setOptions(next)
        setOpen(true)
      }),
    [],
  )

  // Options stay mounted while the dialog closes so the exit transition keeps its text.
  const dialog = options ? (
    <ConfirmDialog {...options} open={open} onConfirm={() => settle(true)} onCancel={() => settle(false)} />
  ) : null

  return { confirm, dialog }
}
```

- [ ] **Step 8: Run both test files**

Run: `pnpm vitest run src/ConfirmDialog`
Expected: PASS (7 tests).

- [ ] **Step 9: Story, index, export**

`src/ConfirmDialog/index.ts`:

```ts
export { ConfirmDialog, type ConfirmDialogProps, type ConfirmOptions } from './ConfirmDialog'
export { useConfirm, type UseConfirmReturn } from './useConfirm'
```

`src/ConfirmDialog/ConfirmDialog.stories.tsx`:

```tsx
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { ConfirmDialog } from './ConfirmDialog'
import { useConfirm } from './useConfirm'

const meta = {
  title: 'ConfirmDialog',
  component: ConfirmDialog,
  parameters: { layout: 'centered' },
  args: { open: true, title: 'Send invoice?', message: 'This emails the client.', onConfirm: () => {}, onCancel: () => {} },
} satisfies Meta<typeof ConfirmDialog>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Destructive: Story = {
  args: { title: 'Delete project?', message: 'This cannot be undone.', confirmLabel: 'Delete', confirmColor: 'error' },
}

export const WithUseConfirm: Story = {
  render: () => {
    const { confirm, dialog } = useConfirm()
    const [last, setLast] = useState<string>('—')
    return (
      <Stack spacing={2} alignItems="flex-start">
        <Button variant="outlined" onClick={() => void confirm({ title: 'Really?' }).then((ok) => setLast(ok ? 'confirmed' : 'cancelled'))}>
          Ask
        </Button>
        <Typography>Last answer: {last}</Typography>
        {dialog}
      </Stack>
    )
  },
}
```

Append to `src/index.ts`:

```ts
export { ConfirmDialog, type ConfirmDialogProps, type ConfirmOptions, useConfirm, type UseConfirmReturn } from './ConfirmDialog'
```

- [ ] **Step 10: Typecheck, format, commit**

Run: `pnpm typecheck && pnpm format && pnpm vitest run src/ConfirmDialog`
Expected: no type errors, tests PASS.

```bash
git add src/ConfirmDialog src/index.ts
git commit -m "feat: ConfirmDialog and useConfirm"
```

---

### Task 2: Form `confirm` and `guard`

**Files:**
- Modify: `src/Form/Form.tsx`
- Modify: `src/Form/Form.test.tsx` (append cases)
- Modify: `src/Form/Form.stories.tsx` (append stories)

**Interfaces:**
- Consumes: `useConfirm`, `ConfirmOptions` from `../ConfirmDialog` (Task 1).
- Produces: `FormProps.confirm?: true | ConfirmOptions`, `FormProps.guard?: boolean`. Task 7's `WizardNav` relies on plain `<SubmitButton>` going through this.

- [ ] **Step 1: Write the failing tests**

Append inside the `describe('Form', …)` block of `src/Form/Form.test.tsx`:

```tsx
  describe('confirm', () => {
    it('opens a dialog after validation and only calls onSubmit on Confirm', async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn()
      render(
        <Form schema={schema} defaultValues={{ email: 'a@b.co' }} onSubmit={onSubmit} confirm>
          <SubmitButton />
        </Form>,
      )
      await user.click(screen.getByRole('button', { name: 'Submit' }))
      expect(await screen.findByRole('alertdialog', { name: 'Submit?' })).toBeInTheDocument()
      expect(onSubmit).not.toHaveBeenCalled()
      await user.click(screen.getByRole('button', { name: 'Confirm' }))
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
      expect(onSubmit).toHaveBeenCalledWith({ email: 'a@b.co' }, expect.anything())
    })

    it('never opens the dialog for an invalid form; shows the errors instead', async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn()
      render(
        <Form schema={schema} defaultValues={{ email: 'nope' }} onSubmit={onSubmit} confirm>
          <TextField name="email" label="Email" />
          <SubmitButton />
        </Form>,
      )
      await user.click(screen.getByRole('button', { name: 'Submit' }))
      expect(await screen.findByText('Invalid email address')).toBeInTheDocument()
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
      expect(onSubmit).not.toHaveBeenCalled()
    })

    it('Cancel leaves the form untouched and onSubmit uncalled', async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn()
      render(
        <Form schema={schema} defaultValues={{ email: 'a@b.co' }} onSubmit={onSubmit} confirm={{ title: 'Send it?', message: 'Emails the client.' }}>
          <SubmitButton />
        </Form>,
      )
      await user.click(screen.getByRole('button', { name: 'Submit' }))
      expect(await screen.findByRole('alertdialog', { name: 'Send it?' })).toHaveAccessibleDescription('Emails the client.')
      await user.click(screen.getByRole('button', { name: 'Cancel' }))
      await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
      expect(onSubmit).not.toHaveBeenCalled()
      expect(screen.getByRole('button', { name: 'Submit' })).toBeEnabled()
    })

    it('Enter in a field and form.requestSubmit() both go through the dialog', async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn()
      const { container } = render(
        <Form schema={schema} defaultValues={{ email: 'a@b.co' }} onSubmit={onSubmit} confirm>
          <TextField name="email" label="Email" />
          <SubmitButton />
        </Form>,
      )
      await user.click(screen.getByRole('textbox', { name: 'Email' }))
      await user.keyboard('{Enter}')
      expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Cancel' }))
      await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
      container.querySelector('form')!.requestSubmit()
      expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
      expect(onSubmit).not.toHaveBeenCalled()
    })
  })

  describe('guard', () => {
    const addSpy = () => vi.spyOn(window, 'addEventListener')
    const removeSpy = () => vi.spyOn(window, 'removeEventListener')
    const beforeunloadCalls = (spy: ReturnType<typeof addSpy>) =>
      spy.mock.calls.filter(([type]) => type === 'beforeunload')

    it('does nothing without the prop', async () => {
      const user = userEvent.setup()
      const add = addSpy()
      render(
        <Form schema={schema} defaultValues={{ email: '' }} onSubmit={() => {}}>
          <TextField name="email" label="Email" />
        </Form>,
      )
      await user.type(screen.getByRole('textbox', { name: 'Email' }), 'a')
      expect(beforeunloadCalls(add)).toHaveLength(0)
    })

    it('listens to beforeunload only while dirty, and the handler prevents default', async () => {
      const user = userEvent.setup()
      const add = addSpy()
      const remove = removeSpy()
      const { unmount } = render(
        <Form schema={schema} defaultValues={{ email: '' }} onSubmit={() => {}} guard>
          <TextField name="email" label="Email" />
        </Form>,
      )
      expect(beforeunloadCalls(add)).toHaveLength(0)
      await user.type(screen.getByRole('textbox', { name: 'Email' }), 'a')
      await waitFor(() => expect(beforeunloadCalls(add)).toHaveLength(1))
      const handler = beforeunloadCalls(add)[0][1] as (e: Event) => void
      const event = new Event('beforeunload', { cancelable: true })
      handler(event)
      expect(event.defaultPrevented).toBe(true)
      await user.clear(screen.getByRole('textbox', { name: 'Email' }))
      await waitFor(() => expect(remove.mock.calls.filter(([t]) => t === 'beforeunload')).toHaveLength(1))
      unmount()
    })
  })
```

- [ ] **Step 2: Run to verify the new cases fail**

Run: `pnpm vitest run src/Form/Form.test.tsx -t "confirm|guard"`
Expected: FAIL (no dialog appears; no beforeunload listener).

- [ ] **Step 3: Implement**

In `src/Form/Form.tsx`:

Add imports:

```tsx
import { useConfirm, type ConfirmOptions } from '../ConfirmDialog'
```

Add to `FormProps` (after `disabled`):

```tsx
  /**
   * Ask before submitting. Runs after validation inside the submit handler,
   * so an invalid form never asks, and every submit path (button, Enter in a
   * field, `form.requestSubmit()`) asks. `true` uses the default copy
   * (`Submit?`); pass `ConfirmOptions` for your own.
   */
  confirm?: true | ConfirmOptions
  /**
   * Warn on tab close / reload while the form is dirty and not submitting
   * (a `beforeunload` listener). For in-app navigation use `useFormGuard`.
   */
  guard?: boolean
```

Destructure `confirm` and `guard = false` in the component. Replace the `useFormState` line and add the guard effect and confirm hook:

```tsx
  const { isLoading, isDirty, isSubmitting } = useFormState({ control: methods.control })
  useEffect(() => {
    setLoading(isLoading)
  }, [isLoading])
  useImperativeHandle(ref, () => methods, [methods])

  const { confirm: ask, dialog } = useConfirm()
  const confirmOptions: ConfirmOptions | undefined =
    confirm === true ? { title: 'Submit?' } : confirm

  useEffect(() => {
    if (!guard || !isDirty || isSubmitting) return
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [guard, isDirty, isSubmitting])

  const submit = methods.handleSubmit(async (submitted) => {
    setSubmitting(true)
    try {
      await onSubmit(submitted, methods)
    } finally {
      setSubmitting(false)
    }
  })
```

Replace the `<form … onSubmit={…}>` with:

```tsx
      <form
        noValidate
        {...formProps}
        onSubmit={
          confirmOptions
            ? async (event) => {
                event.preventDefault()
                // Validate first (focusing the first error like handleSubmit does) so an
                // invalid form never asks; handleSubmit re-validates on Confirm, which is
                // cheap and keeps hookform's isSubmitting confined to the real submit.
                const valid = await methods.trigger(undefined, { shouldFocus: true })
                if (!valid) return
                if (await ask(confirmOptions)) await submit(event)
              }
            : submit
        }
      >
        {children}
        {dialog}
      </form>
```

- [ ] **Step 4: Run the whole Form test file**

Run: `pnpm vitest run src/Form/Form.test.tsx`
Expected: PASS, including the existing cases.

- [ ] **Step 5: Stories**

Append to `src/Form/Form.stories.tsx`:

```tsx
export const ConfirmSubmit: Story = {
  args: { confirm: { title: 'Create account?', message: 'We will email a verification link.' } },
}

export const UnsavedChangesGuard: Story = {
  args: { guard: true },
  parameters: { docs: { description: { story: 'Type something, then try to reload the tab: the browser asks before leaving.' } } },
}
```

- [ ] **Step 6: Typecheck, format, commit**

Run: `pnpm typecheck && pnpm format && pnpm vitest run src/Form`
Expected: PASS.

```bash
git add src/Form
git commit -m "feat(Form): confirm prop (dialog after validation) and guard prop (beforeunload while dirty)"
```

---

### Task 3: ClearButton

**Files:**
- Create: `src/ClearButton/emptyOf.ts`
- Create: `src/ClearButton/emptyOf.test.ts`
- Create: `src/ClearButton/ClearButton.tsx`
- Create: `src/ClearButton/ClearButton.test.tsx`
- Create: `src/ClearButton/ClearButton.stories.tsx`
- Create: `src/ClearButton/index.ts`
- Modify: `src/index.ts`

**Interfaces:**
- Consumes: `useConfirm`, `ConfirmOptions` (Task 1); `mergeDisabled`; `useEzFormContext`.
- Produces: `ClearButton({ to?: 'defaults' | 'empty'; confirm?: true | ConfirmOptions } & Omit<ButtonProps, 'type'>)`; `emptyOf(values: unknown): unknown`.

- [ ] **Step 1: Write the failing emptyOf tests**

`src/ClearButton/emptyOf.test.ts`:

```ts
import { emptyOf } from './emptyOf'

describe('emptyOf', () => {
  it('maps leaves by type and recurses into plain objects', () => {
    const file = new File(['x'], 'x.txt')
    expect(
      emptyOf({
        name: 'Ada',
        seats: 3,
        tos: true,
        tags: ['a'],
        when: new Date(2026, 0, 1),
        doc: file,
        nothing: null,
        missing: undefined,
        address: { city: 'Oslo', zip: 1234 },
      }),
    ).toEqual({
      name: '',
      seats: null,
      tos: false,
      tags: [],
      when: null,
      doc: null,
      nothing: null,
      missing: undefined,
      address: { city: '', zip: null },
    })
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run src/ClearButton/emptyOf.test.ts`
Expected: FAIL, cannot resolve `./emptyOf`.

- [ ] **Step 3: Implement emptyOf**

`src/ClearButton/emptyOf.ts`:

```ts
const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && Object.getPrototypeOf(v) === Object.prototype

/**
 * The "blank" shape of a values object, by the current type of each leaf:
 * string → '', number → null, boolean → false, array → [], anything else
 * that is not a plain object (Date, File, class instance) → null.
 * `null` / `undefined` stay as they are.
 */
export function emptyOf(values: unknown): unknown {
  if (values === null || values === undefined) return values
  if (typeof values === 'string') return ''
  if (typeof values === 'number') return null
  if (typeof values === 'boolean') return false
  if (Array.isArray(values)) return []
  if (isPlainObject(values)) {
    return Object.fromEntries(Object.entries(values).map(([k, v]) => [k, emptyOf(v)]))
  }
  return null
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run src/ClearButton/emptyOf.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing ClearButton tests**

`src/ClearButton/ClearButton.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { z } from 'zod'
import { Form } from '../Form'
import { TextField } from '../fields/TextField'
import { NumberField } from '../fields/NumberField'
import { ClearButton } from './ClearButton'
import { expectNoA11yViolations } from '../test/axe'

const schema = z.object({ name: z.string(), seats: z.number().nullable() })
const defaults = { name: 'Ada', seats: 2 }

function Fields() {
  return (
    <>
      <TextField name="name" label="Name" />
      <NumberField name="seats" label="Seats" />
    </>
  )
}

describe('ClearButton', () => {
  it('is a type=button named Clear, disabled while pristine', () => {
    render(
      <Form schema={schema} defaultValues={defaults} onSubmit={() => {}}>
        <Fields />
        <ClearButton />
      </Form>,
    )
    const btn = screen.getByRole('button', { name: 'Clear' })
    expect(btn).toHaveAttribute('type', 'button')
    expect(btn).toBeDisabled()
  })

  it('resets to defaultValues once dirty', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={defaults} onSubmit={() => {}}>
        <Fields />
        <ClearButton />
      </Form>,
    )
    const name = screen.getByRole('textbox', { name: 'Name' })
    await user.type(name, 'm')
    const btn = screen.getByRole('button', { name: 'Clear' })
    await waitFor(() => expect(btn).toBeEnabled())
    await user.click(btn)
    expect(name).toHaveValue('Ada')
    await waitFor(() => expect(btn).toBeDisabled())
  })

  it('to="empty" blanks every field by type', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={defaults} onSubmit={() => {}}>
        <Fields />
        <ClearButton to="empty" />
      </Form>,
    )
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'm')
    await user.click(screen.getByRole('button', { name: 'Clear' }))
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('')
    expect(screen.getByRole('textbox', { name: 'Seats' })).toHaveValue('')
  })

  it('confirm: Cancel keeps the values, Confirm resets', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={defaults} onSubmit={() => {}}>
        <Fields />
        <ClearButton confirm />
      </Form>,
    )
    const name = screen.getByRole('textbox', { name: 'Name' })
    await user.type(name, 'm')
    await user.click(screen.getByRole('button', { name: 'Clear' }))
    expect(await screen.findByRole('alertdialog', { name: 'Discard changes?' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(name).toHaveValue('Adam')
    await user.click(screen.getByRole('button', { name: 'Clear' }))
    await user.click(await screen.findByRole('button', { name: 'Confirm' }))
    await waitFor(() => expect(name).toHaveValue('Ada'))
  })

  it('is disabled while the form is disabled, even when dirty', async () => {
    const user = userEvent.setup()
    const { rerender } = render(
      <Form schema={schema} defaultValues={defaults} onSubmit={() => {}}>
        <Fields />
        <ClearButton />
      </Form>,
    )
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'm')
    rerender(
      <Form schema={schema} defaultValues={defaults} onSubmit={() => {}} disabled>
        <Fields />
        <ClearButton />
      </Form>,
    )
    await waitFor(() => expect(screen.getByRole('button', { name: 'Clear' })).toBeDisabled())
  })

  it('has no accessibility violations', async () => {
    const { container } = render(
      <Form schema={schema} defaultValues={defaults} onSubmit={() => {}}>
        <Fields />
        <ClearButton />
      </Form>,
    )
    await expectNoA11yViolations(container)
  })

  it('throws outside <Form>', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<ClearButton />)).toThrow('ez-form: <ClearButton> must be rendered inside <Form>')
  })
})
```

If `NumberField` renders `null` as something other than an empty textbox, check `src/fields/NumberField/NumberField.test.tsx` for how an empty value is asserted there and match it.

- [ ] **Step 6: Run to verify it fails**

Run: `pnpm vitest run src/ClearButton/ClearButton.test.tsx`
Expected: FAIL, cannot resolve `./ClearButton`.

- [ ] **Step 7: Implement ClearButton**

`src/ClearButton/ClearButton.tsx`:

```tsx
import Button, { type ButtonProps } from '@mui/material/Button'
import { useFormState } from 'react-hook-form'
import { useEzFormContext } from '../useEzFormContext'
import { mergeDisabled } from '../fields/mergeDisabled'
import { useConfirm, type ConfirmOptions } from '../ConfirmDialog'
import { emptyOf } from './emptyOf'

export interface ClearButtonProps extends Omit<ButtonProps, 'type'> {
  /** `defaults` (hookform `reset()`) or `empty` (blank every field by its type). Default `defaults`. */
  to?: 'defaults' | 'empty'
  /** Ask first. `true` uses `Discard changes?`; pass `ConfirmOptions` for your own copy. */
  confirm?: true | ConfirmOptions
}

/**
 * Resets the form. Disabled while there is nothing to clear (`!isDirty`) and
 * while the form is disabled.
 */
export function ClearButton({
  to = 'defaults',
  confirm,
  disabled,
  variant = 'text',
  children = 'Clear',
  onClick,
  ...rest
}: ClearButtonProps) {
  const { reset } = useEzFormContext('ClearButton')
  const { isDirty, disabled: formDisabled, defaultValues } = useFormState()
  const { confirm: ask, dialog } = useConfirm()
  const options: ConfirmOptions | undefined =
    confirm === true ? { title: 'Discard changes?' } : confirm

  return (
    <>
      <Button
        type="button"
        variant={variant}
        disabled={mergeDisabled(disabled, formDisabled) || !isDirty}
        onClick={async (event) => {
          onClick?.(event)
          if (options && !(await ask(options))) return
          if (to === 'empty') reset(emptyOf(defaultValues) as typeof defaultValues)
          else reset()
        }}
        {...rest}
      >
        {children}
      </Button>
      {dialog}
    </>
  )
}
```

- [ ] **Step 8: Run the tests**

Run: `pnpm vitest run src/ClearButton`
Expected: PASS.

- [ ] **Step 9: Story, index, export**

`src/ClearButton/index.ts`:

```ts
export { ClearButton, type ClearButtonProps } from './ClearButton'
```

`src/ClearButton/ClearButton.stories.tsx`:

```tsx
import type { Meta, StoryObj } from '@storybook/react-vite'
import Stack from '@mui/material/Stack'
import { z } from 'zod'
import { ClearButton } from './ClearButton'
import { TextField } from '../fields/TextField'
import { NumberField } from '../fields/NumberField'
import { Checkbox } from '../fields/Checkbox'
import type { FormParameters } from '../../.storybook/preview'

const schema = z.object({ name: z.string(), seats: z.number().nullable(), tos: z.boolean() })

const meta = {
  title: 'ClearButton',
  component: ClearButton,
  parameters: {
    layout: 'centered',
    form: { schema, defaultValues: { name: 'Ada', seats: 2, tos: true } },
  } satisfies FormParameters & Record<string, unknown>,
  render: (args) => (
    <Stack spacing={2}>
      <TextField name="name" label="Name" />
      <NumberField name="seats" label="Seats" />
      <Checkbox name="tos" label="Accept terms" />
      <ClearButton {...args} />
    </Stack>
  ),
} satisfies Meta<typeof ClearButton>
export default meta
type Story = StoryObj<typeof meta>

export const ToDefaults: Story = {}
export const ToEmpty: Story = { args: { to: 'empty' } }
export const WithConfirm: Story = { args: { confirm: true } }
```

Check how other field stories import `FormParameters` (for example `src/fields/Checkbox/Checkbox.stories.tsx`) and match that import path and the `parameters` shape exactly.

Append to `src/index.ts`:

```ts
export { ClearButton, type ClearButtonProps } from './ClearButton'
```

- [ ] **Step 10: Typecheck, format, commit**

Run: `pnpm typecheck && pnpm format && pnpm vitest run src/ClearButton`
Expected: PASS.

```bash
git add src/ClearButton src/index.ts
git commit -m "feat: ClearButton (reset to defaults or empty, optional confirm)"
```

---

### Task 4: useFormGuard

**Files:**
- Create: `src/useFormGuard.ts`
- Create: `src/useFormGuard.test.tsx`
- Modify: `src/index.ts`
- Modify: `package.json` (devDependency `react-router`)
- Create: `src/Form/FormGuard.stories.tsx`

**Interfaces:**
- Produces:
  ```ts
  interface FormGuardBlocker { state: 'unblocked' | 'blocked' | 'proceeding'; proceed?: () => void; reset?: () => void }
  function useFormGuard(useBlocker: (shouldBlock: boolean) => FormGuardBlocker): { blocked: boolean; proceed: () => void; cancel: () => void; shouldBlock: boolean }
  ```

- [ ] **Step 1: Add react-router as a devDependency**

```bash
pnpm add -D react-router@^7
```

- [ ] **Step 2: Write the failing tests**

`src/useFormGuard.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { z } from 'zod'
import { Form } from './Form'
import { TextField } from './fields/TextField'
import { useFormGuard, type FormGuardBlocker } from './useFormGuard'

const schema = z.object({ email: z.string() })

/** A blocker that blocks whenever asked to, so `blocked` mirrors `shouldBlock`. */
function makeFakeBlocker() {
  const proceed = vi.fn()
  const reset = vi.fn()
  const calls: boolean[] = []
  const useBlocker = (shouldBlock: boolean): FormGuardBlocker => {
    calls.push(shouldBlock)
    return shouldBlock ? { state: 'blocked', proceed, reset } : { state: 'unblocked' }
  }
  return { useBlocker, proceed, reset, calls }
}

function Probe({ useBlocker }: { useBlocker: (b: boolean) => FormGuardBlocker }) {
  const guard = useFormGuard(useBlocker)
  return (
    <>
      <output data-testid="state">{guard.blocked ? 'blocked' : 'free'}</output>
      <button type="button" onClick={guard.proceed}>proceed</button>
      <button type="button" onClick={guard.cancel}>cancel</button>
    </>
  )
}

describe('useFormGuard', () => {
  it('asks the blocker to block only while dirty and not submitting', async () => {
    const user = userEvent.setup()
    const fake = makeFakeBlocker()
    render(
      <Form schema={schema} defaultValues={{ email: '' }} onSubmit={() => {}}>
        <TextField name="email" label="Email" />
        <Probe useBlocker={fake.useBlocker} />
      </Form>,
    )
    expect(screen.getByTestId('state')).toHaveTextContent('free')
    expect(fake.calls.at(-1)).toBe(false)
    await user.type(screen.getByRole('textbox', { name: 'Email' }), 'a')
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('blocked'))
    expect(fake.calls.at(-1)).toBe(true)
  })

  it('stops blocking after a successful submit', async () => {
    const user = userEvent.setup()
    const fake = makeFakeBlocker()
    render(
      <Form schema={schema} defaultValues={{ email: '' }} onSubmit={() => {}}>
        <TextField name="email" label="Email" />
        <Probe useBlocker={fake.useBlocker} />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.type(screen.getByRole('textbox', { name: 'Email' }), 'a')
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('blocked'))
    await user.click(screen.getByRole('button', { name: 'Go' }))
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('free'))
  })

  it('forwards proceed and cancel to the blocker', async () => {
    const user = userEvent.setup()
    const fake = makeFakeBlocker()
    render(
      <Form schema={schema} defaultValues={{ email: '' }} onSubmit={() => {}}>
        <TextField name="email" label="Email" />
        <Probe useBlocker={fake.useBlocker} />
      </Form>,
    )
    await user.type(screen.getByRole('textbox', { name: 'Email' }), 'a')
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('blocked'))
    await user.click(screen.getByRole('button', { name: 'proceed' }))
    expect(fake.proceed).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'cancel' }))
    expect(fake.reset).toHaveBeenCalledTimes(1)
  })

  it('throws outside <Form>', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const fake = makeFakeBlocker()
    expect(() => render(<Probe useBlocker={fake.useBlocker} />)).toThrow(
      'ez-form: <useFormGuard> must be rendered inside <Form>',
    )
  })
})
```

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm vitest run src/useFormGuard.test.tsx`
Expected: FAIL, cannot resolve `./useFormGuard`.

- [ ] **Step 4: Implement**

`src/useFormGuard.ts`:

```ts
import { useFormState } from 'react-hook-form'
import { useEzFormContext } from './useEzFormContext'

/** The shape react-router's `useBlocker` returns; any router can provide it. */
export interface FormGuardBlocker {
  state: 'unblocked' | 'blocked' | 'proceeding'
  proceed?: () => void
  reset?: () => void
}

export interface UseFormGuardReturn {
  /** Render a `ConfirmDialog` with `open={blocked}` when true. */
  blocked: boolean
  /** Leave anyway. */
  proceed: () => void
  /** Stay. */
  cancel: () => void
  /** `isDirty && !isSubmitting && !isSubmitSuccessful` — what was handed to the blocker. */
  shouldBlock: boolean
}

/**
 * Unsaved-changes guard for in-app navigation. Pass your router's blocker
 * hook (react-router: `useBlocker`); it is called with `shouldBlock` every
 * render, so it must be a stable hook, not a conditional one.
 *
 * ```tsx
 * const guard = useFormGuard(useBlocker)
 * <ConfirmDialog open={guard.blocked} title="Discard changes?" onConfirm={guard.proceed} onCancel={guard.cancel} />
 * ```
 */
export function useFormGuard(
  useBlocker: (shouldBlock: boolean) => FormGuardBlocker,
): UseFormGuardReturn {
  useEzFormContext('useFormGuard')
  const { isDirty, isSubmitting, isSubmitSuccessful } = useFormState()
  const shouldBlock = isDirty && !isSubmitting && !isSubmitSuccessful
  const blocker = useBlocker(shouldBlock)
  return {
    blocked: blocker.state === 'blocked',
    proceed: () => blocker.proceed?.(),
    cancel: () => blocker.reset?.(),
    shouldBlock,
  }
}
```

- [ ] **Step 5: Run the tests**

Run: `pnpm vitest run src/useFormGuard.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 6: Story with a real react-router data router**

`src/Form/FormGuard.stories.tsx`:

```tsx
import type { Meta, StoryObj } from '@storybook/react-vite'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { z } from 'zod'
import { Link, Outlet, RouterProvider, createMemoryRouter, useBlocker } from 'react-router'
import { Form } from './Form'
import { SubmitButton } from '../SubmitButton'
import { TextField } from '../fields/TextField'
import { ConfirmDialog } from '../ConfirmDialog'
import { useFormGuard } from '../useFormGuard'

const schema = z.object({ title: z.string().min(1, 'Title is required') })

function Guard() {
  const guard = useFormGuard(useBlocker)
  return (
    <ConfirmDialog
      open={guard.blocked}
      title="Discard changes?"
      message="You have unsaved edits on this page."
      confirmLabel="Discard"
      confirmColor="error"
      onConfirm={guard.proceed}
      onCancel={guard.cancel}
    />
  )
}

function EditPage() {
  return (
    <Form schema={schema} defaultValues={{ title: '' }} onSubmit={() => {}}>
      <Stack spacing={2} sx={{ width: 360 }}>
        <TextField name="title" label="Title" />
        <SubmitButton>Save</SubmitButton>
        <Button component={Link} to="/other">Go to another page</Button>
      </Stack>
      <Guard />
    </Form>
  )
}

function OtherPage() {
  return (
    <Stack spacing={2}>
      <Typography>Another page.</Typography>
      <Button component={Link} to="/">Back to the form</Button>
    </Stack>
  )
}

const router = createMemoryRouter([
  { path: '/', element: <Outlet />, children: [{ index: true, element: <EditPage /> }, { path: 'other', element: <OtherPage /> }] },
])

const meta = {
  title: 'Form/useFormGuard',
  parameters: { layout: 'centered' },
  render: () => <RouterProvider router={router} />,
} satisfies Meta
export default meta

export const ReactRouter: StoryObj<typeof meta> = {}
```

Open http://localhost:6006 → Form/useFormGuard: type in Title, click "Go to another page", the dialog appears; Cancel stays, Discard leaves.

- [ ] **Step 7: Export, typecheck, format, commit**

Append to `src/index.ts`:

```ts
export { useFormGuard, type FormGuardBlocker, type UseFormGuardReturn } from './useFormGuard'
```

Run: `pnpm typecheck && pnpm format && pnpm vitest run src/useFormGuard.test.tsx`
Expected: PASS.

```bash
git add src/useFormGuard.ts src/useFormGuard.test.tsx src/Form/FormGuard.stories.tsx src/index.ts package.json pnpm-lock.yaml
git commit -m "feat: useFormGuard (router-agnostic unsaved-changes blocker) + react-router story"
```

---

### Task 5: Wizard core — context, state, `useWizard`, `WizardStep`

**Files:**
- Create: `src/Wizard/WizardContext.ts`
- Create: `src/Wizard/Wizard.tsx`
- Create: `src/Wizard/useWizard.ts`
- Create: `src/Wizard/WizardStep.tsx`
- Create: `src/Wizard/Wizard.test.tsx`
- Create: `src/Wizard/index.ts`

**Interfaces:**
- Consumes: `useEzFormContext`; hookform `trigger`, `useFormState().errors`, `get`.
- Produces (used by Tasks 6–9):
  ```ts
  interface WizardStepDef<TIn extends FieldValues = FieldValues> { id: string; label: ReactNode; fields?: readonly Path<TIn>[]; optional?: ReactNode }
  type WizardStepStatus = 'current' | 'completed' | 'visited' | 'upcoming'
  interface WizardContextValue {
    steps: readonly WizardStepDef[]; current: WizardStepDef; index: number; visited: readonly string[]
    orientation: 'horizontal' | 'vertical'; isFirst: boolean; isLast: boolean; pending: boolean
    next(): Promise<boolean>; prev(): void; go(id: string): Promise<boolean>; stepStatus(id: string): WizardStepStatus
    contentEl: HTMLElement | null; setContentEl(el: HTMLElement | null): void   // vertical portal target (Task 6)
  }
  const WizardContext: Context<WizardContextValue | null>
  function useWizard(componentName?: string): WizardContextValue   // throws outside <Wizard>
  function useOptionalWizard(): WizardContextValue | null
  function Wizard<TIn>(props: WizardProps<TIn>): JSX.Element
  function WizardStep(props: { id: string; children: ReactNode }): JSX.Element | null
  ```

- [ ] **Step 1: Write the failing tests**

`src/Wizard/Wizard.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { z } from 'zod'
import { Form } from '../Form'
import { TextField } from '../fields/TextField'
import { Wizard, type WizardStepDef } from './Wizard'
import { WizardStep } from './WizardStep'
import { useWizard } from './useWizard'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.email('Invalid email'),
  plan: z.string().min(1, 'Plan is required'),
})
type Input = z.input<typeof schema>

const steps = [
  { id: 'account', label: 'Account', fields: ['name', 'email'] },
  { id: 'plan', label: 'Plan', fields: ['plan'] },
  { id: 'review', label: 'Review' },
] as const satisfies WizardStepDef<Input>[]

/** Buttons + a readout so tests drive the context without the Stepper/Nav components. */
function Controls() {
  const w = useWizard()
  return (
    <>
      <output data-testid="current">{w.current.id}</output>
      <output data-testid="visited">{w.visited.join(',')}</output>
      <output data-testid="status">{w.steps.map((s) => `${s.id}:${w.stepStatus(s.id)}`).join(' ')}</output>
      <button type="button" onClick={() => void w.next()}>next</button>
      <button type="button" onClick={w.prev}>prev</button>
      <button type="button" onClick={() => void w.go('account')}>go account</button>
      <button type="button" onClick={() => void w.go('review')}>go review</button>
    </>
  )
}

function Steps() {
  return (
    <>
      <WizardStep id="account">
        <TextField name="name" label="Name" />
        <TextField name="email" label="Email" />
      </WizardStep>
      <WizardStep id="plan">
        <TextField name="plan" label="Plan" />
      </WizardStep>
      <WizardStep id="review">
        <p>Review</p>
      </WizardStep>
      <Controls />
    </>
  )
}

const empty = { name: '', email: '', plan: '' }
const filled = { name: 'Ada', email: 'ada@x.io', plan: 'pro' }

describe('Wizard', () => {
  it('renders only the current step and starts on the first', () => {
    render(
      <Form schema={schema} defaultValues={empty} onSubmit={() => {}}>
        <Wizard steps={steps}>
          <Steps />
        </Wizard>
      </Form>,
    )
    expect(screen.getByRole('textbox', { name: 'Name' })).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Plan' })).not.toBeInTheDocument()
    expect(screen.getByTestId('current')).toHaveTextContent('account')
    expect(screen.getByTestId('status')).toHaveTextContent('account:current plan:upcoming review:upcoming')
  })

  it('next validates only the current step and focuses the first error', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={empty} onSubmit={() => {}}>
        <Wizard steps={steps}>
          <Steps />
        </Wizard>
      </Form>,
    )
    await user.click(screen.getByRole('button', { name: 'next' }))
    expect(await screen.findByText('Name is required')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveFocus()
    expect(screen.getByTestId('current')).toHaveTextContent('account')
    // plan's error is not shown / not evaluated: still on account, plan never mounted
    expect(screen.queryByText('Plan is required')).not.toBeInTheDocument()
  })

  it('next advances when the step is valid, prev goes back without validating', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={{ ...filled, plan: '' }} onSubmit={() => {}}>
        <Wizard steps={steps}>
          <Steps />
        </Wizard>
      </Form>,
    )
    await user.click(screen.getByRole('button', { name: 'next' }))
    await waitFor(() => expect(screen.getByTestId('current')).toHaveTextContent('plan'))
    expect(screen.getByRole('textbox', { name: 'Plan' })).toBeInTheDocument()
    expect(screen.getByTestId('status')).toHaveTextContent('account:completed plan:current review:upcoming')
    await user.click(screen.getByRole('button', { name: 'prev' }))
    expect(screen.getByTestId('current')).toHaveTextContent('account')
    expect(screen.queryByText('Plan is required')).not.toBeInTheDocument()
    expect(screen.getByTestId('visited')).toHaveTextContent('account,plan')
  })

  it('go() reaches visited steps, refuses upcoming ones, validates when moving forward', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={filled} onSubmit={() => {}}>
        <Wizard steps={steps}>
          <Steps />
        </Wizard>
      </Form>,
    )
    await user.click(screen.getByRole('button', { name: 'go review' }))
    expect(screen.getByTestId('current')).toHaveTextContent('account')
    await user.click(screen.getByRole('button', { name: 'next' }))
    await user.click(screen.getByRole('button', { name: 'next' }))
    await waitFor(() => expect(screen.getByTestId('current')).toHaveTextContent('review'))
    await user.click(screen.getByRole('button', { name: 'go account' }))
    expect(screen.getByTestId('current')).toHaveTextContent('account')
    await user.clear(screen.getByRole('textbox', { name: 'Name' }))
    await user.click(screen.getByRole('button', { name: 'go review' }))
    expect(await screen.findByText('Name is required')).toBeInTheDocument()
    expect(screen.getByTestId('current')).toHaveTextContent('account')
  })

  it('a visited step with an error is "visited", not "completed"', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={filled} onSubmit={() => {}} mode="onChange">
        <Wizard steps={steps}>
          <Steps />
        </Wizard>
      </Form>,
    )
    await user.click(screen.getByRole('button', { name: 'next' }))
    await waitFor(() => expect(screen.getByTestId('current')).toHaveTextContent('plan'))
    await user.clear(screen.getByRole('textbox', { name: 'Plan' }))
    await screen.findByText('Plan is required')
    await user.click(screen.getByRole('button', { name: 'prev' }))
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('plan:visited'))
  })

  it('next on the last step is a no-op that returns false', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={filled} onSubmit={() => {}}>
        <Wizard steps={steps}>
          <Steps />
        </Wizard>
      </Form>,
    )
    await user.click(screen.getByRole('button', { name: 'next' }))
    await user.click(screen.getByRole('button', { name: 'next' }))
    await waitFor(() => expect(screen.getByTestId('current')).toHaveTextContent('review'))
    await user.click(screen.getByRole('button', { name: 'next' }))
    expect(screen.getByTestId('current')).toHaveTextContent('review')
  })

  describe('controlled', () => {
    function Controlled({ initial, visited, onVisitedChange }: { initial: string; visited?: readonly string[]; onVisitedChange?: (ids: readonly string[]) => void }) {
      const [step, setStep] = useState(initial)
      const onStepChange = vi.fn((s: WizardStepDef) => setStep(s.id))
      return (
        <Form schema={schema} defaultValues={filled} onSubmit={() => {}}>
          <output data-testid="param">{step}</output>
          <Wizard steps={steps} step={step} onStepChange={onStepChange} visited={visited} onVisitedChange={onVisitedChange}>
            <Steps />
          </Wizard>
        </Form>
      )
    }

    it('round-trips step through onStepChange', async () => {
      const user = userEvent.setup()
      render(<Controlled initial="account" />)
      await user.click(screen.getByRole('button', { name: 'next' }))
      await waitFor(() => expect(screen.getByTestId('param')).toHaveTextContent('plan'))
      expect(screen.getByTestId('current')).toHaveTextContent('plan')
    })

    it('redirects an unknown or unvisited step to the last visited one', async () => {
      render(<Controlled initial="review" />)
      await waitFor(() => expect(screen.getByTestId('param')).toHaveTextContent('account'))
      expect(screen.getByTestId('current')).toHaveTextContent('account')
    })

    it('restores from a controlled visited list and reports changes', async () => {
      const user = userEvent.setup()
      const onVisitedChange = vi.fn()
      render(<Controlled initial="plan" visited={['account', 'plan']} onVisitedChange={onVisitedChange} />)
      expect(screen.getByTestId('current')).toHaveTextContent('plan')
      expect(screen.getByTestId('status')).toHaveTextContent('account:completed plan:current review:upcoming')
      await user.click(screen.getByRole('button', { name: 'next' }))
      await waitFor(() => expect(onVisitedChange).toHaveBeenCalledWith(['account', 'plan', 'review']))
    })

    it('redirects a step beyond the restored visited list to the last visited step', async () => {
      render(<Controlled initial="review" visited={['account', 'plan']} />)
      await waitFor(() => expect(screen.getByTestId('param')).toHaveTextContent('plan'))
    })
  })

  it('throws outside <Form> and useWizard throws outside <Wizard>', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() =>
      render(
        <Wizard steps={steps}>
          <p />
        </Wizard>,
      ),
    ).toThrow('ez-form: <Wizard> must be rendered inside <Form>')
    expect(() =>
      render(
        <Form schema={schema} defaultValues={filled} onSubmit={() => {}}>
          <Controls />
        </Form>,
      ),
    ).toThrow('ez-form: <Controls> must be rendered inside <Wizard>')
  })
})
```

Add `import { useState } from 'react'` at the top. In `Controls`, call `useWizard('Controls')` so the last assertion's message matches.

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run src/Wizard/Wizard.test.tsx`
Expected: FAIL, cannot resolve `./Wizard`.

- [ ] **Step 3: Implement the context and hook**

`src/Wizard/WizardContext.ts`:

```ts
import { createContext, type ReactNode } from 'react'
import type { FieldValues, Path } from 'react-hook-form'

export interface WizardStepDef<TIn extends FieldValues = FieldValues> {
  id: string
  label: ReactNode
  /** Field paths validated by Next. Omit for steps with nothing to validate (a review step). */
  fields?: readonly Path<TIn>[]
  /** Secondary text under the label (`StepLabel optional`). */
  optional?: ReactNode
}

export type WizardStepStatus = 'current' | 'completed' | 'visited' | 'upcoming'

export interface WizardContextValue {
  steps: readonly WizardStepDef[]
  current: WizardStepDef
  index: number
  visited: readonly string[]
  orientation: 'horizontal' | 'vertical'
  isFirst: boolean
  isLast: boolean
  /** True while `next()` / a forward `go()` is validating. */
  pending: boolean
  /** Validates the current step's fields; on success moves forward. Resolves to whether it moved. */
  next: () => Promise<boolean>
  /** Moves back without validating. */
  prev: () => void
  /** Moves to a visited step (or the one right after the last visited, validating first). Resolves to whether it moved. */
  go: (id: string) => Promise<boolean>
  stepStatus: (id: string) => WizardStepStatus
  /** Vertical orientation: where the active step's content is portaled (set by `WizardStepper`). */
  contentEl: HTMLElement | null
  setContentEl: (el: HTMLElement | null) => void
}

export const WizardContext = createContext<WizardContextValue | null>(null)
```

`src/Wizard/useWizard.ts`:

```ts
import { useContext } from 'react'
import { WizardContext, type WizardContextValue } from './WizardContext'

/** The wizard's state and navigation. Throws outside `<Wizard>`, naming the caller. */
export function useWizard(componentName = 'useWizard'): WizardContextValue {
  const ctx = useContext(WizardContext)
  if (!ctx) throw new Error(`ez-form: <${componentName}> must be rendered inside <Wizard>`)
  return ctx
}

/** For components that adapt to a wizard when there is one (ReadOnlyField's Edit link). */
export function useOptionalWizard(): WizardContextValue | null {
  return useContext(WizardContext)
}
```

- [ ] **Step 4: Implement Wizard**

`src/Wizard/Wizard.tsx`:

```tsx
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { get, useFormState, type FieldValues, type Path } from 'react-hook-form'
import { useEzFormContext } from '../useEzFormContext'
import { WizardContext, type WizardContextValue, type WizardStepDef, type WizardStepStatus } from './WizardContext'

export type { WizardStepDef, WizardStepStatus } from './WizardContext'

export interface WizardProps<TIn extends FieldValues> {
  steps: readonly WizardStepDef<TIn>[]
  /** Controlled current step id. Omit for internal state. */
  step?: string
  /**
   * Called with the step the wizard wants to show: after Next / Prev / a
   * stepper click, and when a controlled `step` is unknown or not yet
   * reachable (it then asks for the last visited step). A controlled wizard
   * does not move until the consumer feeds the new `step` back.
   */
  onStepChange?: (step: WizardStepDef<TIn>) => void
  /**
   * Controlled list of step ids the user has reached: which stepper steps are
   * clickable and where an unreachable `step` redirects. Omit for internal
   * state. Save it with draft values so a returning user resumes where they
   * left off.
   */
  visited?: readonly string[]
  onVisitedChange?: (ids: readonly string[]) => void
  orientation?: 'horizontal' | 'vertical'
  children: ReactNode
}

/**
 * Multi-step navigation over one `<Form>`. Values live in hookform; the
 * wizard only knows which step is current and which have been visited.
 * Next validates the current step's `fields` with `trigger`; submit (the
 * whole schema) is `<SubmitButton>` on the last step.
 */
export function Wizard<TIn extends FieldValues>({
  steps,
  step,
  onStepChange,
  visited: visitedProp,
  onVisitedChange,
  orientation = 'horizontal',
  children,
}: WizardProps<TIn>) {
  const { trigger, control } = useEzFormContext('Wizard')
  const { errors } = useFormState({ control })
  const firstId = steps[0].id
  const [stepState, setStepState] = useState(firstId)
  const [visitedState, setVisitedState] = useState<readonly string[]>([firstId])
  const [pending, setPending] = useState(false)
  const [contentEl, setContentEl] = useState<HTMLElement | null>(null)

  const visited = visitedProp ?? visitedState
  const requestedId = step ?? stepState
  const indexOf = useCallback((id: string) => steps.findIndex((s) => s.id === id), [steps])
  const lastVisitedIndex = Math.max(0, ...visited.map(indexOf))
  // A controlled `step` that is unknown or not yet visited is shown as the last visited step
  // while the effect below asks the consumer to move there.
  const reachable = indexOf(requestedId) !== -1 && visited.includes(requestedId)
  const index = reachable ? indexOf(requestedId) : lastVisitedIndex
  const current = steps[index]

  const markVisited = useCallback(
    (id: string) => {
      if (visited.includes(id)) return
      const nextVisited = [...visited, id]
      if (visitedProp === undefined) setVisitedState(nextVisited)
      onVisitedChange?.(nextVisited)
    },
    [visited, visitedProp, onVisitedChange],
  )

  const move = useCallback(
    (to: number) => {
      const target = steps[to]
      markVisited(target.id)
      if (step === undefined) setStepState(target.id)
      onStepChange?.(target)
    },
    [steps, markVisited, step, onStepChange],
  )

  useEffect(() => {
    if (step === undefined) return
    if (!reachable) onStepChange?.(steps[lastVisitedIndex])
  }, [step, reachable, steps, lastVisitedIndex, onStepChange])

  const validateCurrent = useCallback(async () => {
    const fields = current.fields as readonly Path<TIn>[] | undefined
    if (!fields?.length) return true
    setPending(true)
    try {
      return await trigger(fields as string[], { shouldFocus: true })
    } finally {
      setPending(false)
    }
  }, [current, trigger])

  const next = useCallback(async () => {
    if (index >= steps.length - 1) return false
    if (!(await validateCurrent())) return false
    move(index + 1)
    return true
  }, [index, steps.length, validateCurrent, move])

  const prev = useCallback(() => {
    if (index > 0) move(index - 1)
  }, [index, move])

  const go = useCallback(
    async (id: string) => {
      const to = indexOf(id)
      if (to === -1 || to === index) return false
      const allowed = visited.includes(id) || to === lastVisitedIndex + 1
      if (!allowed) return false
      if (to > index && !(await validateCurrent())) return false
      move(to)
      return true
    },
    [indexOf, index, visited, lastVisitedIndex, validateCurrent, move],
  )

  const hasError = useCallback(
    (def: WizardStepDef) => (def.fields ?? []).some((f) => get(errors, f) !== undefined),
    [errors],
  )

  const stepStatus = useCallback(
    (id: string): WizardStepStatus => {
      if (id === current.id) return 'current'
      if (!visited.includes(id)) return 'upcoming'
      const def = steps[indexOf(id)]
      return def && hasError(def) ? 'visited' : 'completed'
    },
    [current.id, visited, steps, indexOf, hasError],
  )

  const value = useMemo<WizardContextValue>(
    () => ({
      steps,
      current,
      index,
      visited,
      orientation,
      isFirst: index === 0,
      isLast: index === steps.length - 1,
      pending,
      next,
      prev,
      go,
      stepStatus,
      contentEl,
      setContentEl,
    }),
    [steps, current, index, visited, orientation, pending, next, prev, go, stepStatus, contentEl],
  )

  return <WizardContext.Provider value={value}>{children}</WizardContext.Provider>
}
```

`src/Wizard/WizardStep.tsx`:

```tsx
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import { useWizard } from './useWizard'

export interface WizardStepProps {
  id: string
  children: ReactNode
}

/**
 * One step's content. Renders only while its step is current: in place for a
 * horizontal wizard, inside the stepper's `StepContent` (a portal, so form
 * context still reaches the fields) for a vertical one.
 */
export function WizardStep({ id, children }: WizardStepProps) {
  const { current, orientation, contentEl } = useWizard('WizardStep')
  if (current.id !== id) return null
  if (orientation === 'vertical') return contentEl ? createPortal(children, contentEl) : null
  return <>{children}</>
}
```

`src/Wizard/index.ts` (Tasks 6 and 7 append their lines):

```ts
export { Wizard, type WizardProps, type WizardStepDef, type WizardStepStatus } from './Wizard'
export { WizardStep, type WizardStepProps } from './WizardStep'
export { useWizard, useOptionalWizard } from './useWizard'
export type { WizardContextValue } from './WizardContext'
```

- [ ] **Step 5: Run the tests**

Run: `pnpm vitest run src/Wizard/Wizard.test.tsx`
Expected: PASS. If `trigger(fields as string[])` does not type-check, cast through `trigger(fields as unknown as Path<FieldValues>[] , …)` — `useEzFormContext` returns an untyped `UseFormReturn`, so `string[]` is the expected shape.

- [ ] **Step 6: Typecheck, format, commit**

Run: `pnpm typecheck && pnpm format`

```bash
git add src/Wizard
git commit -m "feat(Wizard): context, controlled/uncontrolled step and visited state, WizardStep"
```

---

### Task 6: WizardStepper (horizontal + vertical)

**Files:**
- Create: `src/Wizard/WizardStepper.tsx`
- Modify: `src/Wizard/Wizard.test.tsx` (append a `describe('WizardStepper')`)
- Modify: `src/Wizard/index.ts`

**Interfaces:**
- Consumes: `useWizard`, `WizardContextValue.setContentEl` (Task 5).
- Produces: `WizardStepper(props: Omit<StepperProps, 'activeStep' | 'orientation' | 'nonLinear' | 'children'>)`.

- [ ] **Step 1: Write the failing tests**

Append to `src/Wizard/Wizard.test.tsx` (import `WizardStepper` from `./WizardStepper` and `expectNoA11yViolations` from `../test/axe`):

```tsx
describe('WizardStepper', () => {
  function Inline({ orientation }: { orientation?: 'horizontal' | 'vertical' }) {
    return (
      <Form schema={schema} defaultValues={filled} onSubmit={() => {}}>
        <Wizard steps={steps} orientation={orientation}>
          <WizardStepper />
          <Steps />
        </Wizard>
      </Form>
    )
  }

  it('shows every step; visited steps are buttons, upcoming steps are not', async () => {
    const user = userEvent.setup()
    render(<Inline />)
    expect(screen.getByText('Account')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Plan/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'next' }))
    await waitFor(() => expect(screen.getByRole('button', { name: /Account/ })).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /Plan/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Review/ })).not.toBeInTheDocument()
  })

  it('clicking a visited step goes there', async () => {
    const user = userEvent.setup()
    render(<Inline />)
    await user.click(screen.getByRole('button', { name: 'next' }))
    await waitFor(() => expect(screen.getByTestId('current')).toHaveTextContent('plan'))
    await user.click(screen.getByRole('button', { name: /Account/ }))
    expect(screen.getByTestId('current')).toHaveTextContent('account')
    expect(screen.getByRole('textbox', { name: 'Name' })).toBeInTheDocument()
  })

  it('vertical: the current step content renders inside the stepper and is still bound to the form', async () => {
    const user = userEvent.setup()
    const { container } = render(<Inline orientation="vertical" />)
    const stepper = container.querySelector('.MuiStepper-vertical')!
    await waitFor(() => expect(stepper.querySelector('input[name="name"]')).not.toBeNull())
    await user.type(screen.getByRole('textbox', { name: 'Name' }), '!')
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Ada!')
    await user.click(screen.getByRole('button', { name: 'next' }))
    await waitFor(() => expect(stepper.querySelector('input[name="plan"]')).not.toBeNull())
    expect(stepper.querySelector('input[name="name"]')).toBeNull()
  })

  it.each(['horizontal', 'vertical'] as const)('%s has no accessibility violations', async (orientation) => {
    const user = userEvent.setup()
    const { container } = render(<Inline orientation={orientation} />)
    await user.click(screen.getByRole('button', { name: 'next' }))
    await waitFor(() => expect(screen.getByTestId('current')).toHaveTextContent('plan'))
    await expectNoA11yViolations(container)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run src/Wizard/Wizard.test.tsx -t WizardStepper`
Expected: FAIL, cannot resolve `./WizardStepper`.

- [ ] **Step 3: Implement**

`src/Wizard/WizardStepper.tsx`:

```tsx
import Step from '@mui/material/Step'
import StepButton from '@mui/material/StepButton'
import StepContent from '@mui/material/StepContent'
import StepLabel from '@mui/material/StepLabel'
import Stepper, { type StepperProps } from '@mui/material/Stepper'
import { useWizard } from './useWizard'

export type WizardStepperProps = Omit<StepperProps, 'activeStep' | 'orientation' | 'nonLinear' | 'children'>

/**
 * MUI Stepper driven by the wizard: visited steps are buttons (`StepButton`),
 * upcoming steps are plain labels, a visited step with an error is marked.
 * Vertical: the current step's `StepContent` hosts that `WizardStep`'s
 * children.
 */
export function WizardStepper(props: WizardStepperProps) {
  const { steps, index, orientation, stepStatus, go, setContentEl } = useWizard('WizardStepper')
  return (
    <Stepper {...props} nonLinear activeStep={index} orientation={orientation}>
      {steps.map((step) => {
        const status = stepStatus(step.id)
        const label = (
          <StepLabel optional={step.optional} error={status === 'visited'}>
            {step.label}
          </StepLabel>
        )
        return (
          <Step key={step.id} completed={status === 'completed'} disabled={status === 'upcoming'}>
            {status === 'upcoming' ? (
              label
            ) : (
              <StepButton color="inherit" optional={step.optional} onClick={() => void go(step.id)}>
                {status === 'visited' ? <StepLabel error>{step.label}</StepLabel> : step.label}
              </StepButton>
            )}
            {orientation === 'vertical' && (
              <StepContent>{status === 'current' && <div ref={setContentEl} />}</StepContent>
            )}
          </Step>
        )
      })}
    </Stepper>
  )
}
```

`StepButton` already renders a `StepLabel` inside; passing a `StepLabel` as its child nests two labels. Check `node_modules/@mui/material/StepButton/StepButton.d.ts`: if it has no `error` passthrough, keep the nested `StepLabel error` for visited-with-error only (as above); otherwise pass `error` directly and use `step.label` as the child everywhere. Verify in Storybook that the visited-with-error step renders once, not twice.

Append to `src/Wizard/index.ts`:

```ts
export { WizardStepper, type WizardStepperProps } from './WizardStepper'
```

- [ ] **Step 4: Run the tests**

Run: `pnpm vitest run src/Wizard/Wizard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Typecheck, format, commit**

```bash
pnpm typecheck && pnpm format
git add src/Wizard
git commit -m "feat(Wizard): WizardStepper on MUI Stepper, horizontal and vertical"
```

---

### Task 6b: Theming retrofit (added Sept 2 after Steve's no-styling rule)

**Files:**
- Modify: `src/ConfirmDialog/ConfirmDialog.tsx`, `src/ClearButton/ClearButton.tsx`, `src/SubmitButton/SubmitButton.tsx`, `src/Wizard/WizardStepper.tsx` (+ their tests and `index.ts` files)
- Create: `src/theme/augmentation.ts`
- Modify: `src/index.ts`

**Interfaces:**
- Produces: `confirmDialogClasses`, `clearButtonClasses`, `submitButtonClasses`, `wizardStepperClasses`; theme keys `EzConfirmDialog`, `EzClearButton`, `EzSubmitButton`, `EzWizardStepper` (plus `EzWizardNav`, `EzReadOnlyField` filled in by Tasks 7/8/10).

- [ ] **Step 1:** Follow the pattern and checklist in `.superpowers/sdd/2026-09-02-ez-form-v4-wizard/theming-pattern.md` (the pattern is also summarized in spec Section 5). For each component: themeability test first (RED), then `useDefaultProps` + `styled` slots + `generateUtilityClasses` (GREEN); remove every `sx`, ripple prop, and literal variant. Existing tests stay green.
- [ ] **Step 2:** `pnpm typecheck && pnpm format && pnpm test`; commit.

Split across worktrees: A does ConfirmDialog / ClearButton / SubmitButton / augmentation; C does WizardStepper.

---

### Task 7: WizardNav

**Files:**
- Create: `src/Wizard/WizardNav.tsx`
- Modify: `src/Wizard/Wizard.test.tsx` (append a `describe('WizardNav')`)
- Modify: `src/Wizard/index.ts`

**Interfaces:**
- Consumes: `useWizard` (Task 5), `SubmitButton`.
- Produces: `WizardNav({ prevLabel?, nextLabel?, submitLabel?, slotProps?: { prev?: ButtonProps; next?: ButtonProps; submit?: SubmitButtonProps } } & StackProps)`.

- [ ] **Step 1: Write the failing tests**

Append to `src/Wizard/Wizard.test.tsx` (import `WizardNav` from `./WizardNav`):

```tsx
describe('WizardNav', () => {
  function Inline({ onSubmit = () => {} }: { onSubmit?: () => void }) {
    return (
      <Form schema={schema} defaultValues={filled} onSubmit={onSubmit}>
        <Wizard steps={steps}>
          <WizardStep id="account">
            <TextField name="name" label="Name" />
          </WizardStep>
          <WizardStep id="plan">
            <TextField name="plan" label="Plan" />
          </WizardStep>
          <WizardStep id="review">
            <p>Review</p>
          </WizardStep>
          <WizardNav />
        </Wizard>
      </Form>
    )
  }

  it('Back is disabled on the first step; Next advances; the last step shows Submit', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<Inline onSubmit={onSubmit} />)
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Submit' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Plan' })).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Back' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await waitFor(() => expect(screen.getByText('Review')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(filled, expect.anything()))
  })

  it('Next stays put and shows the error when the step is invalid', async () => {
    const user = userEvent.setup()
    render(<Inline />)
    await user.clear(screen.getByRole('textbox', { name: 'Name' }))
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(await screen.findByText('Name is required')).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Plan' })).not.toBeInTheDocument()
  })

  it('custom labels', () => {
    render(
      <Form schema={schema} defaultValues={filled} onSubmit={() => {}}>
        <Wizard steps={steps}>
          <WizardNav prevLabel="Previous" nextLabel="Continue" />
        </Wizard>
      </Form>,
    )
    expect(screen.getByRole('button', { name: 'Previous' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run src/Wizard/Wizard.test.tsx -t WizardNav`
Expected: FAIL, cannot resolve `./WizardNav`.

- [ ] **Step 3: Implement**

`src/Wizard/WizardNav.tsx`:

```tsx
import type { ReactNode } from 'react'
import Button, { type ButtonProps } from '@mui/material/Button'
import Stack, { type StackProps } from '@mui/material/Stack'
import { useFormState } from 'react-hook-form'
import { SubmitButton, type SubmitButtonProps } from '../SubmitButton'
import { mergeDisabled } from '../fields/mergeDisabled'
import { useWizard } from './useWizard'

export interface WizardNavProps extends StackProps {
  /** Default `Back`. */
  prevLabel?: ReactNode
  /** Default `Next`. */
  nextLabel?: ReactNode
  /** Default `Submit` (SubmitButton's default). */
  submitLabel?: ReactNode
  slotProps?: {
    prev?: ButtonProps
    next?: ButtonProps
    submit?: SubmitButtonProps
  }
}

/**
 * Back / Next for the current step; on the last step Next becomes
 * `<SubmitButton>`, so the whole schema (and `<Form confirm>`) applies.
 */
export function WizardNav({
  prevLabel = 'Back',
  nextLabel = 'Next',
  submitLabel,
  slotProps,
  direction = 'row',
  spacing = 1,
  justifyContent = 'space-between',
  ...rest
}: WizardNavProps) {
  const { isFirst, isLast, pending, next, prev } = useWizard('WizardNav')
  const { disabled: formDisabled } = useFormState()
  return (
    <Stack direction={direction} spacing={spacing} justifyContent={justifyContent} {...rest}>
      <Button
        type="button"
        variant="text"
        onClick={prev}
        {...slotProps?.prev}
        disabled={isFirst || mergeDisabled(slotProps?.prev?.disabled, formDisabled)}
      >
        {prevLabel}
      </Button>
      {isLast ? (
        <SubmitButton {...slotProps?.submit}>{submitLabel ?? slotProps?.submit?.children}</SubmitButton>
      ) : (
        <Button
          type="button"
          variant="contained"
          onClick={() => void next()}
          loading={pending}
          {...slotProps?.next}
          disabled={mergeDisabled(slotProps?.next?.disabled, formDisabled)}
        >
          {nextLabel}
        </Button>
      )}
    </Stack>
  )
}
```

`SubmitButton` defaults `children` to `Submit` only when the prop is `undefined`; `submitLabel ?? slotProps?.submit?.children` preserves that.

Append to `src/Wizard/index.ts`:

```ts
export { WizardNav, type WizardNavProps } from './WizardNav'
```

- [ ] **Step 4: Run all Wizard tests**

Run: `pnpm vitest run src/Wizard`
Expected: PASS.

- [ ] **Step 5: Typecheck, format, commit**

```bash
pnpm typecheck && pnpm format
git add src/Wizard
git commit -m "feat(Wizard): WizardNav (Back / Next / Submit on last step)"
```

---

### Task 8: ReadOnlyField

**Files:**
- Create: `src/fields/ReadOnlyField/humanize.ts`
- Create: `src/fields/ReadOnlyField/humanize.test.ts`
- Create: `src/fields/ReadOnlyField/ReadOnlyField.tsx`
- Create: `src/fields/ReadOnlyField/ReadOnlyField.test.tsx`
- Create: `src/fields/ReadOnlyField/ReadOnlyField.stories.tsx`
- Create: `src/fields/ReadOnlyField/index.ts`
- Modify: `src/index.ts`

**Interfaces:**
- Consumes: `useOptionalWizard` (Task 5), `Option` (`src/fields/Option.ts`), `useEzFormContext`.
- Produces: `ReadOnlyField({ name; label?; options?; format?; empty?; editStep?; slotProps? })`.

- [ ] **Step 1: Write the failing humanize test**

`src/fields/ReadOnlyField/humanize.test.ts`:

```ts
import { humanize } from './humanize'

describe('humanize', () => {
  it.each([
    ['cardNumber', 'Card number'],
    ['address.zipCode', 'Zip code'],
    ['items.0.sku', 'Sku'],
    ['first_name', 'First name'],
    ['email', 'Email'],
  ])('%s → %s', (input, expected) => {
    expect(humanize(input)).toBe(expected)
  })
})
```

- [ ] **Step 2: Run to verify it fails, implement, run to verify it passes**

Run: `pnpm vitest run src/fields/ReadOnlyField/humanize.test.ts` → FAIL.

`src/fields/ReadOnlyField/humanize.ts`:

```ts
/** `address.zipCode` → `Zip code`: last path segment, camelCase / snake_case split, first letter upper. */
export function humanize(path: string): string {
  const last = path.split('.').at(-1) ?? path
  const words = last
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}
```

Run again → PASS.

- [ ] **Step 3: Write the failing ReadOnlyField tests**

`src/fields/ReadOnlyField/ReadOnlyField.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { z } from 'zod'
import { Form } from '../../Form'
import { TextField } from '../TextField'
import { Wizard, WizardStep } from '../../Wizard'
import { ReadOnlyField } from './ReadOnlyField'
import { expectNoA11yViolations } from '../../test/axe'

const schema = z.object({
  email: z.string(),
  role: z.string(),
  tags: z.array(z.string()),
  tos: z.boolean(),
  when: z.date().nullable(),
  cardNumber: z.string(),
})
const values = {
  email: 'ada@x.io',
  role: 'admin',
  tags: ['a', 'b'],
  tos: true,
  when: null,
  cardNumber: '',
}
const roles = [
  { value: 'admin', label: 'Administrator' },
  { value: 'user', label: 'User' },
]

const wrap = (ui: React.ReactNode) =>
  render(
    <Form schema={schema} defaultValues={values} onSubmit={() => {}}>
      {ui}
    </Form>,
  )

describe('ReadOnlyField', () => {
  it('shows the label above the value', () => {
    wrap(<ReadOnlyField name="email" label="Email" />)
    expect(screen.getByText('Email')).toBeInTheDocument()
    expect(screen.getByText('ada@x.io')).toBeInTheDocument()
  })

  it('humanizes the name when there is no label', () => {
    wrap(<ReadOnlyField name="cardNumber" />)
    expect(screen.getByText('Card number')).toBeInTheDocument()
  })

  it('looks up option labels, joins arrays, renders booleans as Yes/No, and empties as —', () => {
    wrap(
      <>
        <ReadOnlyField name="role" options={roles} />
        <ReadOnlyField name="tags" />
        <ReadOnlyField name="tos" />
        <ReadOnlyField name="when" />
        <ReadOnlyField name="cardNumber" empty="none" />
      </>,
    )
    expect(screen.getByText('Administrator')).toBeInTheDocument()
    expect(screen.getByText('a, b')).toBeInTheDocument()
    expect(screen.getByText('Yes')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.getByText('none')).toBeInTheDocument()
  })

  it('format wins over every default', () => {
    wrap(<ReadOnlyField name="tags" format={(v) => `${(v as string[]).length} tags`} />)
    expect(screen.getByText('2 tags')).toBeInTheDocument()
  })

  it('is live: reflects edits to the field', async () => {
    const user = userEvent.setup()
    wrap(
      <>
        <TextField name="email" label="Edit email" />
        <ReadOnlyField name="email" label="Email" />
      </>,
    )
    await user.type(screen.getByRole('textbox', { name: 'Edit email' }), 'x')
    expect(await screen.findByText('ada@x.iox')).toBeInTheDocument()
  })

  it('editStep shows an Edit button inside a Wizard that goes to that step, and nothing outside', async () => {
    const user = userEvent.setup()
    wrap(<ReadOnlyField name="email" editStep="account" />)
    expect(screen.queryByRole('button', { name: /Edit/ })).not.toBeInTheDocument()

    const steps = [
      { id: 'account', label: 'Account', fields: ['email'] },
      { id: 'review', label: 'Review' },
    ] as const
    wrap(
      <Wizard steps={steps} step="review" visited={['account', 'review']}>
        <WizardStep id="account">
          <TextField name="email" label="Edit email" />
        </WizardStep>
        <WizardStep id="review">
          <ReadOnlyField name="email" label="Email" editStep="account" />
        </WizardStep>
      </Wizard>,
    )
    await user.click(screen.getByRole('button', { name: 'Edit Email' }))
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Edit email' })).toBeInTheDocument())
  })

  it('has no accessibility violations', async () => {
    const { container } = wrap(<ReadOnlyField name="email" label="Email" />)
    await expectNoA11yViolations(container)
  })

  it('throws outside <Form>', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<ReadOnlyField name="email" />)).toThrow(
      'ez-form: <ReadOnlyField> must be rendered inside <Form>',
    )
  })
})
```

The `editStep` test uses a controlled `step` without `onStepChange`; that is an uncontrolled-visited, controlled-step wizard that never moves, so the wizard must be uncontrolled for the click to move: change that render to `<Wizard steps={steps}>` and first navigate with a `useWizard` probe, or simpler, render uncontrolled and reach review by giving `visited`… `visited` alone does not set the current step. Use this instead:

```tsx
    function ReviewFirst() {
      const [step, setStep] = useState('review')
      return (
        <Wizard steps={steps} step={step} onStepChange={(s) => setStep(s.id)} visited={['account', 'review']}>
          …same children…
        </Wizard>
      )
    }
    wrap(<ReviewFirst />)
```

and `import { useState } from 'react'`.

- [ ] **Step 4: Run to verify it fails**

Run: `pnpm vitest run src/fields/ReadOnlyField/ReadOnlyField.test.tsx`
Expected: FAIL, cannot resolve `./ReadOnlyField`.

- [ ] **Step 5: Implement**

`src/fields/ReadOnlyField/ReadOnlyField.tsx`:

```tsx
import { useId, type ReactNode } from 'react'
import Button from '@mui/material/Button'
import Stack, { type StackProps } from '@mui/material/Stack'
import Typography, { type TypographyProps } from '@mui/material/Typography'
import { useWatch } from 'react-hook-form'
import { useEzFormContext } from '../../useEzFormContext'
import { useOptionalWizard } from '../../Wizard/useWizard'
import type { Option } from '../Option'
import { humanize } from './humanize'

export interface ReadOnlyFieldProps {
  /** Form path to display. Read with `useWatch`; never registered, never validated. */
  name: string
  /** Defaults to a humanized `name` (`cardNumber` → `Card number`). */
  label?: ReactNode
  /** Show the matching option label(s) instead of the raw value. */
  options?: readonly Option[]
  /** Custom rendering; wins over every default. */
  format?: (value: unknown) => ReactNode
  /** Shown for `'' | null | undefined | []`. Default `—`. */
  empty?: ReactNode
  /** Inside a `Wizard`: renders an Edit button that goes to this step. Ignored outside one. */
  editStep?: string
  slotProps?: {
    root?: StackProps
    label?: TypographyProps
    value?: TypographyProps
  }
}

const isEmpty = (v: unknown) => v === '' || v === null || v === undefined || (Array.isArray(v) && v.length === 0)

function display(value: unknown, options?: readonly Option[]): ReactNode {
  if (Array.isArray(value)) return value.map((v) => display(v, options)).join(', ')
  if (options) {
    const match = options.find((o) => o.value === value)
    if (match) return match.label
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (value instanceof Date) return value.toLocaleString()
  if (typeof File !== 'undefined' && value instanceof File) return value.name
  return String(value)
}

/**
 * A value from the form, read-only: small secondary label above, the value
 * below. For review / summary steps. Typography, not a disabled TextField,
 * so the value keeps full contrast.
 */
export function ReadOnlyField({ name, label, options, format, empty = '—', editStep, slotProps }: ReadOnlyFieldProps) {
  useEzFormContext('ReadOnlyField')
  const value = useWatch({ name })
  const wizard = useOptionalWizard()
  const labelId = useId()
  const text = label ?? humanize(name)
  const content = format ? format(value) : isEmpty(value) ? empty : display(value, options)
  const editable = editStep !== undefined && wizard !== null

  return (
    <Stack {...slotProps?.root} aria-labelledby={labelId}>
      <Stack direction="row" alignItems="baseline" justifyContent="space-between" spacing={1}>
        <Typography id={labelId} variant="caption" color="text.secondary" {...slotProps?.label}>
          {text}
        </Typography>
        {editable && (
          <Button size="small" onClick={() => void wizard.go(editStep)} aria-label={`Edit ${typeof text === 'string' ? text : name}`}>
            Edit
          </Button>
        )}
      </Stack>
      <Typography variant="body1" {...slotProps?.value}>
        {content}
      </Typography>
    </Stack>
  )
}
```

`src/fields/ReadOnlyField/index.ts`:

```ts
export { ReadOnlyField, type ReadOnlyFieldProps } from './ReadOnlyField'
```

- [ ] **Step 6: Run the tests**

Run: `pnpm vitest run src/fields/ReadOnlyField`
Expected: PASS. If axe reports `aria-labelledby` on the root `Stack` div, drop that attribute (the visible label already sits directly above the value) and keep the test.

- [ ] **Step 7: Story, export**

`src/fields/ReadOnlyField/ReadOnlyField.stories.tsx`:

```tsx
import type { Meta, StoryObj } from '@storybook/react-vite'
import Stack from '@mui/material/Stack'
import { z } from 'zod'
import { ReadOnlyField } from './ReadOnlyField'
import { TextField } from '../TextField'
import type { FormParameters } from '../../../.storybook/preview'

const schema = z.object({
  name: z.string(),
  role: z.string(),
  tags: z.array(z.string()),
  tos: z.boolean(),
  cardNumber: z.string(),
})

const roles = [
  { value: 'admin', label: 'Administrator' },
  { value: 'user', label: 'User' },
]

const meta = {
  title: 'Fields/ReadOnlyField',
  component: ReadOnlyField,
  parameters: {
    layout: 'centered',
    form: { schema, defaultValues: { name: 'Ada Lovelace', role: 'admin', tags: ['math', 'engines'], tos: true, cardNumber: '' } },
  } satisfies FormParameters & Record<string, unknown>,
  args: { name: 'name', label: 'Name' },
} satisfies Meta<typeof ReadOnlyField>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Summary: Story = {
  render: () => (
    <Stack spacing={2}>
      <TextField name="name" label="Edit name (live)" />
      <ReadOnlyField name="name" />
      <ReadOnlyField name="role" options={roles} />
      <ReadOnlyField name="tags" />
      <ReadOnlyField name="tos" label="Accepted terms" />
      <ReadOnlyField name="cardNumber" />
      <ReadOnlyField name="tags" label="Tag count" format={(v) => `${(v as string[]).length} tags`} />
    </Stack>
  ),
}
```

Match the `FormParameters` import path used by the other field stories.

Append to `src/index.ts`:

```ts
export { ReadOnlyField, type ReadOnlyFieldProps } from './fields/ReadOnlyField'
```

- [ ] **Step 8: Typecheck, format, commit**

```bash
pnpm typecheck && pnpm format && pnpm vitest run src/fields/ReadOnlyField
git add src/fields/ReadOnlyField src/index.ts
git commit -m "feat: ReadOnlyField for review steps (label above value, options, format, Edit link)"
```

---

### Task 9: Wizard stories (Horizontal, Vertical, Resume, ReactRouter)

**Files:**
- Create: `src/Wizard/Wizard.stories.tsx`
- Create: `src/Wizard/WizardRouter.stories.tsx`
- Modify: `package.json` (devDependency `react-router`, if Task 4 has not merged yet)

**Interfaces:**
- Consumes: everything from Tasks 5–8, `ClearButton` is **not** required (worktree A may not be merged); use only `Wizard/*`, `ReadOnlyField`, `SubmitButton`, fields.

- [ ] **Step 1: Ensure react-router is installed**

```bash
pnpm add -D react-router@^7
```

(No-op if already present from Task 4.)

- [ ] **Step 2: Inline stories**

`src/Wizard/Wizard.stories.tsx`:

```tsx
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { useEffect, useState } from 'react'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { z } from 'zod'
import { Form } from '../Form'
import { TextField } from '../fields/TextField'
import { Select } from '../fields/Select'
import { NumberField } from '../fields/NumberField'
import { Checkbox } from '../fields/Checkbox'
import { ReadOnlyField } from '../fields/ReadOnlyField'
import { Wizard, type WizardStepDef } from './Wizard'
import { WizardStep } from './WizardStep'
import { WizardStepper } from './WizardStepper'
import { WizardNav } from './WizardNav'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.email('Invalid email'),
  plan: z.enum(['basic', 'pro'], { error: 'Pick a plan' }),
  seats: z.number().min(1, 'At least one seat'),
  tos: z.boolean().refine(Boolean, { error: 'You must accept the terms' }),
})
type Input = z.input<typeof schema>

const plans = [
  { value: 'basic', label: 'Basic' },
  { value: 'pro', label: 'Pro' },
] as const

export const steps = [
  { id: 'account', label: 'Account', fields: ['name', 'email'] },
  { id: 'plan', label: 'Plan', optional: 'Seats are billed monthly', fields: ['plan', 'seats'] },
  { id: 'review', label: 'Review', fields: ['tos'] },
] as const satisfies WizardStepDef<Input>[]

export const emptyValues = { name: '', email: '', seats: 1, tos: false } as Partial<Input>

export function StepsContent() {
  return (
    <>
      <WizardStep id="account">
        <Stack spacing={2}>
          <TextField name="name" label="Name" required />
          <TextField name="email" label="Email" required />
        </Stack>
      </WizardStep>
      <WizardStep id="plan">
        <Stack spacing={2}>
          <Select name="plan" label="Plan" options={plans} required />
          <NumberField name="seats" label="Seats" min={1} />
        </Stack>
      </WizardStep>
      <WizardStep id="review">
        <Stack spacing={2}>
          <ReadOnlyField name="name" editStep="account" />
          <ReadOnlyField name="email" editStep="account" />
          <ReadOnlyField name="plan" options={plans} editStep="plan" />
          <ReadOnlyField name="seats" editStep="plan" />
          <Checkbox name="tos" label="I accept the terms" required />
        </Stack>
      </WizardStep>
    </>
  )
}

const onSubmit = fn()

const meta = {
  title: 'Wizard',
  component: Wizard,
  parameters: { layout: 'centered' },
  args: { steps, children: null },
  render: (args) => (
    <Form schema={schema} defaultValues={emptyValues} onSubmit={onSubmit} confirm={{ title: 'Create account?' }}>
      <Stack spacing={3} sx={{ width: 480 }}>
        <Wizard {...args}>
          <WizardStepper />
          <StepsContent />
          <WizardNav submitLabel="Create account" />
        </Wizard>
      </Stack>
    </Form>
  ),
} satisfies Meta<typeof Wizard<Input>>
export default meta
type Story = StoryObj<typeof meta>

export const Horizontal: Story = {}

export const Vertical: Story = { args: { orientation: 'vertical' } }

/** Values and visited steps survive a reload through localStorage; clear storage to start over. */
export const Resume: Story = {
  render: (args) => {
    const key = 'ez-form:wizard-resume'
    const saved = (() => {
      try {
        return JSON.parse(localStorage.getItem(key) ?? 'null') as { values: Partial<Input>; visited: string[]; step: string } | null
      } catch {
        return null
      }
    })()
    const [step, setStep] = useState(saved?.step ?? 'account')
    const [visited, setVisited] = useState<readonly string[]>(saved?.visited ?? ['account'])
    const [values, setValues] = useState<Partial<Input>>(saved?.values ?? emptyValues)
    useEffect(() => {
      localStorage.setItem(key, JSON.stringify({ values, visited, step }))
    }, [values, visited, step])
    return (
      <Form
        schema={schema}
        defaultValues={values}
        onSubmit={(v, form) => {
          onSubmit(v)
          localStorage.removeItem(key)
          form.reset(emptyValues)
        }}
        onChange={(e) => {
          const form = e.currentTarget
          setValues(Object.fromEntries(new FormData(form).entries()) as Partial<Input>)
        }}
      >
        <Stack spacing={3} sx={{ width: 480 }}>
          <Typography variant="body2" color="text.secondary">
            Reload the page: you land back on “{step}”.
          </Typography>
          <Wizard {...args} step={step} onStepChange={(s) => setStep(s.id)} visited={visited} onVisitedChange={setVisited}>
            <WizardStepper />
            <StepsContent />
            <WizardNav submitLabel="Create account" />
          </Wizard>
        </Stack>
      </Form>
    )
  },
}
```

If saving values through the native `onChange` + `FormData` loses typed values (numbers, booleans), replace it with a small child component that calls `useWatch()` and `useEffect`s the result into `setValues`; either is fine for a story.

- [ ] **Step 3: React-router story**

`src/Wizard/WizardRouter.stories.tsx`:

```tsx
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { Outlet, RouterProvider, createMemoryRouter, useLocation, useNavigate, useParams } from 'react-router'
import { z } from 'zod'
import { Form } from '../Form'
import { Wizard } from './Wizard'
import { WizardStep } from './WizardStep'
import { WizardStepper } from './WizardStepper'
import { WizardNav } from './WizardNav'
import { TextField } from '../fields/TextField'
import { Select } from '../fields/Select'
import { NumberField } from '../fields/NumberField'
import { Checkbox } from '../fields/Checkbox'
import { ReadOnlyField } from '../fields/ReadOnlyField'
import { steps, emptyValues } from './Wizard.stories'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.email('Invalid email'),
  plan: z.enum(['basic', 'pro'], { error: 'Pick a plan' }),
  seats: z.number().min(1, 'At least one seat'),
  tos: z.boolean().refine(Boolean, { error: 'You must accept the terms' }),
})

const plans = [
  { value: 'basic', label: 'Basic' },
  { value: 'pro', label: 'Pro' },
] as const

const onSubmit = fn()

/** Layout route: owns the Form and the Wizard; the step routes render below through <Outlet>. */
function SignupLayout() {
  const { step = '' } = useParams()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  return (
    <Form schema={schema} defaultValues={emptyValues} onSubmit={onSubmit}>
      <Stack spacing={3} sx={{ width: 480 }}>
        <Typography variant="body2" color="text.secondary">
          URL: {pathname}
        </Typography>
        <Wizard steps={steps} step={step} onStepChange={(s) => void navigate(`/signup/${s.id}`)}>
          <WizardStepper />
          <Outlet />
          <WizardNav submitLabel="Create account" />
        </Wizard>
      </Stack>
    </Form>
  )
}

/** One route per step. The route only renders the WizardStep for its own id. */
function SignupStep() {
  const { step } = useParams()
  switch (step) {
    case 'account':
      return (
        <WizardStep id="account">
          <Stack spacing={2}>
            <TextField name="name" label="Name" required />
            <TextField name="email" label="Email" required />
          </Stack>
        </WizardStep>
      )
    case 'plan':
      return (
        <WizardStep id="plan">
          <Stack spacing={2}>
            <Select name="plan" label="Plan" options={plans} required />
            <NumberField name="seats" label="Seats" min={1} />
          </Stack>
        </WizardStep>
      )
    case 'review':
      return (
        <WizardStep id="review">
          <Stack spacing={2}>
            <ReadOnlyField name="name" editStep="account" />
            <ReadOnlyField name="email" editStep="account" />
            <ReadOnlyField name="plan" options={plans} editStep="plan" />
            <ReadOnlyField name="seats" editStep="plan" />
            <Checkbox name="tos" label="I accept the terms" required />
          </Stack>
        </WizardStep>
      )
    default:
      return null
  }
}

const routes = [
  {
    path: '/signup',
    element: <SignupLayout />,
    children: [
      { index: true, element: null },
      { path: ':step', element: <SignupStep /> },
    ],
  },
]

const meta = {
  title: 'Wizard/ReactRouter',
  parameters: { layout: 'centered' },
} satisfies Meta
export default meta

/** Starts at /signup/account. Next / Back / stepper clicks change the URL. */
export const OneRoutePerStep: StoryObj<typeof meta> = {
  render: () => <RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/signup/account'] })} />,
}

/** Deep link to /signup/review with nothing visited: the wizard asks the router for the last visited step (account). */
export const DeepLinkRedirect: StoryObj<typeof meta> = {
  render: () => <RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/signup/review'] })} />,
}
```

Storybook treats every named export of a `*.stories.tsx` file as a story; exporting `steps`, `emptyValues`, and `StepsContent` from `Wizard.stories.tsx` needs `excludeStories: /^(steps|emptyValues|StepsContent)$/` on that file's `meta`. Add it.

- [ ] **Step 4: Verify in Storybook**

Open http://localhost:6006. Check: Wizard/Horizontal (Next validates, stepper clicks, Review shows ReadOnlyFields with Edit, Submit asks "Create account?"); Wizard/Vertical (content inside the stepper); Wizard/Resume (reload keeps step); Wizard/ReactRouter/OneRoutePerStep (URL line changes); DeepLinkRedirect (URL becomes /signup/account).

- [ ] **Step 5: Typecheck, format, commit**

```bash
pnpm typecheck && pnpm format
git add src/Wizard package.json pnpm-lock.yaml
git commit -m "docs(Wizard): stories — horizontal, vertical, resume, react-router"
```

---

### Task 10: Integration — merge, exports, README, ledger

**Files:**
- Modify: `src/index.ts` (verify all lines after merge)
- Modify: `README.md`
- Create: `docs/superpowers/reviews/2026-09-02-v4-sdd-ledger.md`

- [ ] **Step 1: Merge the three worktrees into main**

```bash
git merge --no-ff <worktree-A-branch>
git merge --no-ff <worktree-B-branch>
git merge --no-ff <worktree-C-branch>
pnpm install
```

Resolve conflicts in `src/index.ts`, `README.md`, `package.json` (keep one `react-router` entry), and `pnpm-lock.yaml` (re-run `pnpm install`).

- [ ] **Step 2: Verify `src/index.ts` ends with exactly these additions**

```ts
export { ConfirmDialog, type ConfirmDialogProps, type ConfirmOptions, useConfirm, type UseConfirmReturn } from './ConfirmDialog'
export { ClearButton, type ClearButtonProps } from './ClearButton'
export { useFormGuard, type FormGuardBlocker, type UseFormGuardReturn } from './useFormGuard'
export {
  Wizard,
  type WizardProps,
  type WizardStepDef,
  type WizardStepStatus,
  type WizardContextValue,
  WizardStep,
  type WizardStepProps,
  WizardStepper,
  type WizardStepperProps,
  WizardNav,
  type WizardNavProps,
  useWizard,
  useOptionalWizard,
} from './Wizard'
export { ReadOnlyField, type ReadOnlyFieldProps } from './fields/ReadOnlyField'
```

- [ ] **Step 3: README**

Add rows to the Components table:

```md
| `Form` (v4 additions)  | —                                          | `confirm?: true \| ConfirmOptions` asks after validation on every submit path; `guard?: boolean` warns on tab close while dirty |
| `ClearButton`          | MUI `Button`                               | `to?: 'defaults' \| 'empty'`, `confirm?`; disabled while pristine |
| `ConfirmDialog`        | MUI `Dialog`                               | `open`, `title`, `message?`, `confirmLabel?`, `cancelLabel?`, `confirmColor?`, `onConfirm`, `onCancel`; `useConfirm()` gives a promise API |
| `Wizard`               | MUI `Stepper`                              | `steps`, `step?`/`onStepChange?`, `visited?`/`onVisitedChange?`, `orientation?`; with `WizardStepper`, `WizardStep`, `WizardNav`, `useWizard` |
| `ReadOnlyField`        | MUI `Typography`                           | `name`, `label?`, `options?`, `format?`, `empty?`, `editStep?` |
```

Add a section after the components table:

````md
## Wizard

One `<Form>` and one schema above every step. `Next` validates only the current step's `fields`; `Submit` on the last step validates everything.

```tsx
const steps = [
  { id: 'account', label: 'Account', fields: ['name', 'email'] },
  { id: 'plan', label: 'Plan', fields: ['plan'] },
  { id: 'review', label: 'Review' },
] as const satisfies WizardStepDef<z.input<typeof schema>>[]

<Form schema={schema} defaultValues={defaults} onSubmit={save} confirm>
  <Wizard steps={steps} orientation="vertical">
    <WizardStepper />
    <WizardStep id="account">…fields…</WizardStep>
    <WizardStep id="plan">…fields…</WizardStep>
    <WizardStep id="review">
      <ReadOnlyField name="email" editStep="account" />
    </WizardStep>
    <WizardNav />
  </Wizard>
</Form>
```

### One route per step

`Wizard` is controlled through `step` / `onStepChange`; wire those to your router. With react-router, put `<Form>` + `<Wizard>` in a layout route and render the step routes through `<Outlet>`:

```tsx
function SignupLayout() {
  const { step = '' } = useParams()
  const navigate = useNavigate()
  return (
    <Form schema={schema} defaultValues={defaults} onSubmit={save}>
      <Wizard steps={steps} step={step} onStepChange={(s) => navigate(`/signup/${s.id}`)}>
        <WizardStepper />
        <Outlet />
        <WizardNav />
      </Wizard>
    </Form>
  )
}
// routes: { path: '/signup', element: <SignupLayout/>, children: [{ path: ':step', element: <SignupStep/> }] }
```

A URL for a step the user has not reached (a deep link, a reload) makes the wizard call `onStepChange` with the last visited step. To resume across reloads, save `visited` (via `onVisitedChange`) with your draft values and pass both back.

## Confirmations and guards

- `<Form confirm>`: dialog after validation, before `onSubmit`, on every submit path.
- `<ClearButton confirm>`: dialog before reset.
- `<Form guard>`: browser prompt on tab close / reload while dirty.
- `useFormGuard(useBlocker)`: in-app navigation; pass react-router's `useBlocker` and render a `ConfirmDialog` with the result.
````

- [ ] **Step 4: Full verification**

Run: `pnpm typecheck && pnpm test && pnpm build && pnpm format`
Expected: all green; `dist/index.d.ts` includes `Wizard`, `ReadOnlyField`, `ClearButton`, `ConfirmDialog`, `useFormGuard`.

- [ ] **Step 5: Ledger**

Create `docs/superpowers/reviews/2026-09-02-v4-sdd-ledger.md` in the same shape as `docs/superpowers/reviews/2026-09-01-v3-sdd-ledger.md`: the spec decisions, every deviation made during implementation (with the reason), and anything left open.

- [ ] **Step 6: Commit and push**

```bash
git add -A
git commit -m "feat: v4 integration — exports, README, SDD ledger"
git push origin main
```
