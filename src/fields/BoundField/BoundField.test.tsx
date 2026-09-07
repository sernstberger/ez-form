import type { ReactElement } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expectTypeOf } from 'vitest'
import type { DefaultValues, FieldValues, RefCallBack } from 'react-hook-form'
import { createTheme, ThemeProvider } from '@mui/material/styles'
import { formControlLabelClasses } from '@mui/material/FormControlLabel'
import { z } from 'zod'
import { Form } from '../../Form'
import { fieldLayoutClasses } from '../LabelPlacementContext'
import { BoundField, type Bound } from './BoundField'
import type { UseEzFieldReturn } from '../useEzField'
import { Checkbox } from '../Checkbox'
import { CheckboxGroup } from '../CheckboxGroup'
import { RadioGroup } from '../RadioGroup'
import { Rating } from '../Rating'
import { Slider } from '../Slider'
import { Switch } from '../Switch'
import { ToggleButtonGroup } from '../ToggleButtonGroup'
import { expectNoA11yViolations } from '../../test/axe'
import { consoleMessages, expectConsole } from '../../test/expectConsole'
import { resetDevWarnings } from '../../devWarn'
import { getInnerGroup } from '../../test/getInnerGroup'
import { ReferenceControl } from '../../test/ReferenceControl'
import { describeFieldContract } from '../../test/describeFieldContract'

/**
 * The shared frame's accessible-name contract, asserted for all seven fields that
 * render through it. The bug this file was written for (#100): the frame emitted
 * `aria-labelledby={labelId}` unconditionally, so a label-less field pointed at an
 * empty legend — and an `aria-labelledby` naming an empty element beats `aria-label`
 * in the accname algorithm, leaving the control with no accessible name at all.
 *
 * Every assertion here is an *accessible name* query, never an attribute check. The
 * QA sweep that found this cleared 15 fields by reading source for a forwarded
 * `aria-label` that a `getByRole(role, { name })` query still fails; `Slider` was
 * the decisive case, forwarding the attribute correctly and still being unnamed.
 */

const options = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
] as const

type Variant = 'labelled' | 'unlabelled' | 'unnamed'

interface FrameCase {
  name: string
  /** The control's role. `group` needs the inner element — see `getNamed`. */
  role: string
  render: (variant: Variant) => ReactElement
}

/**
 * Each case closes over its own schema and defaults instead of exposing them as
 * fields: `describe.each` widens the array to a union of its entry types, which
 * would decouple every schema from the defaults it was written for.
 */
const frameCase = <TIn extends FieldValues, TOut>(
  name: string,
  role: string,
  schema: z.ZodType<TOut, TIn>,
  defaultValues: DefaultValues<TIn>,
  variants: Record<Variant, ReactElement>,
): FrameCase => ({
  name,
  role,
  render: (variant) => (
    <Form schema={schema} defaultValues={defaultValues} onSubmit={() => {}}>
      {variants[variant]}
    </Form>
  ),
})

