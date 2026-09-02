import { useState } from 'react'
import { createTheme, ThemeProvider } from '@mui/material/styles'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { z } from 'zod'
import { Form } from '../Form'
import { TextField } from '../fields/TextField'
import { expectNoA11yViolations } from '../test/axe'
import { Wizard, type WizardStepDef } from './Wizard'
import { WizardStep } from './WizardStep'
import { WizardStepper, wizardStepperClasses } from './WizardStepper'
import { WizardNav } from './WizardNav'
import { useWizard } from './useWizard'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.email('Invalid email'),
  plan: z.string().min(1, 'Plan is required'),
})
type Input = z.input<typeof schema>

const steps = [
  { id: 'account', label: 'Account', fields: ['name', 'email'] },
  { id: 'plan', label: 'Plan', fields: ['plan'] },
  { id: 'review', label: 'Review' },
] as const satisfies WizardStepDef<Input>[]

/** Buttons + a readout so tests drive the context without the Stepper/Nav components. */
function Controls() {
  const w = useWizard('Controls')
  return (
    <>
      <output data-testid="current">{w.current.id}</output>
      <output data-testid="visited">{w.visited.join(',')}</output>
      <output data-testid="status">
        {w.steps.map((s) => `${s.id}:${w.stepStatus(s.id)}`).join(' ')}
      </output>
      <output data-testid="pending">{String(w.pending)}</output>
      <button type="button" onClick={() => void w.next()}>
        next
      </button>
      <button type="button" onClick={w.prev}>
        prev
      </button>
      <button type="button" onClick={() => void w.go('account')}>
        go account
      </button>
      <button type="button" onClick={() => void w.go('review')}>
        go review
      </button>
    </>
  )
}

function Steps() {
  return (
    <>
      <WizardStep id="account">
        <TextField name="name" label="Name" />
        <TextField name="email" label="Email" />
      </WizardStep>
      <WizardStep id="plan">
        <TextField name="plan" label="Plan" />
      </WizardStep>
      <WizardStep id="review">
        <p>Review</p>
      </WizardStep>
      <Controls />
    </>
  )
}

const empty = { name: '', email: '', plan: '' }
const filled = { name: 'Ada', email: 'ada@x.io', plan: 'pro' }

