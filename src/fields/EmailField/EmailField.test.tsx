import { createTheme, ThemeProvider } from '@mui/material/styles'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { z } from 'zod'
import { Form } from '../../Form'
import { EmailField } from './EmailField'
import { describeFieldContract } from '../../test/describeFieldContract'
import { expectNoA11yViolations } from '../../test/axe'

const schema = z.object({ email: z.string() })
const input = () => screen.getByRole('textbox', { name: /Email/ }) as HTMLInputElement

describeFieldContract({
  componentName: 'EmailField',
  label: 'Email',
  schema,
  defaultValues: { email: '' },
  render: (props) => <EmailField name="email" label="Email" {...props} />,
  getControl: () => screen.getByRole('textbox', { name: /Email/ }),
  interact: (user) => user.type(screen.getByRole('textbox', { name: /Email/ }), 'a'),
})

function renderEmail(props: Record<string, unknown> = {}, onSubmit = vi.fn()) {
  const utils = render(
    <Form schema={schema} defaultValues={{ email: '' }} onSubmit={onSubmit}>
      <EmailField name="email" label="Email" {...props} />
      <button type="submit">Go</button>
    </Form>,
  )
  return { onSubmit, ...utils }
}

describe('EmailField input attributes', () => {
  it('sets type, inputMode and the email autoComplete default', () => {
    renderEmail()
    expect(input()).toHaveAttribute('type', 'email')
    expect(input()).toHaveAttribute('inputmode', 'email')
    expect(input()).toHaveAttribute('autocomplete', 'email')
  })

  it("a consumer's autoComplete wins over the default", () => {
    renderEmail({ autoComplete: 'work email' })
    expect(input()).toHaveAttribute('autocomplete', 'work email')
  })
})

describe('EmailField normalize', () => {
  it('trims and lower-cases on blur by default, and submits the canonical value', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderEmail()
    await user.type(input(), '  Ada@Example.COM  ')
    await user.tab()
    expect(input()).toHaveValue('ada@example.com')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ email: 'ada@example.com' }, expect.anything())
  })

  it('normalize={false} stores exactly what was typed', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderEmail({ normalize: false })
    // `type="email"` is a sanitized value type: the platform strips leading and
    // trailing whitespace itself, so case is what `normalize` is left to decide.
    await user.type(input(), 'Ada@Example.COM')
    await user.tab()
    expect(input()).toHaveValue('Ada@Example.COM')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ email: 'Ada@Example.COM' }, expect.anything())
  })

  it('still fires a consumer onBlur, with normalize on and off', async () => {
    for (const normalize of [true, false]) {
      const user = userEvent.setup()
      const onBlur = vi.fn()
      const { unmount } = render(
        <Form schema={schema} defaultValues={{ email: '' }} onSubmit={() => {}}>
          <EmailField name="email" label="Email" normalize={normalize} onBlur={onBlur} />
        </Form>,
      )
      await user.type(input(), 'Ada@Example.com')
      await user.tab()
      expect(onBlur).toHaveBeenCalledTimes(1)
      unmount()
    }
  })

  it('leaves an already-canonical value undirtied (no needless setValue)', async () => {
    const user = userEvent.setup()
    renderEmail()
    await user.type(input(), 'ada@example.com')
    await user.tab()
    expect(input()).toHaveValue('ada@example.com')
  })
})

describe('EmailField validation', () => {
  it.each([
    'ada@example.com',
    'ada.lovelace+tag@sub.example.co.uk',
    "o'brien!#$%&*@example.com",
    'a@b',
  ])('accepts %j', async (value) => {
    const user = userEvent.setup()
    const { onSubmit } = renderEmail()
    await user.type(input(), value)
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(onSubmit).toHaveBeenCalled()
  })

  it.each(['ada', 'ada@', '@example.com', 'ada@@example.com', 'ada example@x.com', 'ada@ex..com'])(
    'rejects %j with the default invalid message',
    async (value) => {
      const user = userEvent.setup()
      const { onSubmit } = renderEmail()
      await user.type(input(), value)
      await user.click(screen.getByRole('button', { name: 'Go' }))
      expect(await screen.findByRole('alert')).toHaveTextContent('Enter a valid email address')
      expect(onSubmit).not.toHaveBeenCalled()
    },
  )

  it('a consumer invalidMessage overrides the default', async () => {
    const user = userEvent.setup()
    renderEmail({ invalidMessage: 'That address looks wrong' })
    await user.type(input(), 'ada')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('That address looks wrong')
  })

  it('an empty optional field passes: the format rule only guards non-empty values', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderEmail()
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ email: '' }, expect.anything())
  })

  it('empty + required reports the required message, not the format one', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderEmail({ required: true })
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Email is required.')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('runs a consumer validate alongside the built-in format rule', async () => {
    const user = userEvent.setup()
    renderEmail({
      validate: { notFree: (v: string) => !v.endsWith('@gmail.com') || 'Use your work address' },
    })
    await user.type(input(), 'ada@gmail.com')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Use your work address')
  })

  it('accepts an un-normalized address that only canonicalization makes valid', async () => {
    // Submitting without blurring first: the rule canonicalizes before testing,
    // so the field never rejects a value it would have fixed itself.
    const user = userEvent.setup()
    const { onSubmit } = renderEmail()
    await user.type(input(), '  ADA@EXAMPLE.COM  {Enter}')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(onSubmit).toHaveBeenCalled()
  })
})

