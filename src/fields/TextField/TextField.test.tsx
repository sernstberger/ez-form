import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { z } from 'zod'
import { Form } from '../../Form'
import { TextField } from './TextField'
import { describeFieldContract } from '../../test/describeFieldContract'
import { expectNoA11yViolations } from '../../test/axe'

const schema = z.object({
  email: z.email({ error: (iss) => (iss.input === '' ? 'Email is required' : 'Invalid email') }),
})

describeFieldContract({
  componentName: 'TextField',
  label: 'Email',
  schema,
  defaultValues: { email: '' },
  render: (props) => <TextField name="email" label="Email" {...props} />,
  getControl: () => screen.getByRole('textbox', { name: 'Email' }),
  interact: (user) => user.type(screen.getByRole('textbox', { name: 'Email' }), 'a'),
})

function renderForm(onSubmit = vi.fn(), helperText?: string) {
  render(
    <Form schema={schema} defaultValues={{ email: '' }} onSubmit={onSubmit}>
      <TextField name="email" label="Email" helperText={helperText} />
      <button type="submit">Go</button>
    </Form>,
  )
  return { onSubmit }
}

describe('TextField', () => {
  it('shows the zod message as helper text after a failed submit', async () => {
    const user = userEvent.setup()
    renderForm()
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByText('Email is required')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
  })

  it('submits the typed value', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderForm()
    await user.type(screen.getByLabelText('Email'), 'a@b.co')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ email: 'a@b.co' }, expect.anything())
  })

  it('shows consumer helperText when there is no error', () => {
    renderForm(vi.fn(), 'We never share it')
    expect(screen.getByText('We never share it')).toBeInTheDocument()
  })

  it('replaces consumer helperText with the error message', async () => {
    const user = userEvent.setup()
    renderForm(vi.fn(), 'We never share it')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByText('Email is required')).toBeInTheDocument()
    expect(screen.queryByText('We never share it')).not.toBeInTheDocument()
  })

  it('shows "<label> is required." when required and left empty', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={{ email: '' }} onSubmit={() => {}}>
        <TextField name="email" label="Email" required />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByText('Email is required.')).toBeInTheDocument()
  })

  it('lets a rule error win over the zod message for the same field', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={{ email: '' }} onSubmit={() => {}}>
        <TextField name="email" label="Email" required="Please fill in your email" />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByText('Please fill in your email')).toBeInTheDocument()
    expect(screen.queryByText('Email is required')).not.toBeInTheDocument()
  })

  it('derives a default message for a bare rule value', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={{ email: '' }} onSubmit={() => {}}>
        <TextField name="email" label="Email" minLength={3} />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.type(screen.getByLabelText('Email'), 'ab')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByText('Email must be at least 3 characters.')).toBeInTheDocument()
    expect(screen.queryByText('Invalid email')).not.toBeInTheDocument()
  })

  it('marks the input required and shows the asterisk when required', () => {
    render(
      <Form schema={schema} defaultValues={{ email: '' }} onSubmit={() => {}}>
        <TextField name="email" label="Email" required />
      </Form>,
    )
    expect(screen.getByRole('textbox', { name: 'Email' })).toBeRequired()
  })

  it('reports a rule message while typing in onChange mode', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={{ email: '' }} onSubmit={() => {}} mode="onChange">
        <TextField name="email" label="Email" minLength={3} />
      </Form>,
    )
    await user.type(screen.getByLabelText('Email'), 'ab')
    expect(await screen.findByText('Email must be at least 3 characters.')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Email'), 'c')
    expect(screen.queryByText('Email must be at least 3 characters.')).not.toBeInTheDocument()
  })

  it('submits when every rule passes', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <Form schema={schema} defaultValues={{ email: '' }} onSubmit={onSubmit}>
        <TextField name="email" label="Email" required minLength={3} pattern={/@/} />
        <button type="submit">Go</button>
      </Form>,
    )
    // A required label reads "Email *" to getByLabelText; the asterisk is aria-hidden, so query by role.
    await user.type(screen.getByRole('textbox', { name: 'Email' }), 'a@b.co')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ email: 'a@b.co' }, expect.anything())
  })

  it('Form requiredIndicator="optional": required stays required with no asterisk', () => {
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
    expect(screen.getByRole('textbox', { name: 'Email' })).toBeRequired()
    expect(container.querySelector('[class*="asterisk"]')).toBeNull()
  })

  it('Form requiredIndicator="optional": not-required gets the optional suffix in its label', () => {
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

  it('a consumer slotProps.inputLabel.required still wins over the label suppression', () => {
    const { container } = render(
      <Form
        schema={schema}
        defaultValues={{ email: '' }}
        onSubmit={() => {}}
        requiredIndicator="optional"
      >
        <TextField
          name="email"
          label="Email"
          required
          slotProps={{ inputLabel: { required: true } }}
        />
      </Form>,
    )
    expect(container.querySelector('[class*="asterisk"]')).not.toBeNull()
  })
})