describe('Wizard', () => {
  it('renders only the current step and starts on the first', () => {
    render(
      <Form schema={schema} defaultValues={empty} onSubmit={() => {}}>
        <Wizard steps={steps}>
          <Steps />
        </Wizard>
      </Form>,
    )
    expect(screen.getByRole('textbox', { name: 'Name' })).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Plan' })).not.toBeInTheDocument()
    expect(screen.getByTestId('current')).toHaveTextContent('account')
    expect(screen.getByTestId('status')).toHaveTextContent(
      'account:current plan:upcoming review:upcoming',
    )
  })

  it('next validates only the current step and focuses the first error', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={empty} onSubmit={() => {}}>
        <Wizard steps={steps}>
          <Steps />
        </Wizard>
      </Form>,
    )
    await user.click(screen.getByRole('button', { name: 'next' }))
    expect(await screen.findByText('Name is required')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveFocus()
    expect(screen.getByTestId('current')).toHaveTextContent('account')
    // plan's error is not shown / not evaluated: still on account, plan never mounted
    expect(screen.queryByText('Plan is required')).not.toBeInTheDocument()
  })

  it('next advances when the step is valid, prev goes back without validating', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={{ ...filled, plan: '' }} onSubmit={() => {}}>
        <Wizard steps={steps}>
          <Steps />
        </Wizard>
      </Form>,
    )
    await user.click(screen.getByRole('button', { name: 'next' }))
    await waitFor(() => expect(screen.getByTestId('current')).toHaveTextContent('plan'))
    expect(screen.getByRole('textbox', { name: 'Plan' })).toBeInTheDocument()
    expect(screen.getByTestId('status')).toHaveTextContent(
      'account:completed plan:current review:upcoming',
    )
    await user.click(screen.getByRole('button', { name: 'prev' }))
    expect(screen.getByTestId('current')).toHaveTextContent('account')
    expect(screen.queryByText('Plan is required')).not.toBeInTheDocument()
    expect(screen.getByTestId('visited')).toHaveTextContent('account,plan')
  })

  it('go() reaches visited steps, refuses upcoming ones, validates when moving forward', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={filled} onSubmit={() => {}}>
        <Wizard steps={steps}>
          <Steps />
        </Wizard>
      </Form>,
    )
    await user.click(screen.getByRole('button', { name: 'go review' }))
    expect(screen.getByTestId('current')).toHaveTextContent('account')
    await user.click(screen.getByRole('button', { name: 'next' }))
    await user.click(screen.getByRole('button', { name: 'next' }))
    await waitFor(() => expect(screen.getByTestId('current')).toHaveTextContent('review'))
    await user.click(screen.getByRole('button', { name: 'go account' }))
    expect(screen.getByTestId('current')).toHaveTextContent('account')
    await user.clear(screen.getByRole('textbox', { name: 'Name' }))
    await user.click(screen.getByRole('button', { name: 'go review' }))
    expect(await screen.findByText('Name is required')).toBeInTheDocument()
    expect(screen.getByTestId('current')).toHaveTextContent('account')
  })

  it('a visited step with an error is "visited", not "completed"', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={filled} onSubmit={() => {}} mode="onChange">
        <Wizard steps={steps}>
          <Steps />
        </Wizard>
      </Form>,
    )
    await user.click(screen.getByRole('button', { name: 'next' }))
    await waitFor(() => expect(screen.getByTestId('current')).toHaveTextContent('plan'))
    await user.clear(screen.getByRole('textbox', { name: 'Plan' }))
    await screen.findByText('Plan is required')
    await user.click(screen.getByRole('button', { name: 'prev' }))
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('plan:visited'))
  })

  it('reports pending while an async rule validates, and clears it after the move', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={filled} onSubmit={() => {}}>
        <Wizard steps={steps}>
          <WizardStep id="account">
            <TextField
              name="name"
              label="Name"
              validate={() => new Promise<true>((r) => setTimeout(() => r(true), 50))}
            />
            <TextField name="email" label="Email" />
          </WizardStep>
          <WizardStep id="plan">
            <TextField name="plan" label="Plan" />
          </WizardStep>
          <Controls />
        </Wizard>
      </Form>,
    )
    expect(screen.getByTestId('pending')).toHaveTextContent('false')
    await user.click(screen.getByRole('button', { name: 'next' }))
    // The slow validate keeps `next()` in flight, so Task 7's Next button has a
    // loading state to render.
    await waitFor(() => expect(screen.getByTestId('pending')).toHaveTextContent('true'))
    await waitFor(() => expect(screen.getByTestId('current')).toHaveTextContent('plan'))
    expect(screen.getByTestId('pending')).toHaveTextContent('false')
  })

  it('next on the last step is a no-op that returns false', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={filled} onSubmit={() => {}}>
        <Wizard steps={steps}>
          <Steps />
        </Wizard>
      </Form>,
    )
    await user.click(screen.getByRole('button', { name: 'next' }))
    await user.click(screen.getByRole('button', { name: 'next' }))
    await waitFor(() => expect(screen.getByTestId('current')).toHaveTextContent('review'))
    await user.click(screen.getByRole('button', { name: 'next' }))
    expect(screen.getByTestId('current')).toHaveTextContent('review')
  })

  describe('controlled', () => {
    function Controlled({
      initial,
      visited,
      onVisitedChange,
    }: {
      initial: string
      visited?: readonly string[]
      onVisitedChange?: (ids: readonly string[]) => void
    }) {
      const [step, setStep] = useState(initial)
      // A controlled `visited` behaves like a controlled `step`: the wizard
      // only moves once the consumer feeds the new list back. Tests that pass
      // `onVisitedChange` get that round trip; the redirect test deliberately
      // leaves the list frozen so the wizard cannot reach `review`.
      const [visitedState, setVisitedState] = useState(visited)
      const onStepChange = vi.fn((s: WizardStepDef) => setStep(s.id))
      return (
        <Form schema={schema} defaultValues={filled} onSubmit={() => {}}>
          <output data-testid="param">{step}</output>
          <Wizard
            steps={steps}
            step={step}
            onStepChange={onStepChange}
            visited={onVisitedChange ? visitedState : visited}
            onVisitedChange={
              onVisitedChange &&
              ((ids) => {
                onVisitedChange(ids)
                setVisitedState(ids)
              })
            }
          >
            <Steps />
          </Wizard>
        </Form>
      )
    }

    it('round-trips step through onStepChange', async () => {
      const user = userEvent.setup()
      render(<Controlled initial="account" />)
      await user.click(screen.getByRole('button', { name: 'next' }))
      await waitFor(() => expect(screen.getByTestId('param')).toHaveTextContent('plan'))
      expect(screen.getByTestId('current')).toHaveTextContent('plan')
    })

    it('redirects an unknown or unvisited step to the last visited one', async () => {
      render(<Controlled initial="review" />)
      await waitFor(() => expect(screen.getByTestId('param')).toHaveTextContent('account'))
      expect(screen.getByTestId('current')).toHaveTextContent('account')
    })

    it('restores from a controlled visited list and reports changes', async () => {
      const user = userEvent.setup()
      const onVisitedChange = vi.fn()
      render(
        <Controlled
          initial="plan"
          visited={['account', 'plan']}
          onVisitedChange={onVisitedChange}
        />,
      )
      expect(screen.getByTestId('current')).toHaveTextContent('plan')
      expect(screen.getByTestId('status')).toHaveTextContent(
        'account:completed plan:current review:upcoming',
      )
      await user.click(screen.getByRole('button', { name: 'next' }))
      await waitFor(() =>
        expect(onVisitedChange).toHaveBeenCalledWith(['account', 'plan', 'review']),
      )
      // The move sticks: with the new list fed back, the wizard reaches review
      // instead of being bounced to the last visited step by the redirect effect.
      await waitFor(() => expect(screen.getByTestId('current')).toHaveTextContent('review'))
      expect(screen.getByTestId('param')).toHaveTextContent('review')
    })

    it('redirects a step beyond the restored visited list to the last visited step', async () => {
      render(<Controlled initial="review" visited={['account', 'plan']} />)
      await waitFor(() => expect(screen.getByTestId('param')).toHaveTextContent('plan'))
    })
  })

  it('throws outside <Form> and useWizard throws outside <Wizard>', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() =>
      render(
        <Wizard steps={steps}>
          <p />
        </Wizard>,
      ),
    ).toThrow('ez-form: <Wizard> must be rendered inside <Form>')
    expect(() =>
      render(
        <Form schema={schema} defaultValues={filled} onSubmit={() => {}}>
          <Controls />
        </Form>,
      ),
    ).toThrow('ez-form: <Controls> must be rendered inside <Wizard>')
  })
})