const cases: FrameCase[] = [
  frameCase(
    'Checkbox',
    'checkbox',
    z.object({ f: z.boolean() }),
    { f: false },
    {
      labelled: <Checkbox name="f" label="Visible" />,
      unlabelled: <Checkbox name="f" label={undefined} aria-label="Aye" />,
      unnamed: <Checkbox name="f" label={undefined} />,
    },
  ),
  frameCase(
    'Switch',
    'switch',
    z.object({ f: z.boolean() }),
    { f: false },
    {
      labelled: <Switch name="f" label="Visible" />,
      unlabelled: <Switch name="f" label={undefined} aria-label="Aye" />,
      unnamed: <Switch name="f" label={undefined} />,
    },
  ),
  frameCase(
    'Slider',
    'slider',
    z.object({ f: z.number() }),
    { f: 10 },
    {
      labelled: <Slider name="f" label="Visible" />,
      unlabelled: <Slider name="f" label={undefined} aria-label="Aye" />,
      unnamed: <Slider name="f" label={undefined} />,
    },
  ),
  frameCase(
    'Rating',
    'radiogroup',
    z.object({ f: z.number().nullable() }),
    { f: null },
    {
      labelled: <Rating name="f" label="Visible" />,
      unlabelled: <Rating name="f" label={undefined} aria-label="Aye" />,
      unnamed: <Rating name="f" label={undefined} />,
    },
  ),
  frameCase(
    'RadioGroup',
    'radiogroup',
    z.object({ f: z.string() }),
    { f: '' },
    {
      labelled: <RadioGroup name="f" label="Visible" options={options} />,
      unlabelled: <RadioGroup name="f" label={undefined} options={options} aria-label="Aye" />,
      unnamed: <RadioGroup name="f" label={undefined} options={options} />,
    },
  ),
  frameCase(
    'CheckboxGroup',
    'group',
    z.object({ f: z.array(z.string()) }),
    { f: [] },
    {
      labelled: <CheckboxGroup name="f" label="Visible" options={options} />,
      unlabelled: <CheckboxGroup name="f" label={undefined} options={options} aria-label="Aye" />,
      unnamed: <CheckboxGroup name="f" label={undefined} options={options} />,
    },
  ),
  frameCase(
    'ToggleButtonGroup',
    'group',
    z.object({ f: z.string().nullable() }),
    { f: null },
    {
      labelled: <ToggleButtonGroup name="f" label="Visible" options={options} exclusive />,
      unlabelled: (
        <ToggleButtonGroup
          name="f"
          label={undefined}
          options={options}
          exclusive
          aria-label="Aye"
        />
      ),
      unnamed: <ToggleButtonGroup name="f" label={undefined} options={options} exclusive />,
    },
  ),
]

/**
 * A `role="group"` field renders a legend-labelled `<fieldset>` (also `role="group"`)
 * around an inner `role="group"`, so a name query matches both; pick the inner one.
 */
const getNamed = (role: string, name: string): HTMLElement =>
  role === 'group' ? getInnerGroup(name) : screen.getByRole(role, { name })

describe.each(cases)('BoundField accessible name — $name', (c) => {
  it('is named by its `label`', () => {
    render(c.render('labelled'))
    expect(getNamed(c.role, 'Visible')).toBeInTheDocument()
  })

  it('is named by `aria-label` when there is no `label`', () => {
    render(c.render('unlabelled'))
    expect(getNamed(c.role, 'Aye')).toBeInTheDocument()
  })

  it('emits no `aria-labelledby` when there is no label', () => {
    render(c.render('unlabelled'))
    // The attribute itself, not the name: an id resolving to `""` is exactly the
    // shape this bug had, and the name assertion above would not pin down that the
    // frame has actually stopped emitting it.
    expect(getNamed(c.role, 'Aye')).not.toHaveAttribute('aria-labelledby')
  })

  it('has no accessibility violations when named only by `aria-label`', async () => {
    const { container } = render(c.render('unlabelled'))
    await expectNoA11yViolations(container)
  })

  it('has no accessibility violations when named by `label`', async () => {
    const { container } = render(c.render('labelled'))
    await expectNoA11yViolations(container)
  })

  it('still warns when it has no accessible name at all', () => {
    expectConsole('warn', `<${c.name} name="f"> has no accessible name`)
    render(c.render('unnamed'))
  })
})

describe('BoundField legend', () => {
  const radioForm = (child: ReactElement) => (
    <Form schema={z.object({ f: z.string() })} defaultValues={{ f: '' }} onSubmit={() => {}}>
      <span id="external">External name</span>
      {child}
    </Form>
  )

  it('renders no empty legend when there is no label', () => {
    const { container } = render(
      <Form schema={z.object({ f: z.number() })} defaultValues={{ f: 10 }} onSubmit={() => {}}>
        <Slider name="f" label={undefined} aria-label="Aye" />
      </Form>,
    )
    expect(container.querySelector('legend')).toBeNull()
  })

  it('keeps a consumer `aria-labelledby` that the legend id would have clobbered', () => {
    render(
      radioForm(
        <RadioGroup name="f" label={undefined} options={options} aria-labelledby="external" />,
      ),
    )
    expect(screen.getByRole('radiogroup', { name: 'External name' })).toBeInTheDocument()
  })

  it('a visible label still wins over a consumer `aria-labelledby`', () => {
    render(
      radioForm(
        <RadioGroup name="f" label="Visible" options={options} aria-labelledby="external" />,
      ),
    )
    expect(screen.getByRole('radiogroup', { name: 'Visible' })).toBeInTheDocument()
  })
})

