import { createTheme, ThemeProvider } from '@mui/material/styles'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { z } from 'zod'
import { Form } from '../../Form'
import { OtpField } from './OtpField'
import { otpFieldClasses } from './OtpFieldControl'
import { describeFieldContract } from '../../test/describeFieldContract'
import { expectTargetSize } from '../../test/targetSize'

const schema = z.object({ code: z.string() })
const inputs = () => screen.getAllByRole('textbox') as HTMLInputElement[]

describeFieldContract({
  componentName: 'OtpField',
  label: 'Code',
  schema,
  defaultValues: { code: '' },
  render: ({ onChange, ...props }) => (
    <OtpField name="code" label="Code" length={4} onValueChange={onChange} {...props} />
  ),
  getControl: () => screen.getByRole('textbox', { name: 'Code' }),
  interact: async (user) => {
    await user.type(screen.getByRole('textbox', { name: 'Code' }), '1')
  },
})

describe('OtpField', () => {
  it('renders one input per slot and submits the joined code', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <Form schema={schema} defaultValues={{ code: '' }} onSubmit={onSubmit}>
        <OtpField name="code" label="Code" length={4} />
        <button type="submit">Go</button>
      </Form>,
    )
    expect(inputs()).toHaveLength(4)
    await user.type(screen.getByRole('textbox', { name: 'Code' }), '1234')
    expect(inputs().map((i) => i.value)).toEqual(['1', '2', '3', '4'])
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ code: '1234' }, expect.anything())
  })

  it.each(['medium', 'small'] as const)('%s: meets 24×24 target size', (size) => {
    render(
      <Form schema={schema} defaultValues={{ code: '' }} onSubmit={() => {}}>
        <OtpField name="code" label="Code" length={4} size={size} />
      </Form>,
    )
    inputs().forEach(expectTargetSize)
  })

  it('accepts a pasted code', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <Form schema={schema} defaultValues={{ code: '' }} onSubmit={onSubmit}>
        <OtpField name="code" label="Code" length={6} />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.click(screen.getByRole('textbox', { name: 'Code' }))
    await user.paste('987654')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ code: '987654' }, expect.anything())
  })

  it('rejects a partial code with the length message', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <Form schema={schema} defaultValues={{ code: '' }} onSubmit={onSubmit}>
        <OtpField name="code" label="Code" length={4} />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.type(screen.getByRole('textbox', { name: 'Code' }), '12')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Code must be 4 characters.')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('passes an empty code when not required', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <Form schema={schema} defaultValues={{ code: '' }} onSubmit={onSubmit}>
        <OtpField name="code" label="Code" length={4} />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ code: '' }, expect.anything())
  })

  it('masks the characters when asked', () => {
    render(
      <Form schema={schema} defaultValues={{ code: '' }} onSubmit={() => {}}>
        <OtpField name="code" label="Code" length={4} mask />
      </Form>,
    )
    // Masked slots are password inputs, which have no textbox role.
    expect(screen.queryAllByRole('textbox')).toHaveLength(0)
    expect(document.querySelectorAll('input[type="password"]')).toHaveLength(4)
  })

  it('focuses the first slot after a failed submit', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={{ code: '' }} onSubmit={() => {}}>
        <OtpField name="code" label="Code" length={4} required />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByText('Code is required.')).toBeInTheDocument()
    expect(inputs()[0]).toHaveFocus()
  })

  it('is themeable: styleOverrides.helperText applies', () => {
    const theme = createTheme({
      components: {
        EzOtpField: {
          styleOverrides: {
            helperText: { letterSpacing: '9px' },
          },
        },
      },
    })
    render(
      <ThemeProvider theme={theme}>
        <Form schema={schema} defaultValues={{ code: '' }} onSubmit={() => {}}>
          <OtpField name="code" label="Code" length={4} helperText="Enter the code" />
        </Form>
      </ThemeProvider>,
    )
    const helperText = screen.getByText('Enter the code')
    expect(helperText).toHaveClass(otpFieldClasses.helperText)
    expect(getComputedStyle(helperText).letterSpacing).toBe('9px')
  })
})
