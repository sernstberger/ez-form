import { createTheme, ThemeProvider } from '@mui/material/styles'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { z } from 'zod'
import { Form } from '../../Form'
import { PasswordField } from '../PasswordField'
import { PasswordStrength, passwordStrengthClasses } from './PasswordStrength'
import { expectNoA11yViolations } from '../../test/axe'
import { expectConsole } from '../../test/expectConsole'

const schema = z.object({ password: z.string() })

const wrap = (ui: React.ReactNode, defaultValues = { password: '' }) =>
  render(
    <Form schema={schema} defaultValues={defaultValues} onSubmit={() => {}}>
      {ui}
    </Form>,
  )

describe('PasswordStrength', () => {
  it('renders the meter at 0 with no label text for an empty password', () => {
    wrap(<PasswordStrength name="password" />)
    const meter = screen.getByRole('meter')
    expect(meter).toHaveAttribute('aria-valuemin', '0')
    expect(meter).toHaveAttribute('aria-valuemax', '4')
    expect(meter).toHaveAttribute('aria-valuenow', '0')
    expect(meter).not.toHaveAttribute('aria-valuetext')
    expect(screen.queryByText('Very weak')).not.toBeInTheDocument()
  })

  it('rises and relabels as a live-typed password gets stronger', async () => {
    const user = userEvent.setup()
    wrap(
      <>
        <PasswordField name="password" label="Password" />
        <PasswordStrength name="password" />
      </>,
    )
    const input = screen.getByLabelText('Password')

    await user.type(input, 'aaaa')
    const meter = screen.getByRole('meter')
    const weakValue = Number(meter.getAttribute('aria-valuenow'))

    await user.clear(input)
    await user.type(input, 'Tr0ub4dor&3xyz!')
    const strongValue = Number(meter.getAttribute('aria-valuenow'))

    expect(strongValue).toBeGreaterThan(weakValue)
    expect(meter).toHaveAttribute('aria-valuenow', '4')
    expect(meter).toHaveAttribute('aria-valuetext', 'Very strong')
    expect(screen.getByText('Very strong')).toBeInTheDocument()
  })

  it('a custom score returning 4 fills the bar and shows the last label', () => {
    wrap(<PasswordStrength name="password" score={() => 4} />, { password: 'anything' })
    const meter = screen.getByRole('meter')
    expect(meter).toHaveAttribute('aria-valuenow', '4')
    expect(meter).toHaveAttribute('aria-valuetext', 'Very strong')
    expect(screen.getByText('Very strong')).toBeInTheDocument()
  })

  it('custom labels replace the defaults', () => {
    wrap(
      <PasswordStrength
        name="password"
        score={() => 2}
        labels={['Terrible', 'Bad', 'Meh', 'Good', 'Great']}
      />,
      { password: 'x' },
    )
    expect(screen.getByText('Meh')).toBeInTheDocument()
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuetext', 'Meh')
  })

  it('label lives in an aria-live=polite region', () => {
    wrap(<PasswordStrength name="password" score={() => 1} />, { password: 'x' })
    const label = screen.getByText('Weak')
    expect(label.closest('[aria-live]')).toHaveAttribute('aria-live', 'polite')
  })

  it("slotProps.label['aria-live'] overrides the polite default", () => {
    wrap(
      <PasswordStrength
        name="password"
        score={() => 1}
        slotProps={{ label: { 'aria-live': 'assertive' } }}
      />,
      { password: 'x' },
    )
    expect(screen.getByText('Weak')).toHaveAttribute('aria-live', 'assertive')
  })

  it('has an accessible name of "Password strength"', () => {
    wrap(<PasswordStrength name="password" />)
    expect(screen.getByRole('meter')).toHaveAccessibleName('Password strength')
  })

  it('slotProps.bar["aria-label"] overrides the default accessible name', () => {
    wrap(<PasswordStrength name="password" slotProps={{ bar: { 'aria-label': 'Stärke' } }} />)
    expect(screen.getByRole('meter', { name: 'Stärke' })).toBeInTheDocument()
  })

  it('has no accessibility violations, empty or filled', async () => {
    const { container, unmount } = wrap(<PasswordStrength name="password" score={() => 3} />, {
      password: 'Tr0ub4dor&3',
    })
    await expectNoA11yViolations(container)
    unmount()

    const { container: emptyContainer } = wrap(<PasswordStrength name="password" />)
    await expectNoA11yViolations(emptyContainer)
  })

  it('throws outside <Form>', () => {
    // React logs every error it caught while rendering before rethrowing it. The `toThrow`
    // below is the assertion; these allow the noise that necessarily comes with it.
    expectConsole('error', 'must be rendered inside <Form>')
    expectConsole('error', 'The above error occurred')
    expect(() => render(<PasswordStrength name="password" />)).toThrow(
      'ez-form: <PasswordStrength> must be rendered inside <Form>',
    )
  })

  it('is themeable: defaultProps.slotProps.bar.color-adjacent props and styleOverrides.label apply', () => {
    const theme = createTheme({
      components: {
        EzPasswordStrength: {
          styleOverrides: {
            label: { textTransform: 'uppercase' },
          },
        },
      },
    })
    render(
      <ThemeProvider theme={theme}>
        <Form schema={schema} defaultValues={{ password: 'x' }} onSubmit={() => {}}>
          <PasswordStrength name="password" score={() => 1} />
        </Form>
      </ThemeProvider>,
    )
    const label = screen.getByText('Weak')
    expect(label).toHaveClass(passwordStrengthClasses.label)
    expect(getComputedStyle(label).textTransform).toBe('uppercase')
  })

  it('root and bar carry their utility classes', () => {
    wrap(<PasswordStrength name="password" score={() => 2} />, { password: 'x' })
    const meter = screen.getByRole('meter')
    expect(meter).toHaveClass(passwordStrengthClasses.bar)
    expect(meter.closest(`.${passwordStrengthClasses.root}`)).toBeInTheDocument()
  })
})