/**
 * #28: `useEzField`/`BoundField` carry the field's value type, so `field.value` is
 * `TValue | undefined` and `field.onChange` rejects a value of the wrong shape. Before
 * this, `UseEzFieldReturn` was a bare `UseControllerReturn`, whose `TFieldValues`
 * defaults to `FieldValues` (`Record<string, any>`) — so `field.value` was `any` and
 * every assertion below would have passed on nothing.
 *
 * Never called: these are compile-time assertions, and the `onChange` lines would
 * throw at runtime on the empty object they are declared against. `pnpm typecheck`
 * is what runs them — each `@ts-expect-error` fails it as an *unused* directive the
 * moment the type widens back to `any`. Verified by temporarily restoring `any`:
 * 2 `expectTypeOf` errors and 3 unused-directive errors.
 */
function typeAssertions() {
  // `TValue | undefined`, not `TValue`: a form with no `defaultValues` entry for the
  // field renders it with `value === undefined`, which is what every `?? null` /
  // `?? ''` fallback in the fields exists for.
  expectTypeOf<Bound<boolean>['field']['value']>().toEqualTypeOf<boolean | undefined>()
  expectTypeOf<UseEzFieldReturn<number | null>['field']['value']>().toEqualTypeOf<
    number | null | undefined
  >()
  // The `ref` forked for #98 keeps hookform's own type.
  expectTypeOf<Bound<boolean>['field']['ref']>().toEqualTypeOf<RefCallBack>()
  expectTypeOf<Bound<boolean>['field']['name']>().toEqualTypeOf<string>()

  const bound = {} as Bound<boolean>
  bound.field.onChange(true)
  // @ts-expect-error a number is not this field's value type
  bound.field.onChange(42)

  const f = {} as UseEzFieldReturn<string[]>
  f.field.onChange(['a'])
  // @ts-expect-error a bare string is not `string[]`
  f.field.onChange('a')
  // @ts-expect-error `field.value` is not `any`
  const wrong: number = f.field.value
  void wrong

  // …and the same `TValue` reaches the *public* `render` prop, which is the half that
  // matters for a consumer wrapping their own control: an explicit type argument on
  // `<BoundField<Date>>` has to arrive as `Date | undefined` inside `render`, or the
  // generic bought the public path nothing.
  void (
    <BoundField<Date>
      name="when"
      render={(b) => {
        expectTypeOf(b.field.value).toEqualTypeOf<Date | undefined>()
        expectTypeOf(b.controlId).toEqualTypeOf<string>()
        expectTypeOf(b.labelId).toEqualTypeOf<string | undefined>()
        b.field.onChange(new Date())
        // @ts-expect-error a string is not this field's value type
        b.field.onChange('nope')
        return <input />
      }}
    />
  )
  // Inferred from `rules` rather than stated, the other way a consumer reaches it.
  void (
    <BoundField
      name="count"
      rules={{ validate: (v: number) => v > 0 }}
      render={(b) => {
        expectTypeOf(b.field.value).toEqualTypeOf<number | undefined>()
        return <input />
      }}
    />
  )
}
void typeAssertions

/*
 * The contract obligation from #28's proposal, discharged: `<BoundField>` is a
 * field-shaped public API, so PHILOSOPHY rule 3 says it owes the shared contract —
 * and the contract renders a *concrete* field, so it runs against the reference
 * control in `src/test/ReferenceControl.tsx`, a plain `<input>` with no MUI inside
 * `render`.
 *
 * **Nothing is exempt.** That is the point of the run: every line here has to be
 * satisfied by what `bound` hands the render prop and nothing else. The a11y-name
 * line (`ariaLabelNames`) and the describedby line (`consumerDescribedBy`) matter
 * most — they were added in #102 precisely because reading source missed the P1 that
 * left 15 of 17 fields anonymous, and a public binding path that consumers copy is
 * exactly where that failure would come back.
 */
