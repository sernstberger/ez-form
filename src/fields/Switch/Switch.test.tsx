import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { z } from 'zod'
import { Form } from '../../Form'
import { Switch } from './Switch'
import { expectNoA11yViolations } from '../../test/axe'

const schema = z.object({ darkMode: z.boolean() })

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

  it('calls a consumer onChange with the new checked state after updating the form', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <Form schema={schema} defaultValues={{ darkMode: false }} onSubmit={() => {}}>
        <Switch name="darkMode" label="Dark mode" onChange={onChange} />
      </Form>,
    )
    await user.click(screen.getByRole('switch', { name: 'Dark mode' }))
    expect(onChange).toHaveBeenCalledWith(expect.anything(), true)
    expect(screen.getByRole('switch', { name: 'Dark mode' })).toBeChecked()
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

  it('has no accessibility violations', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <Form schema={schema} defaultValues={{ darkMode: false }} onSubmit={() => {}}>
        <Switch name="darkMode" label="Dark mode" helperText="Easier on the eyes" required />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByText('Dark mode is required.')).toBeInTheDocument()
    await expectNoA11yViolations(container)
  })

  it('throws outside <Form>', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Switch name="x" label="x" />)).toThrow(
      'ez-form: <Switch> must be rendered inside <Form>',
    )
  })
})
