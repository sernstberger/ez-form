import { createRef } from 'react'
import { render, renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createTheme, ThemeProvider } from '@mui/material/styles'
import { z } from 'zod'
import { Form, formClasses, type FormMethods } from './Form'
import { SubmitButton } from '../SubmitButton'
import { TextField } from '../fields/TextField'
import { Select } from '../fields/Select'
import { Checkbox } from '../fields/Checkbox'
import { Switch } from '../fields/Switch'
import { RadioGroup } from '../fields/RadioGroup'
import { Autocomplete } from '../fields/Autocomplete'
import { NumberField } from '../fields/NumberField'
import { useEzFormContext } from '../useEzFormContext'
import { expectNoA11yViolations } from '../test/axe'

const schema = z.object({ email: z.email() })

describe('Form', () => {
  it('calls onSubmit with parsed values when defaultValues are valid', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <Form schema={schema} defaultValues={{ email: 'a@b.co' }} onSubmit={onSubmit}>
        <button type="submit">Go</button>
      </Form>,
    )
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith({ email: 'a@b.co' }, expect.anything())
  })

  it('hands the form methods to onSubmit so the caller can map a server error', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn(
      (_values: { email: string }, form: FormMethods<{ email: string }, { email: string }>) =>
        form.setError('email', { message: 'Already registered' }),
    )
    render(
      <Form schema={schema} defaultValues={{ email: 'a@b.co' }} onSubmit={onSubmit}>
        <TextField name="email" label="Email" />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByText('Already registered')).toBeInTheDocument()
  })

  it('does not call onSubmit when values fail the schema', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <Form schema={schema} defaultValues={{ email: 'nope' }} onSubmit={onSubmit}>
        <button type="submit">Go</button>
      </Form>,
    )
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('renders a noValidate form and forwards extra props', () => {
    render(
      <Form schema={schema} onSubmit={() => {}} aria-label="signup" className="x">
        <span>child</span>
      </Form>,
    )
    const form = screen.getByRole('form', { name: 'signup' })
    expect(form).toHaveAttribute('novalidate')
    expect(form).toHaveClass('x')
    expect(screen.getByText('child')).toBeInTheDocument()
  })

  it('disables every field when the form is disabled', () => {
    render(
      <Form schema={schema} defaultValues={{ email: '' }} onSubmit={() => {}} disabled>
        <TextField name="email" label="Email" />
      </Form>,
    )
    expect(screen.getByLabelText('Email')).toBeDisabled()
  })

  it('disables the fields while onSubmit is pending, then re-enables them', async () => {
    const user = userEvent.setup()
    let resolve!: () => void
    const onSubmit = vi.fn(() => new Promise<void>((r) => (resolve = r)))
    render(
      <Form schema={schema} defaultValues={{ email: 'a@b.co' }} onSubmit={onSubmit}>
        <TextField name="email" label="Email" />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.click(screen.getByRole('button', { name: 'Go' }))
    await waitFor(() => expect(screen.getByLabelText('Email')).toBeDisabled())
    resolve()
    await waitFor(() => expect(screen.getByLabelText('Email')).toBeEnabled())
  })

  it('disables the fields and submit while async defaultValues load, then fills them', async () => {
    let resolve!: (values: { email: string }) => void
    const load = vi.fn(() => new Promise<{ email: string }>((r) => (resolve = r)))
    render(
      <Form schema={schema} defaultValues={load} onSubmit={() => {}}>
        <TextField name="email" label="Email" />
        <SubmitButton />
      </Form>,
    )
    expect(screen.getByLabelText('Email')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled()
    resolve({ email: 'a@b.co' })
    await waitFor(() => expect(screen.getByLabelText('Email')).toHaveValue('a@b.co'))
    await waitFor(() => expect(screen.getByLabelText('Email')).toBeEnabled())
    expect(screen.getByRole('button', { name: 'Submit' })).toBeEnabled()
  })

  it('re-enables the form and reports the error when async defaultValues rejects', async () => {
    let reject!: (error: unknown) => void
    const load = vi.fn(() => new Promise<{ email: string }>((_r, j) => (reject = j)))
    const onDefaultValuesError = vi.fn()
    render(
      <Form
        schema={schema}
        defaultValues={load}
        onSubmit={() => {}}
        onDefaultValuesError={onDefaultValuesError}
      >
        <TextField name="email" label="Email" />
        <SubmitButton />
      </Form>,
    )
    expect(screen.getByLabelText('Email')).toBeDisabled()
    const boom = new Error('boom')
    reject(boom)
    await waitFor(() => expect(screen.getByLabelText('Email')).toBeEnabled())
    expect(screen.getByRole('button', { name: 'Submit' })).toBeEnabled()
    expect(screen.getByLabelText('Email')).toHaveValue('')
    expect(onDefaultValuesError).toHaveBeenCalledExactlyOnceWith(boom)
  })

  it("a setError call made synchronously inside onDefaultValuesError survives hookform's post-rejection reset", async () => {
    // #70: hookform's internal _resetDefaultValues() awaits our wrapped
    // defaultValues() and, once it resolves, calls its own reset({}) — which
    // clears formState.errors unless keepErrors is set. A consumer's setError
    // called synchronously inside onDefaultValuesError must still be visible
    // once that settles, with no setTimeout/deferral on the consumer's part.
    let reject!: (error: unknown) => void
    const load = vi.fn(() => new Promise<{ email: string }>((_r, j) => (reject = j)))
    const ref = createRef<FormMethods<{ email: string }, { email: string }>>()
    render(
      <Form
        ref={ref}
        schema={schema}
        defaultValues={load}
        onSubmit={() => {}}
        onDefaultValuesError={(error) => {
          ref.current?.setError('root.server', { message: (error as Error).message })
        }}
      >
        <TextField name="email" label="Email" />
        <SubmitButton />
      </Form>,
    )
    expect(screen.getByLabelText('Email')).toBeDisabled()
    reject(new Error('Could not load profile'))
    await waitFor(() => expect(screen.getByLabelText('Email')).toBeEnabled())
    await waitFor(() =>
      expect(ref.current?.formState.errors.root?.server?.message).toBe('Could not load profile'),
    )
  })

  it('re-enables the form and rethrows when async defaultValues rejects without a handler', async () => {
    // hookform's internal `_resetDefaultValues` never attaches a `.catch` to the
    // promise our wrapped defaultValues returns, so a rejection with no
    // `onDefaultValuesError` genuinely becomes an unhandled rejection (the current
    // JS norm for an unobserved rejected promise). Observe it the same way a test
    // runner does, and stop it from failing this run once captured.
    const unhandled: unknown[] = []
    const onUnhandledRejection = (error: unknown) => unhandled.push(error)
    process.on('unhandledRejection', onUnhandledRejection)
    try {
      let reject!: (error: unknown) => void
      const load = () => new Promise<{ email: string }>((_r, j) => (reject = j))
      render(
        <Form schema={schema} defaultValues={load} onSubmit={() => {}}>
          <TextField name="email" label="Email" />
          <SubmitButton />
        </Form>,
      )
      expect(screen.getByLabelText('Email')).toBeDisabled()
      const boom = new Error('boom')
      reject(boom)
      await waitFor(() => expect(screen.getByLabelText('Email')).toBeEnabled())
      expect(screen.getByRole('button', { name: 'Submit' })).toBeEnabled()
      await waitFor(() => expect(unhandled).toEqual([boom]))
    } finally {
      process.off('unhandledRejection', onUnhandledRejection)
    }
  })

  it('re-syncs the fields when values changes', async () => {
    const view = render(
      <Form schema={schema} values={{ email: 'a@b.co' }} onSubmit={() => {}}>
        <TextField name="email" label="Email" />
      </Form>,
    )
    expect(screen.getByLabelText('Email')).toHaveValue('a@b.co')
    view.rerender(
      <Form schema={schema} values={{ email: 'c@d.co' }} onSubmit={() => {}}>
        <TextField name="email" label="Email" />
      </Form>,
    )
    await waitFor(() => expect(screen.getByLabelText('Email')).toHaveValue('c@d.co'))
  })

  it('exposes the form methods through ref', async () => {
    const user = userEvent.setup()
    const ref = createRef<FormMethods<{ email: string }, { email: string }>>()
    render(
      <>
        <Form ref={ref} schema={schema} defaultValues={{ email: '' }} onSubmit={() => {}}>
          <TextField name="email" label="Email" />
        </Form>
        <button type="button" onClick={() => ref.current?.reset({ email: 'r@s.co' })}>
          Load
        </button>
      </>,
    )
    await user.type(screen.getByLabelText('Email'), 'typed')
    await user.click(screen.getByRole('button', { name: 'Load' }))
    expect(screen.getByLabelText('Email')).toHaveValue('r@s.co')
  })

  it('calls a ref callback with the form methods', () => {
    const received: FormMethods<{ email: string }, { email: string }>[] = []
    render(
      <Form
        ref={(methods) => {
          if (methods) received.push(methods)
        }}
        schema={schema}
        defaultValues={{ email: '' }}
        onSubmit={() => {}}
      >
        <TextField name="email" label="Email" />
      </Form>,
    )
    expect(received).toHaveLength(1)
    expect(typeof received[0]?.reset).toBe('function')
  })

  // #71: the suite runs React 19, where a plain function component receives `ref` as an
  // ordinary prop, so the two tests above would pass with or without the fix. React 18 does
  // not pass `ref` through props at all — only a `forwardRef` component gets it there — and
  // the peer range advertises `^18 || ^19`. Asserting the exotic type is what actually
  // pins the React 18 support down without installing a second React.
  it('is a forwardRef component, so ref works on React 18 as well as 19', () => {
    expect((Form as unknown as { $$typeof: symbol }).$$typeof).toBe(Symbol.for('react.forward_ref'))
  })
})

