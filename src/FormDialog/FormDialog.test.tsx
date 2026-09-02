import { useState } from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createTheme, ThemeProvider } from '@mui/material/styles'
import Button from '@mui/material/Button'
import { z } from 'zod'
import { FormDialog, formDialogClasses, type FormDialogCloseReason } from './FormDialog'
import { TextField } from '../fields/TextField'
import { expectNoA11yViolations } from '../test/axe'

const schema = z.object({ name: z.string().min(1, 'Name is required') })

/** The whole dialog, with `open` owned by a real opener button, as a consumer would. */
function Harness({
  onSubmit = () => {},
  onClosed,
  ...props
}: Partial<React.ComponentProps<typeof FormDialog<{ name: string }, { name: string }>>> & {
  onClosed?: (reason: FormDialogCloseReason) => void
} = {}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>Edit</Button>
      <FormDialog
        title="Edit contact"
        schema={schema}
        defaultValues={{ name: '' }}
        onSubmit={onSubmit}
        {...props}
        open={open}
        onClose={(_event, reason) => {
          setOpen(false)
          onClosed?.(reason)
        }}
      >
        <TextField name="name" label="Name" />
      </FormDialog>
    </>
  )
}

const openDialog = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: 'Edit' }))
  return screen.getByRole('dialog', { name: 'Edit contact' })
}

const type = async (user: ReturnType<typeof userEvent.setup>, value: string) =>
  user.type(screen.getByRole('textbox', { name: 'Name' }), value)