describeFieldContract({
  componentName: 'ReferenceControl',
  role: 'textbox',
  label: 'Nickname',
  schema: z.object({ nickname: z.string() }),
  defaultValues: { nickname: '' },
  render: (props) => <ReferenceControl name="nickname" label="Nickname" {...props} />,
  renderNamed: (name) => <ReferenceControl name="nickname" aria-label={name} />,
  renderDescribed: (id, props) => (
    <ReferenceControl name="nickname" label="Nickname" aria-describedby={id} {...props} />
  ),
  getControl: () => screen.getByRole('textbox', { name: /Nickname/ }),
  expectSubmitted: { nickname: 'a' },
  interact: (user) => user.type(screen.getByRole('textbox', { name: /Nickname/ }), 'a'),
  // Row 6: `labelAs` is `BoundField`'s one default, and `EzBoundField.defaultProps`
  // is what makes it theme-settable. `legend` renders a `<fieldset>`/`<legend>` the
  // default `none` does not, which is visible in the DOM without interacting.
  themeDefault: {
    name: 'EzBoundField',
    defaultProps: { labelAs: 'legend' },
    expect: () => expect(screen.getByRole('group', { name: /Nickname/ })).toBeInTheDocument(),
  },
})

/**
 * The public render-prop path's own cases: the three `labelAs` modes, and the two
 * `bound` members a consumer's control cannot work without.
 */
describe('BoundField render prop', () => {
  const schema = z.object({ nickname: z.string() })
  const inForm = (child: ReactElement, onSubmit: (v: { nickname: string }) => void = () => {}) => (
    <Form schema={schema} defaultValues={{ nickname: '' }} onSubmit={onSubmit}>
      {child}
      <button type="submit">Go</button>
    </Form>
  )

  it('renders no label element under the default `labelAs="none"`', () => {
    const { container } = render(inForm(<ReferenceControl name="nickname" label="Nickname" />))
    // The consumer's own `<label htmlFor>`, and no `<legend>` or MUI
    // `FormControlLabel` from the frame.
    expect(container.querySelector('legend')).toBeNull()
    expect(container.querySelector('.MuiFormControlLabel-root')).toBeNull()
    expect(screen.getByRole('textbox', { name: 'Nickname' })).toBeInTheDocument()
  })

  it('pairs `controlId` with `labelId` so the consumer label names the control', () => {
    render(inForm(<ReferenceControl name="nickname" label="Nickname" />))
    const control = screen.getByRole('textbox', { name: 'Nickname' })
    const label = screen.getByText('Nickname')
    expect(label).toHaveAttribute('for', control.id)
    expect(control.id).not.toBe('')
    // Distinct ids: a `labelId` equal to `controlId` would make `aria-labelledby`
    // point the control at itself.
    expect(label.id).not.toBe(control.id)
  })

  it('renders a fieldset and legend under `labelAs="legend"`', () => {
    const { container } = render(
      inForm(
        <BoundField<string>
          name="nickname"
          label="Nickname"
          labelAs="legend"
          render={(b) => <input ref={b.field.ref} {...b.inputA11y} aria-labelledby={b.labelId} />}
        />,
      ),
    )
    expect(container.querySelector('fieldset')).not.toBeNull()
    expect(container.querySelector('legend')).toHaveTextContent('Nickname')
  })

  it('routes a consumer `aria-label` onto the control through `nameA11y`, not the wrapper', () => {
    const { container } = render(inForm(<ReferenceControl name="nickname" aria-label="Aye" />))
    // The name query, not `toHaveAttribute`: a named wrapper around an anonymous
    // control satisfies the attribute check and is the bug itself (#99).
    expect(screen.getByRole('textbox', { name: 'Aye' })).toBeInTheDocument()
    expect(container.querySelector('.MuiFormControl-root')).not.toHaveAttribute('aria-label')
  })

  it('warns when the render prop has no accessible name to give its control', () => {
    expectConsole('warn', '<BoundField name="nickname"> has no accessible name')
    render(
      inForm(
        <BoundField<string>
          name="nickname"
          render={(b) => <input ref={b.field.ref} {...b.inputA11y} />}
        />,
      ),
    )
  })

  it('names the warning after `componentName` so it points at the consumer component', () => {
    expectConsole('warn', '<NicknameField name="nickname"> has no accessible name')
    render(
      inForm(
        <BoundField<string>
          name="nickname"
          componentName="NicknameField"
          render={(b) => <input ref={b.field.ref} {...b.inputA11y} />}
        />,
      ),
    )
  })

  it("throws outside <Form> under the consumer's own `componentName`", () => {
    expectConsole('error', 'must be rendered inside <Form>')
    expectConsole('error', 'The above error occurred')
    expect(() =>
      render(
        <BoundField<string>
          name="nickname"
          componentName="NicknameField"
          label="Nickname"
          render={(b) => <input ref={b.field.ref} {...b.inputA11y} />}
        />,
      ),
    ).toThrow('ez-form: <NicknameField> must be rendered inside <Form>')
  })

  it('hands the render prop the resolved helper text and its id', async () => {
    const user = userEvent.setup()
    const seen: { text: unknown; id: string }[] = []
    render(
      inForm(
        <BoundField<string>
          name="nickname"
          label="Nickname"
          helperText="Some help"
          rules={{ required: true }}
          render={(b) => {
            seen.push({ text: b.helperText, id: b.helperTextId })
            return (
              <input
                id={b.controlId}
                ref={b.field.ref}
                value={b.field.value ?? ''}
                onChange={(e) => b.field.onChange(e.target.value)}
                aria-labelledby={b.labelId}
                {...b.inputA11y}
              />
            )
          }}
        />,
      ),
    )
    expect(seen.at(-1)?.text).toBe('Some help')
    // The id `inputA11y` points at, so a control with a description slot of its own
    // can reach the same element.
    expect(document.getElementById(seen.at(-1)!.id)).toHaveTextContent('Some help')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    await screen.findByRole('alert')
    // After a failed submit the same member carries the error, which is what the
    // frame renders too.
    await waitFor(() => expect(seen.at(-1)?.text).toBe('Nickname is required.'))
  })

  it('has no accessibility violations', async () => {
    const { container } = render(
      inForm(<ReferenceControl name="nickname" label="Nickname" helperText="Some help" />),
    )
    await expectNoA11yViolations(container)
  })
})

