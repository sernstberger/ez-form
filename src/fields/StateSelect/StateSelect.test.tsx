import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { z } from 'zod'
import { Form } from '../../Form'
import { StateSelect, US_STATES, US_TERRITORIES } from './StateSelect'
import { describeFieldContract } from '../../test/describeFieldContract'

const schema = z.object({ state: z.string().min(1, { error: 'State is required' }) })
const combobox = () => screen.getByRole('combobox', { name: 'State' })

describeFieldContract({
  componentName: 'StateSelect',
  label: 'State',
  schema,
  defaultValues: {},
  render: (props) => <StateSelect name="state" label="State" {...props} />,
  getControl: combobox,
  expectDisabled: (control) => expect(control).toHaveAttribute('aria-disabled', 'true'),
  interact: async (user) => {
    await user.click(combobox())
    await user.click(await screen.findByRole('option', { name: 'California' }))
  },
})

function renderForm(onSubmit = vi.fn()) {
  render(
    <Form schema={schema} defaultValues={{}} onSubmit={onSubmit}>
      <StateSelect name="state" label="State" />
      <button type="submit">Go</button>
    </Form>,
  )
  return { onSubmit }
}

describe('StateSelect', () => {
  it('renders 51 options by default (50 states + DC)', async () => {
    const user = userEvent.setup()
    renderForm()
    await user.click(combobox())
    expect(await screen.findAllByRole('option')).toHaveLength(51)
  })

  it('renders 56 options with territories', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={{}} onSubmit={() => {}}>
        <StateSelect name="state" label="State" territories />
      </Form>,
    )
    await user.click(combobox())
    expect(await screen.findAllByRole('option')).toHaveLength(56)
  })

  it('submits the USPS abbreviation as the value', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderForm(onSubmit)
    await user.click(combobox())
    await user.click(await screen.findByRole('option', { name: 'California' }))
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ state: 'CA' }, expect.anything())
  })

  it('sets autoComplete="address-level1" on the hidden native input by default', () => {
    renderForm()
    const hidden = document.querySelector('input[name="state"]')!
    expect(hidden).toHaveAttribute('autoComplete', 'address-level1')
  })

  it('a consumer autoComplete overrides the default', () => {
    render(
      <Form schema={schema} defaultValues={{}} onSubmit={() => {}}>
        <StateSelect name="state" label="State" autoComplete="off" />
      </Form>,
    )
    const hidden = document.querySelector('input[name="state"]')!
    expect(hidden).toHaveAttribute('autoComplete', 'off')
  })

  it('under <Form assisted> emits autoComplete="off" instead of the address-level1 default (#65)', () => {
    render(
      <Form schema={schema} defaultValues={{}} onSubmit={() => {}} assisted>
        <StateSelect name="state" label="State" />
      </Form>,
    )
    const hidden = document.querySelector('input[name="state"]') as HTMLInputElement
    expect(hidden).toHaveAttribute('autoComplete', 'off')
  })

  it('a consumer autoComplete still wins under assisted', () => {
    render(
      <Form schema={schema} defaultValues={{}} onSubmit={() => {}} assisted>
        <StateSelect name="state" label="State" autoComplete="address-level1" />
      </Form>,
    )
    const hidden = document.querySelector('input[name="state"]') as HTMLInputElement
    expect(hidden).toHaveAttribute('autoComplete', 'address-level1')
  })

  it('includes a territory option when territories is set', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={{}} onSubmit={() => {}}>
        <StateSelect name="state" label="State" territories />
      </Form>,
    )
    await user.click(combobox())
    expect(await screen.findByRole('option', { name: 'Puerto Rico' })).toBeInTheDocument()
  })

  it('US_STATES has 51 entries and US_TERRITORIES has 5', () => {
    expect(US_STATES).toHaveLength(51)
    expect(US_TERRITORIES).toHaveLength(5)
  })

  it('shows the required rule message when required and nothing is chosen', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={{}} onSubmit={() => {}}>
        <StateSelect name="state" label="State" required />
        <button type="submit">Go</button>
      </Form>,
    )
    expect(combobox()).toBeRequired()
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByText('State is required.')).toBeInTheDocument()
  })
})