describe('WizardStepper', () => {
  function Inline({ orientation }: { orientation?: 'horizontal' | 'vertical' }) {
    return (
      <Form schema={schema} defaultValues={filled} onSubmit={() => {}}>
        <Wizard steps={steps} orientation={orientation}>
          <WizardStepper />
          <Steps />
        </Wizard>
      </Form>
    )
  }

  // MUI 9.4's Stepper renders a `StepButton` step as `role="tab"` inside a
  // `role="tablist"` (roving-tabindex APG tabs pattern), not `role="button"` —
  // see https://mui.com/material-ui/migration/upgrade-to-v9/. These tests use
  // the default (horizontal) orientation, where `WizardStepper` uses
  // `StepButton`, so step queries target `tab`; `button` still targets the
  // plain <button>s (next/prev/go). Vertical doesn't use `StepButton` (a
  // tablist can't contain `StepContent`) and its own test below queries
  // `button` for steps.
  it('shows every step; visited steps are buttons, upcoming steps are not', async () => {
    const user = userEvent.setup()
    render(<Inline />)
    expect(screen.getByText('Account')).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: /Plan/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'next' }))
    await waitFor(() => expect(screen.getByRole('tab', { name: /Account/ })).toBeInTheDocument())
    expect(screen.getByRole('tab', { name: /Plan/ })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: /Review/ })).not.toBeInTheDocument()
  })

  it('clicking a visited step goes there', async () => {
    const user = userEvent.setup()
    render(<Inline />)
    await user.click(screen.getByRole('button', { name: 'next' }))
    await waitFor(() => expect(screen.getByTestId('current')).toHaveTextContent('plan'))
    await user.click(screen.getByRole('tab', { name: /Account/ }))
    expect(screen.getByTestId('current')).toHaveTextContent('account')
    expect(screen.getByRole('textbox', { name: 'Name' })).toBeInTheDocument()
  })

  it('vertical: the current step content renders inside the stepper and is still bound to the form', async () => {
    const user = userEvent.setup()
    const { container } = render(<Inline orientation="vertical" />)
    const stepper = container.querySelector('.MuiStepper-vertical')!
    await waitFor(() => expect(stepper.querySelector('input[name="name"]')).not.toBeNull())
    await user.type(screen.getByRole('textbox', { name: 'Name' }), '!')
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Ada!')
    await user.click(screen.getByRole('button', { name: 'next' }))
    await waitFor(() => expect(stepper.querySelector('input[name="plan"]')).not.toBeNull())
    expect(stepper.querySelector('input[name="name"]')).toBeNull()
  })

  it.each(['horizontal', 'vertical'] as const)(
    '%s has no accessibility violations',
    async (orientation) => {
      const user = userEvent.setup()
      const { container } = render(<Inline orientation={orientation} />)
      await user.click(screen.getByRole('button', { name: 'next' }))
      await waitFor(() => expect(screen.getByTestId('current')).toHaveTextContent('plan'))
      await expectNoA11yViolations(container)
    },
  )

  it.each(['horizontal', 'vertical'] as const)(
    '%s: a step optional hint renders',
    async (orientation) => {
      const optionalSteps = [
        {
          id: 'account',
          label: 'Account',
          fields: ['name', 'email'],
          optional: 'Seats are billed monthly',
        },
        { id: 'plan', label: 'Plan', fields: ['plan'] },
        { id: 'review', label: 'Review' },
      ] as const satisfies WizardStepDef<Input>[]
      render(
        <Form schema={schema} defaultValues={filled} onSubmit={() => {}}>
          <Wizard steps={optionalSteps} orientation={orientation}>
            <WizardStepper />
            <Steps />
          </Wizard>
        </Form>,
      )
      expect(screen.getByText('Seats are billed monthly')).toBeInTheDocument()
    },
  )

  it('a visited step with an error shows the StepLabel error state', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={filled} onSubmit={() => {}} mode="onChange">
        <Wizard steps={steps}>
          <WizardStepper />
          <Steps />
        </Wizard>
      </Form>,
    )
    await user.click(screen.getByRole('button', { name: 'next' }))
    await waitFor(() => expect(screen.getByTestId('current')).toHaveTextContent('plan'))
    await user.clear(screen.getByRole('textbox', { name: 'Plan' }))
    await screen.findByText('Plan is required')
    await user.click(screen.getByRole('button', { name: 'prev' }))
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('plan:visited'))
    const planLabel = screen.getByText('Plan', { selector: '.MuiStepLabel-label' })
    expect(planLabel).toHaveClass('Mui-error')
  })

  it('is themeable: styleOverrides.verticalStepButton applies to the vertical step button', async () => {
    const user = userEvent.setup()
    const theme = createTheme({
      components: {
        EzWizardStepper: {
          styleOverrides: {
            verticalStepButton: { textTransform: 'uppercase' },
          },
        },
      },
    })
    render(
      <ThemeProvider theme={theme}>
        <Inline orientation="vertical" />
      </ThemeProvider>,
    )
    await user.click(screen.getByRole('button', { name: 'next' }))
    await waitFor(() => expect(screen.getByTestId('current')).toHaveTextContent('plan'))
    const accountButton = screen.getByText('Account').closest('button')!
    expect(accountButton).toHaveClass(wizardStepperClasses.verticalStepButton)
    expect(getComputedStyle(accountButton).textTransform).toBe('uppercase')
  })
})

