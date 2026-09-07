import type { Meta, StoryObj } from '@storybook/react-vite'
import { z } from 'zod'
import type { FormParameters } from '../../../.storybook/preview'
import { BoundField } from './BoundField'

/**
 * `<BoundField>` is the public way to bind a control ez-form does not wrap. It renders
 * the `FormControl` box and the helper text; the control itself comes from `render`,
 * which receives everything the binding knows about the field.
 *
 * Every story below uses a **plain DOM control** on purpose — no MUI inside `render` —
 * so what arrives from `bound` is all there is. A wrapped MUI control would supply the
 * label and description wiring itself and these stories would demonstrate nothing.
 *
 * The three things `render` must forward, in every one of them:
 *
 * - `bound.field.ref` — hookform focuses it after a failed submit, and the fork in
 *   `useEzField` registers it as this field's `<FormErrorSummary>` target.
 * - `bound.inputA11y` — `aria-invalid`, plus the `aria-describedby` that links the
 *   helper text and the error.
 * - `bound.nameA11y` — the consumer's `aria-label` / `aria-labelledby`, for a field
 *   with no visible label.
 */
const schema = z.object({
  nickname: z.string().min(1, 'Nickname is required.'),
  size: z.string(),
})

const meta = {
  title: 'Fields/BoundField',
  component: BoundField,
  parameters: {
    form: { schema, defaultValues: { nickname: '', size: '' } },
  } satisfies FormParameters,
} satisfies Meta<typeof BoundField>

export default meta
type Story = StoryObj<typeof meta>

/**
 * A plain `<input>`. `labelAs="none"` (the default) renders no label element, so the
 * control owns its own — paired to `bound.controlId` by `htmlFor`, and reading
 * `bound.displayLabel` so `requiredIndicator="optional"` still works.
 */
export const PlainInput: Story = {
  args: {
    name: 'nickname',
    label: 'Nickname',
    helperText: 'What should we call you?',
    render: () => <input />,
  },
  render: (args) => (
    <BoundField<string>
      {...args}
      render={(bound) => (
        <>
          <label htmlFor={bound.controlId} id={bound.labelId} style={{ display: 'block' }}>
            {bound.displayLabel}
          </label>
          <input
            type="text"
            id={bound.controlId}
            name={bound.field.name}
            ref={bound.field.ref}
            value={bound.field.value ?? ''}
            disabled={bound.field.disabled}
            required={bound.required}
            onChange={(e) => bound.field.onChange(e.target.value)}
            onBlur={bound.field.onBlur}
            {...bound.nameA11y}
            {...bound.inputA11y}
          />
        </>
      )}
    />
  ),
}

/**
 * The same binding on a native `<select>` — a different control, an identical `render`
 * contract. `rules={{ required: true }}` is ez-form's rule vocabulary, so the message
 * is the label-derived default.
 */
export const NativeSelect: Story = {
  args: {
    name: 'size',
    label: 'Size',
    rules: { required: true },
    render: () => <select />,
  },
  render: (args) => (
    <BoundField<string>
      {...args}
      render={(bound) => (
        <>
          <label htmlFor={bound.controlId} id={bound.labelId} style={{ display: 'block' }}>
            {bound.displayLabel}
          </label>
          <select
            id={bound.controlId}
            name={bound.field.name}
            ref={bound.field.ref}
            value={bound.field.value ?? ''}
            disabled={bound.field.disabled}
            required={bound.required}
            onChange={(e) => bound.field.onChange(e.target.value)}
            onBlur={bound.field.onBlur}
            {...bound.nameA11y}
            {...bound.inputA11y}
          >
            <option value="">Choose…</option>
            <option value="s">Small</option>
            <option value="m">Medium</option>
            <option value="l">Large</option>
          </select>
        </>
      )}
    />
  ),
}

/**
 * A failed submit, on the plain input: the error replaces the helper text, is announced
 * through the frame's `role="alert"` helper text, reaches the input through
 * `bound.inputA11y`'s `aria-describedby`, and focus lands on the input because `render`
 * forwarded `bound.field.ref`.
 */
export const Error: Story = {
  ...PlainInput,
  args: { ...PlainInput.args, rules: { required: true } },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Submit' }))
    await canvas.findByText('Nickname is required.')
  },
}
