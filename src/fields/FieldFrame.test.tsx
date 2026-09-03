import type { ReactElement } from 'react'
import { render, screen } from '@testing-library/react'
import type { DefaultValues, FieldValues } from 'react-hook-form'
import { z } from 'zod'
import { Form } from '../Form'
import { Checkbox } from './Checkbox'
import { CheckboxGroup } from './CheckboxGroup'
import { RadioGroup } from './RadioGroup'
import { Rating } from './Rating'
import { Slider } from './Slider'
import { Switch } from './Switch'
import { ToggleButtonGroup } from './ToggleButtonGroup'
import { expectNoA11yViolations } from '../test/axe'
import { expectConsole } from '../test/expectConsole'
import { getInnerGroup } from '../test/getInnerGroup'

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

describe.each(cases)('FieldFrame accessible name — $name', (c) => {
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

describe('FieldFrame legend', () => {
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
