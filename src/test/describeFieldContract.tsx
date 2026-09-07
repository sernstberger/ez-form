import type { ReactElement } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { expectConsole } from './expectConsole'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import type { DefaultValues, FieldValues } from 'react-hook-form'
import type { z } from 'zod'
import { createTheme, ThemeProvider } from '@mui/material/styles'
import { renderToString } from 'react-dom/server'
import { Form } from '../Form'
import { fieldLayoutClasses, type LabelPlacement } from '../fields/LabelPlacementContext'
import { expectNoA11yViolations } from './axe'

/**
 * The lines a field may opt out of, one key per `it` the contract adds beyond
 * the original five. The union exists so a typo in an `exempt` key is a
 * compile error rather than an opt-out that silently never applies.
 */
export type ContractLine =
  'ariaLabelNames' | 'consumerDescribedBy' | 'submitPayload' | 'quietInteraction' | 'ssr'

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
  /**
   * Renders the field with the consumer's own `aria-describedby` pointing at `id`,
   * plus this contract's `errorProps` so a failed submit produces an error. Like
   * `renderNamed`, it cannot be derived from `render`: the attribute has to reach
   * whichever prop or slot the field routes descriptions through, and for several
   * fields (`AddressField`'s parts, the pickers' `slotProps.textField`) that is not
   * a top-level prop at all.
   *
   * Omit it only alongside `exempt.consumerDescribedBy` — a field whose props admit
   * no `aria-describedby` has nothing for the line to preserve.
   */
  renderDescribed?: (id: string, props: FieldContractProps) => ReactElement
  /**
   * What `onSubmit` must receive after one `interact`, for row 3.
   *
   * "`onChange` was called" is not the same claim: a transform field can hand the
   * consumer one value and store another, and the payload is the one that reaches
   * the server. Asserted as a whole object so a field that writes a *sibling* key,
   * or writes nothing at all, fails rather than passing on a partial match.
   *
   * The values are unavoidably per-field — the contract's single `interact` types
   * one character, picks one option, drags one slider — so each field states what
   * that produces. A field whose one interaction cannot produce a submittable value
   * opts out with a reason instead.
   */
  expectSubmitted?: FieldValues
  /**
   * The interaction row 3 drives, when `interact` cannot be it.
   *
   * `interact` is constrained to change the value **exactly once**, so the
   * `onChange` line can count calls — for a text field that means typing a single
   * character, which some schemas (`TextField`'s `z.email()`) then reject, blocking
   * the submit that row 3 is about. Such a field supplies a fuller interaction here
   * instead; everything else leaves it out and row 3 reuses `interact`.
   */
  interactSubmittable?: (user: UserEvent) => Promise<void>
  /**
   * Row 6: a `theme.components.Ez<Name>.defaultProps` value must actually reach the
   * field. This is **opt-in rather than opt-out**, and deliberately so: a pure
   * pass-through field keeps MUI's own `Mui*` keys and registers no `Ez*` name of
   * its own (PHILOSOPHY, "A component ships when"), so there is nothing for the line
   * to assert. Absence of this key is the honest answer for those fields — an
   * `exempt` entry would claim a gap that does not exist.
   *
   * A field that *does* call `useDefaultProps({ name: 'Ez<Name>' })` states one
   * default here: which theme key to set, to what, and how to see it in the DOM.
   * Prefer a prop whose effect is visible without interaction, so the assertion is
   * about the default arriving rather than about the prop's own behaviour.
   */
  themeDefault?: {
    /** The `Ez<Name>` key, as registered in `src/theme/augmentation.ts`. */
    name: string
    /** The `defaultProps` object to put under it. */
    defaultProps: Record<string, unknown>
    /** Asserts the default arrived, against the rendered DOM. */
    expect: () => void
  }
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
  const inForm = (
    child: ReactElement,
    disabled = false,
    onSubmit: (values: TOut) => void = () => {},
    labelPlacement?: LabelPlacement,
  ) => (
    <Form
      schema={c.schema}
      defaultValues={c.defaultValues}
      onSubmit={onSubmit}
      disabled={disabled}
      labelPlacement={labelPlacement}
    >
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

    /*
     * Row 8 of #102, the family-wide half of #104. An accessible description is a
     * *list*: the consumer's own text and the error message are both meant to be
     * read, so the binding joins them rather than one replacing the other.
     *
     * Measured before the fix: every field except `TextField` dropped the consumer's
     * ids outright — not just after a failed submit, but from the first render, since
     * the attribute was overwritten wholesale with the helper-text id.
     */
    const describedExemption = c.exempt?.consumerDescribedBy
    it.skipIf(describedExemption)(
      'keeps a consumer aria-describedby, and adds the error to it',
      async () => {
        const user = userEvent.setup()
        const renderDescribed = c.renderDescribed
        if (!renderDescribed)
          throw new Error(
            `describeFieldContract(${c.componentName}): row 8 needs \`renderDescribed\`, ` +
              'or an `exempt.consumerDescribedBy` reason naming the issue.',
          )
        render(
          inForm(
            <>
              <span id="ez-contract-desc">Consumer description</span>
              {renderDescribed('ez-contract-desc', errorProps)}
            </>,
          ),
        )
        expect(c.getControl()).toHaveAccessibleDescription(/Consumer description/)
        await user.click(screen.getByRole('button', { name: 'Go' }))
        await screen.findByRole('alert')
        // Both, and in that order: the consumer wrote theirs first.
        expect(c.getControl()).toHaveAccessibleDescription(
          `Consumer description ${errorMessage}`.trim(),
        )
      },
    )

    /*
     * Row 3 of #102. The existing `onChange` line counts calls; this one follows the
     * value all the way to the payload, which is what a consumer's server sees. The
     * two differ for every field whose stored value and displayed value deliberately
     * diverge — `PhoneField` stores digits and shows `555-555-5555`, `PercentField`
     * under `scale="fraction"` stores `0.125` and shows `12.5%` — and a mangling
     * there is invisible to an `onChange` spy.
     */
    const payloadExemption = c.exempt?.submitPayload
    it.skipIf(payloadExemption)('round-trips the value into the submit payload', async () => {
      const user = userEvent.setup()
      const expected = c.expectSubmitted
      if (!expected)
        throw new Error(
          `describeFieldContract(${c.componentName}): row 3 needs \`expectSubmitted\` (the ` +
            'payload one `interact` produces), or an `exempt.submitPayload` reason.',
        )
      const onSubmit = vi.fn()
      render(inForm(c.render({}), false, onSubmit))
      await (c.interactSubmittable ?? c.interact)(user)
      await user.click(screen.getByRole('button', { name: 'Go' }))
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
      expect(onSubmit).toHaveBeenCalledWith(expected, expect.anything())
    })

    /*
     * Row 2 of #102. The console guard in `src/test/setup.ts` already fails any test
     * that logs unexpectedly; what was missing was a test that drives a field far
     * enough for it to have something to say. Every other line stops after one step,
     * so an `act()` warning from a cleanup, a controlled/uncontrolled flip on the
     * *second* change, or a devWarn that only fires once an error has rendered would
     * all go unseen in a green run.
     *
     * The cycle is the one a user actually performs: submit empty → error → fix →
     * resubmit → unmount (which the guard's own `afterEach` runs while still
     * watching, so effect cleanups are covered too).
     */
    const quietExemption = c.exempt?.quietInteraction
    it.skipIf(quietExemption)('logs nothing through a full interaction cycle', async () => {
      const user = userEvent.setup()
      render(inForm(c.render({ helperText: 'Some help', ...errorProps })))
      // Fail first: the error path is where a live region, a focus move and a
      // re-render all land at once.
      await user.click(screen.getByRole('button', { name: 'Go' }))
      await screen.findByRole('alert')
      await (c.interactSubmittable ?? c.interact)(user)
      await user.click(screen.getByRole('button', { name: 'Go' }))
      // No assertion on the outcome — a field whose `errorProps` still fail after
      // the fix is fine here. The subject is the console, and the guard's
      // `afterEach` is what fails the test; this only has to make the field do the
      // work. `getControl` last so the run cannot pass by rendering nothing.
      expect(c.getControl()).toBeInTheDocument()
    })

    /*
     * Row 7 of #102. A field that throws on the server takes the whole page with it,
     * and nothing else in the suite renders one without a DOM — jsdom is present for
     * every other line, so a `document` read during render, a `useLayoutEffect`
     * warning, or a hook that is not SSR-safe all pass unnoticed.
     *
     * `renderToString` is the assertion *and* the console check: React logs a hydration
     * or layout-effect complaint rather than throwing, so the guard in `setup.ts` is
     * what catches those, and the emitted markup being non-empty is what says the
     * field rendered at all rather than bailing to nothing.
     */
    const ssrExemption = c.exempt?.ssr
    it.skipIf(ssrExemption)('renders on the server without throwing or logging', () => {
      expect(renderToString(inForm(c.render({ helperText: 'Some help' })))).not.toBe('')
    })

    /*
     * Row 6 of #102. PHILOSOPHY rule 2 says a component's every default must be
     * reachable from `theme.components`, and `useDefaultProps` is the mechanism — but
     * nothing asserted that the wiring was actually connected. A field that reads
     * `inProps` and then destructures the *original* props object, or registers under
     * a name that does not match its `augmentation.ts` entry, would ship a default no
     * theme could override, which is the failure rule 2 exists to prevent.
     *
     * Opt-in by `themeDefault`: a pure pass-through field registers no `Ez*` key at
     * all and has nothing to assert here.
     */
    const themeDefault = c.themeDefault
    if (themeDefault) {
      it('takes a default from theme.components.Ez<Name>.defaultProps', () => {
        const theme = createTheme({
          components: { [themeDefault.name]: { defaultProps: themeDefault.defaultProps } },
        })
        render(<ThemeProvider theme={theme}>{inForm(c.render({}))}</ThemeProvider>)
        themeDefault.expect()
      })
    }

    /*
     * #9 / #66. Label placement is a layout axis: `stacked` un-floats the label and
     * `start` puts it in a grid column beside the control, both purely in CSS on the
     * one `FormControl` box every field's root already is. Nothing about the markup
     * moves — which is exactly the claim that needs a test, because the cheap wrong
     * implementation (re-rendering the label somewhere else per family) would break
     * the name/description wiring in seventeen different ways and axe would only
     * catch some of them.
     *
     * Run for every field rather than for three representatives: the whole design
     * rests on "every family funnels through the same box", and a field that quietly
     * does not is precisely what this has to find.
     */
    describe.each(['floating', 'stacked', 'start'] as const)(
      'under labelPlacement=%s',
      (placement) => {
        it('keeps the control named, described and marked required', async () => {
          const user = userEvent.setup()
          render(
            inForm(
              c.render({ helperText: 'Some help', ...errorProps }),
              false,
              () => {},
              placement,
            ),
          )
          // The name, computed by the accname algorithm on the control itself —
          // not `toHaveAttribute`, which a wrapper named around an anonymous control
          // satisfies and which is the bug #99/#100 were. `getControl` rather than
          // `getByRole(role, { name })`: a `labelAs="legend"` field's fieldset and its
          // inner `role="group"` share one name, so only the field knows which element
          // is the control (the same disambiguation `FieldFrame` already documents).
          expect(c.getControl()).toHaveAccessibleName(new RegExp(c.label))
          expect(c.getControl()).toHaveAccessibleDescription('Some help')
          if (c.errorProps === undefined && !c.requiredNotAnnounced)
            expect(c.getControl()).toBeRequired()
          // And the error still reaches `aria-describedby` and the live region.
          await user.click(screen.getByRole('button', { name: 'Go' }))
          expect(await screen.findByRole('alert')).toHaveTextContent(errorMessage)
          expect(c.getControl()).toHaveAccessibleDescription(errorMessage)
          expect(c.getControl()).toHaveAttribute('aria-invalid', 'true')
        })

        it('carries the placement classes on its FormControl root', () => {
          const { container } = render(inForm(c.render({}), false, () => {}, placement))
          const box = container.querySelector(`.${fieldLayoutClasses[placement]}`)
          expect(box).not.toBeNull()
          // The rules select `.MuiFormControl-root` descendants of the form; a field
          // whose class landed on some other element would be classed but unstyled.
          expect(box).toHaveClass('MuiFormControl-root')
          expect(box).toHaveClass(fieldLayoutClasses.root)
        })

        it('has no accessibility violations', async () => {
          const { container } = render(
            inForm(
              c.render({ helperText: 'Some help', ...errorProps }),
              false,
              () => {},
              placement,
            ),
          )
          await expectNoA11yViolations(container)
        })
      },
    )

    it('has no accessibility violations in the error state', async () => {
      const user = userEvent.setup()
      const { container } = render(inForm(c.render({ helperText: 'Some help', ...errorProps })))
      await user.click(screen.getByRole('button', { name: 'Go' }))
      await screen.findByRole('alert')
      await expectNoA11yViolations(container)
    })
  })
}
