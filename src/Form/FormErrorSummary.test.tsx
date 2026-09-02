import { render, screen, waitFor, within } from '@testing-library/react'
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

describe('FormErrorSummary', () => {
  it('renders nothing before any submit', () => {
    renderForm()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
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
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('lists one item per invalid field with its message after a failed submit', async () => {
    const user = userEvent.setup()
    renderForm()
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    const alert = await screen.findByRole('alert', { name: 'There is a problem' })
    expect(within(alert).getByText('There is a problem')).toBeInTheDocument()
    const items = within(alert).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(within(alert).getByRole('link', { name: 'Name is required' })).toBeInTheDocument()
    expect(within(alert).getByRole('link', { name: 'Invalid email address' })).toBeInTheDocument()
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
    await screen.findByRole('alert', { name: 'There is a problem' })
    expect(screen.getByLabelText('Name')).not.toHaveFocus()
  })

  it('activating an item focuses that field', async () => {
    const user = userEvent.setup()
    renderForm()
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    const alert = await screen.findByRole('alert', { name: 'There is a problem' })
    const link = within(alert).getByRole('link', { name: 'Name is required' })
    await user.click(link)
    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveFocus())
  })

  it('the link href points at the field id when the registered element has one', async () => {
    const user = userEvent.setup()
    renderForm()
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    const alert = await screen.findByRole('alert', { name: 'There is a problem' })
    const link = within(alert).getByRole('link', { name: 'Name is required' })
    const nameInput = screen.getByLabelText('Name')
    expect(link).toHaveAttribute('href', `#${nameInput.id}`)
  })

  it('drops items as their fields become valid, and removes the summary once none remain', async () => {
    const user = userEvent.setup()
    renderForm()
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    let alert = await screen.findByRole('alert', { name: 'There is a problem' })
    expect(within(alert).getAllByRole('listitem')).toHaveLength(2)

    await user.type(screen.getByLabelText('Name'), 'Ada')
    await user.tab()
    alert = await screen.findByRole('alert', { name: 'There is a problem' })
    await waitFor(() => expect(within(alert).getAllByRole('listitem')).toHaveLength(1))
    expect(within(alert).getByRole('link', { name: 'Invalid email address' })).toBeInTheDocument()

    await user.type(screen.getByLabelText('Email'), 'a@b.co')
    await user.tab()
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  })

  it('has no accessibility violations after a failed submit', async () => {
    const user = userEvent.setup()
    const { container } = renderForm()
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    await screen.findByRole('alert', { name: 'There is a problem' })
    await expectNoA11yViolations(container)
  })

  it('custom title, and theme-driven heading level via slotProps', () => {
    const { unmount } = render(
      <Form schema={schema} defaultValues={{ name: '', email: '' }} onSubmit={() => {}}>
        <FormErrorSummary title="Fix these" slotProps={{ heading: { component: 'h3' } }} />
        <TextField name="name" label="Name" />
        <SubmitButton>Submit</SubmitButton>
      </Form>,
    )
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
    const alert = await screen.findByTestId('summary')
    expect(alert).toHaveClass('mine')
    expect(alert).toHaveClass(formErrorSummaryClasses.root)
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
    const alert = await screen.findByRole('alert', { name: 'There is a problem' })
    const items = within(alert).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(within(alert).getByRole('link', { name: 'Name is required' })).toBeInTheDocument()
    expect(within(alert).getByRole('link', { name: 'Invalid email address' })).toBeInTheDocument()
  })

  it('renders nothing on the plan step, which has no failures yet', async () => {
    const user = userEvent.setup()
    renderWizard()
    await user.type(screen.getByLabelText('Name'), 'Ada')
    await user.type(screen.getByLabelText('Email'), 'a@b.co')
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await waitFor(() => expect(screen.getByLabelText('Plan')).toBeInTheDocument())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('useEzFormContext guard', () => {
  it('throws a clear error outside <Form>', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<FormErrorSummary />)).toThrow(
      'ez-form: <FormErrorSummary> must be rendered inside <Form>',
    )
  })
})
