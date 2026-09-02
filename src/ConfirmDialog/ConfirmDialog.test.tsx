import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createTheme, ThemeProvider } from '@mui/material/styles'
import { ConfirmDialog, confirmDialogClasses } from './ConfirmDialog'
import { expectNoA11yViolations } from '../test/axe'

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
