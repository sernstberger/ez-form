import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createTheme, ThemeProvider } from '@mui/material/styles'
import { z } from 'zod'
import { Form } from '../../Form'
import { ResendCodeButton, resendCodeButtonClasses } from './ResendCodeButton'
import { expectNoA11yViolations } from '../../test/axe'
import { expectConsole } from '../../test/expectConsole'

const schema = z.object({ code: z.string() })

// This button's own status region, not the <Form>'s submit-status live region —
// both are `role="status"`, so the role alone is ambiguous inside a form.
const statusRegion = () =>
  document.querySelector<HTMLElement>(`.${resendCodeButtonClasses.status}`)!

describe('ResendCodeButton', () => {
  it('renders a type=button with default label and enabled status region', () => {
    render(
      <Form schema={schema} defaultValues={{ code: '' }} onSubmit={() => {}}>
        <ResendCodeButton onResend={() => {}} />
      </Form>,
    )
    const btn = screen.getByRole('button', { name: 'Resend code' })
    expect(btn).toHaveAttribute('type', 'button')
    expect(btn).toBeEnabled()
    expect(statusRegion()).toBeInTheDocument()
    expect(statusRegion()).toBeEmptyDOMElement()
  })

  it('calls onResend once on click, disables immediately, and shows a countdown label', async () => {
    vi.useFakeTimers()
    const onResend = vi.fn()
    render(
      <Form schema={schema} defaultValues={{ code: '' }} onSubmit={() => {}}>
        <ResendCodeButton onResend={onResend} cooldown={3} />
      </Form>,
    )
    const btn = screen.getByRole('button', { name: 'Resend code' })
    await act(async () => {
      fireEvent.click(btn)
    })
    expect(onResend).toHaveBeenCalledTimes(1)
    expect(btn).toBeDisabled()
    expect(btn).toHaveTextContent('Resend code (3s)')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    expect(btn).toHaveTextContent('Resend code (2s)')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    expect(btn).toBeEnabled()
    expect(btn).toHaveTextContent('Resend code')
    vi.useRealTimers()
  })

  it('awaits an async onResend and stays disabled while pending', async () => {
    vi.useFakeTimers()
    let resolve!: () => void
    const onResend = vi.fn(() => new Promise<void>((r) => (resolve = r)))
    render(
      <Form schema={schema} defaultValues={{ code: '' }} onSubmit={() => {}}>
        <ResendCodeButton onResend={onResend} cooldown={3} />
      </Form>,
    )
    const btn = screen.getByRole('button', { name: 'Resend code' })
    await act(async () => {
      fireEvent.click(btn)
    })
    expect(btn).toBeDisabled()
    expect(onResend).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolve()
      await Promise.resolve()
    })
    expect(btn).toBeDisabled()
    expect(btn).toHaveTextContent(/Resend code \(3s\)/)
    vi.useRealTimers()
  })

  it('announces "Code sent" once per resend via the status slot, clearing between resends', async () => {
    vi.useFakeTimers()
    const onResend = vi.fn()
    render(
      <Form schema={schema} defaultValues={{ code: '' }} onSubmit={() => {}}>
        <ResendCodeButton onResend={onResend} cooldown={1} />
      </Form>,
    )
    const btn = screen.getByRole('button', { name: 'Resend code' })
    // Re-queried each time: each announcement mounts a fresh region node, so a
    // held reference goes stale (that remount is what makes a repeat audible).
    expect(statusRegion()).toBeEmptyDOMElement()

    await act(async () => {
      fireEvent.click(btn)
    })
    expect(statusRegion()).toHaveTextContent('Code sent')
    const first = statusRegion()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    expect(btn).toBeEnabled()

    // Re-click triggers a fresh announcement in a replaced node.
    await act(async () => {
      fireEvent.click(btn)
    })
    expect(statusRegion()).toHaveTextContent('Code sent')
    expect(statusRegion()).not.toBe(first)
    vi.useRealTimers()
  })

  /*
   * The "without act warnings" part is the console guard's job now
   * (src/test/expectConsole.ts): any `console.error` this test does not opt into fails it, and
   * the guard also unmounts inside its own afterEach, so a stray timer firing after teardown
   * is caught there too. Hence no spy and no explicit assertion — the absence of an
   * `expectConsole` call *is* the assertion.
   */
  it('clears the interval on unmount without act warnings', async () => {
    vi.useFakeTimers()
    const onResend = vi.fn()
    const { unmount } = render(
      <Form schema={schema} defaultValues={{ code: '' }} onSubmit={() => {}}>
        <ResendCodeButton onResend={onResend} cooldown={5} />
      </Form>,
    )
    const btn = screen.getByRole('button', { name: 'Resend code' })
    await act(async () => {
      fireEvent.click(btn)
    })
    unmount()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000)
    })
    vi.useRealTimers()
  })

  it('is disabled while the form is disabled', () => {
    render(
      <Form schema={schema} defaultValues={{ code: '' }} onSubmit={() => {}} disabled>
        <ResendCodeButton onResend={() => {}} />
      </Form>,
    )
    expect(screen.getByRole('button', { name: 'Resend code' })).toBeDisabled()
  })

  it('is disabled while the form is submitting', async () => {
    const user = userEvent.setup()
    let resolveSubmit!: () => void
    const onSubmit = vi.fn(() => new Promise<void>((r) => (resolveSubmit = r)))
    render(
      <Form schema={schema} defaultValues={{ code: '123456' }} onSubmit={onSubmit}>
        <button type="submit">Submit</button>
        <ResendCodeButton onResend={() => {}} />
      </Form>,
    )
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Resend code' })).toBeDisabled())
    resolveSubmit()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Resend code' })).toBeEnabled())
  })

  it('accepts custom children as the idle label', () => {
    render(
      <Form schema={schema} defaultValues={{ code: '' }} onSubmit={() => {}}>
        <ResendCodeButton onResend={() => {}}>Send again</ResendCodeButton>
      </Form>,
    )
    expect(screen.getByRole('button', { name: 'Send again' })).toBeInTheDocument()
  })

  it('throws outside <Form>', () => {
    // React logs every error it caught while rendering before rethrowing it. The `toThrow`
    // below is the assertion; these allow the noise that necessarily comes with it.
    expectConsole('error', 'must be rendered inside <Form>')
    expectConsole('error', 'The above error occurred')
    expect(() => render(<ResendCodeButton onResend={() => {}} />)).toThrow(
      'ez-form: <ResendCodeButton> must be rendered inside <Form>',
    )
  })

  it('has no accessibility violations idle and while cooling down', async () => {
    const onResend = vi.fn()
    const { container } = render(
      <Form schema={schema} defaultValues={{ code: '' }} onSubmit={onResend}>
        <ResendCodeButton onResend={onResend} cooldown={2} />
      </Form>,
    )
    await expectNoA11yViolations(container)
    const btn = screen.getByRole('button', { name: 'Resend code' })
    const user = userEvent.setup()
    await user.click(btn)
    await expectNoA11yViolations(container)
  })

  it('is themeable: defaultProps and styleOverrides apply to root and status', () => {
    const theme = createTheme({
      components: {
        EzResendCodeButton: {
          defaultProps: { variant: 'outlined' },
          styleOverrides: {
            root: { textTransform: 'lowercase' },
            status: { fontStyle: 'italic' },
          },
        },
      },
    })
    render(
      <ThemeProvider theme={theme}>
        <Form schema={schema} defaultValues={{ code: '' }} onSubmit={() => {}}>
          <ResendCodeButton onResend={() => {}} />
        </Form>
      </ThemeProvider>,
    )
    const btn = screen.getByRole('button', { name: 'Resend code' })
    expect(btn).toHaveClass('MuiButton-outlined')
    expect(btn).toHaveClass(resendCodeButtonClasses.root)
    expect(getComputedStyle(btn).textTransform).toBe('lowercase')
    const status = statusRegion()
    expect(status).toHaveClass(resendCodeButtonClasses.status)
    expect(getComputedStyle(status).fontStyle).toBe('italic')
  })

  it('forwards slotProps.status to the status element', () => {
    render(
      <Form schema={schema} defaultValues={{ code: '' }} onSubmit={() => {}}>
        <ResendCodeButton onResend={() => {}} slotProps={{ status: { id: 'resend-status' } }} />
      </Form>,
    )
    expect(document.getElementById('resend-status')).toBe(statusRegion())
  })

  it('shows the error text and re-enables immediately (no cooldown) when onResend rejects', async () => {
    const user = userEvent.setup()
    const onResend = vi.fn(() => Promise.reject(new Error('network down')))
    render(
      <Form schema={schema} defaultValues={{ code: '' }} onSubmit={() => {}}>
        <ResendCodeButton onResend={onResend} cooldown={30} />
      </Form>,
    )
    const btn = screen.getByRole('button', { name: 'Resend code' })
    await user.click(btn)
    await waitFor(() => expect(statusRegion()).toHaveTextContent('Code could not be sent'))
    expect(btn).toBeEnabled()
    expect(btn).toHaveTextContent('Resend code')
    expect(btn).not.toHaveTextContent(/\(\d+s\)/)
  })

  it('shows a custom errorText on rejection', async () => {
    const user = userEvent.setup()
    const onResend = vi.fn(() => Promise.reject(new Error('nope')))
    render(
      <Form schema={schema} defaultValues={{ code: '' }} onSubmit={() => {}}>
        <ResendCodeButton onResend={onResend} errorText="Try again later" />
      </Form>,
    )
    await user.click(screen.getByRole('button', { name: 'Resend code' }))
    await waitFor(() => expect(statusRegion()).toHaveTextContent('Try again later'))
  })

  it('calls onResendError with the rejection and does not leave an unhandled rejection', async () => {
    const user = userEvent.setup()
    const error = new Error('boom')
    const onResend = vi.fn(() => Promise.reject(error))
    const onResendError = vi.fn()
    render(
      <Form schema={schema} defaultValues={{ code: '' }} onSubmit={() => {}}>
        <ResendCodeButton onResend={onResend} onResendError={onResendError} />
      </Form>,
    )
    await user.click(screen.getByRole('button', { name: 'Resend code' }))
    await waitFor(() => expect(onResendError).toHaveBeenCalledWith(error))
  })

  it('swallows the rejection when onResendError is not provided', async () => {
    const user = userEvent.setup()
    const onResend = vi.fn(() => Promise.reject(new Error('quiet failure')))
    render(
      <Form schema={schema} defaultValues={{ code: '' }} onSubmit={() => {}}>
        <ResendCodeButton onResend={onResend} />
      </Form>,
    )
    await user.click(screen.getByRole('button', { name: 'Resend code' }))
    await waitFor(() => expect(statusRegion()).toHaveTextContent('Code could not be sent'))
    // No unhandled rejection: vitest fails the run on one, so reaching this
    // point (and the file finishing green) is the assertion.
  })
})
