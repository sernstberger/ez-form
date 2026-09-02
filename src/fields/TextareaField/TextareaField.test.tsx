import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createTheme, ThemeProvider } from '@mui/material/styles'
import { z } from 'zod'
import { Form } from '../../Form'
import { TextareaField, textareaFieldClasses } from './TextareaField'
import { describeFieldContract } from '../../test/describeFieldContract'

// jsdom has no real layout engine, so `TextareaAutosize`'s own row-measuring effect
// always bails out to a 0px height (its `computedStyle.width === '0px'` guard), and
// `InputBase` always merges in a `rows: undefined` alongside `minRows`/`maxRows` that
// clobbers `TextareaAutosize`'s own `rows={minRows}` (set for the "correct" first SSR
// paint) — so no `minRows`/`maxRows` value is ever visible in a rendered attribute or
// style here (matches the task's own note that jsdom can't measure autogrow). Mocking
// ez-form's own `TextField` — the boundary `TextareaField` actually owns, one import
// hop before MUI — proves the values left `TextareaField` correctly without fighting
// jsdom's layout limits or MUI's internal (non-public) import path.
const textFieldSpy = vi.fn()
vi.mock('../TextField', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../TextField')>()
  return {
    ...actual,
    TextField: (props: unknown) => {
      textFieldSpy(props)
      return actual.TextField(props as never)
    },
  }
})

const schema = z.object({ bio: z.string() })
const textbox = () => screen.getByRole('textbox', { name: 'Bio' })

// The generic contract exercises plain helperText/error behaviour with no `maxLength`
// rule, so it never triggers the length meter — that has its own tests below.
describeFieldContract({
  componentName: 'TextareaField',
  label: 'Bio',
  schema,
  defaultValues: { bio: '' },
  render: (props) => <TextareaField name="bio" label="Bio" {...props} />,
  getControl: textbox,
  interact: (user) => user.type(textbox(), 'a'),
})

describe('TextareaField', () => {
  it('renders a multiline textbox with the themeable default minRows/maxRows reaching TextField', () => {
    render(
      <Form schema={schema} defaultValues={{ bio: '' }} onSubmit={() => {}}>
        <TextareaField name="bio" label="Bio" />
      </Form>,
    )
    expect(textbox().tagName).toBe('TEXTAREA')
    expect(textFieldSpy).toHaveBeenCalledWith(expect.objectContaining({ minRows: 4, maxRows: 12 }))
  })

  it('shows no meter when there is no maxLength rule and showCount is unset', () => {
    render(
      <Form schema={z.object({ bio: z.string() })} defaultValues={{ bio: '' }} onSubmit={() => {}}>
        <TextareaField name="bio" label="Bio" />
      </Form>,
    )
    expect(screen.queryByText(/^\d/)).not.toBeInTheDocument()
  })

  it('shows a bare count with showCount and no maxLength', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={z.object({ bio: z.string() })} defaultValues={{ bio: '' }} onSubmit={() => {}}>
        <TextareaField name="bio" label="Bio" showCount />
      </Form>,
    )
    await user.type(textbox(), 'hello')
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('shows n / max after typing and updates live', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={{ bio: '' }} onSubmit={() => {}}>
        <TextareaField name="bio" label="Bio" maxLength={500} />
      </Form>,
    )
    expect(screen.getByText('0 / 500')).toBeInTheDocument()
    await user.type(textbox(), 'hello world!')
    expect(screen.getByText('12 / 500')).toBeInTheDocument()
  })

  it('associates the counter with the control via aria-describedby', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={{ bio: '' }} onSubmit={() => {}}>
        <TextareaField name="bio" label="Bio" maxLength={500} />
      </Form>,
    )
    await user.type(textbox(), 'hi')
    expect(textbox()).toHaveAccessibleDescription('2 / 500')
  })

  it('replaces the meter with the validation error once past the limit', async () => {
    const user = userEvent.setup()
    const maxTen = z.object({ bio: z.string().max(10) })
    render(
      <Form schema={maxTen} defaultValues={{ bio: '' }} onSubmit={() => {}}>
        <TextareaField name="bio" label="Bio" maxLength={10} />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.type(textbox(), 'this is way too long')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByText('Bio must be at most 10 characters.')).toBeInTheDocument()
    expect(screen.queryByText(/\/ 10/)).not.toBeInTheDocument()
  })

  it('keeps consumer helperText alongside the meter when there is no error', () => {
    render(
      <Form schema={schema} defaultValues={{ bio: '' }} onSubmit={() => {}}>
        <TextareaField name="bio" label="Bio" maxLength={500} helperText="Tell us about yourself" />
      </Form>,
    )
    expect(screen.getByText('Tell us about yourself')).toBeInTheDocument()
    expect(screen.getByText('0 / 500')).toBeInTheDocument()
    // One accessible description, not two disjoint text nodes glued together with no space.
    expect(textbox()).toHaveAccessibleDescription('Tell us about yourself 0 / 500')
  })

  it('passes explicit minRows/maxRows through to autogrow, overriding the defaults', () => {
    render(
      <Form schema={schema} defaultValues={{ bio: '' }} onSubmit={() => {}}>
        <TextareaField name="bio" label="Bio" minRows={2} maxRows={6} />
      </Form>,
    )
    expect(textFieldSpy).toHaveBeenCalledWith(expect.objectContaining({ minRows: 2, maxRows: 6 }))
  })

  it('is themeable: EzTextareaField defaultProps.minRows reaches autogrow', () => {
    const theme = createTheme({
      components: {
        EzTextareaField: { defaultProps: { minRows: 6 } },
      },
    })
    render(
      <ThemeProvider theme={theme}>
        <Form schema={schema} defaultValues={{ bio: '' }} onSubmit={() => {}}>
          <TextareaField name="bio" label="Bio" />
        </Form>
      </ThemeProvider>,
    )
    expect(textFieldSpy).toHaveBeenCalledWith(expect.objectContaining({ minRows: 6 }))
  })

  it('is themeable: EzTextareaField styleOverrides.counter applies and the root/counter classes are present', () => {
    const theme = createTheme({
      components: {
        EzTextareaField: {
          styleOverrides: { counter: { fontWeight: 700 } },
        },
      },
    })
    const { container } = render(
      <ThemeProvider theme={theme}>
        <Form schema={schema} defaultValues={{ bio: '' }} onSubmit={() => {}}>
          <TextareaField name="bio" label="Bio" maxLength={500} />
        </Form>
      </ThemeProvider>,
    )
    const counter = container.querySelector(`.${textareaFieldClasses.counter}`)!
    expect(counter).toBeInTheDocument()
    expect(getComputedStyle(counter).fontWeight).toBe('700')
    expect(container.querySelector(`.${textareaFieldClasses.root}`)).toBeInTheDocument()
  })

  it('Form requiredIndicator="optional": required stays required with no asterisk', () => {
    const { container } = render(
      <Form
        schema={schema}
        defaultValues={{ bio: '' }}
        onSubmit={() => {}}
        requiredIndicator="optional"
      >
        <TextareaField name="bio" label="Bio" required />
      </Form>,
    )
    expect(textbox()).toBeRequired()
    expect(container.querySelector('[class*="asterisk"]')).toBeNull()
  })
})