describe('Form with every component', () => {
  const signup = z.object({
    name: z.string(),
    email: z.email(),
    role: z.enum(['admin', 'user'], { error: 'Pick a role' }),
    plan: z.number({ error: 'Pick a plan' }),
    team: z.string(),
    seats: z.number(),
    tos: z.boolean(),
    newsletter: z.boolean(),
  })
  const roles = [
    { value: 'admin', label: 'Admin' },
    { value: 'user', label: 'User' },
  ] as const
  const plans = [
    { value: 1, label: 'Basic' },
    { value: 2, label: 'Pro' },
  ] as const
  const teams = [
    { value: 'core', label: 'Core' },
    { value: 'infra', label: 'Infra' },
  ] as const

  function renderSignup() {
    return render(
      <Form
        schema={signup}
        defaultValues={{ name: '', email: '', team: '', tos: false, newsletter: false }}
        onSubmit={() => {}}
        aria-label="Sign up"
      >
        <TextField name="name" label="Name" required />
        <TextField name="email" label="Email" helperText="We never share it" required />
        <Select name="role" label="Role" options={roles} required />
        <RadioGroup name="plan" label="Plan" options={plans} required />
        <Autocomplete name="team" label="Team" options={teams} required />
        <NumberField name="seats" label="Seats" min={1} required />
        <Checkbox name="tos" label="I accept the terms" required />
        <Switch name="newsletter" label="Send me the newsletter" />
        <SubmitButton>Create account</SubmitButton>
      </Form>,
    )
  }

  it('locks every field and the submit button under <Form disabled>, even with disabled={false}', () => {
    render(
      <Form
        schema={signup}
        defaultValues={{ name: '', email: '', team: '', tos: false, newsletter: false }}
        onSubmit={() => {}}
        disabled
      >
        <TextField name="name" label="Name" disabled={false} />
        <Select name="role" label="Role" options={roles} disabled={false} />
        <RadioGroup name="plan" label="Plan" options={plans} disabled={false} />
        <Autocomplete name="team" label="Team" options={teams} disabled={false} />
        <NumberField name="seats" label="Seats" disabled={false} />
        <Checkbox name="tos" label="I accept the terms" disabled={false} />
        <Switch name="newsletter" label="Send me the newsletter" disabled={false} />
        <SubmitButton disabled={false}>Create account</SubmitButton>
      </Form>,
    )
    expect(screen.getByRole('textbox', { name: 'Name' })).toBeDisabled()
    expect(screen.getByRole('combobox', { name: 'Role' })).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByRole('radio', { name: 'Basic' })).toBeDisabled()
    expect(screen.getByRole('combobox', { name: 'Team' })).toBeDisabled()
    expect(screen.getByRole('textbox', { name: 'Seats' })).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: 'I accept the terms' })).toBeDisabled()
    expect(screen.getByRole('switch', { name: 'Send me the newsletter' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Create account' })).toBeDisabled()
  })

  it('has no accessibility violations at rest', async () => {
    const { container } = renderSignup()
    await expectNoA11yViolations(container)
  })

  it('has no accessibility violations after an empty submit', async () => {
    const user = userEvent.setup()
    const { container } = renderSignup()
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByText('Name is required.')).toBeInTheDocument()
    await expectNoA11yViolations(container)
  })
})

