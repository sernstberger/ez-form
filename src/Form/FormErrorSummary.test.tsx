import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createTheme, ThemeProvider } from '@mui/material/styles'
import { z } from 'zod'
import { Form } from './Form'
import { FormErrorSummary, formErrorSummaryClasses } from './FormErrorSummary'
import { SubmitButton } from '../SubmitButton'
import { TextField } from '../fields/TextField'
import { Wizard, type WizardStepDef } from '../Wizard/Wizard'
import { WizardStep } from '../Wizard/WizardStep'
import { WizardNav } from '../Wizard/WizardNav'
import { expectNoA11yViolations } from '../test/axe'
import { expectConsole } from '../test/expectConsole'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.email('Invalid email address'),
})

function renderForm() {
  return render(
    <Form schema={schema} defaultValues={{ name: '', email: '' }} onSubmit={() => {}}>
      <FormErrorSummary />
      <TextField name="name" label="Name" />
      <TextField name="email" label="Email" />
      <SubmitButton>Submit</SubmitButton>
    </Form>,
  )
}

/**
 * The summary root carries no ARIA `role` (see FormErrorSummary's doc: GOV.UK's own pattern
 * drops `role="alert"` to avoid a double announcement alongside the per-field `role="alert"`
 * helper texts — the heading receiving focus is what announces it), so tests find it by its
 * heading and walk up to the labelled container instead of querying a role.
 */
function findSummary(name = 'There is a problem') {
  return screen.findByRole('heading', { name }).then((heading) => heading.parentElement!)
}

function querySummary(name = 'There is a problem') {
  const heading = screen.queryByRole('heading', { name })
  return heading?.parentElement ?? null
}

