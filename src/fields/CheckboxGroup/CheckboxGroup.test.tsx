import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { z } from 'zod'
import { Form } from '../../Form'
import { CheckboxGroup } from './CheckboxGroup'
import { describeFieldContract } from '../../test/describeFieldContract'
import { getInnerGroup } from '../../test/getInnerGroup'
import { expectTargetSize } from '../../test/targetSize'

const schema = z.object({ toppings: z.array(z.number()) })
const toppings = [
  { value: 1, label: 'Cheese' },
  { value: 2, label: 'Ham' },
  { value: 3, label: 'Pineapple', disabled: true },
] as const

describeFieldContract({
  componentName: 'CheckboxGroup',
  label: 'Toppings',
  schema,
  defaultValues: { toppings: [] },
  render: (props) => (
    <CheckboxGroup name="toppings" label="Toppings" options={toppings} {...props} />
  ),
  // The inner MUI FormGroup, not the enclosing <fieldset>: that is the element
  // carrying aria-describedby/aria-invalid.
  getControl: () => getInnerGroup('Toppings'),
  requiredNotAnnounced: true,
  expectDisabled: () => expect(screen.getByRole('checkbox', { name: 'Cheese' })).toBeDisabled(),
  interact: (user) => user.click(screen.getByRole('checkbox', { name: 'Ham' })),
})

describe('CheckboxGroup', () => {
  it('adds and removes typed values, keeping options order', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <Form schema={schema} defaultValues={{ toppings: [] }} onSubmit={onSubmit}>
        <CheckboxGroup name="toppings" label="Toppings" options={toppings} />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.click(screen.getByRole('checkbox', { name: 'Ham' }))
    await user.click(screen.getByRole('checkbox', { name: 'Cheese' }))
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenLastCalledWith({ toppings: [1, 2] }, expect.anything())
    await user.click(screen.getByRole('checkbox', { name: 'Ham' }))
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenLastCalledWith({ toppings: [1] }, expect.anything())
  })

  it('reflects default values', () => {
    render(
      <Form schema={schema} defaultValues={{ toppings: [2] }} onSubmit={() => {}}>
        <CheckboxGroup name="toppings" label="Toppings" options={toppings} />
      </Form>,
    )
    expect(screen.getByRole('checkbox', { name: 'Ham' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Cheese' })).not.toBeChecked()
  })

  it('required fails on an empty array and focuses the first checkbox', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={{ toppings: [] }} onSubmit={() => {}}>
        <CheckboxGroup name="toppings" label="Toppings" options={toppings} required />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByText('Toppings is required.')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Cheese' })).toHaveFocus()
  })

  it('disables a disabled option only', () => {
    render(
      <Form schema={schema} defaultValues={{ toppings: [] }} onSubmit={() => {}}>
        <CheckboxGroup name="toppings" label="Toppings" options={toppings} />
      </Form>,
    )
    expect(screen.getByRole('checkbox', { name: 'Pineapple' })).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: 'Cheese' })).toBeEnabled()
  })

  it('calls a consumer onChange with the new array after updating the form', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <Form schema={schema} defaultValues={{ toppings: [1] }} onSubmit={() => {}}>
        <CheckboxGroup name="toppings" label="Toppings" options={toppings} onChange={onChange} />
      </Form>,
    )
    await user.click(screen.getByRole('checkbox', { name: 'Ham' }))
    expect(onChange).toHaveBeenCalledWith(expect.anything(), [1, 2])
  })

  it('lays the checkboxes out in a row when asked', () => {
    render(
      <Form schema={schema} defaultValues={{ toppings: [] }} onSubmit={() => {}}>
        <CheckboxGroup name="toppings" label="Toppings" options={toppings} row />
      </Form>,
    )
    expect(getInnerGroup('Toppings')).toHaveClass('MuiFormGroup-row')
  })

  it('Form requiredIndicator="optional": required stays required with no legend asterisk', () => {
    const { container } = render(
      <Form
        schema={schema}
        defaultValues={{ toppings: [] }}
        onSubmit={() => {}}
        requiredIndicator="optional"
      >
        <CheckboxGroup name="toppings" label="Toppings" options={toppings} required />
      </Form>,
    )
    expect(container.querySelector('[class*="asterisk"]')).toBeNull()
  })

  it('Form requiredIndicator="optional": not-required gets the optional suffix on the legend', () => {
    render(
      <Form
        schema={schema}
        defaultValues={{ toppings: [] }}
        onSubmit={() => {}}
        requiredIndicator="optional"
      >
        <CheckboxGroup name="toppings" label="Toppings" options={toppings} />
      </Form>,
    )
    expect(getInnerGroup('Toppings (optional)')).toBeInTheDocument()
  })

  // No `size` prop here (unlike `Checkbox`), so the default is the only size to pin.
  it('every box meets 24×24 target size', () => {
    render(
      <Form schema={schema} defaultValues={{ toppings: [] }} onSubmit={() => {}}>
        <CheckboxGroup name="toppings" label="Toppings" options={toppings} />
      </Form>,
    )
    for (const box of screen.getAllByRole('checkbox')) expectTargetSize(box)
  })
})
