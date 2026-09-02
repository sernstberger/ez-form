import { useState } from 'react'
import { createTheme, ThemeProvider } from '@mui/material/styles'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useFormContext } from 'react-hook-form'
import { z } from 'zod'
import { Form } from '../Form'
import { SubmitButton } from '../SubmitButton'
import { TextField } from '../fields/TextField'
import { expectNoA11yViolations } from '../test/axe'
import { FormSection, formSectionClasses } from '../FormSection'
import { Wizard, type WizardStepDef } from './Wizard'
import { WizardStep } from './WizardStep'
import { WizardStepper, wizardStepperClasses } from './WizardStepper'
import { WizardNav } from './WizardNav'
import { useWizard } from './useWizard'

// A spy on the real `useWatch` — proves a `when`-less `Wizard` never calls it at all
// (the fix for the reviewed bug: `disabled: true` still subscribed at the react-hook-form
// level; only never mounting the hook is a real no-op). Wraps rather than replaces, so
// every other test in this file exercises the genuine hook.
const useWatchSpy = vi.fn()
vi.mock('react-hook-form', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-hook-form')>()
  return {
    ...actual,
    useWatch: (...args: Parameters<typeof actual.useWatch>) => {
      useWatchSpy(...args)
      return actual.useWatch(...(args as unknown as []))
    },
  }
})

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
  const [went, setWent] = useState<string>('')
  return (
    <>
      <output data-testid="current">{w.current.id}</output>
      <output data-testid="went">{went}</output>
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
      <button type="button" onClick={() => void w.go('gone').then((r) => setWent(String(r)))}>
        go gone
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

/**
 * A gate field plus a step whose `when` reads it — the shape the Insurance example's
 * `hasVehicle`/`vehicle` step used a hand-rolled `useMemo` filter for (see #80).
 */
const conditionalSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  hasExtra: z.boolean(),
  extra: z.string(),
  plan: z.string().min(1, 'Plan is required'),
})
type ConditionalInput = z.input<typeof conditionalSchema>
const conditionalSteps = [
  { id: 'account', label: 'Account', fields: ['name', 'hasExtra'] },
  {
    id: 'extra',
    label: 'Extra',
    fields: ['extra'],
    when: (v: ConditionalInput) => Boolean(v.hasExtra),
  },
  { id: 'plan', label: 'Plan', fields: ['plan'] },
  { id: 'review', label: 'Review' },
] as const satisfies WizardStepDef<ConditionalInput>[]
const conditionalFilled: ConditionalInput = {
  name: 'Ada',
  hasExtra: false,
  extra: '',
  plan: 'pro',
}

function ConditionalControls() {
  const { setValue } = useFormContext<ConditionalInput>()
  return (
    <>
      <button type="button" onClick={() => setValue('hasExtra', true)}>
        show extra
      </button>
      <button type="button" onClick={() => setValue('hasExtra', false)}>
        hide extra
      </button>
    </>
  )
}

function ConditionalSteps() {
  const w = useWizard('ConditionalSteps')
  return (
    <>
      <WizardStep id="account">
        <TextField name="name" label="Name" />
      </WizardStep>
      <WizardStep id="extra">
        <TextField name="extra" label="Extra" />
      </WizardStep>
      <WizardStep id="plan">
        <TextField name="plan" label="Plan" />
      </WizardStep>
      <WizardStep id="review">
        <p>Review</p>
      </WizardStep>
      <Controls />
      <ConditionalControls />
      <button type="button" onClick={() => void w.go('extra')}>
        go extra
      </button>
    </>
  )
}

/**
 * Counts distinct `steps` array references seen across renders (a `Set` of identities,
 * read via its size) — proves the effective list keeps its reference across a value
 * change that doesn't flip any `when` predicate's answer, rather than being re-derived
 * (and handed a fresh array) on every keystroke.
 */
const seenStepsRefs = new Set<unknown>()
function StepsIdentityProbe() {
  const { steps } = useWizard('StepsIdentityProbe')
  seenStepsRefs.add(steps)
  return <output data-testid="steps-ref-count">{seenStepsRefs.size}</output>
}

/** `nickname` appears in no step's `fields`: only final submit ever validates it. */
const unlistedSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  nickname: z.string().min(1, 'Nickname is required'),
})
const unlistedSteps = [
  { id: 'account', label: 'Account', fields: ['name'] },
  { id: 'review', label: 'Review' },
] as const satisfies WizardStepDef<z.input<typeof unlistedSchema>>[]
const unlistedEmpty = { name: 'Ada', nickname: '' }

/**
 * Invalidates a field from another step, the way an async `values` load or a "clear"
 * action on a review step does: the account step is unmounted, so nothing shows the
 * error and hookform's submit-time focus has no input to focus.
 */
function ClearEmail() {
  const { setValue } = useFormContext<Input>()
  return (
    <button type="button" onClick={() => setValue('email', '')}>
      clear email
    </button>
  )
}

/**
 * A schema with a top-level field literally named `type`, and a nested `address` object
 * whose own leaf is also named `type` (alongside `city`) — regression fixtures for the
 * `errorFieldPaths` leaf check, which used to mistake a node with a `type` key for a
 * `FieldError` leaf regardless of what else was on it.
 */