describe('FormErrorSummary', () => {
  it('renders nothing before any submit', () => {
    renderForm()
    expect(querySummary()).toBeNull()
  })

  it('renders nothing when the form has no errors, even after a successful submit', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={{ name: 'A', email: 'a@b.co' }} onSubmit={() => {}}>
        <FormErrorSummary />
        <TextField name="name" label="Name" />
        <TextField name="email" label="Email" />
        <SubmitButton>Submit</SubmitButton>
      </Form>,
    )
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    expect(querySummary()).toBeNull()
  })

  it('lists one item per invalid field with its message after a failed submit', async () => {
    const user = userEvent.setup()
    renderForm()
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    const summary = await findSummary()
    const items = within(summary).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(within(summary).getByRole('link', { name: 'Name is required' })).toBeInTheDocument()
    expect(within(summary).getByRole('link', { name: 'Invalid email address' })).toBeInTheDocument()
  })

  it('moves focus to the heading after a failed submit', async () => {
    const user = userEvent.setup()
    renderForm()
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    const heading = await screen.findByRole('heading', { name: 'There is a problem' })
    await waitFor(() => expect(heading).toHaveFocus())
    expect(heading).toHaveAttribute('tabindex', '-1')
  })

  it('does not focus the first invalid field when a summary is mounted', async () => {
    const user = userEvent.setup()
    renderForm()
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    await findSummary()
    expect(screen.getByLabelText('Name')).not.toHaveFocus()
  })

  it('activating an item focuses that field', async () => {
    const user = userEvent.setup()
    renderForm()
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    const summary = await findSummary()
    const link = within(summary).getByRole('link', { name: 'Name is required' })
    await user.click(link)
    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveFocus())
  })

  it('the link href points at the field id when the registered element has one', async () => {
    const user = userEvent.setup()
    renderForm()
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    const summary = await findSummary()
    const link = within(summary).getByRole('link', { name: 'Name is required' })
    const nameInput = screen.getByLabelText('Name')
    await waitFor(() => expect(link).toHaveAttribute('href', `#${nameInput.id}`))
  })

  it('drops items as their fields become valid, and removes the summary once none remain', async () => {
    const user = userEvent.setup()
    renderForm()
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    let summary = await findSummary()
    expect(within(summary).getAllByRole('listitem')).toHaveLength(2)

    await user.type(screen.getByLabelText('Name'), 'Ada')
    await user.tab()
    summary = await findSummary()
    await waitFor(() => expect(within(summary).getAllByRole('listitem')).toHaveLength(1))
    expect(within(summary).getByRole('link', { name: 'Invalid email address' })).toBeInTheDocument()

    await user.type(screen.getByLabelText('Email'), 'a@b.co')
    await user.tab()
    await waitFor(() => expect(querySummary()).toBeNull())
  })

  it('has no accessibility violations after a failed submit', async () => {
    const user = userEvent.setup()
    const { container } = renderForm()
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    await findSummary()
    await expectNoA11yViolations(container)
  })

  it('custom title and a theme-driven heading level via slotProps', async () => {
    const user = userEvent.setup()
    const { unmount } = render(
      <Form schema={schema} defaultValues={{ name: '', email: '' }} onSubmit={() => {}}>
        <FormErrorSummary title="Fix these" slotProps={{ heading: { component: 'h3' } }} />
        <TextField name="name" label="Name" />
        <SubmitButton>Submit</SubmitButton>
      </Form>,
    )
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    expect(await screen.findByRole('heading', { level: 3, name: 'Fix these' })).toBeInTheDocument()
    unmount()

    const theme = createTheme({
      components: {
        EzFormErrorSummary: { defaultProps: { title: 'Themed title' } },
      },
    })
    render(
      <ThemeProvider theme={theme}>
        <Form schema={schema} defaultValues={{ name: '', email: '' }} onSubmit={() => {}}>
          <FormErrorSummary />
          <TextField name="name" label="Name" />
          <SubmitButton>Submit</SubmitButton>
        </Form>
      </ThemeProvider>,
    )
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    expect(await screen.findByRole('heading', { name: 'Themed title' })).toBeInTheDocument()
  })

  it('forwards className and root props, and applies formErrorSummaryClasses', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={{ name: '', email: '' }} onSubmit={() => {}}>
        <FormErrorSummary className="mine" data-testid="summary" />
        <TextField name="name" label="Name" />
        <SubmitButton>Submit</SubmitButton>
      </Form>,
    )
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    const summary = await screen.findByTestId('summary')
    expect(summary).toHaveClass('mine')
    expect(summary).toHaveClass(formErrorSummaryClasses.root)
  })

  describe('with confirm', () => {
    it('renders the summary and focuses its heading instead of the first field; no dialog opens', async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn()
      render(
        <Form schema={schema} defaultValues={{ name: '', email: '' }} onSubmit={onSubmit} confirm>
          <FormErrorSummary />
          <TextField name="name" label="Name" />
          <TextField name="email" label="Email" />
          <SubmitButton>Submit</SubmitButton>
        </Form>,
      )
      await user.click(screen.getByRole('button', { name: 'Submit' }))
      const heading = await screen.findByRole('heading', { name: 'There is a problem' })
      await waitFor(() => expect(heading).toHaveFocus())
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
      expect(screen.getByLabelText('Name')).not.toHaveFocus()
      expect(onSubmit).not.toHaveBeenCalled()
    })
  })
})