describe('useEzFormContext', () => {
  it('throws a clear error outside <Form>', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderHook(() => useEzFormContext('Probe'))).toThrow(
      'ez-form: <Probe> must be rendered inside <Form>',
    )
  })

  it('returns the form methods inside <Form>', () => {
    const { result } = renderHook(() => useEzFormContext('Reader'), {
      wrapper: ({ children }) => (
        <Form schema={schema} onSubmit={() => {}}>
          {children}
        </Form>
      ),
    })
    expect(result.current).toHaveProperty('control')
  })

  describe('confirm', () => {
    it('opens a dialog after validation and only calls onSubmit on Confirm', async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn()
      render(
        <Form schema={schema} defaultValues={{ email: 'a@b.co' }} onSubmit={onSubmit} confirm>
          <SubmitButton />
        </Form>,
      )
      await user.click(screen.getByRole('button', { name: 'Submit' }))
      expect(await screen.findByRole('alertdialog', { name: 'Submit?' })).toBeInTheDocument()
      expect(onSubmit).not.toHaveBeenCalled()
      await user.click(screen.getByRole('button', { name: 'Confirm' }))
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
      expect(onSubmit).toHaveBeenCalledWith({ email: 'a@b.co' }, expect.anything())
    })

    it('never opens the dialog for an invalid form; shows the errors instead', async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn()
      render(
        <Form schema={schema} defaultValues={{ email: 'nope' }} onSubmit={onSubmit} confirm>
          <TextField name="email" label="Email" />
          <SubmitButton />
        </Form>,
      )
      await user.click(screen.getByRole('button', { name: 'Submit' }))
      expect(await screen.findByText('Invalid email address')).toBeInTheDocument()
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
      expect(onSubmit).not.toHaveBeenCalled()
    })

    it('Cancel leaves the form untouched and onSubmit uncalled', async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn()
      render(
        <Form
          schema={schema}
          defaultValues={{ email: 'a@b.co' }}
          onSubmit={onSubmit}
          confirm={{ title: 'Send it?', message: 'Emails the client.' }}
        >
          <SubmitButton />
        </Form>,
      )
      await user.click(screen.getByRole('button', { name: 'Submit' }))
      expect(
        await screen.findByRole('alertdialog', { name: 'Send it?' }),
      ).toHaveAccessibleDescription('Emails the client.')
      await user.click(screen.getByRole('button', { name: 'Cancel' }))
      await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
      expect(onSubmit).not.toHaveBeenCalled()
      expect(screen.getByRole('button', { name: 'Submit' })).toBeEnabled()
    })

    it('a theme-level EzConfirmDialog.defaultProps.actionsOrder reaches the Form confirm dialog', async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn()
      const theme = createTheme({
        components: {
          EzConfirmDialog: { defaultProps: { actionsOrder: 'confirm-cancel' } },
        },
      })
      render(
        <ThemeProvider theme={theme}>
          <Form schema={schema} defaultValues={{ email: 'a@b.co' }} onSubmit={onSubmit} confirm>
            <SubmitButton />
          </Form>
        </ThemeProvider>,
      )
      await user.click(screen.getByRole('button', { name: 'Submit' }))
      expect(await screen.findByRole('alertdialog', { name: 'Submit?' })).toBeInTheDocument()
      const buttons = screen.getAllByRole('button', { name: /Confirm|Cancel/ })
      expect(buttons.map((b) => b.textContent)).toEqual(['Confirm', 'Cancel'])
    })

    it('Enter in a field and form.requestSubmit() both go through the dialog', async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn()
      const { container } = render(
        <Form schema={schema} defaultValues={{ email: 'a@b.co' }} onSubmit={onSubmit} confirm>
          <TextField name="email" label="Email" />
          <SubmitButton />
        </Form>,
      )
      await user.click(screen.getByRole('textbox', { name: 'Email' }))
      await user.keyboard('{Enter}')
      expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Cancel' }))
      await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
      container.querySelector('form')!.requestSubmit()
      expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
      expect(onSubmit).not.toHaveBeenCalled()
    })

    it('a rejecting resolver rethrows like the non-confirm path; nothing is left stranded', async () => {
      // A field-level `validate` rule that throws makes `methods.trigger()` (the confirm
      // path's own pre-validation, run before the dialog) reject. Like handleSubmit's own
      // resolver call, this handler has no try/catch, so the rejection surfaces as an
      // unhandled rejection — the same behavior as the non-confirm path. Nothing here should
      // strand any state: `submitting` and the dialog are only set after this call succeeds.
      const unhandled: unknown[] = []
      const onUnhandledRejection = (error: unknown) => unhandled.push(error)
      process.on('unhandledRejection', onUnhandledRejection)
      try {
        const user = userEvent.setup()
        const onSubmit = vi.fn()
        const boom = new Error('boom')
        render(
          <Form schema={schema} defaultValues={{ email: 'a@b.co' }} onSubmit={onSubmit} confirm>
            <TextField
              name="email"
              label="Email"
              validate={() => {
                throw boom
              }}
            />
            <SubmitButton />
          </Form>,
        )
        await user.click(screen.getByRole('button', { name: 'Submit' }))
        await waitFor(() => expect(unhandled).toEqual([boom]))
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
        expect(onSubmit).not.toHaveBeenCalled()
        expect(screen.getByLabelText('Email')).toBeEnabled()
        expect(screen.getByRole('button', { name: 'Submit' })).toBeEnabled()
      } finally {
        process.off('unhandledRejection', onUnhandledRejection)
      }
    })
  })

  describe('guard', () => {
    const addSpy = () => vi.spyOn(window, 'addEventListener')
    const removeSpy = () => vi.spyOn(window, 'removeEventListener')
    const beforeunloadCalls = (spy: ReturnType<typeof addSpy>) =>
      spy.mock.calls.filter(([type]) => type === 'beforeunload')

    it('does nothing without the prop', async () => {
      const user = userEvent.setup()
      const add = addSpy()
      render(
        <Form schema={schema} defaultValues={{ email: '' }} onSubmit={() => {}}>
          <TextField name="email" label="Email" />
        </Form>,
      )
      await user.type(screen.getByRole('textbox', { name: 'Email' }), 'a')
      expect(beforeunloadCalls(add)).toHaveLength(0)
    })

    it('listens to beforeunload only while dirty, and the handler prevents default', async () => {
      const user = userEvent.setup()
      const add = addSpy()
      const remove = removeSpy()
      const { unmount } = render(
        <Form schema={schema} defaultValues={{ email: '' }} onSubmit={() => {}} guard>
          <TextField name="email" label="Email" />
        </Form>,
      )
      expect(beforeunloadCalls(add)).toHaveLength(0)
      await user.type(screen.getByRole('textbox', { name: 'Email' }), 'a')
      await waitFor(() => expect(beforeunloadCalls(add)).toHaveLength(1))
      const handler = beforeunloadCalls(add)[0]![1] as (e: Event) => void
      const event = new Event('beforeunload', { cancelable: true })
      handler(event)
      expect(event.defaultPrevented).toBe(true)
      await user.clear(screen.getByRole('textbox', { name: 'Email' }))
      await waitFor(() =>
        expect(remove.mock.calls.filter(([t]) => t === 'beforeunload')).toHaveLength(1),
      )
      unmount()
    })

    it('disarms after a successful submit, even though isDirty stays true (#74)', async () => {
      const user = userEvent.setup()
      const add = addSpy()
      const remove = removeSpy()
      render(
        <Form schema={schema} defaultValues={{ email: 'a@b.co' }} onSubmit={() => {}} guard>
          <TextField name="email" label="Email" />
          <SubmitButton />
        </Form>,
      )
      await user.type(screen.getByRole('textbox', { name: 'Email' }), 'm')
      await waitFor(() => expect(beforeunloadCalls(add)).toHaveLength(1))
      await user.click(screen.getByRole('button', { name: 'Submit' }))
      // Net armed state: adds minus removes for 'beforeunload' should settle back to 0 —
      // the guard must not re-arm once isSubmitSuccessful is true, even though isDirty
      // stays true (hookform never clears isDirty except on an explicit reset()).
      await waitFor(() => {
        const netArmed = beforeunloadCalls(add).length - beforeunloadCalls(remove).length
        expect(netArmed).toBe(0)
      })
      // A dispatched beforeunload must not be prevented while disarmed.
      const event = new Event('beforeunload', { cancelable: true })
      window.dispatchEvent(event)
      expect(event.defaultPrevented).toBe(false)
    })

    it('re-arms once the form is reset and dirtied again after a successful submit (#74)', async () => {
      // Verified directly against react-hook-form: a plain edit after a successful submit
      // does NOT clear isSubmitSuccessful (only the next handleSubmit call or an explicit
      // reset() does) — isDirty was already true and stays true, so typing more produces
      // no change either guard can observe; this matches useFormGuard's own long-accepted
      // isSubmitSuccessful semantics (see its "stops blocking after a successful submit"
      // test), which has no re-arm-on-plain-edit case either. The real re-arm path is the
      // common submit-then-reset pattern: onSubmit resolves, the consumer resets the form
      // (often to fresh values, from outside handleSubmit's own microtask chain — a
      // reset() called synchronously inside onSubmit itself is clobbered by hookform's own
      // post-submit state patch, a hookform ordering quirk, not an ez-form one), clearing
      // both isDirty and isSubmitSuccessful, and only then does a later edit genuinely
      // re-dirty and re-arm the guard.
      const user = userEvent.setup()
      const add = addSpy()
      const remove = removeSpy()
      render(
        <Form
          schema={schema}
          defaultValues={{ email: 'a@b.co' }}
          onSubmit={(_values, form) => {
            setTimeout(() => form.reset({ email: 'a@b.co' }), 0)
          }}
          guard
        >
          <TextField name="email" label="Email" />
          <SubmitButton />
        </Form>,
      )
      await user.type(screen.getByRole('textbox', { name: 'Email' }), 'm')
      await waitFor(() => expect(beforeunloadCalls(add)).toHaveLength(1))
      await user.click(screen.getByRole('button', { name: 'Submit' }))
      await waitFor(() => {
        const netArmed = beforeunloadCalls(add).length - beforeunloadCalls(remove).length
        expect(netArmed).toBe(0)
      })
      await user.type(screen.getByRole('textbox', { name: 'Email' }), 'z')
      await waitFor(() => {
        const netArmed = beforeunloadCalls(add).length - beforeunloadCalls(remove).length
        expect(netArmed).toBe(1)
      })
    })
  })
})