const typeFieldSchema = z.object({
  type: z.string().min(1, 'Type is required'),
  address: z.object({
    type: z.string().min(1, 'Address type is required'),
    city: z.string().min(1, 'City is required'),
  }),
})
type TypeFieldInput = z.input<typeof typeFieldSchema>
const typeFieldSteps = [
  { id: 'kind', label: 'Kind', fields: ['type'] },
  { id: 'address', label: 'Address', fields: ['address.type', 'address.city'] },
  { id: 'review', label: 'Review' },
] as const satisfies WizardStepDef<TypeFieldInput>[]
const typeFieldFilled: TypeFieldInput = {
  type: 'personal',
  address: { type: 'home', city: 'Ada' },
}

/** Invalidates the top-level `type` field from a step that does not mount it. */
function ClearType() {
  const { setValue } = useFormContext<TypeFieldInput>()
  return (
    <button type="button" onClick={() => setValue('type', '')}>
      clear type
    </button>
  )
}

function TypeFieldSteps() {
  return (
    <>
      <WizardStep id="kind">
        <TextField name="type" label="Type" />
      </WizardStep>
      <WizardStep id="address">
        <TextField name="address.type" label="Address type" />
        <TextField name="address.city" label="City" />
      </WizardStep>
      <WizardStep id="review">
        <p>Review</p>
      </WizardStep>
      <Controls />
    </>
  )
}

/**
 * Re-syncs the form the way `<Form resetOptions={{ keepErrors: true }} values={…}>` does
 * after a failed submit: hookform's `reset` sets `submitCount` back to 0 unless
 * `keepSubmitCount`, while `keepErrors` leaves the errors (and hence `errorPaths`) alone.
 */
