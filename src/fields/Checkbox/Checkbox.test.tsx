import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { z } from 'zod'
import { Form } from '../../Form'
import { Checkbox } from './Checkbox'
import { describeFieldContract } from '../../test/describeFieldContract'
import { expectTargetSize } from '../../test/targetSize'

const schema = z.object({
  tos: z.boolean().refine(Boolean, { error: 'You must accept the terms' }),
})

describeFieldContract({
  componentName: 'Checkbox',
  label: 'Accept terms',
  schema,
  defaultValues: { tos: false },
  render: (props) => <Checkbox name="tos" label="Accept terms" {...props} />,
  getControl: () => screen.getByRole('checkbox', { name: 'Accept terms' }),
  interact: (user) => user.click(screen.getByRole('checkbox', { name: 'Accept terms' })),
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

  it('Form requiredIndicator="optional": required stays required with no asterisk', () => {
    const { container } = render(
      <Form
        schema={schema}
        defaultValues={{ tos: false }}
        onSubmit={() => {}}
        requiredIndicator="optional"
      >
        <Checkbox name="tos" label="Accept terms" required />
      </Form>,
    )
    expect(screen.getByRole('checkbox', { name: 'Accept terms' })).toBeRequired()
    expect(container.querySelector('[class*="asterisk"]')).toBeNull()
  })

  it('Form requiredIndicator="optional": not-required gets the optional suffix on the label', () => {
    render(
      <Form
        schema={schema}
        defaultValues={{ tos: false }}
        onSubmit={() => {}}
        requiredIndicator="optional"
      >
        <Checkbox name="tos" label="Accept terms" />
      </Form>,
    )
    expect(screen.getByRole('checkbox', { name: 'Accept terms (optional)' })).toBeInTheDocument()
  })

  it.each(['medium', 'small'] as const)('%s: meets 24×24 target size', (size) => {
    render(
      <Form schema={schema} defaultValues={{ tos: false }} onSubmit={() => {}}>
        <Checkbox name="tos" label="Accept terms" size={size} />
      </Form>,
    )
    expectTargetSize(screen.getByRole('checkbox', { name: 'Accept terms' }))
  })
})
