import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { z } from 'zod'
import { Form } from '../../Form'
import { Checkbox } from './Checkbox'
import { expectNoA11yViolations } from '../../test/axe'

const schema = z.object({
  tos: z.boolean().refine(Boolean, { error: 'You must accept the terms' }),
})

describe('Checkbox', () => {
  it('toggles and submits a boolean', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <Form schema={schema} defaultValues={{ tos: false }} onSubmit={onSubmit}>
        <Checkbox name="tos" label="Accept terms" />
        <button type="submit">Go</button>
      </Form>,
    )
    const box = screen.getByRole('checkbox', { name: 'Accept terms' })
    expect(box).not.toBeChecked()
    await user.click(box)
    expect(box).toBeChecked()
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ tos: true }, expect.anything())
  })

  it('shows the zod message beneath the control', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={{ tos: false }} onSubmit={() => {}}>
        <Checkbox name="tos" label="Accept terms" helperText="Required to continue" />
        <button type="submit">Go</button>
      </Form>,
    )
    expect(screen.getByText('Required to continue')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByText('You must accept the terms')).toBeInTheDocument()
    expect(screen.queryByText('Required to continue')).not.toBeInTheDocument()
  })

  it('associates the message with the input for assistive tech', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={{ tos: false }} onSubmit={() => {}}>
        <Checkbox name="tos" label="Accept terms" />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.click(screen.getByRole('button', { name: 'Go' }))
    const box = await screen.findByRole('checkbox', { name: 'Accept terms' })
    expect(box).toHaveAttribute('aria-invalid', 'true')
    expect(box).toHaveAccessibleDescription('You must accept the terms')
  })

  it('marks the control required and reports the rule message instead of the zod one', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={{ tos: false }} onSubmit={() => {}}>
        <Checkbox name="tos" label="Accept terms" required />
        <button type="submit">Go</button>
      </Form>,
    )
    expect(screen.getByRole('checkbox', { name: 'Accept terms' })).toBeRequired()
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByText('Accept terms is required.')).toBeInTheDocument()
    expect(screen.queryByText('You must accept the terms')).not.toBeInTheDocument()
  })

  it('calls a consumer onChange with the new checked state after updating the form', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <Form schema={schema} defaultValues={{ tos: false }} onSubmit={() => {}}>
        <Checkbox name="tos" label="Accept terms" onChange={onChange} />
      </Form>,
    )
    await user.click(screen.getByRole('checkbox', { name: 'Accept terms' }))
    expect(onChange).toHaveBeenCalledWith(expect.anything(), true)
    expect(screen.getByRole('checkbox', { name: 'Accept terms' })).toBeChecked()
  })

  it('runs a consumer validate rule when submitted unchecked', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={{ tos: false }} onSubmit={() => {}}>
        <Checkbox name="tos" label="Accept terms" validate={(v) => v || 'You must opt in'} />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByText('You must opt in')).toBeInTheDocument()
    expect(screen.queryByText('You must accept the terms')).not.toBeInTheDocument()
  })

  it('merges consumer slotProps.input with the a11y wiring', () => {
    render(
      <Form schema={schema} defaultValues={{ tos: false }} onSubmit={() => {}}>
        <Checkbox
          name="tos"
          label="Accept terms"
          helperText="Required to continue"
          slotProps={{ input: { title: 'Tick to continue' } }}
        />
      </Form>,
    )
    const box = screen.getByRole('checkbox', { name: 'Accept terms' })
    expect(box).toHaveAttribute('title', 'Tick to continue')
    expect(box).toHaveAccessibleDescription('Required to continue')
  })

  it('has no accessibility violations', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <Form schema={schema} defaultValues={{ tos: false }} onSubmit={() => {}}>
        <Checkbox name="tos" label="Accept terms" helperText="Required to continue" required />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByText('Accept terms is required.')).toBeInTheDocument()
    await expectNoA11yViolations(container)
  })

  it('throws outside <Form>', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Checkbox name="x" label="x" />)).toThrow(
      'ez-form: <Checkbox> must be rendered inside <Form>',
    )
  })
})