describe('FormErrorSummary inside a Wizard', () => {
  const wizardSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    email: z.email('Invalid email address'),
    plan: z.string().min(1, 'Plan is required'),
  })
  type Input = z.input<typeof wizardSchema>
  const steps = [
    { id: 'account', label: 'Account', fields: ['name', 'email'] },
    { id: 'plan', label: 'Plan', fields: ['plan'] },
  ] as const satisfies WizardStepDef<Input>[]

  function renderWizard() {
    return render(
      <Form
        schema={wizardSchema}
        defaultValues={{ name: '', email: '', plan: '' }}
        onSubmit={() => {}}
      >
        <Wizard steps={steps}>
          <WizardStep id="account">
            <FormErrorSummary />
            <TextField name="name" label="Name" />
            <TextField name="email" label="Email" />
          </WizardStep>
          <WizardStep id="plan">
            <FormErrorSummary />
            <TextField name="plan" label="Plan" />
          </WizardStep>
          <WizardNav />
        </Wizard>
      </Form>,
    )
  }

  it('lists only the current step errors after a failed Next', async () => {
    const user = userEvent.setup()
    renderWizard()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    const summary = await findSummary()
    const items = within(summary).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(within(summary).getByRole('link', { name: 'Name is required' })).toBeInTheDocument()
    expect(within(summary).getByRole('link', { name: 'Invalid email address' })).toBeInTheDocument()
  })

  it('renders nothing on the plan step, which has no failures yet', async () => {
    const user = userEvent.setup()
    renderWizard()
    await user.type(screen.getByLabelText('Name'), 'Ada')
    await user.type(screen.getByLabelText('Email'), 'a@b.co')
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await waitFor(() => expect(screen.getByLabelText('Plan')).toBeInTheDocument())
    expect(querySummary()).toBeNull()
  })

  it('re-focuses the heading on a second failed Next against the same step', async () => {
    const user = userEvent.setup()
    renderWizard()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    const heading = await screen.findByRole('heading', { name: 'There is a problem' })
    await waitFor(() => expect(heading).toHaveFocus())

    // Move focus elsewhere, then fail Next again with nothing fixed: the same fields are still
    // invalid, but the heading must still receive focus a second time.
    // Wrapped in `act`: focusing a MUI input flips its FormControl's focused state, and a raw
    // `.focus()` would land that update outside React's batching.
    act(() => screen.getByLabelText('Name').focus())
    expect(heading).not.toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await waitFor(() => expect(heading).toHaveFocus())
  })

  it('a failed final submit lists the last step errors and focuses the heading', async () => {
    const user = userEvent.setup()
    renderWizard()
    await user.type(screen.getByLabelText('Name'), 'Ada')
    await user.type(screen.getByLabelText('Email'), 'a@b.co')
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await waitFor(() => expect(screen.getByLabelText('Plan')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Submit' }))
    const summary = await findSummary()
    expect(within(summary).getByRole('link', { name: 'Plan is required' })).toBeInTheDocument()
    const heading = within(summary).getByRole('heading', { name: 'There is a problem' })
    await waitFor(() => expect(heading).toHaveFocus())
  })

  it('a failed confirm pre-submit on the last step still shows the summary (regression: #81)', async () => {
    // `<Form confirm>`'s pre-submit `trigger()` runs before the dialog and outside
    // `handleSubmit`, so a failed validation there never bumps `submitCount` — the same
    // gap `failedConfirmAttempt` closes for a plain, non-Wizard form (see the "with
    // confirm" describe block above). Inside a Wizard, `attempted` used to check only
    // `wizard.lastFailed`/`submitCount` and never `failedConfirmAttempt`, so a Wizard's
    // last-step Submit + `confirm` + `FormErrorSummary` silently showed nothing on a
    // failed submit: no dialog (correctly refused), but also no visible feedback at all.
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <Form
        schema={wizardSchema}
        defaultValues={{ name: '', email: '', plan: '' }}
        onSubmit={onSubmit}
        confirm
      >
        <Wizard steps={steps}>
          <WizardStep id="account">
            <FormErrorSummary />
            <TextField name="name" label="Name" />
            <TextField name="email" label="Email" />
          </WizardStep>
          <WizardStep id="plan">
            <FormErrorSummary />
            <TextField name="plan" label="Plan" />
          </WizardStep>
          <WizardNav />
        </Wizard>
      </Form>,
    )
    await user.type(screen.getByLabelText('Name'), 'Ada')
    await user.type(screen.getByLabelText('Email'), 'a@b.co')
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await waitFor(() => expect(screen.getByLabelText('Plan')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Submit' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    const summary = await findSummary()
    expect(within(summary).getByRole('link', { name: 'Plan is required' })).toBeInTheDocument()
    const heading = within(summary).getByRole('heading', { name: 'There is a problem' })
    await waitFor(() => expect(heading).toHaveFocus())
    expect(onSubmit).not.toHaveBeenCalled()
  })
})

describe('useEzFormContext guard', () => {
  it('throws a clear error outside <Form>', () => {
    // React logs every error it caught while rendering before rethrowing it. The `toThrow`
    // below is the assertion; these allow the noise that necessarily comes with it.
    expectConsole('error', 'must be rendered inside <Form>')
    expectConsole('error', 'The above error occurred')
    expect(() => render(<FormErrorSummary />)).toThrow(
      'ez-form: <FormErrorSummary> must be rendered inside <Form>',
    )
  })
})
