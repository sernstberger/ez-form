import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { z } from 'zod'
import { Form } from '../../Form'
import { NumberField } from './NumberField'
import { describeFieldContract } from '../../test/describeFieldContract'

const schema = z.object({ age: z.number({ error: 'Enter your age' }) })
const input = () => screen.getByRole('textbox', { name: 'Age' })

describeFieldContract({
  componentName: 'NumberField',
  label: 'Age',
  schema,
  defaultValues: {},
  render: ({ onChange, ...props }) => (
    <NumberField name="age" label="Age" onValueChange={onChange} {...props} />
  ),
  getControl: input,
  interact: (user) => user.type(input(), '4'),
})

describe('NumberField', () => {
  it('submits a number for typed digits', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <Form schema={schema} defaultValues={{}} onSubmit={onSubmit}>
        <NumberField name="age" label="Age" />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.type(input(), '42')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ age: 42 }, expect.anything())
  })

  it('submits null when cleared', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    const nullable = z.object({ age: z.number().nullable() })
    render(
      <Form schema={nullable} defaultValues={{ age: 5 }} onSubmit={onSubmit}>
        <NumberField name="age" label="Age" />
        <button type="submit">Go</button>
      </Form>,
    )
    expect(input()).toHaveValue('5')
    await user.clear(input())
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ age: null }, expect.anything())
  })

  it('shows the zod message when empty', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={{}} onSubmit={() => {}}>
        <NumberField name="age" label="Age" />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByText('Enter your age')).toBeInTheDocument()
  })

  it('shows the min rule message for a value below the bound', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={{}} onSubmit={() => {}}>
        <NumberField name="age" label="Age" min={18} />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.type(input(), '17')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByText('Age must be at least 18.')).toBeInTheDocument()
  })

  it('steps with the increment button and the arrow keys', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={{ age: 5 }} onSubmit={() => {}}>
        <NumberField name="age" label="Age" />
      </Form>,
    )
    await user.click(screen.getByRole('button', { name: 'Increase' }))
    expect(input()).toHaveValue('6')
    await user.click(input())
    await user.keyboard('{ArrowDown}{ArrowDown}')
    expect(input()).toHaveValue('4')
  })

  it('stops stepping at max but still validates typed input against it', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={{ age: 10 }} onSubmit={() => {}}>
        <NumberField name="age" label="Age" max={10} />
        <button type="submit">Go</button>
      </Form>,
    )
    // Base UI disables the stepper at the bound, so a click cannot move past it.
    expect(screen.getByRole('button', { name: 'Increase' })).toBeDisabled()
    expect(input()).toHaveValue('10')
    await user.clear(input())
    await user.type(input(), '11')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByText('Age must be at most 10.')).toBeInTheDocument()
  })

  it('marks the input required and focuses it after a failed submit', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={{}} onSubmit={() => {}}>
        <NumberField name="age" label="Age" required />
        <button type="submit">Go</button>
      </Form>,
    )
    expect(input()).toBeRequired()
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByText('Age is required.')).toBeInTheDocument()
    expect(input()).toHaveFocus()
  })

  it('groups digits while typing and submits the number', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <Form schema={schema} defaultValues={{}} onSubmit={onSubmit}>
        <NumberField name="age" label="Age" />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.type(input(), '1234567')
    expect(input()).toHaveValue('1,234,567')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ age: 1234567 }, expect.anything())
  })

  it('leaves the fraction alone while grouping the integer digits', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <Form schema={schema} defaultValues={{}} onSubmit={onSubmit}>
        <NumberField name="age" label="Age" />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.type(input(), '1234.5')
    expect(input()).toHaveValue('1,234.5')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ age: 1234.5 }, expect.anything())
  })

  it('does not group when format disables grouping', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={{}} onSubmit={() => {}}>
        <NumberField name="age" label="Age" format={{ useGrouping: false }} />
      </Form>,
    )
    await user.type(input(), '1000')
    expect(input()).toHaveValue('1000')
  })

  it('backspaces the last digit of a grouped value', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={{}} onSubmit={() => {}}>
        <NumberField name="age" label="Age" />
      </Form>,
    )
    await user.type(input(), '1000')
    expect(input()).toHaveValue('1,000')
    await user.keyboard('{Backspace}')
    expect(input()).toHaveValue('100')
  })

  it('calls a consumer onValueChange after updating the form', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(
      <Form schema={schema} defaultValues={{}} onSubmit={() => {}}>
        <NumberField name="age" label="Age" onValueChange={onValueChange} />
      </Form>,
    )
    await user.type(input(), '7')
    expect(onValueChange).toHaveBeenCalledWith(7, expect.anything())
  })
})
