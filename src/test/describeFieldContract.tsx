import type { ReactElement } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import type { DefaultValues, FieldValues } from 'react-hook-form'
import type { z } from 'zod'
import { Form } from '../Form'
import { expectNoA11yViolations } from './axe'

export interface FieldContractProps {
  disabled?: boolean
  helperText?: string
  required?: boolean
  /** Slider's failing rule for `errorProps` (it has no `required`). */
  min?: number
  max?: number
  /** Args vary per field (event, value, reason, …); the contract only ever counts calls. */
  onChange?: (...args: unknown[]) => void
}

export interface FieldContract<TIn extends FieldValues, TOut> {
  /** Component name as it appears in the "must be rendered inside <Form>" error. */
  componentName: string
  /** The label the render uses; the required message is `${label} is required.` */
  label: string
  schema: z.ZodType<TOut, TIn>
  /** Values under which a submit with `required` fails (empty / unchecked). */
  defaultValues: DefaultValues<TIn>
  /**
   * Props that make a submit fail, for the error/a11y cases. Defaults to
   * `{ required: true }`; a field without `required` (Slider) supplies another
   * failing rule, plus the `errorMessage` it produces.
   */
  errorProps?: FieldContractProps
  /** The message `errorProps` produces. Defaults to `` `${label} is required.` ``. */
  errorMessage?: string
  render: (props: FieldContractProps) => ReactElement
  /** The element that carries `aria-describedby` / `aria-invalid` (input, combobox, radiogroup). */
  getControl: () => HTMLElement
  /** Defaults to `toBeDisabled()`. Select's combobox is `aria-disabled`; RadioGroup checks a radio. */
  expectDisabled?: (control: HTMLElement) => void
  /**
   * Set when the control cannot announce `required`: ARIA has no
   * `aria-required` for `role="group"` (CheckboxGroup, ToggleButtonGroup, and
   * the pickers' MUI X input group), so asserting it there would demand an
   * attribute axe rejects. The legend asterisk and the error carry it instead.
   */
  requiredNotAnnounced?: boolean
  /** Changes the value exactly once (one consumer `onChange` call). */
  interact: (user: UserEvent) => Promise<void>
}

/**
 * The behavior every ez-form field shares. Each component's test file calls
 * this once and keeps only its component-specific cases.
 */
export function describeFieldContract<TIn extends FieldValues, TOut>(c: FieldContract<TIn, TOut>) {
  const expectDisabled = c.expectDisabled ?? ((control) => expect(control).toBeDisabled())
  const errorProps = c.errorProps ?? { required: true }
  const errorMessage = c.errorMessage ?? `${c.label} is required.`
  const inForm = (child: ReactElement, disabled = false) => (
    <Form schema={c.schema} defaultValues={c.defaultValues} onSubmit={() => {}} disabled={disabled}>
      {child}
      <button type="submit">Go</button>
    </Form>
  )

  describe(`${c.componentName} field contract`, () => {
    it('throws outside <Form>', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      expect(() => render(c.render({}))).toThrow(
        `ez-form: <${c.componentName}> must be rendered inside <Form>`,
      )
    })

    it('is disabled under <Form disabled>, even with disabled={false}', () => {
      render(inForm(c.render({ disabled: false }), true))
      expectDisabled(c.getControl())
    })

    it('calls a consumer onChange once per interaction', async () => {
      const user = userEvent.setup()
      const onChange = vi.fn()
      render(inForm(c.render({ onChange })))
      await c.interact(user)
      expect(onChange).toHaveBeenCalledTimes(1)
    })

    it('describes the control with helperText, then replaces it with an announced error', async () => {
      const user = userEvent.setup()
      render(inForm(c.render({ helperText: 'Some help', ...errorProps })))
      expect(c.getControl()).toHaveAccessibleDescription('Some help')
      // The control announces `required` to assistive tech, not only visually.
      if (c.errorProps === undefined && !c.requiredNotAnnounced)
        expect(c.getControl()).toBeRequired()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Go' }))
      expect(await screen.findByRole('alert')).toHaveTextContent(errorMessage)
      expect(c.getControl()).toHaveAccessibleDescription(errorMessage)
      expect(c.getControl()).toHaveAttribute('aria-invalid', 'true')
      expect(screen.queryByText('Some help')).not.toBeInTheDocument()
    })

    it('has no accessibility violations in the error state', async () => {
      const user = userEvent.setup()
      const { container } = render(inForm(c.render({ helperText: 'Some help', ...errorProps })))
      await user.click(screen.getByRole('button', { name: 'Go' }))
      await screen.findByRole('alert')
      await expectNoA11yViolations(container)
    })
  })
}
