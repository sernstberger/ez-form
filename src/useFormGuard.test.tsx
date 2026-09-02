import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { z } from 'zod'
import { Form } from './Form'
import { TextField } from './fields/TextField'
import { SubmitButton } from './SubmitButton'
import { useFormGuard, type FormGuardBlocker } from './useFormGuard'

const schema = z.object({ email: z.string() })

/** A blocker that blocks whenever asked to, so `blocked` mirrors `shouldBlock`. */
function makeFakeBlocker() {
  const proceed = vi.fn()
  const reset = vi.fn()
  const calls: boolean[] = []
  const useBlocker = (shouldBlock: boolean): FormGuardBlocker => {
    calls.push(shouldBlock)
    return shouldBlock ? { state: 'blocked', proceed, reset } : { state: 'unblocked' }
  }
  return { useBlocker, proceed, reset, calls }
}

function Probe({ useBlocker }: { useBlocker: (b: boolean) => FormGuardBlocker }) {
  const guard = useFormGuard(useBlocker)
  return (
    <>
      <output data-testid="state">{guard.blocked ? 'blocked' : 'free'}</output>
      <button type="button" onClick={guard.proceed}>
        proceed
      </button>
      <button type="button" onClick={guard.cancel}>
        cancel
      </button>
    </>
  )
}

describe('useFormGuard', () => {
  it('asks the blocker to block only while dirty and not submitting', async () => {
    const user = userEvent.setup()
    const fake = makeFakeBlocker()
    render(
      <Form schema={schema} defaultValues={{ email: '' }} onSubmit={() => {}}>
        <TextField name="email" label="Email" />
        <Probe useBlocker={fake.useBlocker} />
      </Form>,
    )
    expect(screen.getByTestId('state')).toHaveTextContent('free')
    expect(fake.calls.at(-1)).toBe(false)
    await user.type(screen.getByRole('textbox', { name: 'Email' }), 'a')
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('blocked'))
    expect(fake.calls.at(-1)).toBe(true)
  })

  it('stops blocking after a successful submit', async () => {
    const user = userEvent.setup()
    const fake = makeFakeBlocker()
    render(
      <Form schema={schema} defaultValues={{ email: '' }} onSubmit={() => {}}>
        <TextField name="email" label="Email" />
        <Probe useBlocker={fake.useBlocker} />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.type(screen.getByRole('textbox', { name: 'Email' }), 'a')
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('blocked'))
    await user.click(screen.getByRole('button', { name: 'Go' }))
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('free'))
  })

  it('stops blocking after a confirmed submit through <Form confirm>', async () => {
    // Verified directly: react-hook-form does NOT reset `isDirty` on a successful submit
    // by itself (fields still hold the typed values, and this onSubmit never calls
    // `reset`) — `isDirty` stays `true` afterwards. It's `isSubmitSuccessful` flipping to
    // `true` inside handleSubmit that drops `shouldBlock` (isDirty && !isSubmitting &&
    // !isSubmitSuccessful), which is what releases the guard here.
    const user = userEvent.setup()
    const fake = makeFakeBlocker()
    render(
      <Form schema={schema} defaultValues={{ email: '' }} onSubmit={() => {}} guard confirm>
        <TextField name="email" label="Email" />
        <Probe useBlocker={fake.useBlocker} />
        <SubmitButton />
      </Form>,
    )
    await user.type(screen.getByRole('textbox', { name: 'Email' }), 'a')
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('blocked'))
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    expect(await screen.findByRole('alertdialog', { name: 'Submit?' })).toBeInTheDocument()
    // Still dirty while the dialog is up: the guard doesn't drop just because a submit
    // is in flight toward confirmation, only once the submit actually completes.
    expect(screen.getByTestId('state')).toHaveTextContent('blocked')
    await user.click(screen.getByRole('button', { name: 'Confirm' }))
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('free'))
  })

  it('forwards proceed and cancel to the blocker', async () => {
    const user = userEvent.setup()
    const fake = makeFakeBlocker()
    render(
      <Form schema={schema} defaultValues={{ email: '' }} onSubmit={() => {}}>
        <TextField name="email" label="Email" />
        <Probe useBlocker={fake.useBlocker} />
      </Form>,
    )
    await user.type(screen.getByRole('textbox', { name: 'Email' }), 'a')
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('blocked'))
    await user.click(screen.getByRole('button', { name: 'proceed' }))
    expect(fake.proceed).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'cancel' }))
    expect(fake.reset).toHaveBeenCalledTimes(1)
  })

  it('throws outside <Form>', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const fake = makeFakeBlocker()
    expect(() => render(<Probe useBlocker={fake.useBlocker} />)).toThrow(
      'ez-form: <useFormGuard> must be rendered inside <Form>',
    )
  })
})