describe('FormDialog', () => {
  it('renders a <form> inside the dialog paper, named by its DialogTitle', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const dialog = await openDialog(user)
    // The <form> is the dialog's only child: MUI's paper keeps the dialog role
    // (ARIA does not allow `role="dialog"` on a <form>), and the form carries
    // the flex layout through so DialogContent still scrolls.
    expect(dialog).toHaveClass('MuiDialog-paper')
    const form = dialog.querySelector('form')!
    expect(form).toHaveClass(formDialogClasses.form)
    expect(form).toHaveClass('EzForm-root')
    expect(form).toContainElement(screen.getByRole('textbox', { name: 'Name' }))
    expect(form).toContainElement(screen.getByRole('button', { name: 'Submit' }))
  })

  it('closes immediately on Escape when the form is pristine', async () => {
    const user = userEvent.setup()
    const onClosed = vi.fn()
    render(<Harness onClosed={onClosed} />)
    await openDialog(user)
    await user.keyboard('{Escape}')
    expect(onClosed).toHaveBeenCalledWith('escapeKeyDown')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('asks before closing on Escape when the form is dirty, and keeps it open on Keep editing', async () => {
    const user = userEvent.setup()
    const onClosed = vi.fn()
    render(<Harness onClosed={onClosed} />)
    await openDialog(user)
    await type(user, 'Ada')
    await user.keyboard('{Escape}')

    const prompt = await screen.findByRole('alertdialog', { name: 'Discard changes?' })
    expect(prompt).toBeInTheDocument()
    expect(onClosed).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Keep editing' }))
    expect(onClosed).not.toHaveBeenCalled()
    // The prompt's own exit transition un-hides the form dialog behind it.
    await waitFor(() =>
      expect(screen.getByRole('dialog', { name: 'Edit contact' })).toBeInTheDocument(),
    )
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Ada')
  })

  it('closes on Discard', async () => {
    const user = userEvent.setup()
    const onClosed = vi.fn()
    render(<Harness onClosed={onClosed} />)
    await openDialog(user)
    await type(user, 'Ada')
    await user.keyboard('{Escape}')
    await user.click(await screen.findByRole('button', { name: 'Discard' }))
    expect(onClosed).toHaveBeenCalledWith('escapeKeyDown')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('asks on the Cancel button too, and reports reason "cancelClick"', async () => {
    const user = userEvent.setup()
    const onClosed = vi.fn()
    render(<Harness onClosed={onClosed} />)
    await openDialog(user)
    await type(user, 'Ada')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await user.click(await screen.findByRole('button', { name: 'Discard' }))
    expect(onClosed).toHaveBeenCalledWith('cancelClick')
  })

  it('asks on a backdrop click', async () => {
    const user = userEvent.setup()
    const onClosed = vi.fn()
    render(<Harness onClosed={onClosed} />)
    await openDialog(user)
    await type(user, 'Ada')
    await user.click(document.querySelector('.MuiBackdrop-root')!)
    expect(await screen.findByRole('alertdialog', { name: 'Discard changes?' })).toBeInTheDocument()
    expect(onClosed).not.toHaveBeenCalled()
  })

  it('exitConfirm={false} closes a dirty form with no prompt', async () => {
    const user = userEvent.setup()
    const onClosed = vi.fn()
    render(<Harness exitConfirm={false} onClosed={onClosed} />)
    await openDialog(user)
    await type(user, 'Ada')
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(onClosed).toHaveBeenCalledWith('escapeKeyDown')
  })

  it('takes custom exitConfirm copy', async () => {
    const user = userEvent.setup()
    render(
      <Harness
        exitConfirm={{
          title: 'Throw it away?',
          message: 'Your draft is not saved.',
          confirmLabel: 'Throw away',
          cancelLabel: 'Go back',
        }}
      />,
    )
    await openDialog(user)
    await type(user, 'Ada')
    await user.keyboard('{Escape}')
    const prompt = await screen.findByRole('alertdialog', { name: 'Throw it away?' })
    expect(prompt).toHaveAccessibleDescription('Your draft is not saved.')
    expect(screen.getByRole('button', { name: 'Throw away' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Go back' })).toBeInTheDocument()
  })

  it('submits and closes with reason "submit", asking nothing on the way out', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    const onClosed = vi.fn()
    render(<Harness onSubmit={onSubmit} onClosed={onClosed} />)
    await openDialog(user)
    await type(user, 'Ada')
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ name: 'Ada' }, expect.anything()))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(onClosed).toHaveBeenCalledWith('submit')
  })

  it('submits on Enter in a field, because the content really is inside a <form>', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<Harness onSubmit={onSubmit} />)
    await openDialog(user)
    await type(user, 'Ada{Enter}')
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ name: 'Ada' }, expect.anything()))
  })

  it('puts Cancel before Submit in the DOM, so tab order matches', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const dialog = await openDialog(user)
    const actions = dialog.querySelector(`.${formDialogClasses.actions}`)!
    expect([...actions.querySelectorAll('button')].map((b) => b.textContent)).toEqual([
      'Cancel',
      'Submit',
    ])
  })

  it('stays open, and does not close, until onSubmit settles', async () => {
    const user = userEvent.setup()
    const onClosed = vi.fn()
    let release = () => {}
    render(
      <Harness
        onSubmit={() => new Promise<void>((resolve) => (release = resolve))}
        onClosed={onClosed}
      />,
    )
    await openDialog(user)
    await type(user, 'Ada')
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    // onSubmit is in flight: `onClose` has not run, so a save that never
    // resolves (or one that throws) leaves the dialog and its values alone.
    expect(onClosed).not.toHaveBeenCalled()
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Ada')
    await act(async () => release())
    expect(onClosed).toHaveBeenCalledWith('submit')
  })

  it('disables Cancel and Submit while a submit is pending', async () => {
    const user = userEvent.setup()
    let release = () => {}
    render(
      <Harness
        closeOnSubmit={false}
        onSubmit={() => new Promise<void>((resolve) => (release = resolve))}
      />,
    )
    await openDialog(user)
    await type(user, 'Ada')
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled())
    expect(screen.getByRole('textbox', { name: 'Name' })).toBeDisabled()
    await act(async () => release())
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled()
  })

  it('does not close on an invalid submit', async () => {
    const user = userEvent.setup()
    const onClosed = vi.fn()
    render(<Harness onClosed={onClosed} />)
    await openDialog(user)
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    expect(await screen.findByText('Name is required')).toBeInTheDocument()
    expect(onClosed).not.toHaveBeenCalled()
  })

  it('closeOnSubmit={false} keeps the dialog open after a successful submit', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    const onClosed = vi.fn()
    render(<Harness closeOnSubmit={false} onSubmit={onSubmit} onClosed={onClosed} />)
    await openDialog(user)
    await type(user, 'Ada')
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    expect(onClosed).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Edit contact' })).toBeInTheDocument()
  })

  it('an onSubmit that reports failure via setError still closes, unless closeOnSubmit is off', async () => {
    const user = userEvent.setup()
    const onClosed = vi.fn()
    render(
      <Harness
        closeOnSubmit={false}
        onSubmit={(_values, form) => form.setError('name', { message: 'Server said no' })}
        onClosed={onClosed}
      />,
    )
    await openDialog(user)
    await type(user, 'Ada')
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    expect(await screen.findByText('Server said no')).toBeInTheDocument()
    expect(onClosed).not.toHaveBeenCalled()
  })

  it('returns focus to the opener after closing', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const opener = screen.getByRole('button', { name: 'Edit' })
    await openDialog(user)
    await user.keyboard('{Escape}')
    await waitFor(() => expect(opener).toHaveFocus())
  })

  it('renders custom actions instead of Cancel / Submit', async () => {
    const user = userEvent.setup()
    render(<Harness actions={<Button>Only me</Button>} />)
    await openDialog(user)
    expect(screen.getByRole('button', { name: 'Only me' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Submit' })).not.toBeInTheDocument()
  })

  it('uses cancelLabel and submitLabel', async () => {
    const user = userEvent.setup()
    render(<Harness cancelLabel="Never mind" submitLabel="Save contact" />)
    await openDialog(user)
    expect(screen.getByRole('button', { name: 'Never mind' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save contact' })).toBeInTheDocument()
  })

  it('has no accessibility violations with the dialog open', async () => {
    const user = userEvent.setup()
    const { baseElement } = render(<Harness />)
    await openDialog(user)
    await expectNoA11yViolations(baseElement)
  })

  it('has no accessibility violations with the exit prompt open', async () => {
    const user = userEvent.setup()
    // The nested ConfirmDialog mounts with a real Fade transition, whose enter callback
    // keeps updating state (entering -> entered) after the button we'd otherwise wait on
    // is already in the DOM. On a slow runner axe can walk the tree while that update is
    // still in flight, outside any act() — a real "not wrapped in act" warning, not a test
    // artifact. `motion.reducedMotion: 'always'` is a first-class MUI theme setting (not a
    // test hack): every Transition still runs, but its completion timer is scheduled at 0ms
    // instead of the authored duration, so RTL's own act-wrapped polling (findByRole below)
    // observes the transition settle instead of racing it.
    const theme = createTheme({ motion: { reducedMotion: 'always' } })
    const { baseElement } = render(
      <ThemeProvider theme={theme}>
        <Harness />
      </ThemeProvider>,
    )
    await openDialog(user)
    await type(user, 'Ada')
    await user.keyboard('{Escape}')
    // Waiting on the prompt being *present* rather than focused: this prompt is a dialog
    // inside a dialog, and the outer Dialog's focus trap keeps focus on its paper, so
    // ConfirmDialog's `autoFocus` on Cancel does not win the race here. Focus behaviour has
    // its own tests (ConfirmDialog.test.tsx); what this one is for is the axe audit below.
    expect(await screen.findByRole('button', { name: 'Keep editing' })).toBeInTheDocument()
    await expectNoA11yViolations(baseElement)
  })

  it('is themeable: defaultProps and styleOverrides apply', async () => {
    const user = userEvent.setup()
    const theme = createTheme({
      components: {
        EzFormDialog: {
          defaultProps: { cancelLabel: 'Abandon' },
          styleOverrides: { actions: { textTransform: 'lowercase' } },
        },
      },
    })
    render(
      <ThemeProvider theme={theme}>
        <Harness />
      </ThemeProvider>,
    )
    await openDialog(user)
    const cancel = screen.getByRole('button', { name: 'Abandon' })
    expect(cancel).toHaveClass(formDialogClasses.cancel)
    const actions = document.querySelector(`.${formDialogClasses.actions}`)!
    expect(getComputedStyle(actions).textTransform).toBe('lowercase')
  })

  it('forwards slotProps.form to the form element', async () => {
    const user = userEvent.setup()
    render(<Harness slotProps={{ form: { id: 'contact-form' } }} />)
    const dialog = await openDialog(user)
    expect(dialog.querySelector('form')).toHaveAttribute('id', 'contact-form')
  })

  it('supports Form props: description and confirm-before-submit', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<Harness description="Who is this?" confirm onSubmit={onSubmit} />)
    const dialog = await openDialog(user)
    // Form appends the requiredIndicator convention to `description` (#4), and
    // the whole thing describes the *dialog*, not just the inner <form>.
    expect(dialog).toHaveAccessibleDescription(
      'Who is this? Required fields are marked with an asterisk (*).',
    )
    await type(user, 'Ada')
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    await user.click(await screen.findByRole('button', { name: 'Confirm' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
  })

  // Finding 1: `description != null` was the wrong gate — Form states the
  // requiredIndicator convention in that same slot, on by default in BOTH modes.
  it('describes the dialog with the requiredIndicator text even with no description', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const dialog = await openDialog(user)
    expect(dialog).toHaveAccessibleDescription('Required fields are marked with an asterisk (*).')
  })

  it('describes the dialog with the optional-mode convention text', async () => {
    const user = userEvent.setup()
    render(<Harness requiredIndicator="optional" />)
    const dialog = await openDialog(user)
    expect(dialog).toHaveAccessibleDescription('All fields are required unless marked optional.')
  })

  it('leaves the dialog undescribed when both description and the convention text are off', async () => {
    const user = userEvent.setup()
    render(<Harness requiredIndicatorText={false} />)
    const dialog = await openDialog(user)
    expect(dialog).not.toHaveAttribute('aria-describedby')
  })

  // Finding 2: a consumer onClick used to replace the close gate outright.
  it('slotProps.cancel.onClick runs and still reaches the exit prompt on a dirty form', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    const onClosed = vi.fn()
    render(<Harness slotProps={{ cancel: { onClick } }} onClosed={onClosed} />)
    await openDialog(user)
    await type(user, 'Ada')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(await screen.findByRole('alertdialog', { name: 'Discard changes?' })).toBeInTheDocument()
    expect(onClosed).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Discard' }))
    expect(onClosed).toHaveBeenCalledWith('cancelClick')
  })

  it('a slotProps.cancel.onClick that calls preventDefault vetoes the close', async () => {
    const user = userEvent.setup()
    const onClosed = vi.fn()
    render(
      <Harness
        slotProps={{ cancel: { onClick: (event) => event.preventDefault() } }}
        onClosed={onClosed}
      />,
    )
    await openDialog(user)
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClosed).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Edit contact' })).toBeInTheDocument()
  })

  /*
   * Finding 3: a Form prop must reach <Form>, not the Dialog's div. React silently drops an
   * unknown prop rather than rendering it, so the attribute alone proves nothing — its "does
   * not recognize the X prop on a DOM element" warning is the actual signal.
   *
   * That signal is now the console guard's (src/test/expectConsole.ts): any `console.error`
   * this test does not opt into fails it. So the assertion is the *absence* of an
   * `expectConsole` call — if `submitPendingText` ever lands on the dialog div, React warns
   * and the guard fails this test with the warning text. Collecting the messages by hand here
   * would only re-implement, less strictly, what the guard already does for every test.
   */
  it('forwards Form-only props to the form, never onto the dialog element', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<Harness submitPendingText="Saving your contact…" onSubmit={onSubmit} />)
    await openDialog(user)
    await type(user, 'Ada')
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
  })

  // Finding 4: two stacked modals — Escape must peel one layer at a time.
  it('Escape on the exit prompt closes only the prompt, and prompts again on a second Escape', async () => {
    const user = userEvent.setup()
    const onClosed = vi.fn()
    render(<Harness onClosed={onClosed} />)
    await openDialog(user)
    await type(user, 'Ada')

    await user.keyboard('{Escape}')
    await screen.findByRole('alertdialog', { name: 'Discard changes?' })

    // First Escape dismisses the prompt only; the form dialog is still there.
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(onClosed).not.toHaveBeenCalled()
    await waitFor(() =>
      expect(screen.getByRole('dialog', { name: 'Edit contact' })).toBeInTheDocument(),
    )
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Ada')

    // Still dirty, so a second Escape asks again rather than closing silently.
    await user.keyboard('{Escape}')
    expect(await screen.findByRole('alertdialog', { name: 'Discard changes?' })).toBeInTheDocument()
    expect(onClosed).not.toHaveBeenCalled()
  })
})
