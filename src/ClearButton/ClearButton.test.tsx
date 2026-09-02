import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createTheme, ThemeProvider } from '@mui/material/styles'
import { z } from 'zod'
import { Form } from '../Form'
import { TextField } from '../fields/TextField'
import { NumberField } from '../fields/NumberField'
import { ClearButton, clearButtonClasses } from './ClearButton'
import { expectNoA11yViolations } from '../test/axe'
import { expectConsole } from '../test/expectConsole'

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

  it('confirm: onClick does not fire when Cancelled (#75)', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <Form schema={schema} defaultValues={defaults} onSubmit={() => {}}>
        <Fields />
        <ClearButton confirm onClick={onClick} />
      </Form>,
    )
    const name = screen.getByRole('textbox', { name: 'Name' })
    await user.type(name, 'm')
    await user.click(screen.getByRole('button', { name: 'Clear' }))
    await screen.findByRole('alertdialog', { name: 'Discard changes?' })
    expect(onClick).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(name).toHaveValue('Adam')
    expect(onClick).not.toHaveBeenCalled()
  })

  it('confirm: onClick fires once, after reset, when Confirmed (#75)', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <Form schema={schema} defaultValues={defaults} onSubmit={() => {}}>
        <Fields />
        <ClearButton confirm onClick={onClick} />
      </Form>,
    )
    const name = screen.getByRole('textbox', { name: 'Name' })
    await user.type(name, 'm')
    await user.click(screen.getByRole('button', { name: 'Clear' }))
    await user.click(await screen.findByRole('button', { name: 'Confirm' }))
    await waitFor(() => expect(name).toHaveValue('Ada'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('without confirm, onClick still fires on click (nothing to gate on)', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <Form schema={schema} defaultValues={defaults} onSubmit={() => {}}>
        <Fields />
        <ClearButton onClick={onClick} />
      </Form>,
    )
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'm')
    await user.click(screen.getByRole('button', { name: 'Clear' }))
    expect(onClick).toHaveBeenCalledTimes(1)
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
    // React logs every error it caught while rendering before rethrowing it. The `toThrow`
    // below is the assertion; these allow the noise that necessarily comes with it.
    expectConsole('error', 'must be rendered inside <Form>')
    expectConsole('error', 'The above error occurred')
    expect(() => render(<ClearButton />)).toThrow(
      'ez-form: <ClearButton> must be rendered inside <Form>',
    )
  })

  it('is themeable: defaultProps and styleOverrides apply', () => {
    const theme = createTheme({
      components: {
        EzClearButton: {
          defaultProps: { variant: 'outlined' },
          styleOverrides: { root: { textTransform: 'lowercase' } },
        },
      },
    })
    render(
      <ThemeProvider theme={theme}>
        <Form schema={schema} defaultValues={defaults} onSubmit={() => {}}>
          <Fields />
          <ClearButton />
        </Form>
      </ThemeProvider>,
    )
    const btn = screen.getByRole('button', { name: 'Clear' })
    expect(btn).toHaveClass('MuiButton-outlined')
    expect(btn).toHaveClass(clearButtonClasses.root)
    expect(getComputedStyle(btn).textTransform).toBe('lowercase')
  })
})