describe('WizardNav', () => {
  function Inline({ onSubmit = () => {} }: { onSubmit?: () => void }) {
    return (
      <Form schema={schema} defaultValues={filled} onSubmit={onSubmit}>
        <Wizard steps={steps}>
          <WizardStep id="account">
            <TextField name="name" label="Name" />
          </WizardStep>
          <WizardStep id="plan">
            <TextField name="plan" label="Plan" />
          </WizardStep>
          <WizardStep id="review">
            <p>Review</p>
          </WizardStep>
          <WizardNav />
        </Wizard>
      </Form>
    )
  }

  it('Back is disabled on the first step; Next advances; the last step shows Submit', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<Inline onSubmit={onSubmit} />)
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Submit' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Plan' })).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Back' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await waitFor(() => expect(screen.getByText('Review')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(filled, expect.anything()))
  })

  it('Next stays put and shows the error when the step is invalid', async () => {
    const user = userEvent.setup()
    render(<Inline />)
    await user.clear(screen.getByRole('textbox', { name: 'Name' }))
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(await screen.findByText('Name is required')).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Plan' })).not.toBeInTheDocument()
  })

  it('custom labels', () => {
    render(
      <Form schema={schema} defaultValues={filled} onSubmit={() => {}}>
        <Wizard steps={steps}>
          <WizardNav prevLabel="Previous" nextLabel="Continue" />
        </Wizard>
      </Form>,
    )
    expect(screen.getByRole('button', { name: 'Previous' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument()
  })

  it('is themeable: defaultProps.slotProps.next.variant applies to the Next button', () => {
    const theme = createTheme({
      components: {
        EzWizardNav: {
          defaultProps: {
            slotProps: { next: { variant: 'outlined' } },
          },
        },
      },
    })
    render(
      <ThemeProvider theme={theme}>
        <Form schema={schema} defaultValues={filled} onSubmit={() => {}}>
          <Wizard steps={steps}>
            <WizardNav />
          </Wizard>
        </Form>
      </ThemeProvider>,
    )
    expect(screen.getByRole('button', { name: 'Next' })).toHaveClass('MuiButton-outlined')
  })
})
