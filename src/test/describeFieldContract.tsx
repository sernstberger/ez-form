import type { ReactElement } from 'react'
import { render, screen } from '@testing-library/react'
import { expectConsole } from './expectConsole'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import type { DefaultValues, FieldValues } from 'react-hook-form'
import type { z } from 'zod'
import { Form } from '../Form'
import { expectNoA11yViolations } from './axe'

/**
 * The lines a field may opt out of, one key per `it` the contract adds beyond
 * the original five. The union exists so a typo in an `exempt` key is a
 * compile error rather than an opt-out that silently never applies.
 */
export type ContractLine = 'ariaLabelNames'

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
  /**
   * Per-line opt-outs, keyed by contract line. The value is the **reason**, not
   * `true`: a line a field cannot satisfy has to say why, in the field's own test
   * file where the next person reading that field sees it, and the reason is
   * expected to name an issue number. A line is never weakened for everyone
   * because one field fails it.
   *
   * `requiredNotAnnounced` above predates this and stays as its own flag: it is
   * already cited by six fields and folding it in would be churn with no gain.
   */
  exempt?: Partial<Record<ContractLine, string>>
  /**
   * The role the field's control exposes, for the lines that must query it by
   * accessible name rather than by the label the rest of the contract uses.
   * Omit it only alongside `renderNamed`/`findNamed` overrides.
   */
  role?: string
  /**
   * Renders the field with **no visible label**, named only by `aria-label` —
   * the exact shape #99 and #100 broke, and the one the dev-mode warning tells
   * consumers to reach for.
   *
   * It cannot default to `c.render({ 'aria-label': name })`, and the reason is
   * the whole point of the line: with a visible label present, MUI names the
   * control through `aria-labelledby` pointing at that label, and
   * `aria-labelledby` **outranks** `aria-label` in the accname algorithm. The
   * query would then be answered by the visible label on a control the
   * `aria-label` never reached — a green test over the bug. Only a label-less
   * render leaves `aria-label` as the sole possible name, so each field states
   * its own here.
   */
  renderNamed: (name: string) => ReactElement
  /**
   * Finds the ARIA-named control for row 1. Defaults to
   * `getByRole(c.role, { name })`; a field whose control has no role at all
   * (`type="password"`) reads the name through a different query.
   */
  findNamed?: (name: string) => HTMLElement
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
  const findNamed =
    c.findNamed ??
    ((name: string) => {
      if (c.role === undefined)
        throw new Error(
          `describeFieldContract(${c.componentName}): row 1 needs \`role\` (the role the ` +
            'control exposes) or a `findNamed` of its own, unless it opts out via ' +
            '`exempt.ariaLabelNames`.',
        )
      return screen.getByRole(c.role, { name })
    })
  const inForm = (child: ReactElement, disabled = false) => (
    <Form schema={c.schema} defaultValues={c.defaultValues} onSubmit={() => {}} disabled={disabled}>
      {child}
      <button type="submit">Go</button>
    </Form>
  )

  describe(`${c.componentName} field contract`, () => {
    it('throws outside <Form>', () => {
      // React logs every error it caught while rendering before rethrowing it. The throw
      // below is the assertion; these allow the noise that necessarily comes with it.
      expectConsole('error', `must be rendered inside <Form>`)
      expectConsole('error', 'The above error occurred')
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

    /*
     * Row 1 of #102. The P1 in #99/#100 was 15 of 17 fields with no accessible name
     * from `aria-label`, passing 1564 tests, because no contract line ever asked.
     * `getByRole(role, { name })` is the assertion — never `toHaveAttribute`, which a
     * named wrapper around an anonymous control satisfies and which is the bug itself.
     */
    const namedExemption = c.exempt?.ariaLabelNames
    it.skipIf(namedExemption)('is named by `aria-label` on the control itself', () => {
      render(inForm(c.renderNamed('Contract ARIA name')))
      expect(findNamed('Contract ARIA name')).toBeInTheDocument()
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