describe('EmailField a11y', () => {
  it('has no violations in the default state', async () => {
    const { container } = renderEmail({ helperText: "We'll only use this to sign you in" })
    await expectNoA11yViolations(container)
  })

  it('has no violations while showing the format error', async () => {
    const user = userEvent.setup()
    const { container } = renderEmail()
    await user.type(input(), 'ada')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    await screen.findByRole('alert')
    await expectNoA11yViolations(container)
  })
})

describe('EmailField theming', () => {
  it('takes invalidMessage, normalize and autoComplete from theme defaultProps', async () => {
    const user = userEvent.setup()
    const theme = createTheme({
      components: {
        EzEmailField: {
          defaultProps: {
            invalidMessage: 'Bad address',
            normalize: false,
            autoComplete: 'work email',
          },
        },
      },
    })
    render(
      <ThemeProvider theme={theme}>
        <Form schema={schema} defaultValues={{ email: '' }} onSubmit={() => {}}>
          <EmailField name="email" label="Email" />
          <button type="submit">Go</button>
        </Form>
      </ThemeProvider>,
    )
    expect(input()).toHaveAttribute('autocomplete', 'work email')
    await user.type(input(), 'Ada')
    await user.tab()
    expect(input()).toHaveValue('Ada')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Bad address')
  })

  it("a prop on the element still wins over the theme's default", async () => {
    const user = userEvent.setup()
    const theme = createTheme({
      components: { EzEmailField: { defaultProps: { invalidMessage: 'Bad address' } } },
    })
    render(
      <ThemeProvider theme={theme}>
        <Form schema={schema} defaultValues={{ email: '' }} onSubmit={() => {}}>
          <EmailField name="email" label="Email" invalidMessage="Nope" />
          <button type="submit">Go</button>
        </Form>
      </ThemeProvider>,
    )
    await user.type(input(), 'ada')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Nope')
  })
})

describe('EmailField form integration', () => {
  it('displays a value that arrives from defaultValues', () => {
    render(
      <Form schema={schema} defaultValues={{ email: 'ada@example.com' }} onSubmit={() => {}}>
        <EmailField name="email" label="Email" />
      </Form>,
    )
    expect(input()).toHaveValue('ada@example.com')
  })

  it('Form requiredIndicator="optional": not-required gets the optional suffix', () => {
    render(
      <Form
        schema={schema}
        defaultValues={{ email: '' }}
        onSubmit={() => {}}
        requiredIndicator="optional"
      >
        <EmailField name="email" label="Email" />
      </Form>,
    )
    expect(screen.getByRole('textbox', { name: 'Email (optional)' })).toBeInTheDocument()
  })
})

describe("EmailField normalize respects the form's validation mode", () => {
  it('does not surface an error on blur under the default onSubmit mode', async () => {
    const user = userEvent.setup()
    renderEmail()
    // A bad address that normalization *does* change, so the write happens.
    await user.type(input(), 'ADA')
    await user.tab()
    expect(input()).toHaveValue('ada')
    // Blur must not validate ahead of the form's mode, the way every other
    // field behaves — the error belongs on submit.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('still shows the error on blur under mode="onBlur"', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={{ email: '' }} onSubmit={() => {}} mode="onBlur">
        <EmailField name="email" label="Email" />
      </Form>,
    )
    await user.type(input(), 'ADA')
    await user.tab()
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a valid email address')
  })

  it('re-validates on blur once a field is already showing an error', async () => {
    const user = userEvent.setup()
    renderEmail()
    await user.type(input(), 'ada')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a valid email address')
    // After a failed submit hookform re-validates on change, so fixing the
    // value clears the error without another submit.
    await user.clear(input())
    await user.type(input(), 'ADA@EXAMPLE.COM')
    await user.tab()
    expect(input()).toHaveValue('ada@example.com')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('EmailField readOnly', () => {
  it('does not normalize a readOnly field on blur', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={{ email: 'Ada@Example.COM' }} onSubmit={() => {}}>
        <EmailField name="email" label="Email" slotProps={{ input: { readOnly: true } }} />
      </Form>,
    )
    expect(input()).toHaveValue('Ada@Example.COM')
    // Focusing and leaving a read-only field must not rewrite a value the user
    // was never able to edit.
    await user.click(input())
    await user.tab()
    expect(input()).toHaveValue('Ada@Example.COM')
  })

  it('still normalizes a plain (non-readOnly) field, for contrast', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={{ email: 'Ada@Example.COM' }} onSubmit={() => {}}>
        <EmailField name="email" label="Email" />
      </Form>,
    )
    await user.click(input())
    await user.tab()
    expect(input()).toHaveValue('ada@example.com')
  })
})

describe('EmailField assisted mode (#65)', () => {
  it('under <Form assisted> emits autoComplete="off" instead of the email default', () => {
    render(
      <Form schema={schema} defaultValues={{ email: '' }} onSubmit={() => {}} assisted>
        <EmailField name="email" label="Email" />
      </Form>,
    )
    expect(input()).toHaveAttribute('autoComplete', 'off')
  })

  it('a consumer autoComplete still wins under assisted', () => {
    render(
      <Form schema={schema} defaultValues={{ email: '' }} onSubmit={() => {}} assisted>
        <EmailField name="email" label="Email" autoComplete="work email" />
      </Form>,
    )
    expect(input()).toHaveAttribute('autoComplete', 'work email')
  })
})
