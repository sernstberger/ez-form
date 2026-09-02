import { render, screen } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import userEvent from '@testing-library/user-event'
import { z } from 'zod'
import { Form } from '../../Form'
import { ZipField } from './ZipField'
import { describeFieldContract } from '../../test/describeFieldContract'

const schema = z.object({ zip: z.string().min(1, { error: 'Zip is required' }) })
const input = () => screen.getByRole('textbox', { name: 'Zip' })

describeFieldContract({
  componentName: 'ZipField',
  label: 'Zip',
  schema,
  defaultValues: { zip: '' },
  render: (props) => <ZipField name="zip" label="Zip" {...props} />,
  getControl: input,
  interact: (user) => user.type(input(), '9'),
})

function renderForm(onSubmit = vi.fn()) {
  render(
    <Form schema={schema} defaultValues={{ zip: '' }} onSubmit={onSubmit}>
      <ZipField name="zip" label="Zip" />
      <button type="submit">Go</button>
    </Form>,
  )
  return { onSubmit }
}

describe('ZipField', () => {
  it('sets inputMode="numeric" and autoComplete="postal-code" by default', () => {
    renderForm()
    expect(input()).toHaveAttribute('inputMode', 'numeric')
    expect(input()).toHaveAttribute('autoComplete', 'postal-code')
  })

  it('a consumer autoComplete overrides the default', () => {
    render(
      <Form schema={schema} defaultValues={{ zip: '' }} onSubmit={() => {}}>
        <ZipField name="zip" label="Zip" autoComplete="off" />
      </Form>,
    )
    expect(input()).toHaveAttribute('autoComplete', 'off')
  })

  it('under <Form assisted> emits autoComplete="off" instead of the postal-code default (#65)', () => {
    render(
      <Form schema={schema} defaultValues={{ zip: '' }} onSubmit={() => {}} assisted>
        <ZipField name="zip" label="Zip" />
      </Form>,
    )
    expect(input()).toHaveAttribute('autoComplete', 'off')
  })

  it('a consumer autoComplete still wins under assisted', () => {
    render(
      <Form schema={schema} defaultValues={{ zip: '' }} onSubmit={() => {}} assisted>
        <ZipField name="zip" label="Zip" autoComplete="postal-code" />
      </Form>,
    )
    expect(input()).toHaveAttribute('autoComplete', 'postal-code')
  })

  it('strips non-digit characters while typing', async () => {
    const user = userEvent.setup()
    renderForm()
    await user.type(input(), '9a0b1-1c1')
    expect(input()).toHaveValue('90111')
  })

  it('caps at 5 digits', async () => {
    const user = userEvent.setup()
    renderForm()
    await user.type(input(), '123456789')
    expect(input()).toHaveValue('12345')
  })

  it('strips non-digits from a paste', async () => {
    const user = userEvent.setup()
    renderForm()
    await user.click(input())
    await user.paste('90210-1234')
    expect(input()).toHaveValue('90210')
  })

  it('submits the digit string', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderForm(onSubmit)
    await user.type(input(), '90210')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ zip: '90210' }, expect.anything())
  })

  it('shows the default invalid message for a non-empty value under 5 digits', async () => {
    const user = userEvent.setup()
    renderForm()
    await user.type(input(), '902')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByText('Enter a 5-digit ZIP code')).toBeInTheDocument()
  })

  it('a consumer invalidMessage overrides the default', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={{ zip: '' }} onSubmit={() => {}}>
        <ZipField name="zip" label="Zip" invalidMessage="Bad zip" />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.type(input(), '902')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByText('Bad zip')).toBeInTheDocument()
  })

  it('an empty value is not flagged invalid by the built-in rule (only zod/required apply)', async () => {
    const user = userEvent.setup()
    renderForm()
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByText('Zip is required')).toBeInTheDocument()
    expect(screen.queryByText('Enter a 5-digit ZIP code')).not.toBeInTheDocument()
  })

  it('shows the required rule message when required and empty', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={{ zip: '' }} onSubmit={() => {}}>
        <ZipField name="zip" label="Zip" required />
        <button type="submit">Go</button>
      </Form>,
    )
    expect(input()).toBeRequired()
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByText('Zip is required.')).toBeInTheDocument()
  })

  it('a consumer validate entry composes with the built-in zip-length rule', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={{ zip: '' }} onSubmit={() => {}}>
        <ZipField name="zip" label="Zip" validate={(v) => v !== '99999' || 'Not that one'} />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.type(input(), '99999')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByText('Not that one')).toBeInTheDocument()
  })
})

describe('ZipField theme defaultProps (EzZipField)', () => {
  it('takes invalidMessage from theme defaultProps', async () => {
    const user = userEvent.setup()
    const theme = createTheme({
      components: {
        EzZipField: {
          defaultProps: { invalidMessage: 'Introduzca un código postal de 5 dígitos' },
        },
      },
    })
    render(
      <ThemeProvider theme={theme}>
        <Form schema={schema} defaultValues={{ zip: '' }} onSubmit={() => {}}>
          <ZipField name="zip" label="Zip" />
          <button type="submit">Go</button>
        </Form>
      </ThemeProvider>,
    )
    await user.type(input(), '902')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Introduzca un código postal de 5 dígitos',
    )
  })

  it("a prop on the element still wins over the theme's default", async () => {
    const user = userEvent.setup()
    const theme = createTheme({
      components: { EzZipField: { defaultProps: { invalidMessage: 'From the theme' } } },
    })
    render(
      <ThemeProvider theme={theme}>
        <Form schema={schema} defaultValues={{ zip: '' }} onSubmit={() => {}}>
          <ZipField name="zip" label="Zip" invalidMessage="From the prop" />
          <button type="submit">Go</button>
        </Form>
      </ThemeProvider>,
    )
    await user.type(input(), '902')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('From the prop')
  })
})