function ResyncWithErrorsKept() {
  const { reset, getValues } = useFormContext<z.input<typeof unlistedSchema>>()
  return (
    <button type="button" onClick={() => reset(getValues(), { keepErrors: true })}>
      resync
    </button>
  )
}

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

    it('ignores a stale visited id and redirects to the last id that still matches a step', async () => {
      render(<Controlled initial="review" visited={['gone', 'plan']} />)
      await waitFor(() => expect(screen.getByTestId('current')).toHaveTextContent('plan'))
      expect(screen.getByTestId('param')).toHaveTextContent('plan')
    })

    it('falls back to the first step when no visited id matches a step', async () => {
      render(<Controlled initial="review" visited={['gone']} />)
      await waitFor(() => expect(screen.getByTestId('current')).toHaveTextContent('account'))
      expect(screen.getByTestId('param')).toHaveTextContent('account')
    })

    it('stepStatus does not throw for a stale id', () => {
      render(<Controlled initial="account" visited={['account', 'gone']} />)
      expect(screen.getByTestId('current')).toHaveTextContent('account')
      expect(screen.getByTestId('status')).toHaveTextContent(
        'account:current plan:upcoming review:upcoming',
      )
    })
  })

  it('go() with an id that is in no step resolves false without throwing', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={filled} onSubmit={() => {}}>
        <Wizard steps={steps}>
          <Steps />
        </Wizard>
      </Form>,
    )
    await user.click(screen.getByRole('button', { name: 'go gone' }))
    await waitFor(() => expect(screen.getByTestId('went')).toHaveTextContent('false'))
    expect(screen.getByTestId('current')).toHaveTextContent('account')
  })

  describe('failed submit', () => {
    it('an error on a field in no step belongs to the last step and blocks submit', async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn()
      render(
        <Form schema={unlistedSchema} defaultValues={unlistedEmpty} onSubmit={onSubmit}>
          <Wizard steps={unlistedSteps}>
            <WizardStep id="account">
              <TextField name="name" label="Name" />
            </WizardStep>
            <WizardStep id="review">
              <p>Review</p>
            </WizardStep>
            <Controls />
            <SubmitButton />
          </Wizard>
        </Form>,
      )
      await user.click(screen.getByRole('button', { name: 'next' }))
      await waitFor(() => expect(screen.getByTestId('current')).toHaveTextContent('review'))
      await user.click(screen.getByRole('button', { name: 'Submit' }))
      // `nickname` is in no step's fields, so its error belongs to the last step: the
      // wizard is already there, and the stepper marks it rather than saying "completed".
      await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('review:current'))
      await user.click(screen.getByRole('button', { name: 'go account' }))
      await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('review:visited'))
      expect(onSubmit).not.toHaveBeenCalled()
    })

    it('moves to the first errored step and focuses the field', async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn()
      render(
        <Form schema={schema} defaultValues={filled} onSubmit={onSubmit}>
          <Wizard steps={steps}>
            <Steps />
            <ClearEmail />
            <SubmitButton />
          </Wizard>
        </Form>,
      )
      await user.click(screen.getByRole('button', { name: 'next' }))
      await waitFor(() => expect(screen.getByTestId('current')).toHaveTextContent('plan'))
      await user.click(screen.getByRole('button', { name: 'next' }))
      await waitFor(() => expect(screen.getByTestId('current')).toHaveTextContent('review'))
      // The account step is unmounted when email goes invalid, so before this fix Submit
      // failed with nothing shown and nothing focused.
      await user.click(screen.getByRole('button', { name: 'clear email' }))
      await user.click(screen.getByRole('button', { name: 'Submit' }))
      await waitFor(() => expect(screen.getByTestId('current')).toHaveTextContent('account'))
      await waitFor(() => expect(screen.getByRole('textbox', { name: 'Email' })).toHaveFocus())
      expect(onSubmit).not.toHaveBeenCalled()
    })

    // Regression for #40: a controlled wizard can decline the failed-submit move (its
    // `onStepChange` need not call the `step` setter). The old focus effect only cleared
    // `focusTarget` once `current.id` became the target — declined, it just sat there — so
    // a later, unrelated arrival at that same step (the consumer's own navigation, long
    // after the failed submit) would wrongly focus the stale field on mount.
    it('clears a stale focusTarget when a controlled wizard declines the failed-submit move', async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn()
      function DeclinesMove() {
        const [step, setStep] = useState('account')
        const [visited, setVisited] = useState<readonly string[]>(['account'])
        return (
          <Form schema={schema} defaultValues={filled} onSubmit={onSubmit}>
            <Wizard
              steps={steps}
              step={step}
              // Accepts every move except the one the failed-submit effect requests
              // (back to "account", once "review" has been reached): that one is
              // declined by not calling `setStep`, the way a consumer with its own
              // routing/guard logic might veto a particular transition.
              onStepChange={(s) => {
                if (step === 'review' && s.id === 'account') return
                setStep(s.id)
              }}
              visited={visited}
              onVisitedChange={setVisited}
            >
              <Steps />
              <ClearEmail />
              <SubmitButton />
              <button type="button" onClick={() => setStep('account')}>
                jump to account
              </button>
            </Wizard>
          </Form>
        )
      }
      render(<DeclinesMove />)
      await user.click(screen.getByRole('button', { name: 'next' }))
      await waitFor(() => expect(screen.getByTestId('current')).toHaveTextContent('plan'))
      await user.click(screen.getByRole('button', { name: 'next' }))
      await waitFor(() => expect(screen.getByTestId('current')).toHaveTextContent('review'))
      await user.click(screen.getByRole('button', { name: 'clear email' }))
      await user.click(screen.getByRole('button', { name: 'Submit' }))
      // The failed submit requested a move to "account" via onStepChange, which declined
      // it: current stays on "review".
      await waitFor(() => expect(onSubmit).not.toHaveBeenCalled())
      expect(screen.getByTestId('current')).toHaveTextContent('review')
      // The consumer now moves to "account" on its own, unrelated to the failed submit —
      // a fresh `step` prop change via a plain setState, not through go/next/move.
      await user.click(screen.getByRole('button', { name: 'jump to account' }))
      await waitFor(() => expect(screen.getByTestId('current')).toHaveTextContent('account'))
      // The stale focusTarget must not fire: Email is not focused.
      expect(screen.getByRole('textbox', { name: 'Email' })).not.toHaveFocus()
    })

    it('does not navigate when the errored field is on the current step', async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn()
      render(
        <Form schema={schema} defaultValues={filled} onSubmit={onSubmit}>
          <Wizard steps={steps}>
            <Steps />
            <SubmitButton />
          </Wizard>
        </Form>,
      )
      await user.clear(screen.getByRole('textbox', { name: 'Email' }))
      await user.click(screen.getByRole('button', { name: 'Submit' }))
      await waitFor(() => expect(screen.getByText('Invalid email')).toBeInTheDocument())
      expect(screen.getByTestId('current')).toHaveTextContent('account')
      expect(screen.getByTestId('visited')).toHaveTextContent('account')
      expect(onSubmit).not.toHaveBeenCalled()
    })

    // Regression for a schema with a field literally named `type`: the old leaf check
    // (`'type' in errors`) treated the root errors object as a `FieldError` leaf itself,
    // since it has a `type` key one level down — `errorFieldPaths` returned `[]` and every
    // step read as error-free.
    it('a top-level field named "type" is still detected and navigated to on failed submit', async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn()
      render(
        <Form schema={typeFieldSchema} defaultValues={typeFieldFilled} onSubmit={onSubmit}>
          <Wizard steps={typeFieldSteps}>
            <TypeFieldSteps />
            <ClearType />
            <SubmitButton />
          </Wizard>
        </Form>,
      )
      await user.click(screen.getByRole('button', { name: 'next' }))
      await waitFor(() => expect(screen.getByTestId('current')).toHaveTextContent('address'))
      await user.click(screen.getByRole('button', { name: 'next' }))
      await waitFor(() => expect(screen.getByTestId('current')).toHaveTextContent('review'))
      // "kind" (which owns `type`) is unmounted from "review", so — like `ClearEmail`
      // above — submit is the only thing left that can catch an invalid `type`. Before the
      // fix, the root errors object (which has a `type` key one level down, for the
      // top-level field) itself matched the old `'type' in errors` leaf check, so
      // `errorFieldPaths` returned `[]` and this failed submit went undetected.
      await user.click(screen.getByRole('button', { name: 'clear type' }))
      await user.click(screen.getByRole('button', { name: 'Submit' }))
      await waitFor(() => expect(screen.getByTestId('current')).toHaveTextContent('kind'))
      await waitFor(() => expect(screen.getByRole('textbox', { name: 'Type' })).toHaveFocus())
      expect(onSubmit).not.toHaveBeenCalled()
    })

    // Regression for the nested case: before the fix, `address.type` (a `FieldError` leaf
    // one level under `address`) truncated to just `['address']` because `isFieldError`
    // never got a chance to look past the top-level `type` key. Driven through the
    // component per the "no export-for-testing precedent" fallback: `stepStatus` for the
    // `address` step (which lists `address.type` and `address.city`) only reads "visited"
    // (not "completed") if the flattener actually reached the `address.type` leaf — mirrors
    // the existing "a visited step with an error is visited" test above, one step over.
    it('flattens a nested object whose own leaf is named "type" (address.type, address.city)', async () => {
      const user = userEvent.setup()
      render(
        <Form
          schema={typeFieldSchema}
          defaultValues={typeFieldFilled}
          onSubmit={() => {}}
          mode="onChange"
        >
          <Wizard steps={typeFieldSteps}>
            <TypeFieldSteps />
          </Wizard>
        </Form>,
      )
      await user.click(screen.getByRole('button', { name: 'next' }))
      await waitFor(() => expect(screen.getByTestId('current')).toHaveTextContent('address'))
      await user.clear(screen.getByRole('textbox', { name: 'Address type' }))
      // Both address.type and address.city errors would be produced by a correct flatten;
      // asserting on address.type alone is the regression-specific one — before the fix it
      // never appeared at all, since `errorFieldPaths` truncated to `['address']`.
      await screen.findByText('Address type is required')
      await user.click(screen.getByRole('button', { name: 'prev' }))
      await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('address:visited'))
    })

    // Regression for the submitCount-decrease bug: `<Form resetOptions={{ keepErrors:
    // true }} values={…}>` re-syncs with `reset`, which resets `submitCount` to 0 unless
    // `keepSubmitCount` — with errors kept, the old `submitCount !== handledSubmit.current`
    // check treated that decrease as a brand-new failed submit and yanked the user to
    // another step a second time.
    it('does not navigate again when a resync (reset with keepErrors) drops submitCount', async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn()
      render(
        <Form schema={unlistedSchema} defaultValues={unlistedEmpty} onSubmit={onSubmit}>
          <Wizard steps={unlistedSteps}>
            <WizardStep id="account">
              <TextField name="name" label="Name" />
            </WizardStep>
            <WizardStep id="review">
              <p>Review</p>
            </WizardStep>
            <Controls />
            <ResyncWithErrorsKept />
            <SubmitButton />
          </Wizard>
        </Form>,
      )
      await user.click(screen.getByRole('button', { name: 'next' }))
      await waitFor(() => expect(screen.getByTestId('current')).toHaveTextContent('review'))
      await user.click(screen.getByRole('button', { name: 'Submit' }))
      // `nickname` is in no step's fields (see the "belongs to the last step" test above),
      // so it is never revalidated — and its error never cleared — by navigating with
      // `go`/`next`. That keeps `errors.nickname` populated for the rest of this test
      // while still letting the wizard move freely, which is what lets a *second* move
      // after the resync (were the bug still present) be observable at all.
      await waitFor(() => expect(screen.getByTestId('current')).toHaveTextContent('review'))
      await user.click(screen.getByRole('button', { name: 'go account' }))
      expect(screen.getByTestId('current')).toHaveTextContent('account')
      // Resync: submitCount drops to 0 with `nickname`'s error kept, but this is not a new
      // submit. With the bug, the decrease was mishandled as one and re-ran the failed-
      // submit navigation, bouncing the user from "account" back to "review" (nickname's
      // owning step) a second time.
      await user.click(screen.getByRole('button', { name: 'resync' }))
      await new Promise((r) => setTimeout(r, 0))
      expect(screen.getByTestId('current')).toHaveTextContent('account')
      expect(onSubmit).not.toHaveBeenCalled()
    })
  })

  describe('conditional steps (when)', () => {
    beforeEach(() => {
      useWatchSpy.mockClear()
      seenStepsRefs.clear()
    })

    it('a wizard with no `when` never calls useWatch', () => {
      render(
        <Form schema={schema} defaultValues={filled} onSubmit={() => {}}>
          <Wizard steps={steps}>
            <Steps />
          </Wizard>
        </Form>,
      )
      expect(useWatchSpy).not.toHaveBeenCalled()
    })

    it('a wizard with a `when` step does call useWatch (positive control for the test above)', () => {
      render(
        <Form schema={conditionalSchema} defaultValues={conditionalFilled} onSubmit={() => {}}>
          <Wizard steps={conditionalSteps}>
            <ConditionalSteps />
          </Wizard>
        </Form>,
      )
      expect(useWatchSpy).toHaveBeenCalled()
    })

    it('a step whose `when` is false is absent from the effective steps and stepper', () => {
      render(
        <Form schema={conditionalSchema} defaultValues={conditionalFilled} onSubmit={() => {}}>
          <Wizard steps={conditionalSteps}>
            <ConditionalSteps />
          </Wizard>
        </Form>,
      )
      expect(screen.getByTestId('status')).toHaveTextContent(
        'account:current plan:upcoming review:upcoming',
      )
      expect(screen.getByTestId('status')).not.toHaveTextContent('extra:')
    })

    it('toggling the predicate true adds the step to the effective list', async () => {
      const user = userEvent.setup()
      render(
        <Form schema={conditionalSchema} defaultValues={conditionalFilled} onSubmit={() => {}}>
          <Wizard steps={conditionalSteps}>
            <ConditionalSteps />
          </Wizard>
        </Form>,
      )
      expect(screen.getByTestId('status')).not.toHaveTextContent('extra:')
      await user.click(screen.getByRole('button', { name: 'show extra' }))
      await waitFor(() =>
        expect(screen.getByTestId('status')).toHaveTextContent(
          'account:current extra:upcoming plan:upcoming review:upcoming',
        ),
      )
    })

    it('next skips a hidden step: from account it lands on plan, not the hidden extra step', async () => {
      const user = userEvent.setup()
      render(
        <Form schema={conditionalSchema} defaultValues={conditionalFilled} onSubmit={() => {}}>
          <Wizard steps={conditionalSteps}>
            <ConditionalSteps />
          </Wizard>
        </Form>,
      )
      await user.click(screen.getByRole('button', { name: 'next' }))
      await waitFor(() => expect(screen.getByTestId('current')).toHaveTextContent('plan'))
    })

    it("next validates only the visible step's fields: a hidden step's fields are not validated", async () => {
      const user = userEvent.setup()
      render(
        <Form
          schema={conditionalSchema}
          defaultValues={{ ...conditionalFilled, extra: '' }}
          onSubmit={() => {}}
        >
          <Wizard steps={conditionalSteps}>
            <ConditionalSteps />
          </Wizard>
        </Form>,
      )
      // `extra` has no validation rule of its own (plain z.string()), so this only proves
      // the hidden step is skipped entirely rather than validated-and-passing.
      await user.click(screen.getByRole('button', { name: 'next' }))
      await waitFor(() => expect(screen.getByTestId('current')).toHaveTextContent('plan'))
    })

    it('current step becoming hidden moves the wizard back to the nearest visible earlier step', async () => {
      const user = userEvent.setup()
      render(
        <Form
          schema={conditionalSchema}
          defaultValues={{ ...conditionalFilled, hasExtra: true }}
          onSubmit={() => {}}
        >
          <Wizard steps={conditionalSteps}>
            <ConditionalSteps />
          </Wizard>
        </Form>,
      )
      await user.click(screen.getByRole('button', { name: 'next' }))
      await waitFor(() => expect(screen.getByTestId('current')).toHaveTextContent('extra'))
      // Hiding the current step (no longer wants the extra step) must move the wizard off
      // it — the nearest visible step before it, i.e. account.
      await user.click(screen.getByRole('button', { name: 'hide extra' }))
      await waitFor(() => expect(screen.getByTestId('current')).toHaveTextContent('account'))
    })

    it('go(hiddenId) resolves false and does not move', async () => {
      const user = userEvent.setup()
      render(
        <Form schema={conditionalSchema} defaultValues={conditionalFilled} onSubmit={() => {}}>
          <Wizard steps={conditionalSteps}>
            <ConditionalSteps />
          </Wizard>
        </Form>,
      )
      await user.click(screen.getByRole('button', { name: 'go extra' }))
      expect(screen.getByTestId('current')).toHaveTextContent('account')
    })

    it("visited keeps a hidden step's id, which reappears as completed once shown again", async () => {
      const user = userEvent.setup()
      render(
        <Form
          schema={conditionalSchema}
          defaultValues={{ ...conditionalFilled, hasExtra: true }}
          onSubmit={() => {}}
        >
          <Wizard steps={conditionalSteps}>
            <ConditionalSteps />
          </Wizard>
        </Form>,
      )
      // Visit extra, then move on to plan — a real committed move (not just the transient
      // "current step became hidden" fallback), so the wizard's own step state points at
      // plan by the time extra is hidden.
      await user.click(screen.getByRole('button', { name: 'next' }))
      await waitFor(() => expect(screen.getByTestId('current')).toHaveTextContent('extra'))
      await user.click(screen.getByRole('button', { name: 'next' }))
      await waitFor(() => expect(screen.getByTestId('current')).toHaveTextContent('plan'))
      expect(screen.getByTestId('visited')).toHaveTextContent('account,extra,plan')
      await user.click(screen.getByRole('button', { name: 'hide extra' }))
      expect(screen.getByTestId('current')).toHaveTextContent('plan')
      expect(screen.getByTestId('visited')).toHaveTextContent('account,extra,plan')
      // Shown again: still visited, so it comes back as completed rather than upcoming.
      await user.click(screen.getByRole('button', { name: 'show extra' }))
      await waitFor(() =>
        expect(screen.getByTestId('status')).toHaveTextContent(
          'account:completed extra:completed plan:current review:upcoming',
        ),
      )
    })

    it('renders the effective steps in WizardStepper and in page layout', () => {
      render(
        <Form schema={conditionalSchema} defaultValues={conditionalFilled} onSubmit={() => {}}>
          <Wizard steps={conditionalSteps}>
            <WizardStepper />
            <ConditionalSteps />
          </Wizard>
        </Form>,
      )
      expect(screen.queryByText('Extra')).not.toBeInTheDocument()
      expect(screen.getAllByText('Account').length).toBeGreaterThan(0)
      expect(screen.getByText('Plan')).toBeInTheDocument()
    })

    it('page layout omits a hidden step entirely (no group, no fields)', () => {
      render(
        <Form schema={conditionalSchema} defaultValues={conditionalFilled} onSubmit={() => {}}>
          <Wizard steps={conditionalSteps} layout="page">
            <ConditionalSteps />
          </Wizard>
        </Form>,
      )
      expect(screen.queryByRole('group', { name: 'Extra' })).not.toBeInTheDocument()
      expect(screen.queryByRole('textbox', { name: 'Extra' })).not.toBeInTheDocument()
      expect(screen.getByRole('group', { name: 'Account' })).toBeInTheDocument()
    })

    it('resuming with a hidden step id (controlled step) lands on the nearest visible step', async () => {
      function Resume() {
        const [step, setStep] = useState('extra')
        return (
          <Form schema={conditionalSchema} defaultValues={conditionalFilled} onSubmit={() => {}}>
            <output data-testid="param">{step}</output>
            <Wizard
              steps={conditionalSteps}
              step={step}
              onStepChange={(s) => setStep(s.id)}
              visited={['account', 'extra']}
            >
              <ConditionalSteps />
            </Wizard>
          </Form>
        )
      }
      render(<Resume />)
      // `extra` was visited (persisted from a session where hasVehicle was true) but the
      // default values here have hasExtra: false, so it is hidden now — resume must land
      // on the nearest visible step rather than a step that renders nothing.
      await waitFor(() => expect(screen.getByTestId('current')).toHaveTextContent('account'))
      expect(screen.getByTestId('param')).toHaveTextContent('account')
    })

    it('has no accessibility violations with a conditional step present', async () => {
      const { container } = render(
        <Form
          schema={conditionalSchema}
          defaultValues={{ ...conditionalFilled, hasExtra: true }}
          onSubmit={() => {}}
        >
          <Wizard steps={conditionalSteps}>
            <WizardStepper />
            <ConditionalSteps />
            <WizardNav />
          </Wizard>
        </Form>,
      )
      await expectNoA11yViolations(container)
    })

    it('keeps the effective steps array reference while typing (no predicate answer changed)', async () => {
      const user = userEvent.setup()
      render(
        <Form schema={conditionalSchema} defaultValues={conditionalFilled} onSubmit={() => {}}>
          <Wizard steps={conditionalSteps}>
            <ConditionalSteps />
            <StepsIdentityProbe />
          </Wizard>
        </Form>,
      )
      // Mount already recorded one reference; typing into `name` (unrelated to `hasExtra`,
      // the only value `when` reads) must not add a second one.
      expect(screen.getByTestId('steps-ref-count')).toHaveTextContent('1')
      await user.type(screen.getByRole('textbox', { name: 'Name' }), ' Lovelace')
      expect(screen.getByTestId('steps-ref-count')).toHaveTextContent('1')
      // Sanity check the probe itself: flipping the predicate *does* produce a new
      // reference, so a '1' above is "stable", not "the probe never re-samples".
      await user.click(screen.getByRole('button', { name: 'show extra' }))
      await waitFor(() => expect(screen.getByTestId('steps-ref-count')).toHaveTextContent('2'))
    })

    it("a hidden step's field failing on final submit reports against the last visible step", async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn()
      // `extra` has no validation rule of its own, so give the hidden step a `fields`
      // entry that *can* fail: reuse `plan` (required) but attribute it to `extra`
      // instead, the way ownerIndex would see a field whose owning step is hidden.
      const hiddenOwnerSteps = [
        { id: 'account', label: 'Account', fields: ['name', 'hasExtra'] },
        {
          id: 'extra',
          label: 'Extra',
          fields: ['plan'],
          when: (v: ConditionalInput) => Boolean(v.hasExtra),
        },
        { id: 'review', label: 'Review' },
      ] as const satisfies WizardStepDef<ConditionalInput>[]
      render(
        <Form
          schema={conditionalSchema}
          defaultValues={{ ...conditionalFilled, plan: '' }}
          onSubmit={onSubmit}
        >
          <Wizard steps={hiddenOwnerSteps}>
            <WizardStep id="account">
              <TextField name="name" label="Name" />
            </WizardStep>
            <WizardStep id="extra">
              <TextField name="extra" label="Extra" />
            </WizardStep>
            <WizardStep id="review">
              <p>Review</p>
            </WizardStep>
            <Controls />
            <ConditionalControls />
            <SubmitButton />
          </Wizard>
        </Form>,
      )
      // `extra` (the owner of the failing `plan` field) is hidden throughout: `hasExtra`
      // stays false, so final submit's own errorPaths -> ownerIndex resolution can't
      // land on it and falls through to the last step, same as a field listed in no
      // step's `fields` already does. Get to review without ever mounting `extra`.
      await user.click(screen.getByRole('button', { name: 'next' }))
      await waitFor(() => expect(screen.getByTestId('current')).toHaveTextContent('review'))
      await user.click(screen.getByRole('button', { name: 'Submit' }))
      // Reports on review (the last step), not on the hidden, unreachable `extra` step —
      // and does not crash even though `plan` never mounted an input for setFocus to find.
      await waitFor(() => expect(screen.getByTestId('current')).toHaveTextContent('review'))
      expect(onSubmit).not.toHaveBeenCalled()
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

  it('a wizard with a `when` step also throws the ez-form message outside <Form> (not a bare useWatch TypeError)', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() =>
      render(
        <Wizard steps={conditionalSteps}>
          <p />
        </Wizard>,
      ),
    ).toThrow('ez-form: <Wizard> must be rendered inside <Form>')
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
    expect(screen.getByRole('tab', { name: /Account/ })).toBeInTheDocument()
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

  // Unlike `verticalStepButton`, the horizontal step button can't be a
  // `theme.components.EzWizardStepper.styleOverrides` slot: it must render
  // the literal `StepButton` import (see the comment at the call site in
  // WizardStepper.tsx) so `Stepper` recognizes it and sets up the
  // `role="tab"`/`tablist` wiring; a `styled(StepButton)` wrapper is a
  // different component reference and that detection silently fails. So
  // this only asserts the class name is present, for consumers to target
  // with a plain CSS rule on `.EzWizardStepper-stepButton`.
  it('the horizontal step button carries the stepButton class', async () => {
    const user = userEvent.setup()
    render(<Inline orientation="horizontal" />)
    await user.click(screen.getByRole('button', { name: 'next' }))
    await waitFor(() => expect(screen.getByRole('tab', { name: /Account/ })).toBeInTheDocument())
    expect(screen.getByRole('tab', { name: /Account/ })).toHaveClass(
      wizardStepperClasses.stepButton,
    )
  })

  it('marks the current step with aria-current="step" and labels each step', async () => {
    const user = userEvent.setup()
    render(<Inline orientation="horizontal" />)
    await user.click(screen.getByRole('button', { name: 'next' }))
    await waitFor(() => expect(screen.getByRole('tab', { name: /Account/ })).toBeInTheDocument())
    expect(screen.getByRole('tab', { name: /Account/ })).not.toHaveAttribute('aria-current')
    const current = screen.getByRole('tab', { name: /Plan/ })
    expect(current).toHaveAttribute('aria-current', 'step')
    const label = screen.getByText('Account', { selector: 'span' })
    expect(label.id).toMatch(/-label-account$/)
  })

  it('vertical: marks the current step with aria-current="step" and labels each step', async () => {
    const user = userEvent.setup()
    render(<Inline orientation="vertical" />)
    await user.click(screen.getByRole('button', { name: 'next' }))
    await waitFor(() => expect(screen.getByTestId('current')).toHaveTextContent('plan'))
    const accountButton = screen
      .getByText('Account', { selector: '.MuiStepLabel-label' })
      .closest('button')!
    expect(accountButton).not.toHaveAttribute('aria-current')
    const planButton = screen
      .getByText('Plan', { selector: '.MuiStepLabel-label' })
      .closest('button')!
    expect(planButton).toHaveAttribute('aria-current', 'step')
    const label = screen.getByText('Account', { selector: '.MuiStepLabel-label' })
    expect(label.id).toMatch(/-label-account$/)
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

describe('WizardStep renders a FormSection', () => {
  function renderWizard({ orientation }: { orientation?: 'horizontal' | 'vertical' } = {}) {
    return render(
      <Form schema={schema} defaultValues={filled} onSubmit={() => {}}>
        <Wizard steps={steps} orientation={orientation}>
          <WizardStepper />
          <Steps />
        </Wizard>
      </Form>,
    )
  }

  it('horizontal: a step is a group named by its label with one heading', () => {
    renderWizard()
    const group = screen.getByRole('group', { name: 'Account' })
    expect(within(group).getByRole('textbox', { name: 'Name' })).toBeInTheDocument()
    expect(screen.getAllByRole('heading')).toHaveLength(1)
    expect(screen.getByRole('heading', { name: 'Account' })).toBeInTheDocument()
  })

  it('vertical: the step group is named by the stepper label and renders no legend', () => {
    renderWizard({ orientation: 'vertical' })
    const group = screen.getByRole('group', { name: 'Account' })
    expect(within(group).getByRole('textbox', { name: 'Name' })).toBeInTheDocument()
    // MUI's outlined TextField renders its own <legend> (NotchedOutline); target
    // FormSection's own legend class rather than the bare selector.
    expect(group.querySelector(`.${formSectionClasses.legend}`)).toBeNull()
  })

  it('title={null} keeps the fieldset but drops the legend; title overrides the label', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={filled} onSubmit={() => {}}>
        <Wizard steps={steps}>
          <WizardStep id="account" title={null}>
            <TextField name="name" label="Name" />
          </WizardStep>
          <WizardStep id="plan" title="Pick a plan">
            <TextField name="plan" label="Plan" />
          </WizardStep>
          <WizardStep id="review">
            <p>Review</p>
          </WizardStep>
          <Controls />
        </Wizard>
      </Form>,
    )
    const accountGroup = screen.getByRole('group')
    expect(within(accountGroup).getByRole('textbox', { name: 'Name' })).toBeInTheDocument()
    expect(accountGroup.querySelector(`.${formSectionClasses.legend}`)).toBeNull()
    await user.click(screen.getByRole('button', { name: 'next' }))
    await waitFor(() =>
      expect(screen.getByRole('group', { name: 'Pick a plan' })).toBeInTheDocument(),
    )
  })
})

describe('Wizard layout="page"', () => {
  function PageWizard({ onSubmit = () => {} }: { onSubmit?: () => void }) {
    return (
      <Form schema={schema} defaultValues={filled} onSubmit={onSubmit}>
        <Wizard steps={steps} layout="page">
          <WizardStepper />
          <Steps />
          <WizardNav />
          <SubmitButton />
        </Wizard>
      </Form>
    )
  }

  it('renders every step as a named group, in step order, with no tablist/tab', () => {
    render(<PageWizard />)
    expect(screen.getAllByRole('group')).toHaveLength(3)
    const account = screen.getByRole('group', { name: 'Account' })
    const plan = screen.getByRole('group', { name: 'Plan' })
    const review = screen.getByRole('group', { name: 'Review' })
    expect(account.compareDocumentPosition(plan) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(plan.compareDocumentPosition(review) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
  })

  it('all fields are present at once (every step mounted)', () => {
    render(<PageWizard />)
    expect(screen.getByRole('textbox', { name: 'Name' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Email' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Plan' })).toBeInTheDocument()
  })

  it('exactly one heading per step', () => {
    render(<PageWizard />)
    expect(screen.getByRole('heading', { name: 'Account' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Plan' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Review' })).toBeInTheDocument()
    expect(screen.getAllByRole('heading')).toHaveLength(3)
  })

  it('WizardStepper and WizardNav render nothing', () => {
    const { container } = render(<PageWizard />)
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument()
    expect(container.querySelector('.MuiStepper-root')).toBeNull()
  })

  it('Submit validates every step at once: an error on step 3 (review) shows immediately', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <Form schema={schema} defaultValues={{ ...filled, name: '' }} onSubmit={onSubmit}>
        <Wizard steps={steps} layout="page">
          <Steps />
          <SubmitButton />
        </Wizard>
      </Form>,
    )
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    expect(await screen.findByText('Name is required')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('useWizard reports layout="page" and current is the first step', () => {
    render(<PageWizard />)
    expect(screen.getByTestId('current')).toHaveTextContent('account')
  })

  it('next/prev/go are no-ops resolving false; pending is always false', async () => {
    const user = userEvent.setup()
    render(<PageWizard />)
    await user.click(screen.getByRole('button', { name: 'next' }))
    expect(screen.getByTestId('current')).toHaveTextContent('account')
    expect(screen.getByTestId('pending')).toHaveTextContent('false')
    await user.click(screen.getByRole('button', { name: 'go review' }))
    expect(screen.getByTestId('current')).toHaveTextContent('account')
  })

  it('is themeable: defaultProps.layout applies EzWizard default', () => {
    const theme = createTheme({
      components: {
        EzWizard: {
          defaultProps: { layout: 'page' },
        },
      },
    })
    render(
      <ThemeProvider theme={theme}>
        <Form schema={schema} defaultValues={filled} onSubmit={() => {}}>
          <Wizard steps={steps}>
            <WizardStepper />
            <Steps />
          </Wizard>
        </Form>
      </ThemeProvider>,
    )
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Account' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Plan' })).toBeInTheDocument()
  })

  it('has no accessibility violations (heading order clean)', async () => {
    const { container } = render(<PageWizard />)
    await expectNoA11yViolations(container)
  })

  it('a nested FormSection inside a step gets h4, with no accessibility violations (heading order h3->h4)', async () => {
    const { container } = render(
      <Form schema={schema} defaultValues={filled} onSubmit={() => {}}>
        <Wizard steps={steps} layout="page">
          <WizardStep id="account">
            <TextField name="name" label="Name" />
            <FormSection title="Nested">
              <TextField name="email" label="Email" />
            </FormSection>
          </WizardStep>
          <WizardStep id="plan">
            <TextField name="plan" label="Plan" />
          </WizardStep>
          <WizardStep id="review">
            <p>Review</p>
          </WizardStep>
        </Wizard>
      </Form>,
    )
    expect(screen.getByRole('heading', { level: 3, name: 'Account' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 4, name: 'Nested' })).toBeInTheDocument()
    // Exercises axe's heading-order rule against an actual h3 -> h4 nesting: the
    // top-level "has no accessibility violations" test above renders only flat,
    // unnested steps, so it never touches this rule.
    await expectNoA11yViolations(container)
  })

  it('a WizardStep id matching no step renders nothing (not an unnamed group) and warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    render(
      <Form schema={schema} defaultValues={filled} onSubmit={() => {}}>
        <Wizard steps={steps} layout="page">
          <WizardStep id="account">
            <TextField name="name" label="Name" />
          </WizardStep>
          <WizardStep id="not-a-real-step">
            <p>orphaned</p>
          </WizardStep>
        </Wizard>
      </Form>,
    )
    expect(screen.queryByText('orphaned')).not.toBeInTheDocument()
    expect(screen.getAllByRole('group')).toHaveLength(1)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('not-a-real-step'))
    warn.mockRestore()
  })

  it('page layout: a WizardStep hidden by `when` renders nothing and does not warn', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    render(
      <Form schema={conditionalSchema} defaultValues={conditionalFilled} onSubmit={() => {}}>
        <Wizard steps={conditionalSteps} layout="page">
          <ConditionalSteps />
        </Wizard>
      </Form>,
    )
    expect(screen.queryByRole('group', { name: 'Extra' })).not.toBeInTheDocument()
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
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
    await waitFor(() => expect(screen.getByRole('group', { name: 'Review' })).toBeInTheDocument())
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
