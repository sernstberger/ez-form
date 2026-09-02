import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { z } from 'zod'
import { Form } from '../../Form'
import { RadioGroup } from './RadioGroup'
import { describeFieldContract } from '../../test/describeFieldContract'

const schema = z.object({ plan: z.number({ error: 'Pick a plan' }) })

const plans = [
  { value: 1, label: 'Basic' },
  { value: 2, label: 'Pro' },
  { value: 3, label: 'Enterprise', disabled: true },
] as const

describeFieldContract({
  componentName: 'RadioGroup',
  label: 'Plan',
  schema,
  defaultValues: {},
  render: (props) => <RadioGroup name="plan" label="Plan" options={plans} {...props} />,
  getControl: () => screen.getByRole('radiogroup', { name: 'Plan' }),
  expectDisabled: () => expect(screen.getByRole('radio', { name: 'Basic' })).toBeDisabled(),
  interact: (user) => user.click(screen.getByRole('radio', { name: 'Pro' })),
})

describe('RadioGroup', () => {
  it('submits the chosen option value with its original type', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <Form schema={schema} defaultValues={{}} onSubmit={onSubmit}>
        <RadioGroup name="plan" label="Plan" options={plans} />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.click(screen.getByRole('radio', { name: 'Pro' }))
    expect(screen.getByRole('radio', { name: 'Pro' })).toBeChecked()
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ plan: 2 }, expect.anything())
  })

  it('reflects a default value', () => {
    render(
      <Form schema={schema} defaultValues={{ plan: 1 }} onSubmit={() => {}}>
        <RadioGroup name="plan" label="Plan" options={plans} />
      </Form>,
    )
    expect(screen.getByRole('radio', { name: 'Basic' })).toBeChecked()
  })

  it('shows the zod message when nothing is chosen', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={{}} onSubmit={() => {}}>
        <RadioGroup name="plan" label="Plan" options={plans} />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByText('Pick a plan')).toBeInTheDocument()
  })

  it('marks the group required and focuses the first radio after a failed submit', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={{}} onSubmit={() => {}}>
        <RadioGroup name="plan" label="Plan" options={plans} required />
        <button type="submit">Go</button>
      </Form>,
    )
    expect(screen.getByRole('radiogroup', { name: 'Plan' })).toBeRequired()
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByText('Plan is required.')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Basic' })).toHaveFocus()
  })

  it('disables a disabled option only', () => {
    render(
      <Form schema={schema} defaultValues={{}} onSubmit={() => {}}>
        <RadioGroup name="plan" label="Plan" options={plans} />
      </Form>,
    )
    expect(screen.getByRole('radio', { name: 'Enterprise' })).toBeDisabled()
    expect(screen.getByRole('radio', { name: 'Basic' })).toBeEnabled()
  })

  it('calls a consumer onChange with the string value after updating the form', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <Form schema={schema} defaultValues={{}} onSubmit={() => {}}>
        <RadioGroup name="plan" label="Plan" options={plans} onChange={onChange} />
      </Form>,
    )
    await user.click(screen.getByRole('radio', { name: 'Pro' }))
    expect(onChange).toHaveBeenCalledWith(expect.anything(), '2')
    expect(screen.getByRole('radio', { name: 'Pro' })).toBeChecked()
  })

  it('lays the radios out in a row when asked', () => {
    render(
      <Form schema={schema} defaultValues={{}} onSubmit={() => {}}>
        <RadioGroup name="plan" label="Plan" options={plans} row />
      </Form>,
    )
    expect(screen.getByRole('radiogroup', { name: 'Plan' })).toHaveClass('MuiFormGroup-row')
  })

  it('Form requiredIndicator="optional": required keeps aria-required with no legend asterisk', () => {
    const { container } = render(
      <Form schema={schema} defaultValues={{}} onSubmit={() => {}} requiredIndicator="optional">
        <RadioGroup name="plan" label="Plan" options={plans} required />
      </Form>,
    )
    expect(screen.getByRole('radiogroup', { name: 'Plan' })).toHaveAttribute(
      'aria-required',
      'true',
    )
    expect(container.querySelector('[class*="asterisk"]')).toBeNull()
  })

  it('Form requiredIndicator="optional": not-required gets the optional suffix on the legend', () => {
    render(
      <Form schema={schema} defaultValues={{}} onSubmit={() => {}} requiredIndicator="optional">
        <RadioGroup name="plan" label="Plan" options={plans} />
      </Form>,
    )
    expect(screen.getByRole('radiogroup', { name: 'Plan (optional)' })).toBeInTheDocument()
  })
})