describe('TextField autoComplete/inputMode defaults (#6, #7)', () => {
  const cases = [
    { type: 'email', autoComplete: 'email', inputMode: 'email' },
    { type: 'tel', autoComplete: 'tel', inputMode: 'tel' },
    { type: 'url', autoComplete: 'url', inputMode: 'url' },
  ] as const

  it.each(cases)(
    'type="$type" defaults autoComplete="$autoComplete" and inputMode="$inputMode"',
    ({ type, autoComplete, inputMode }) => {
      render(
        <Form schema={schema} defaultValues={{ email: '' }} onSubmit={vi.fn()}>
          <TextField name="email" label="Email" type={type} />
        </Form>,
      )
      const input = screen.getByLabelText('Email')
      expect(input).toHaveAttribute('autoComplete', autoComplete)
      expect(input).toHaveAttribute('inputMode', inputMode)
    },
  )

  it('type="search" defaults inputMode="search" with no autoComplete guess', () => {
    render(
      <Form schema={schema} defaultValues={{ email: '' }} onSubmit={vi.fn()}>
        <TextField name="email" label="Email" type="search" />
      </Form>,
    )
    const input = screen.getByLabelText('Email')
    expect(input).toHaveAttribute('inputMode', 'search')
    expect(input).not.toHaveAttribute('autocomplete')
  })

  it('plain type="text" gets no autoComplete or inputMode default', () => {
    render(
      <Form schema={schema} defaultValues={{ email: '' }} onSubmit={vi.fn()}>
        <TextField name="email" label="Email" type="text" />
      </Form>,
    )
    const input = screen.getByLabelText('Email')
    expect(input).not.toHaveAttribute('autocomplete')
    expect(input).not.toHaveAttribute('inputmode')
  })

  it('no type at all gets no autoComplete or inputMode default', () => {
    render(
      <Form schema={schema} defaultValues={{ email: '' }} onSubmit={vi.fn()}>
        <TextField name="email" label="Email" />
      </Form>,
    )
    const input = screen.getByLabelText('Email')
    expect(input).not.toHaveAttribute('autocomplete')
    expect(input).not.toHaveAttribute('inputmode')
  })

  it('a consumer top-level autoComplete wins over the type-derived default', () => {
    render(
      <Form schema={schema} defaultValues={{ email: '' }} onSubmit={vi.fn()}>
        <TextField name="email" label="Email" type="email" autoComplete="username" />
      </Form>,
    )
    expect(screen.getByLabelText('Email')).toHaveAttribute('autoComplete', 'username')
  })

  it('a consumer slotProps.htmlInput.inputMode wins over the type-derived default', () => {
    render(
      <Form schema={schema} defaultValues={{ email: '' }} onSubmit={vi.fn()}>
        <TextField
          name="email"
          label="Email"
          type="email"
          slotProps={{ htmlInput: { inputMode: 'text' } }}
        />
      </Form>,
    )
    expect(screen.getByLabelText('Email')).toHaveAttribute('inputMode', 'text')
  })

  it('a consumer inputMode set via slotProps.htmlInput on type="tel" is not clobbered by undefined', () => {
    render(
      <Form schema={schema} defaultValues={{ email: '' }} onSubmit={vi.fn()}>
        <TextField
          name="email"
          label="Email"
          type="tel"
          slotProps={{ htmlInput: { 'aria-label': 'Phone' } }}
        />
      </Form>,
    )
    const input = screen.getByLabelText('Email')
    expect(input).toHaveAttribute('inputMode', 'tel')
    expect(input).toHaveAttribute('aria-label', 'Phone')
  })
})

describe('TextField under <Form assisted> (#65)', () => {
  it('emits autoComplete="off" instead of the type-derived default', () => {
    render(
      <Form schema={schema} defaultValues={{ email: '' }} onSubmit={vi.fn()} assisted>
        <TextField name="email" label="Email" type="email" />
      </Form>,
    )
    expect(screen.getByLabelText('Email')).toHaveAttribute('autoComplete', 'off')
  })

  it('a consumer autoComplete still wins under assisted', () => {
    render(
      <Form schema={schema} defaultValues={{ email: '' }} onSubmit={vi.fn()} assisted>
        <TextField name="email" label="Email" type="email" autoComplete="username" />
      </Form>,
    )
    expect(screen.getByLabelText('Email')).toHaveAttribute('autoComplete', 'username')
  })

  it('a plain type="text" field (no type-derived default) still gets autoComplete="off" under assisted', () => {
    // Chromium's own autofill heuristics key off `name`/`id`, not just `autoComplete` —
    // suppressing only the fields that already had a default token would leave that gap
    // open. Assisted mode sets `off` on every field with no explicit `autoComplete`,
    // regardless of whether it had a type-derived default to replace.
    render(
      <Form schema={schema} defaultValues={{ email: '' }} onSubmit={vi.fn()} assisted>
        <TextField name="email" label="Email" type="text" />
      </Form>,
    )
    expect(screen.getByLabelText('Email')).toHaveAttribute('autoComplete', 'off')
  })
})

