import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { z } from 'zod'
import { Form } from '../../Form'
import { Switch } from './Switch'
import { describeFieldContract } from '../../test/describeFieldContract'

const schema = z.object({ darkMode: z.boolean() })

describeFieldContract({
  componentName: 'Switch',
  label: 'Dark mode',
  schema,
  defaultValues: { darkMode: false },
  render: (props) => <Switch name="darkMode" label="Dark mode" {...props} />,
  getControl: () => screen.getByRole('switch', { name: 'Dark mode' }),
  interact: (user) => user.click(screen.getByRole('switch', { name: 'Dark mode' })),
})

describe('Switch', () => {
  it('toggles and submits a boolean', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <Form schema={schema} defaultValues={{ darkMode: false }} onSubmit={onSubmit}>
        <Switch name="darkMode" label="Dark mode" />
        <button type="submit">Go</button>
      </Form>,
    )
    const sw = screen.getByRole('switch', { name: 'Dark mode' })
    expect(sw).not.toBeChecked()
    await user.click(sw)
    expect(sw).toBeChecked()
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ darkMode: true }, expect.anything())
  })

  it('shows consumer helperText and associates it with the input', () => {
    render(
      <Form schema={schema} defaultValues={{ darkMode: false }} onSubmit={() => {}}>
        <Switch name="darkMode" label="Dark mode" helperText="Easier on the eyes" />
      </Form>,
    )
    expect(screen.getByText('Easier on the eyes')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Dark mode' })).toHaveAccessibleDescription(
      'Easier on the eyes',
    )
  })

  it('marks the control required', () => {
    render(
      <Form schema={schema} defaultValues={{ darkMode: false }} onSubmit={() => {}}>
        <Switch name="darkMode" label="Dark mode" required />
      </Form>,
    )
    expect(screen.getByRole('switch', { name: 'Dark mode' })).toBeRequired()
  })

  it('runs a consumer validate rule when submitted off', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={{ darkMode: false }} onSubmit={() => {}}>
        <Switch name="darkMode" label="Dark mode" validate={(v) => v || 'You must opt in'} />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByText('You must opt in')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Dark mode' })).toHaveAttribute(
      'aria-invalid',
      'true',
    )
  })

  it('merges consumer slotProps.input with the a11y wiring', () => {
    render(
      <Form schema={schema} defaultValues={{ darkMode: false }} onSubmit={() => {}}>
        <Switch
          name="darkMode"
          label="Dark mode"
          helperText="Easier on the eyes"
          slotProps={{ input: { title: 'Flip me' } }}
        />
      </Form>,
    )
    const sw = screen.getByRole('switch', { name: 'Dark mode' })
    expect(sw).toHaveAttribute('title', 'Flip me')
    expect(sw).toHaveAccessibleDescription('Easier on the eyes')
  })

  it('Form requiredIndicator="optional": required stays required with no asterisk', () => {
    const { container } = render(
      <Form
        schema={schema}
        defaultValues={{ darkMode: false }}
        onSubmit={() => {}}
        requiredIndicator="optional"
      >
        <Switch name="darkMode" label="Dark mode" required />
      </Form>,
    )
    expect(screen.getByRole('switch', { name: 'Dark mode' })).toBeRequired()
    expect(container.querySelector('[class*="asterisk"]')).toBeNull()
  })

  it('Form requiredIndicator="optional": not-required gets the optional suffix in its label', () => {
    render(
      <Form
        schema={schema}
        defaultValues={{ darkMode: false }}
        onSubmit={() => {}}
        requiredIndicator="optional"
      >
        <Switch name="darkMode" label="Dark mode" />
      </Form>,
    )
    expect(screen.getByRole('switch', { name: 'Dark mode (optional)' })).toBeInTheDocument()
  })
})
