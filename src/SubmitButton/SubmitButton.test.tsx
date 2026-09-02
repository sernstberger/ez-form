import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createTheme, ThemeProvider } from '@mui/material/styles'
import { z } from 'zod'
import { Form } from '../Form'
import { SubmitButton, submitButtonClasses } from './SubmitButton'
import { expectNoA11yViolations } from '../test/axe'

const schema = z.object({ ok: z.boolean() })

describe('SubmitButton', () => {
  it('renders a submit button with default label', () => {
    render(
      <Form schema={schema} defaultValues={{ ok: true }} onSubmit={() => {}}>
        <SubmitButton />
      </Form>,
    )
    const btn = screen.getByRole('button', { name: 'Submit' })
    expect(btn).toHaveAttribute('type', 'submit')
    expect(btn).toBeEnabled()
  })

  it('is disabled and shows a progress indicator while onSubmit is pending, then re-enabled', async () => {
    const user = userEvent.setup()
    let resolve!: () => void
    const onSubmit = vi.fn(() => new Promise<void>((r) => (resolve = r)))
    render(
      <Form schema={schema} defaultValues={{ ok: true }} onSubmit={onSubmit}>
        <SubmitButton>Save</SubmitButton>
      </Form>,
    )
    const btn = screen.getByRole('button', { name: 'Save' })
    await user.click(btn)
    await waitFor(() => expect(btn).toBeDisabled())
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
    resolve()
    await waitFor(() => expect(btn).toBeEnabled())
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })

  it('respects a consumer disabled prop', () => {
    render(
      <Form schema={schema} defaultValues={{ ok: true }} onSubmit={() => {}}>
        <SubmitButton disabled />
      </Form>,
    )
    expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled()
  })

  it('is disabled while the form is disabled', () => {
    render(
      <Form schema={schema} defaultValues={{ ok: true }} onSubmit={() => {}} disabled>
        <SubmitButton />
      </Form>,
    )
    expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled()
  })

  it('has no accessibility violations while pending', async () => {
    const user = userEvent.setup()
    let resolve!: () => void
    const onSubmit = vi.fn(() => new Promise<void>((r) => (resolve = r)))
    const { container } = render(
      <Form schema={schema} defaultValues={{ ok: true }} onSubmit={onSubmit}>
        <SubmitButton>Save</SubmitButton>
      </Form>,
    )
    const btn = screen.getByRole('button', { name: 'Save' })
    await user.click(btn)
    await waitFor(() => expect(btn).toBeDisabled())
    await expectNoA11yViolations(container)
    resolve()
    await waitFor(() => expect(btn).toBeEnabled())
  })

  it('throws outside <Form>', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<SubmitButton />)).toThrow(
      'ez-form: <SubmitButton> must be rendered inside <Form>',
    )
  })

  it('is themeable: defaultProps and styleOverrides apply', () => {
    const theme = createTheme({
      components: {
        EzSubmitButton: {
          defaultProps: { variant: 'outlined' },
          styleOverrides: { root: { textTransform: 'lowercase' } },
        },
      },
    })
    render(
      <ThemeProvider theme={theme}>
        <Form schema={schema} defaultValues={{ ok: true }} onSubmit={() => {}}>
          <SubmitButton />
        </Form>
      </ThemeProvider>,
    )
    const btn = screen.getByRole('button', { name: 'Submit' })
    expect(btn).toHaveClass('MuiButton-outlined')
    expect(btn).toHaveClass(submitButtonClasses.root)
    expect(getComputedStyle(btn).textTransform).toBe('lowercase')
  })
})
