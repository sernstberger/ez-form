import { createTheme, ThemeProvider } from '@mui/material/styles'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { z } from 'zod'
import { Form } from '../../Form'
import { PasswordField } from './PasswordField'
import { passwordFieldClasses } from './PasswordField'
import { describeFieldContract } from '../../test/describeFieldContract'
import { expectNoA11yViolations } from '../../test/axe'
import { expectTargetSize } from '../../test/targetSize'

const schema = z.object({ password: z.string().min(1, { error: 'Password is required' }) })
// A password input exposes no `textbox` role (unlike TextField's own contract test, which
// dodges the required-asterisk label text by querying role instead), so `getByLabelText` is
// the only way in; querySelector is the fallback for the required case, where the label reads
// "Password *" to accessible-name computation.
// A widening cast (Element -> HTMLInputElement), not a non-null one; `!` alone loses
// `.value`.
// eslint-disable-next-line @typescript-eslint/non-nullable-type-assertion-style
const input = () => document.querySelector('input[name="password"]') as HTMLInputElement

describeFieldContract({
  componentName: 'PasswordField',
  label: 'Password',
  schema,
  defaultValues: { password: '' },
  render: (props) => <PasswordField name="password" label="Password" {...props} />,
  getControl: input,
  interact: (user) => user.type(input(), 'a'),
})

function renderForm(onSubmit = vi.fn()) {
  return render(
    <Form schema={schema} defaultValues={{ password: '' }} onSubmit={onSubmit}>
      <PasswordField name="password" label="Password" />
      <button type="submit">Go</button>
    </Form>,
  )
}