describe('title and description', () => {
  it('names the form from title and links description', () => {
    render(
      <Form schema={schema} onSubmit={() => {}} title="Sign up" description="All fields required">
        <TextField name="email" label="Email" />
      </Form>,
    )
    const form = screen.getByRole('form', { name: 'Sign up' })
    expect(form).toHaveAccessibleDescription('All fields required')
    expect(screen.getByRole('heading', { level: 2, name: 'Sign up' })).toBeInTheDocument()
  })

  it('renders no heading and no aria attributes without a title', () => {
    render(
      <Form schema={schema} onSubmit={() => {}} data-testid="f">
        <TextField name="email" label="Email" />
      </Form>,
    )
    expect(screen.queryByRole('heading')).toBeNull()
    expect(screen.getByTestId('f')).not.toHaveAttribute('aria-labelledby')
    expect(screen.getByTestId('f')).not.toHaveAttribute('aria-describedby')
  })

  it("keeps the consumer's aria-labelledby", () => {
    render(
      <>
        <h1 id="mine">Mine</h1>
        <Form schema={schema} onSubmit={() => {}} title="Ignored" aria-labelledby="mine">
          <TextField name="email" label="Email" />
        </Form>
      </>,
    )
    expect(screen.getByRole('form', { name: 'Mine' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Ignored' })).toBeInTheDocument()
  })

  it('heading level comes from slotProps, and from the theme', () => {
    const { unmount } = render(
      <Form
        schema={schema}
        onSubmit={() => {}}
        title="T"
        slotProps={{ title: { component: 'h1' } }}
      >
        <TextField name="email" label="Email" />
      </Form>,
    )
    expect(screen.getByRole('heading', { level: 1, name: 'T' })).toBeInTheDocument()
    unmount()
    const theme = createTheme({
      components: {
        EzForm: {
          defaultProps: { slotProps: { title: { component: 'h3' } } },
          styleOverrides: { title: { letterSpacing: '9px' } },
        },
      },
    })
    render(
      <ThemeProvider theme={theme}>
        <Form schema={schema} onSubmit={() => {}} title="T">
          <TextField name="email" label="Email" />
        </Form>
      </ThemeProvider>,
    )
    const h = screen.getByRole('heading', { level: 3, name: 'T' })
    expect(h).toHaveClass(formClasses.title)
    expect(getComputedStyle(h).letterSpacing).toBe('9px')
  })

  it('has no a11y violations', async () => {
    const { container } = render(
      <Form schema={schema} onSubmit={() => {}} title="Sign up" description="Hint">
        <TextField name="email" label="Email" />
      </Form>,
    )
    await expectNoA11yViolations(container)
  })

  it('a slotProps.title id cannot clobber the generated id aria-labelledby points at', () => {
    render(
      <Form
        schema={schema}
        onSubmit={() => {}}
        title="Sign up"
        slotProps={{ title: { id: 'custom' } }}
      >
        <TextField name="email" label="Email" />
      </Form>,
    )
    const form = screen.getByRole('form', { name: 'Sign up' })
    const heading = screen.getByRole('heading', { level: 2, name: 'Sign up' })
    expect(form.getAttribute('aria-labelledby')).toBe(heading.id)
  })

  it('a slotProps.description id cannot clobber the generated id aria-describedby points at', () => {
    render(
      <Form
        schema={schema}
        onSubmit={() => {}}
        title="Sign up"
        description="All fields required"
        slotProps={{ description: { id: 'custom' } }}
      >
        <TextField name="email" label="Email" />
      </Form>,
    )
    const form = screen.getByRole('form', { name: 'Sign up' })
    expect(form).toHaveAccessibleDescription('All fields required')
  })
})

describe('requiredIndicator', () => {
  const asterisk = (container: HTMLElement) => container.querySelector('[class*="asterisk"]')

  it('defaults to "asterisk": unchanged from today (asterisk shown, no suffix)', () => {
    const { container } = render(
      <Form schema={schema} defaultValues={{ email: '' }} onSubmit={() => {}}>
        <TextField name="email" label="Email" required />
      </Form>,
    )
    expect(asterisk(container)).not.toBeNull()
    expect(screen.getByRole('textbox', { name: 'Email' })).toBeRequired()
  })

  it('"optional": a required field keeps required/aria-required but shows no asterisk', () => {
    const { container } = render(
      <Form
        schema={schema}
        defaultValues={{ email: '' }}
        onSubmit={() => {}}
        requiredIndicator="optional"
      >
        <TextField name="email" label="Email" required />
      </Form>,
    )
    const input = screen.getByRole('textbox', { name: 'Email' })
    // TextField's native `required` is what announces this to assistive tech
    // (redundant `aria-required` is not needed alongside it, see RadioGroup's own
    // `aria-required` for the case where the group has no native `required`).
    expect(input).toBeRequired()
    expect(asterisk(container)).toBeNull()
  })

  it('"optional": RadioGroup keeps aria-required but shows no legend asterisk', () => {
    const { container } = render(
      <Form
        schema={z.object({ plan: z.number() })}
        defaultValues={{}}
        onSubmit={() => {}}
        requiredIndicator="optional"
      >
        <RadioGroup
          name="plan"
          label="Plan"
          options={[{ value: 1, label: 'Basic' }] as const}
          required
        />
      </Form>,
    )
    expect(screen.getByRole('radiogroup', { name: 'Plan' })).toHaveAttribute(
      'aria-required',
      'true',
    )
    expect(asterisk(container)).toBeNull()
  })

  it('"optional": a required field still blocks submit', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <Form
        schema={schema}
        defaultValues={{ email: '' }}
        onSubmit={onSubmit}
        requiredIndicator="optional"
      >
        <TextField name="email" label="Email" required />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(await screen.findByText('Email is required.')).toBeInTheDocument()
  })

  it('"optional": a not-required field label ends with the default "(optional)" text', () => {
    render(
      <Form
        schema={schema}
        defaultValues={{ email: '' }}
        onSubmit={() => {}}
        requiredIndicator="optional"
      >
        <TextField name="email" label="Email" />
      </Form>,
    )
    expect(screen.getByLabelText('Email (optional)')).toBeInTheDocument()
  })

  it('"optional": Form optionalText overrides the default suffix', () => {
    render(
      <Form
        schema={schema}
        defaultValues={{ email: '' }}
        onSubmit={() => {}}
        requiredIndicator="optional"
        optionalText="(not required)"
      >
        <TextField name="email" label="Email" />
      </Form>,
    )
    expect(screen.getByLabelText('Email (not required)')).toBeInTheDocument()
  })

  it('a per-field optionalText overrides the Form-level one', () => {
    render(
      <Form
        schema={schema}
        defaultValues={{ email: '' }}
        onSubmit={() => {}}
        requiredIndicator="optional"
        optionalText="(not required)"
      >
        <TextField name="email" label="Email" optionalText="(skip if unsure)" />
      </Form>,
    )
    expect(screen.getByLabelText('Email (skip if unsure)')).toBeInTheDocument()
  })

  it('a per-field optionalText={false} hides the suffix on that field only', () => {
    render(
      <Form
        schema={schema}
        defaultValues={{ email: '' }}
        onSubmit={() => {}}
        requiredIndicator="optional"
      >
        <TextField name="email" label="Email" optionalText={false} />
      </Form>,
    )
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.queryByLabelText(/optional/i)).not.toBeInTheDocument()
  })

  it('"asterisk" mode never appends optionalText', () => {
    render(
      <Form schema={schema} defaultValues={{ email: '' }} onSubmit={() => {}}>
        <TextField name="email" label="Email" />
      </Form>,
    )
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.queryByText(/optional/i)).not.toBeInTheDocument()
  })

  it('renders the default requiredIndicatorText as the description in "optional" mode', () => {
    render(
      <Form
        schema={schema}
        defaultValues={{ email: '' }}
        onSubmit={() => {}}
        title="Sign up"
        requiredIndicator="optional"
      >
        <TextField name="email" label="Email" />
      </Form>,
    )
    const form = screen.getByRole('form', { name: 'Sign up' })
    expect(form).toHaveAccessibleDescription('All fields are required unless marked optional.')
  })

  it('appends requiredIndicatorText as a second sentence when description is also set', () => {
    render(
      <Form
        schema={schema}
        defaultValues={{ email: '' }}
        onSubmit={() => {}}
        title="Sign up"
        description="We use this to contact you."
        requiredIndicator="optional"
      >
        <TextField name="email" label="Email" />
      </Form>,
    )
    const form = screen.getByRole('form', { name: 'Sign up' })
    expect(form).toHaveAccessibleDescription(
      'We use this to contact you. All fields are required unless marked optional.',
    )
  })

  it('requiredIndicatorText={false} suppresses the sentence entirely', () => {
    render(
      <Form
        schema={schema}
        defaultValues={{ email: '' }}
        onSubmit={() => {}}
        title="Sign up"
        requiredIndicator="optional"
        requiredIndicatorText={false}
      >
        <TextField name="email" label="Email" />
      </Form>,
    )
    const form = screen.getByRole('form', { name: 'Sign up' })
    expect(form).not.toHaveAttribute('aria-describedby')
  })

  it('requiredIndicatorText is ignored in "asterisk" mode', () => {
    render(
      <Form schema={schema} defaultValues={{ email: '' }} onSubmit={() => {}} title="Sign up">
        <TextField name="email" label="Email" />
      </Form>,
    )
    const form = screen.getByRole('form', { name: 'Sign up' })
    expect(form).not.toHaveAttribute('aria-describedby')
  })

  it('is theme-defaultable via EzForm.defaultProps.requiredIndicator', () => {
    const theme = createTheme({
      components: { EzForm: { defaultProps: { requiredIndicator: 'optional' } } },
    })
    const { container } = render(
      <ThemeProvider theme={theme}>
        <Form schema={schema} defaultValues={{ email: '' }} onSubmit={() => {}}>
          <TextField name="email" label="Email" required />
        </Form>
      </ThemeProvider>,
    )
    expect(asterisk(container)).toBeNull()
    expect(screen.getByRole('textbox', { name: 'Email' })).toBeRequired()
  })

  it('a per-form requiredIndicator overrides the theme default', () => {
    const theme = createTheme({
      components: { EzForm: { defaultProps: { requiredIndicator: 'optional' } } },
    })
    const { container } = render(
      <ThemeProvider theme={theme}>
        <Form
          schema={schema}
          defaultValues={{ email: '' }}
          onSubmit={() => {}}
          requiredIndicator="asterisk"
        >
          <TextField name="email" label="Email" required />
        </Form>
      </ThemeProvider>,
    )
    expect(asterisk(container)).not.toBeNull()
  })

  it('has no accessibility violations in "optional" mode with a mix of required/optional fields', async () => {
    const { container } = render(
      <Form
        schema={schema}
        defaultValues={{ email: '' }}
        onSubmit={() => {}}
        title="Sign up"
        requiredIndicator="optional"
      >
        <TextField name="email" label="Email" required />
        <RadioGroup
          name="plan"
          label="Plan"
          options={[{ value: 1, label: 'Basic' }] as const}
          required
        />
        <Checkbox name="tos" label="I accept the terms" required />
        <Switch name="newsletter" label="Send me the newsletter" />
      </Form>,
    )
    await expectNoA11yViolations(container)
  })

  it('"optional": Checkbox keeps required with no asterisk, and a not-required Switch gets the suffix', () => {
    const { container } = render(
      <Form
        schema={schema}
        defaultValues={{ email: '' }}
        onSubmit={() => {}}
        requiredIndicator="optional"
      >
        <Checkbox name="tos" label="I accept the terms" required />
        <Switch name="newsletter" label="Send me the newsletter" />
      </Form>,
    )
    expect(screen.getByRole('checkbox', { name: 'I accept the terms' })).toBeRequired()
    expect(screen.getByLabelText('Send me the newsletter (optional)')).toBeInTheDocument()
    expect(asterisk(container)).toBeNull()
  })
})
