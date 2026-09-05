import { useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createTheme, ThemeProvider } from '@mui/material/styles'
import { ConfirmDialog, confirmDialogClasses, type ConfirmDialogProps } from './ConfirmDialog'
import { expectNoA11yViolations } from '../test/axe'

/**
 * Mounts the dialog the way every real caller does — a click handler flips `open`, so the
 * whole `<Dialog>` subtree mounts fresh across two commits. This is the shape that #119 was
 * about: `autoFocus` alone only survives when `open` is true from the very first render.
 */
function DynamicHarness({
  onAnswer,
  ...props
}: { onAnswer?: (answer: 'confirmed' | 'cancelled') => void } & Partial<ConfirmDialogProps>) {
  const [open, setOpen] = useState(false)
  const answer = (value: 'confirmed' | 'cancelled') => {
    setOpen(false)
    onAnswer?.(value)
  }
  return (
    <>
      <button onClick={() => setOpen(true)}>Ask</button>
      <ConfirmDialog
        title="Sure?"
        {...props}
        open={open}
        onConfirm={() => answer('confirmed')}
        onCancel={() => answer('cancelled')}
      />
    </>
  )
}

async function openDynamic(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Ask' }))
  return screen.findByRole('alertdialog')
}

describe('ConfirmDialog', () => {
  it('renders an alertdialog named by the title and described by the message', () => {
    render(
      <ConfirmDialog
        open
        title="Send invoice?"
        message="This emails the client."
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
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

  // #119. Since MUI v9.0.1 the Dialog marks its own paper as the focus trap's initial
  // target, so a child `autoFocus` only wins when `open` is true from the first render.
  // Every real caller flips `open` in a click handler instead, and used to end up with
  // focus stuck on the paper: Enter did nothing and the safe-button-focused property was
  // lost. jsdom reproduces the original failure, so these are real regression tests.
  describe('initial focus when mounted dynamically (#119)', () => {
    it('focuses Cancel once the dialog has entered', async () => {
      const user = userEvent.setup()
      render(<DynamicHarness />)
      await openDynamic(user)
      await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus())
    })

    it('Enter straight after opening cancels rather than confirming', async () => {
      const user = userEvent.setup()
      const onAnswer = vi.fn()
      render(<DynamicHarness onAnswer={onAnswer} />)
      await openDynamic(user)
      await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus())
      await user.keyboard('{Enter}')
      expect(onAnswer).toHaveBeenCalledExactlyOnceWith('cancelled')
    })

    it('restores focus to the trigger after closing', async () => {
      const user = userEvent.setup()
      render(<DynamicHarness />)
      await openDynamic(user)
      await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus())
      await user.click(screen.getByRole('button', { name: 'Cancel' }))
      await waitFor(() => expect(screen.getByRole('button', { name: 'Ask' })).toHaveFocus())
    })

    it('leaves focus alone when slotProps.cancel opts out of autoFocus', async () => {
      const user = userEvent.setup()
      render(<DynamicHarness slotProps={{ cancel: { autoFocus: false } }} />)
      const dialog = await openDynamic(user)
      // The dialog's own paper keeps focus — MUI's default — instead of Cancel.
      await waitFor(() => expect(dialog).toHaveFocus())
      expect(screen.getByRole('button', { name: 'Cancel' })).not.toHaveFocus()
    })

    it("still calls a consumer's own slotProps.transition.onEntered", async () => {
      const user = userEvent.setup()
      const onEntered = vi.fn()
      render(<DynamicHarness slotProps={{ transition: { onEntered } }} />)
      await openDynamic(user)
      await waitFor(() => expect(onEntered).toHaveBeenCalledTimes(1))
      expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
    })

    it("does not steal focus from a consumer's onEntered that focuses Confirm itself", async () => {
      const user = userEvent.setup()
      render(
        <DynamicHarness
          slotProps={{
            transition: {
              onEntered: () =>
                screen.getByRole<HTMLButtonElement>('button', { name: 'Confirm' }).focus(),
            },
          }}
        />,
      )
      await openDynamic(user)
      // Our re-focus runs before the consumer's callback and only reclaims focus from the
      // non-tabbable paper, so the consumer's explicit choice is the one that sticks.
      await waitFor(() => expect(screen.getByRole('button', { name: 'Confirm' })).toHaveFocus())
    })

    it('has no accessibility violations when opened dynamically', async () => {
      const user = userEvent.setup()
      const { baseElement } = render(<DynamicHarness message="Really." />)
      await openDynamic(user)
      await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus())
      await expectNoA11yViolations(baseElement)
    })
  })

  it('slotProps={{ cancel: { autoFocus: false } }} opts out of the default Cancel focus', () => {
    render(
      <ConfirmDialog
        open
        title="Sure?"
        onConfirm={() => {}}
        onCancel={() => {}}
        slotProps={{ cancel: { autoFocus: false } }}
      />,
    )
    expect(screen.getByRole('button', { name: 'Cancel' })).not.toHaveFocus()
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
      <ConfirmDialog
        open
        title="Delete?"
        confirmLabel="Delete"
        cancelLabel="Keep"
        confirmColor="error"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    )
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveClass('MuiButton-colorError')
    expect(screen.getByRole('button', { name: 'Keep' })).toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    const { baseElement } = render(
      <ConfirmDialog
        open
        title="Sure?"
        message="Really."
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    )
    await expectNoA11yViolations(baseElement)
  })

  it('is themeable: defaultProps and styleOverrides apply', () => {
    const theme = createTheme({
      components: {
        EzConfirmDialog: {
          defaultProps: { slotProps: { confirm: { variant: 'outlined' } } },
          styleOverrides: { confirm: { textTransform: 'lowercase' } },
        },
      },
    })
    render(
      <ThemeProvider theme={theme}>
        <ConfirmDialog open title="Sure?" onConfirm={() => {}} onCancel={() => {}} />
      </ThemeProvider>,
    )
    const confirmBtn = screen.getByRole('button', { name: 'Confirm' })
    expect(confirmBtn).toHaveClass('MuiButton-outlined')
    expect(confirmBtn).toHaveClass(confirmDialogClasses.confirm)
    expect(getComputedStyle(confirmBtn).textTransform).toBe('lowercase')
  })

  it('defaults the Confirm button to contained when no theme is provided', () => {
    render(<ConfirmDialog open title="Sure?" onConfirm={() => {}} onCancel={() => {}} />)
    expect(screen.getByRole('button', { name: 'Confirm' })).toHaveClass('MuiButton-contained')
  })

  it('defaults actionsOrder to cancel-confirm: Cancel is first in the DOM', () => {
    render(<ConfirmDialog open title="Sure?" onConfirm={() => {}} onCancel={() => {}} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons.map((b) => b.textContent)).toEqual(['Cancel', 'Confirm'])
  })

  it('actionsOrder="confirm-cancel" puts Confirm first in the DOM; Cancel keeps autoFocus', () => {
    render(
      <ConfirmDialog
        open
        title="Sure?"
        onConfirm={() => {}}
        onCancel={() => {}}
        actionsOrder="confirm-cancel"
      />,
    )
    const buttons = screen.getAllByRole('button')
    expect(buttons.map((b) => b.textContent)).toEqual(['Confirm', 'Cancel'])
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
  })

  it('is themeable: defaultProps.actionsOrder applies globally', () => {
    const theme = createTheme({
      components: {
        EzConfirmDialog: {
          defaultProps: { actionsOrder: 'confirm-cancel' },
        },
      },
    })
    render(
      <ThemeProvider theme={theme}>
        <ConfirmDialog open title="Sure?" onConfirm={() => {}} onCancel={() => {}} />
      </ThemeProvider>,
    )
    const buttons = screen.getAllByRole('button')
    expect(buttons.map((b) => b.textContent)).toEqual(['Confirm', 'Cancel'])
  })

  it('has no accessibility violations with actionsOrder="confirm-cancel"', async () => {
    const { baseElement } = render(
      <ConfirmDialog
        open
        title="Sure?"
        message="Really."
        onConfirm={() => {}}
        onCancel={() => {}}
        actionsOrder="confirm-cancel"
      />,
    )
    await expectNoA11yViolations(baseElement)
  })

  it('forwards a consumer slotProps.paper to Dialog while slotProps.confirm still reaches the Confirm button', () => {
    render(
      <ConfirmDialog
        open
        title="Sure?"
        onConfirm={() => {}}
        onCancel={() => {}}
        slotProps={{
          paper: { className: 'confirm-dialog-paper' },
          confirm: { variant: 'outlined' },
        }}
      />,
    )
    expect(document.querySelector('.confirm-dialog-paper')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirm' })).toHaveClass('MuiButton-outlined')
  })
})