describe('PasswordField', () => {
  it('renders a password input by default', () => {
    renderForm()
    expect(input()).toHaveAttribute('type', 'password')
  })

  it('submits the typed value and keeps type="password"', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderForm(onSubmit)
    await user.type(input(), 'hunter2')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ password: 'hunter2' }, expect.anything())
    expect(input()).toHaveAttribute('type', 'password')
  })

  it('renders a toggle button labeled "Show password" with aria-pressed false', () => {
    renderForm()
    const toggle = screen.getByRole('button', { name: 'Show password' })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    expect(toggle).toHaveAttribute('type', 'button')
  })

  it('reveals the value as type="text" when the toggle is pressed, and the button reads "Hide password"', async () => {
    const user = userEvent.setup()
    renderForm()
    await user.type(input(), 'hunter2')
    await user.click(screen.getByRole('button', { name: 'Show password' }))
    expect(input()).toHaveAttribute('type', 'text')
    const toggle = screen.getByRole('button', { name: 'Hide password' })
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    expect(input()).toHaveValue('hunter2')
  })

  it('reverts to type="password" when the toggle is pressed again', async () => {
    const user = userEvent.setup()
    renderForm()
    await user.click(screen.getByRole('button', { name: 'Show password' }))
    await user.click(screen.getByRole('button', { name: 'Hide password' }))
    expect(input()).toHaveAttribute('type', 'password')
    expect(screen.getByRole('button', { name: 'Show password' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  // A real browser re-creates the editing context on a password↔text `type`
  // swap, which drops the selection; the click that flipped it has already
  // moved focus to the button. jsdom models neither, so these assert the
  // restoration this field performs — the same code that repairs the real
  // reset — rather than the reset itself.
  it('returns focus to the input and restores the caret after revealing', async () => {
    const user = userEvent.setup()
    renderForm()
    await user.type(input(), 'hunter2')
    input().setSelectionRange(3, 3)
    await user.click(screen.getByRole('button', { name: 'Show password' }))
    expect(input()).toHaveFocus()
    expect(input().selectionStart).toBe(3)
    expect(input().selectionEnd).toBe(3)
  })

  it('restores a non-collapsed selection, and does so on the way back to hidden', async () => {
    const user = userEvent.setup()
    renderForm()
    await user.type(input(), 'hunter2')
    input().setSelectionRange(1, 4)
    await user.click(screen.getByRole('button', { name: 'Show password' }))
    expect(input()).toHaveFocus()
    expect(input().selectionStart).toBe(1)
    expect(input().selectionEnd).toBe(4)

    input().setSelectionRange(2, 2)
    await user.click(screen.getByRole('button', { name: 'Hide password' }))
    expect(input()).toHaveFocus()
    expect(input().selectionStart).toBe(2)
  })

  it('leaves focus on the toggle when the input did not have it', async () => {
    const user = userEvent.setup()
    renderForm()
    await user.type(input(), 'hunter2')
    // Focus put on the button deliberately (keyboard): yanking it into the
    // input would fight the user.
    input().blur()
    screen.getByRole('button', { name: 'Show password' }).focus()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveFocus()
    expect(input()).not.toHaveFocus()
  })

  it("a consumer's slotProps.htmlInput.ref is called and caret restoration still works", async () => {
    const user = userEvent.setup()
    const consumerRef = vi.fn()
    render(
      <Form schema={schema} defaultValues={{ password: '' }} onSubmit={() => {}}>
        <PasswordField
          name="password"
          label="Password"
          slotProps={{ htmlInput: { ref: consumerRef } }}
        />
      </Form>,
    )
    expect(consumerRef).toHaveBeenCalledWith(input())

    await user.type(input(), 'hunter2')
    input().setSelectionRange(3, 3)
    await user.click(screen.getByRole('button', { name: 'Show password' }))
    expect(input()).toHaveFocus()
    expect(input().selectionStart).toBe(3)
  })

  it('takes custom toggle labels', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={{ password: '' }} onSubmit={() => {}}>
        <PasswordField
          name="password"
          label="Password"
          showLabel="Reveal password"
          hideLabel="Conceal password"
        />
      </Form>,
    )
    await user.click(screen.getByRole('button', { name: 'Reveal password' }))
    expect(screen.getByRole('button', { name: 'Conceal password' })).toBeInTheDocument()
  })

  it('is themeable: EzPasswordField defaultProps sets the toggle labels app-wide', () => {
    const theme = createTheme({
      components: { EzPasswordField: { defaultProps: { showLabel: 'Mostrar contraseña' } } },
    })
    render(
      <ThemeProvider theme={theme}>
        <Form schema={schema} defaultValues={{ password: '' }} onSubmit={() => {}}>
          <PasswordField name="password" label="Password" />
        </Form>
      </ThemeProvider>,
    )
    expect(screen.getByRole('button', { name: 'Mostrar contraseña' })).toBeInTheDocument()
  })

  it('does not render a toggle when revealable={false}', () => {
    render(
      <Form schema={schema} defaultValues={{ password: '' }} onSubmit={() => {}}>
        <PasswordField name="password" label="Password" revealable={false} />
      </Form>,
    )
    expect(screen.queryByRole('button', { name: /password/i })).not.toBeInTheDocument()
    expect(input()).toHaveAttribute('type', 'password')
  })

  it('disables the toggle when the field is disabled', () => {
    render(
      <Form schema={schema} defaultValues={{ password: '' }} onSubmit={() => {}} disabled>
        <PasswordField name="password" label="Password" />
      </Form>,
    )
    expect(screen.getByRole('button', { name: 'Show password' })).toBeDisabled()
  })

  it('defaults autoComplete to "current-password"', () => {
    renderForm()
    expect(input()).toHaveAttribute('autocomplete', 'current-password')
  })

  it('lets autoComplete be overridden, e.g. to "new-password"', () => {
    render(
      <Form schema={schema} defaultValues={{ password: '' }} onSubmit={() => {}}>
        <PasswordField name="password" label="Password" autoComplete="new-password" />
      </Form>,
    )
    expect(input()).toHaveAttribute('autocomplete', 'new-password')
  })

  it('under <Form assisted> defaults to "new-password" instead of "off" (#65 requirement 3)', () => {
    // Browsers do not reliably honour autoComplete="off" for password inputs, so assisted
    // mode uses "new-password" here specifically — the one token that reliably suppresses
    // fill-from-saved-credential, unlike every other field which gets a plain "off".
    render(
      <Form schema={schema} defaultValues={{ password: '' }} onSubmit={() => {}} assisted>
        <PasswordField name="password" label="Password" />
      </Form>,
    )
    expect(input()).toHaveAttribute('autocomplete', 'new-password')
  })

  it('a consumer autoComplete still wins under assisted', () => {
    render(
      <Form schema={schema} defaultValues={{ password: '' }} onSubmit={() => {}} assisted>
        <PasswordField name="password" label="Password" autoComplete="current-password" />
      </Form>,
    )
    expect(input()).toHaveAttribute('autocomplete', 'current-password')
  })

  it('the toggle button is focusable via Tab', async () => {
    const user = userEvent.setup()
    renderForm()
    await user.click(input())
    await user.tab()
    expect(screen.getByRole('button', { name: 'Show password' })).toHaveFocus()
  })

  it('is themeable: EzPasswordField defaultProps and styleOverrides.toggle apply', () => {
    const theme = createTheme({
      components: {
        EzPasswordField: {
          defaultProps: { slotProps: { toggle: { size: 'small' } } },
          styleOverrides: { toggle: { marginRight: 4 } },
        },
      },
    })
    render(
      <ThemeProvider theme={theme}>
        <Form schema={schema} defaultValues={{ password: '' }} onSubmit={() => {}}>
          <PasswordField name="password" label="Password" />
        </Form>
      </ThemeProvider>,
    )
    const toggle = screen.getByRole('button', { name: 'Show password' })
    expect(toggle).toHaveClass(passwordFieldClasses.toggle)
    expect(toggle).toHaveClass('MuiIconButton-sizeSmall')
    expect(getComputedStyle(toggle).marginRight).toBe('4px')
  })

  it('carries the root class hook for CSS / styleOverrides.root', () => {
    const { container } = renderForm()
    expect(container.querySelector(`.${passwordFieldClasses.root}`)).toBeInTheDocument()
  })

  it('meets 24×24 target size', () => {
    renderForm()
    expectTargetSize(screen.getByRole('button', { name: 'Show password' }))
  })

  it('has no accessibility violations with the value revealed', async () => {
    const user = userEvent.setup()
    const { container } = renderForm()
    await user.type(input(), 'hunter2')
    await user.click(screen.getByRole('button', { name: 'Show password' }))
    await expectNoA11yViolations(container)
  })

  it('never blocks paste', async () => {
    const user = userEvent.setup()
    renderForm()
    await user.click(input())
    await user.paste('hunter2')
    expect(input()).toHaveValue('hunter2')
  })

  it('keeps the toggle even when slotProps.input sets other options', () => {
    render(
      <Form schema={schema} defaultValues={{ password: '' }} onSubmit={() => {}}>
        <PasswordField name="password" label="Password" slotProps={{ input: { readOnly: true } }} />
      </Form>,
    )
    expect(screen.getByRole('button', { name: 'Show password' })).toBeInTheDocument()
    expect(input()).toHaveAttribute('readonly')
  })

  it('renders custom icons via the icons prop, per toggle state', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={{ password: '' }} onSubmit={() => {}}>
        <PasswordField
          name="password"
          label="Password"
          icons={{
            show: <span data-testid="show-icon" />,
            hide: <span data-testid="hide-icon" />,
          }}
        />
      </Form>,
    )
    expect(screen.getByTestId('show-icon')).toBeInTheDocument()
    expect(screen.queryByTestId('hide-icon')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Show password' }))
    expect(screen.getByTestId('hide-icon')).toBeInTheDocument()
    expect(screen.queryByTestId('show-icon')).not.toBeInTheDocument()
  })

  it('is themeable: EzPasswordField defaultProps.icons swaps icons app-wide', () => {
    const theme = createTheme({
      components: {
        EzPasswordField: {
          defaultProps: {
            icons: {
              show: <span data-testid="theme-show-icon" />,
              hide: <span data-testid="theme-hide-icon" />,
            },
          },
        },
      },
    })
    render(
      <ThemeProvider theme={theme}>
        <Form schema={schema} defaultValues={{ password: '' }} onSubmit={() => {}}>
          <PasswordField name="password" label="Password" />
        </Form>
      </ThemeProvider>,
    )
    expect(screen.getByTestId('theme-show-icon')).toBeInTheDocument()
  })

  it('resets the reveal state on unmount (a remount starts hidden again)', async () => {
    const user = userEvent.setup()
    const { unmount } = renderForm()
    await user.click(screen.getByRole('button', { name: 'Show password' }))
    expect(input()).toHaveAttribute('type', 'text')
    unmount()
    renderForm()
    expect(input()).toHaveAttribute('type', 'password')
    expect(screen.getByRole('button', { name: 'Show password' })).toBeInTheDocument()
  })

  it('Form requiredIndicator="optional": required stays required with no asterisk', () => {
    const { container } = render(
      <Form
        schema={schema}
        defaultValues={{ password: '' }}
        onSubmit={() => {}}
        requiredIndicator="optional"
      >
        <PasswordField name="password" label="Password" required />
      </Form>,
    )
    expect(input()).toBeRequired()
    expect(container.querySelector('[class*="asterisk"]')).toBeNull()
  })
})
