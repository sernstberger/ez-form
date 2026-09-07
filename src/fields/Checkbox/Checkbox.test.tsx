import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { z } from 'zod'
import { formControlLabelClasses } from '@mui/material/FormControlLabel'
import { Form } from '../../Form'
import { Checkbox, type CheckboxProps } from './Checkbox'
import { describeFieldContract } from '../../test/describeFieldContract'
import { expectTargetSize } from '../../test/targetSize'
import { expectNoA11yViolations } from '../../test/axe'

const schema = z.object({
  tos: z.boolean().refine(Boolean, { error: 'You must accept the terms' }),
})

describeFieldContract({
  componentName: 'Checkbox',
  role: 'checkbox',
  label: 'Accept terms',
  schema,
  defaultValues: { tos: false },
  renderNamed: (name) => <Checkbox name="tos" label="" aria-label={name} />,
  render: (props) => <Checkbox name="tos" label="Accept terms" {...props} />,
  renderDescribed: (id, props) => (
    <Checkbox name="tos" label="Accept terms" aria-describedby={id} {...props} />
  ),
  getControl: () => screen.getByRole('checkbox', { name: 'Accept terms' }),
  expectSubmitted: { tos: true },
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

/**
 * `labelPlacement` is MUI's `FormControlLabel.labelPlacement` (#139), not the form-level
 * `<Form labelPlacement>` axis. Before this it was typed as the ez axis and read by nothing
 * on these two fields — they are `selfLabelled` and opt out of that axis — so a consumer
 * could not put a label before a Checkbox at all.
 *
 * ### Measured: MUI reorders in CSS, never in markup
 *
 * All four placements emit the same DOM — control `<span>` first, label `<span>` second,
 * inside one `<label>`. `FormControlLabel` sets `flexDirection: 'row-reverse'` for `start`
 * and `'column-reverse'` for `top` (verified against @mui/material 9.4.0), so a DOM-order
 * assertion would fail on correct code for `start` and `top` and pass vacuously for the
 * other two. It is asserted here anyway, as a *constant*: the markup does not move, and if a
 * future MUI starts reordering it, the a11y-order assumption behind this component changes
 * and someone should look.
 *
 * The visual half therefore has to be read off the **emitted rule text** — jsdom has no
 * layout engine, so `getComputedStyle` on the root reports nothing useful. Same technique as
 * `labelPlacement.test.tsx` uses for the form-level axis's media-query rules.
 */
describe('Checkbox labelPlacement (MUI FormControlLabel)', () => {
  const renderPlaced = (labelPlacement?: CheckboxProps['labelPlacement']) =>
    render(
      <Form schema={schema} defaultValues={{ tos: false }} onSubmit={() => {}}>
        <Checkbox name="tos" label="Accept terms" labelPlacement={labelPlacement} />
      </Form>,
    )

  const labelRoot = (container: HTMLElement) =>
    container.querySelector(`.${formControlLabelClasses.root}`)!

  it.each([
    ['start', formControlLabelClasses.labelPlacementStart],
    ['top', formControlLabelClasses.labelPlacementTop],
    ['bottom', formControlLabelClasses.labelPlacementBottom],
  ] as const)("%s puts MUI's placement class on the FormControlLabel root", (placement, cls) => {
    const { container } = renderPlaced(placement)
    expect(labelRoot(container)).toHaveClass(cls)
  })

  it("unset leaves MUI's own default: no placement class at all", () => {
    // `'end'` is `FormControlLabel`'s default and MUI emits *no* modifier class for it, so
    // "unset" and "end" are the same DOM. Asserting the absence of all three is what pins
    // that the field passes nothing rather than passing `'end'` itself — a
    // `{ labelPlacement: undefined }` object spread onto `FormControlLabel` would look
    // identical here today but would stop a theme `defaultProps.labelPlacement` working.
    const { container } = renderPlaced()
    const root = labelRoot(container)
    expect(root).not.toHaveClass(formControlLabelClasses.labelPlacementStart)
    expect(root).not.toHaveClass(formControlLabelClasses.labelPlacementTop)
    expect(root).not.toHaveClass(formControlLabelClasses.labelPlacementBottom)
  })

  /** The declarations of every emitted rule whose selector mentions `needle`. */
  const rulesFor = (needle: string): string =>
    [
      ...[...document.querySelectorAll('style')]
        .map((s) => s.textContent ?? '')
        .join('\n')
        .matchAll(/([^{}]*)\{([^{}]*)\}/g),
    ]
      .filter(([, selector]) => selector?.includes(needle))
      .map(([, , declarations]) => declarations)
      .join('\n')

  it.each([
    ['start', formControlLabelClasses.labelPlacementStart, 'row-reverse'],
    ['top', formControlLabelClasses.labelPlacementTop, 'column-reverse'],
    ['bottom', formControlLabelClasses.labelPlacementBottom, 'column'],
  ] as const)(
    '%s actually moves the label: the class carries its flex direction',
    (placement, cls, direction) => {
      // The class alone would pass with MUI's stylesheet gone. This reads the rule the class
      // is attached to and asserts the declaration that does the moving, which is the closest
      // jsdom can get to "the label is on the left".
      const { container } = renderPlaced(placement)
      const emitted = rulesFor(
        labelRoot(container)
          .className.split(' ')
          .find((c) => c.startsWith('css-'))!,
      )
      expect(emitted).toContain(`flex-direction:${direction}`)
      expect(labelRoot(container)).toHaveClass(cls)
    },
  )

  it.each(['end', 'start', 'top', 'bottom'] as const)(
    '%s leaves the markup order alone: control first, label second',
    (placement) => {
      // A constant, not a consequence — see this block's doc. Pinned so a future MUI that
      // *does* reorder shows up here rather than as a silent change in reading order.
      renderPlaced(placement)
      const control = screen.getByRole('checkbox', { name: 'Accept terms' })
      const text = screen.getByText('Accept terms')
      expect(control.compareDocumentPosition(text) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      )
    },
  )

  it.each([undefined, 'end', 'start', 'top', 'bottom'] as const)(
    '%s keeps the label associated with the input',
    (placement) => {
      // The a11y contract must not move with the visual one: `FormControlLabel` wraps the
      // input in the `<label>` whatever the placement, so `getByLabelText` finds it — and a
      // regression to a sibling `<label>` with no `htmlFor` would fail here while every
      // class assertion above still passed.
      renderPlaced(placement)
      expect(screen.getByLabelText('Accept terms')).toHaveAttribute('type', 'checkbox')
    },
  )

  it('has no accessibility violations under every placement', async () => {
    for (const placement of ['end', 'start', 'top', 'bottom'] as const) {
      const { container, unmount } = renderPlaced(placement)
      await expectNoA11yViolations(container)
      unmount()
    }
  })
})
