import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { z } from 'zod'
import { formControlLabelClasses } from '@mui/material/FormControlLabel'
import { Form } from '../../Form'
import { Switch, type SwitchProps } from './Switch'
import { describeFieldContract } from '../../test/describeFieldContract'
import { expectTargetSize } from '../../test/targetSize'
import { expectNoA11yViolations } from '../../test/axe'

const schema = z.object({ darkMode: z.boolean() })

describeFieldContract({
  componentName: 'Switch',
  role: 'switch',
  label: 'Dark mode',
  schema,
  defaultValues: { darkMode: false },
  renderNamed: (name) => <Switch name="darkMode" label="" aria-label={name} />,
  render: (props) => <Switch name="darkMode" label="Dark mode" {...props} />,
  renderDescribed: (id, props) => (
    <Switch name="darkMode" label="Dark mode" aria-describedby={id} {...props} />
  ),
  getControl: () => screen.getByRole('switch', { name: 'Dark mode' }),
  expectSubmitted: { darkMode: true },
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

  it.each(['medium', 'small'] as const)('%s: meets 24×24 target size', (size) => {
    render(
      <Form schema={schema} defaultValues={{ darkMode: false }} onSubmit={() => {}}>
        <Switch name="darkMode" label="Dark mode" size={size} />
      </Form>,
    )
    expectTargetSize(screen.getByRole('switch', { name: 'Dark mode' }))
  })
})

/**
 * `labelPlacement` is MUI's `FormControlLabel.labelPlacement` (#139), not the form-level
 * `<Form labelPlacement>` axis. Before this it was typed as the ez axis and read by nothing
 * on these two fields — they are `selfLabelled` and opt out of that axis — so a consumer
 * could not put a label before a Switch at all.
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
describe('Switch labelPlacement (MUI FormControlLabel)', () => {
  const renderPlaced = (labelPlacement?: SwitchProps['labelPlacement']) =>
    render(
      <Form schema={schema} defaultValues={{ darkMode: false }} onSubmit={() => {}}>
        <Switch name="darkMode" label="Dark mode" labelPlacement={labelPlacement} />
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
      const control = screen.getByRole('switch', { name: 'Dark mode' })
      const text = screen.getByText('Dark mode')
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
      expect(screen.getByLabelText('Dark mode')).toHaveAttribute('type', 'checkbox')
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