/**
 * `start`'s label column and the self-labelled opt-out, per `labelAs` (#133 + #28).
 *
 * The class half is asserted on the DOM; the CSS half has to be asserted on the
 * *emitted rule text*, because jsdom has no layout engine and evaluates no media
 * queries — every `start`-only declaration lives inside a `@media (min-width…)` block
 * (#130), so `getComputedStyle` on a box reports the below-the-breakpoint fallback and
 * would report a pass whatever the grid said. Same technique as `labelPlacement.test.tsx`.
 */
describe('BoundField under labelPlacement="start"', () => {
  /** Every rule in the document whose selector mentions `needle`. */
  const rulesMentioning = (needle: string): string =>
    [
      ...[...document.querySelectorAll('style')]
        .map((s) => s.textContent ?? '')
        .join('\n')
        .matchAll(/([^{}]*)\{([^{}]*)\}/g),
    ]
      .filter(([, selector]) => selector?.includes(needle))
      .map(([rule]) => rule)
      .join('\n')

  const startForm = (child: ReactElement) =>
    render(
      <Form
        schema={z.object({ f: z.string() })}
        defaultValues={{ f: '' }}
        onSubmit={() => {}}
        labelPlacement="start"
      >
        {child}
      </Form>,
    )

  const rootOf = (container: HTMLElement) => container.querySelector(`.${fieldLayoutClasses.root}`)!

  it('marks a `labelAs="control"` root self-labelled', () => {
    // MUI's `FormControlLabel` puts the label inside the click target, so there is no
    // separate element for column 1 and the box opts out of the grid entirely.
    const { container } = startForm(
      <BoundField<boolean>
        name="f"
        label="Terms"
        labelAs="control"
        render={(b) => <input type="checkbox" ref={b.field.ref} {...b.inputA11y} />}
      />,
    )
    expect(rootOf(container)).toHaveClass(fieldLayoutClasses.selfLabelled)
  })

  it('does not mark a `labelAs="none"` root self-labelled', () => {
    // The documented `'none'` shape is a plain `<label>` beside its control — an
    // ordinary two-part field, which belongs *in* the grid. Marking it self-labelled by
    // default would un-align every wrapped control from its neighbours.
    const { container } = startForm(<ReferenceControl name="f" label="Nickname" />)
    expect(rootOf(container)).not.toHaveClass(fieldLayoutClasses.selfLabelled)
  })

  it('lets a consumer opt out with `fieldLayoutClasses.selfLabelled`', () => {
    // The escape hatch for a control that really is its own label. The class is
    // exported, and `BoundField` appends the consumer's `className` after its own.
    const { container } = startForm(
      <BoundField<string>
        name="f"
        label="Avatar"
        className={fieldLayoutClasses.selfLabelled}
        render={(b) => <button type="button" ref={b.field.ref} {...b.inputA11y} />}
      />,
    )
    expect(rootOf(container)).toHaveClass(fieldLayoutClasses.selfLabelled)
  })

  it('emits the guarded column-1 rule that puts the reference control label in the label column', () => {
    startForm(<ReferenceControl name="f" label="Nickname" />)
    // The label the reference control renders is a plain direct-child `<label>` with no
    // MUI class, so column 1 has to reach it by tag — guarded by *not* being
    // self-labelled, or a `labelAs="control"` box would pull its inner label out of the
    // click target.
    const columnOne = rulesMentioning(`${fieldLayoutClasses.start}`)
    expect(columnOne).toMatch(
      new RegExp(`:not\\(\\.${fieldLayoutClasses.selfLabelled}\\)[^{]*>\\s*label`),
    )
    // …and it is column *1* that the rule sets, not merely that a selector exists.
    expect(columnOne).toMatch(
      new RegExp(
        `:not\\(\\.${fieldLayoutClasses.selfLabelled}\\)[^{]*>\\s*label\\{[^}]*grid-column:1;`,
      ),
    )
    // …and the catch-all that sends everything else to column 2 excludes that same
    // plain `label`, or the two rules would fight over it.
    expect(columnOne).toMatch(/:not\(label\)[^{]*\{grid-column:2;\}/)
  })
})

/**
 * `theme.components.EzBoundField.defaultProps` belongs to the **public** `<BoundField>`
 * and must not reach the seven fields that render through the same frame.
 *
 * `useDefaultProps` fills any key the caller left `undefined` — MUI's `resolveProps`
 * cannot tell "not passed" from "not applicable" — so with the call inside the shared
 * component, a consumer's default for their own wrapped controls leaked into this
 * library's Checkbox. Measured before the split: `defaultProps.helperText = 'Leaked'`
 * rendered helper text under a plain `<Checkbox name="f" label="Visible" />`, and
 * `defaultProps.labelPlacement = 'start'` re-laid-out that same Checkbox.
 *
 * The placement case is *stronger* since #139, not weaker: `Checkbox` no longer passes a
 * form-axis `labelPlacement` at all (its own prop is now MUI's `FormControlLabel` one,
 * forwarded as `controlLabelProps`), so the key reaching the base could only ever come
 * from the theme. The leak is the whole of what this asserts.
 *
 * The fix is the `BoundField` / `BoundFieldBase` split; these two cases are what pins
 * it. Both halves matter: a split that stopped the leak by never reading the theme at
 * all would pass the first and fail the second.
 */
describe('EzBoundField.defaultProps scope', () => {
  const withTheme = (defaultProps: Record<string, unknown>, child: ReactElement) => {
    const theme = createTheme({ components: { EzBoundField: { defaultProps } } })
    return render(
      <ThemeProvider theme={theme}>
        <Form
          schema={z.object({ f: z.boolean() })}
          defaultValues={{ f: false }}
          onSubmit={() => {}}
        >
          {child}
        </Form>
      </ThemeProvider>,
    )
  }

  it('does not reach a <Checkbox> rendering through the same frame', () => {
    withTheme({ helperText: 'Leaked' }, <Checkbox name="f" label="Visible" />)
    expect(screen.queryByText('Leaked')).not.toBeInTheDocument()
  })

  it('does not re-lay-out a <Checkbox> through `labelPlacement`', () => {
    const { container } = withTheme({ labelPlacement: 'start' }, <Checkbox name="f" label="V" />)
    // The form's own placement still owns the field. Asserted as "a placement class, and
    // not `start`" rather than by naming the default's class: which value is the default is
    // the form axis's business, and this test is about the theme not reaching here at all.
    const root = container.querySelector(`.${fieldLayoutClasses.root}`)
    expect(root).not.toBeNull()
    expect(root).not.toHaveClass(fieldLayoutClasses.start)
  })

  it('does reach the public <BoundField>', () => {
    withTheme(
      { helperText: 'From the theme' },
      <BoundField<boolean>
        name="f"
        label="Visible"
        render={(b) => <input ref={b.field.ref} aria-labelledby={b.labelId} {...b.inputA11y} />}
      />,
    )
    expect(screen.getByText('From the theme')).toBeInTheDocument()
  })
})

/**
 * `controlLabelProps` (#139): the channel to the `FormControlLabel` that `labelAs="control"`
 * renders, and the only way anything reaches it. Before this, `labelAs="control"` was a
 * closed box — no `labelPlacement`, no `disableTypography`, no `slotProps.typography` — which
 * is why `Checkbox` and `Switch` shadowed MUI's `labelPlacement` with an inert prop of the
 * library's own.
 *
 * The three keys the binding owns are `Omit`ted from the type *and* applied after the spread,
 * so this file asserts the runtime half too: the compile-time half is invisible to a
 * consumer who casts, and it is the runtime half that keeps the `optional`-mode asterisk
 * suppression and the `render` prop's element in place.
 */
describe('BoundField controlLabelProps', () => {
  beforeEach(() => resetDevWarnings())

  const boolSchema = z.object({ f: z.boolean() })

  const renderControl = (props: Partial<Parameters<typeof BoundField<boolean>>[0]> = {}) =>
    render(
      <Form schema={boolSchema} defaultValues={{ f: false }} onSubmit={() => {}}>
        <BoundField<boolean>
          name="f"
          label="Terms"
          labelAs="control"
          render={(b) => (
            <input
              type="checkbox"
              ref={b.field.ref}
              checked={b.field.value}
              readOnly
              {...b.inputA11y}
            />
          )}
          {...props}
        />
      </Form>,
    )

  const labelRoot = (container: HTMLElement) =>
    container.querySelector(`.${formControlLabelClasses.root}`)!

  it('forwards labelPlacement and disableTypography to the FormControlLabel', () => {
    const { container } = renderControl({
      controlLabelProps: { labelPlacement: 'start', disableTypography: true },
    })
    expect(labelRoot(container)).toHaveClass(formControlLabelClasses.labelPlacementStart)
    // `disableTypography` renders the label as passed, with no wrapping `<Typography>` — so
    // there is no element carrying MUI's label class at all.
    expect(container.querySelector(`.${formControlLabelClasses.label}`)).toBeNull()
    expect(screen.getByText('Terms')).toBeInTheDocument()
  })

  it('forwards slotProps.typography', () => {
    const { container } = renderControl({
      controlLabelProps: { slotProps: { typography: { className: 'consumer-typography' } } },
    })
    expect(container.querySelector('.consumer-typography')).toHaveTextContent('Terms')
  })

  it('cannot override the binding-owned `label`', () => {
    // Cast: the `Omit` in the type already rejects this at compile time. The cast is what
    // lets the test assert the *runtime* guarantee behind it — the spread order — which is
    // what a JS consumer, or one who casts as this does, actually depends on.
    const { container } = renderControl({
      controlLabelProps: { label: 'Hijacked' } as never,
    })
    expect(labelRoot(container)).toHaveTextContent('Terms')
    expect(screen.queryByText('Hijacked')).not.toBeInTheDocument()
  })

  it('cannot override the binding-owned `control`', () => {
    renderControl({ controlLabelProps: { control: <input type="radio" /> } as never })
    // The `render` prop's element is still the one inside the label.
    expect(screen.getByRole('checkbox', { name: 'Terms' })).toBeInTheDocument()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
  })

  it('cannot override the binding-owned `required`, which owns the asterisk', () => {
    /*
     * `requiredIndicator="optional"` is where this bites: the binding resolves the label's
     * `required` to `false` so no asterisk renders, while the *rule* stays in force. A
     * `controlLabelProps.required` winning would put the asterisk back.
     *
     * The input's own `required` is asserted through `slotProps`-style placement rather than
     * a plain attribute, because `FormControlLabel` clones its resolved `required` onto its
     * `control` child — which is the documented reason `Checkbox`/`Switch` set the native
     * `required` through `slotProps.input` instead. Measured here: a plain
     * `required={b.required}` on the rendered `<input>` is overwritten to `false` by that
     * clone, so this asserts `aria-required` (which the clone does not touch) for the rule
     * and the missing asterisk for the indicator.
     */
    const { container } = render(
      <Form
        schema={boolSchema}
        defaultValues={{ f: false }}
        onSubmit={() => {}}
        requiredIndicator="optional"
      >
        <BoundField<boolean>
          name="f"
          label="Terms"
          labelAs="control"
          rules={{ required: true }}
          controlLabelProps={{ required: true } as never}
          render={(b) => (
            <input
              type="checkbox"
              ref={b.field.ref}
              aria-required={b.required}
              checked={b.field.value}
              readOnly
              {...b.inputA11y}
            />
          )}
        />
      </Form>,
    )
    expect(screen.getByRole('checkbox', { name: 'Terms' })).toHaveAttribute('aria-required', 'true')
    expect(container.querySelector('[class*="asterisk"]')).toBeNull()
  })

  it('warns once under labelAs="legend", where nothing reads it', () => {
    expectConsole('warn', 'controlLabelProps')
    const { rerender } = render(
      <Form schema={boolSchema} defaultValues={{ f: false }} onSubmit={() => {}}>
        <BoundField<boolean>
          name="f"
          label="Terms"
          labelAs="legend"
          controlLabelProps={{ labelPlacement: 'start' }}
          render={(b) => (
            <input
              type="checkbox"
              ref={b.field.ref}
              checked={b.field.value}
              readOnly
              {...b.inputA11y}
            />
          )}
        />
      </Form>,
    )
    const hits = consoleMessages('warn').filter((m) => m.includes('controlLabelProps'))
    expect(hits).toHaveLength(1)
    expect(hits[0]).toContain('<BoundField name="f" labelAs="legend">')
    expect(hits[0]).toContain('only read under `labelAs="control"`')
    // Re-rendering does not warn again: `devWarn` dedupes by key for the life of the module.
    rerender(
      <Form schema={boolSchema} defaultValues={{ f: false }} onSubmit={() => {}}>
        <BoundField<boolean>
          name="f"
          label="Terms"
          labelAs="legend"
          controlLabelProps={{ labelPlacement: 'start' }}
          render={(b) => (
            <input
              type="checkbox"
              ref={b.field.ref}
              checked={b.field.value}
              readOnly
              {...b.inputA11y}
            />
          )}
        />
      </Form>,
    )
    expect(consoleMessages('warn').filter((m) => m.includes('controlLabelProps'))).toHaveLength(1)
  })

  it('warns under labelAs="none" too', () => {
    expectConsole('warn', 'controlLabelProps')
    render(
      <Form schema={boolSchema} defaultValues={{ f: false }} onSubmit={() => {}}>
        <BoundField<boolean>
          name="f"
          label="Terms"
          controlLabelProps={{ labelPlacement: 'start' }}
          render={(b) => (
            <input
              type="checkbox"
              ref={b.field.ref}
              aria-labelledby={b.labelId}
              aria-label="Terms"
              checked={b.field.value}
              readOnly
              {...b.inputA11y}
            />
          )}
        />
      </Form>,
    )
    expect(consoleMessages('warn').filter((m) => m.includes('labelAs="none"'))).toHaveLength(1)
  })

  it('does not warn under labelAs="control"', () => {
    renderControl({ controlLabelProps: { labelPlacement: 'start' } })
    expect(consoleMessages('warn')).toEqual([])
  })

  it('does not warn when controlLabelProps is absent', () => {
    render(
      <Form schema={boolSchema} defaultValues={{ f: false }} onSubmit={() => {}}>
        <BoundField<boolean>
          name="f"
          label="Terms"
          labelAs="legend"
          render={(b) => (
            <input
              type="checkbox"
              ref={b.field.ref}
              checked={b.field.value}
              readOnly
              {...b.inputA11y}
            />
          )}
        />
      </Form>,
    )
    expect(consoleMessages('warn')).toEqual([])
  })

  it('has no accessibility violations with controlLabelProps applied', async () => {
    const { container } = renderControl({
      controlLabelProps: { labelPlacement: 'start', disableTypography: true },
    })
    await expectNoA11yViolations(container)
  })
})
