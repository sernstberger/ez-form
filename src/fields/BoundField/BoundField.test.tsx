import type { ReactElement } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expectTypeOf } from 'vitest'
import type { DefaultValues, FieldValues, RefCallBack } from 'react-hook-form'
import { createTheme, ThemeProvider } from '@mui/material/styles'
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
import { expectConsole } from '../../test/expectConsole'
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
 * `theme.components.EzBoundField.defaultProps` belongs to the **public** `<BoundField>`
 * and must not reach the seven fields that render through the same frame.
 *
 * `useDefaultProps` fills any key the caller left `undefined` — MUI's `resolveProps`
 * cannot tell "not passed" from "not applicable" — so with the call inside the shared
 * component, a consumer's default for their own wrapped controls leaked into this
 * library's Checkbox. Measured before the split: `defaultProps.helperText = 'Leaked'`
 * rendered helper text under a plain `<Checkbox name="f" label="Visible" />`, and
 * `defaultProps.labelPlacement = 'start'` re-laid-out that Checkbox inside a `floating`
 * form.
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
    // The form's own placement (`floating`, the default) still owns the field.
    expect(container.querySelector(`.${fieldLayoutClasses.start}`)).toBeNull()
    expect(container.querySelector(`.${fieldLayoutClasses.floating}`)).not.toBeNull()
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
