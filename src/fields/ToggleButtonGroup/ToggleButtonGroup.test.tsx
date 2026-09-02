import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { z } from 'zod'
import { Form } from '../../Form'
import { ToggleButtonGroup } from './ToggleButtonGroup'
import { describeFieldContract } from '../../test/describeFieldContract'

const schema = z.object({ align: z.string().nullable() })
const multiSchema = z.object({ format: z.array(z.number()) })

const aligns = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right', disabled: true },
] as const
const formats = [
  { value: 1, label: 'Bold' },
  { value: 2, label: 'Italic' },
] as const

describeFieldContract({
  componentName: 'ToggleButtonGroup',
  label: 'Align',
  schema,
  defaultValues: { align: null },
  render: (props) => (
    <ToggleButtonGroup name="align" label="Align" options={aligns} exclusive {...props} />
  ),
  // The enclosing <fieldset> also matches role "group" named "Align" (native
  // legend association), so disambiguate to the inner MUI group, the element
  // that actually carries aria-describedby/aria-invalid.
  getControl: () =>
    screen.getAllByRole('group', { name: 'Align' }).find((el) => el.tagName !== 'FIELDSET')!,
  expectDisabled: () => expect(screen.getByRole('button', { name: 'Left' })).toBeDisabled(),
  interact: (user) => user.click(screen.getByRole('button', { name: 'Center' })),
})

describe('ToggleButtonGroup', () => {
  it('exclusive: submits one typed value, or null when deselected', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <Form schema={schema} defaultValues={{ align: null }} onSubmit={onSubmit}>
        <ToggleButtonGroup name="align" label="Align" options={aligns} exclusive />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.click(screen.getByRole('button', { name: 'Center' }))
    expect(screen.getByRole('button', { name: 'Center' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenLastCalledWith({ align: 'center' }, expect.anything())
    await user.click(screen.getByRole('button', { name: 'Center' }))
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenLastCalledWith({ align: null }, expect.anything())
  })

  it('multiple: submits an array of typed values', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <Form schema={multiSchema} defaultValues={{ format: [1] }} onSubmit={onSubmit}>
        <ToggleButtonGroup name="format" label="Format" options={formats} />
        <button type="submit">Go</button>
      </Form>,
    )
    expect(screen.getByRole('button', { name: 'Bold' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'Italic' }))
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ format: [1, 2] }, expect.anything())
  })

  it('required fails on an empty array and focuses the first button', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={multiSchema} defaultValues={{ format: [] }} onSubmit={() => {}}>
        <ToggleButtonGroup name="format" label="Format" options={formats} required />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByText('Format is required.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Bold' })).toHaveFocus()
  })

  it('disables a disabled option only', () => {
    render(
      <Form schema={schema} defaultValues={{ align: null }} onSubmit={() => {}}>
        <ToggleButtonGroup name="align" label="Align" options={aligns} exclusive />
      </Form>,
    )
    expect(screen.getByRole('button', { name: 'Right' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Left' })).toBeEnabled()
  })

  it('calls a consumer onChange with the value after updating the form', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <Form schema={schema} defaultValues={{ align: null }} onSubmit={() => {}}>
        <ToggleButtonGroup
          name="align"
          label="Align"
          options={aligns}
          exclusive
          onChange={onChange}
        />
      </Form>,
    )
    await user.click(screen.getByRole('button', { name: 'Left' }))
    expect(onChange).toHaveBeenCalledWith(expect.anything(), 'left')
  })
})