describe('TextField displayValue', () => {
  it('renders the bound value when displayValue is not set', async () => {
    const user = userEvent.setup()
    renderForm()
    await user.type(screen.getByLabelText('Email'), 'a@b.co')
    expect(screen.getByLabelText('Email')).toHaveValue('a@b.co')
  })

  it('renders displayValue in the input while the form value stays the bound one', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <Form schema={schema} defaultValues={{ email: 'a@b.co' }} onSubmit={onSubmit}>
        <TextField name="email" label="Email" displayValue="shown instead" />
        <button type="submit">Go</button>
      </Form>,
    )
    expect(screen.getByLabelText('Email')).toHaveValue('shown instead')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ email: 'a@b.co' }, expect.anything())
  })
})

describe('TextField binding cannot be displaced by consumer props (#104)', () => {
  it('announces the error even when a consumer sets slotProps.formHelperText.role', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={{ email: '' }} onSubmit={() => {}}>
        <TextField name="email" label="Email" slotProps={{ formHelperText: { role: 'note' } }} />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Email is required')
  })

  it('honours a consumer helper-text role while there is no error to announce', () => {
    render(
      <Form schema={schema} defaultValues={{ email: '' }} onSubmit={() => {}}>
        <TextField
          name="email"
          label="Email"
          helperText="We never share it"
          slotProps={{ formHelperText: { role: 'note' } }}
        />
      </Form>,
    )
    expect(screen.getByText('We never share it')).toHaveAttribute('role', 'note')
  })

  it('announces the error through the function form of slotProps.formHelperText', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={{ email: '' }} onSubmit={() => {}}>
        <TextField
          name="email"
          label="Email"
          slotProps={{ formHelperText: () => ({ role: 'note' }) }}
        />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Email is required')
  })

  it('describes the input with both the consumer aria-describedby and the error', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={{ email: '' }} onSubmit={() => {}}>
        <span id="mine">Work address only</span>
        <TextField name="email" label="Email" aria-describedby="mine" />
        <button type="submit">Go</button>
      </Form>,
    )
    const input = screen.getByRole('textbox', { name: 'Email' })
    expect(input).toHaveAccessibleDescription('Work address only')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    await screen.findByRole('alert')
    expect(input).toHaveAccessibleDescription('Work address only Email is required')
  })

  it('describes the input with both the consumer aria-describedby and the helper text', () => {
    render(
      <Form schema={schema} defaultValues={{ email: '' }} onSubmit={() => {}}>
        <span id="mine">Work address only</span>
        <TextField
          name="email"
          label="Email"
          aria-describedby="mine"
          helperText="We never share it"
        />
      </Form>,
    )
    expect(screen.getByRole('textbox', { name: 'Email' })).toHaveAccessibleDescription(
      'Work address only We never share it',
    )
  })

  it('keeps the consumer aria-describedby off the FormControl wrapper', () => {
    const { container } = render(
      <Form schema={schema} defaultValues={{ email: '' }} onSubmit={() => {}}>
        <span id="mine">Work address only</span>
        <TextField name="email" label="Email" aria-describedby="mine" />
      </Form>,
    )
    // It belongs on the element that carries the `textbox` role, not on the wrapper div (#99).
    expect(container.querySelector('.MuiFormControl-root')).not.toHaveAttribute('aria-describedby')
  })

  it('has no accessibility violations with a consumer aria-describedby and an error', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <Form schema={schema} defaultValues={{ email: '' }} onSubmit={() => {}}>
        <span id="mine">Work address only</span>
        <TextField name="email" label="Email" aria-describedby="mine" />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.click(screen.getByRole('button', { name: 'Go' }))
    await screen.findByRole('alert')
    await expectNoA11yViolations(container)
  })

  it('lets the binding win over a same-named prop arriving through a spread', () => {
    // `value` and `error` are `Omit`ted from `TextFieldProps`, so this is a type error —
    // but a consumer building props dynamically can still get here at runtime, and the
    // binding, not the spread, must decide what the input shows.
    const dynamic = { value: 'CLOBBERED', error: true } as unknown as { placeholder: string }
    render(
      <Form schema={schema} defaultValues={{ email: 'bound@b.co' }} onSubmit={() => {}}>
        <TextField name="email" label="Email" {...dynamic} />
      </Form>,
    )
    const input = screen.getByRole('textbox', { name: 'Email' })
    expect(input).toHaveValue('bound@b.co')
    expect(input).not.toHaveAttribute('aria-invalid', 'true')
  })

  it('rejects defaultValue at the type level', () => {
    // Not rendered: the point is that `tsc` rejects it. Rendering it would emit React's
    // "both value and defaultValue" error, which is the very thing the `Omit` prevents.
    const rejected = (
      // @ts-expect-error the form owns the value; a defaultValue would make the input uncontrolled
      <TextField name="email" label="Email" defaultValue="x" />
    )
    expect(rejected).toBeTruthy()
  })
})
