import { useId, type ReactElement, type ReactNode } from 'react'
import FormControl from '@mui/material/FormControl'
import FormControlLabel from '@mui/material/FormControlLabel'
import FormHelperText from '@mui/material/FormHelperText'
import FormLabel from '@mui/material/FormLabel'
import type { ControllerRenderProps } from 'react-hook-form'
import { useEzField, type InputA11y } from './useEzField'
import { mergeDisabled } from './mergeDisabled'
import type { FieldRules } from '../rules'
import { hasLabel } from '../devWarn'

/** What the frame hands to `renderControl`. The control composes its own handlers after `field.onChange`. */
export interface BoundField {
  field: ControllerRenderProps
  invalid: boolean
  required: boolean
  /** Resolved against the helper text: `aria-describedby` is set only when there is text. */
  inputA11y: InputA11y
  /**
   * Id of the legend when `labelAs="legend"`; put it in `aria-labelledby` on the group.
   *
   * `undefined` when there is no label to render, so the attribute is dropped rather
   * than pointing at an empty legend. That matters because `aria-labelledby` outranks
   * `aria-label` in the accname algorithm: an id resolving to `""` does not fall back
   * to `aria-label`, it leaves the control with no accessible name at all.
   */
  labelId: string | undefined
}

export interface FieldFrameProps<TValue> {
  componentName: string
  name: string
  label: ReactNode
  helperText?: ReactNode
  disabled?: boolean
  rules: FieldRules<TValue>
  /**
   * Overrides `Form`'s `optionalText` for this field when the form's
   * `requiredIndicator` is `"optional"`; `false` hides it on this field.
   */
  optionalText?: ReactNode | false
  /**
   * `control`: label beside the control (FormControlLabel) — Checkbox, Switch.
   * `legend`: label above a group of controls (fieldset + legend) — RadioGroup.
   * A `legend` frame renders a fieldset whose implicit role is `group` named by the
   * legend; when the inner control is itself `role="group"` (ToggleButtonGroup,
   * CheckboxGroup), it shares that same accessible name, so tests must disambiguate
   * by picking the inner element rather than querying by the shared name alone.
   */
  labelAs: 'control' | 'legend'
  /**
   * Not rendered here — reported only so the dev-mode "no accessible name" warning can
   * see that a label-less field is named some other way (see `src/devWarn.ts`). Every
   * field passes these; each one forwards its own copy to its control through `{...rest}`.
   *
   * This used to say a `labelAs="legend"` field must *not* report them, on the reasoning
   * that its `aria-labelledby={labelId}` is set after `rest` and so wins anyway. That was
   * the bug (#100) written down as intent: the frame emitted `aria-labelledby` even with
   * no legend content, and an `aria-labelledby` naming an empty element beats `aria-label`
   * in the accname algorithm — so those fields ended up with **no** accessible name while
   * the warning that would have said so was suppressed. `labelId` is now `undefined`
   * without a label, which leaves a consumer's `aria-label` as the name, exactly as plain
   * MUI does.
   */
  'aria-label'?: string
  'aria-labelledby'?: string
  renderControl: (bound: BoundField) => ReactElement
}

/**
 * Internal frame for fields that are not a MUI TextField: FormControl, the
 * label, the control, and FormHelperText with the hook's a11y wiring.
 * Not exported from the package.
 */
export function FieldFrame<TValue>({
  componentName,
  name,
  label,
  helperText,
  disabled,
  rules,
  optionalText,
  labelAs,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  renderControl,
}: FieldFrameProps<TValue>) {
  const f = useEzField<TValue>(name, componentName, {
    label,
    rules,
    optionalText,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
  })
  const generatedLabelId = useId()
  const text = f.helperText(helperText)
  // `label`, not `displayLabel`: in `optional` mode `displayLabel` wraps a missing label
  // with the "(optional)" suffix, which is not a name — a legend reading "(optional)"
  // alone would be worse than none. Shared with `warnMissingLabel`, so the same input
  // that warns is exactly the input that gets no legend.
  const labelled = hasLabel(label)
  const bound: BoundField = {
    field: f.field,
    invalid: f.invalid,
    required: f.required,
    inputA11y: f.inputA11y(text),
    labelId: labelled ? generatedLabelId : undefined,
  }
  // FormControlLabel/FormLabel read `required` from FormControl context only when
  // their own prop is undefined; passing `f.labelRequired` (`false` in `optional`
  // mode for a required field) wins over that context and suppresses the asterisk
  // while FormControl's own `required` (and so the input's `aria-required`) is
  // untouched.
  const labelRequired = f.labelRequired ?? f.required

  return (
    <FormControl
      component={labelAs === 'legend' ? 'fieldset' : 'div'}
      error={f.invalid}
      disabled={mergeDisabled(disabled, f.field.disabled)}
      required={f.required}
    >
      {labelAs === 'control' ? (
        <FormControlLabel
          label={f.displayLabel}
          required={labelRequired}
          control={renderControl(bound)}
        />
      ) : (
        <>
          {/* No legend at all without a label: an empty one is markup nothing can use,
              and in `optional` mode `displayLabel` would render a bare "(optional)". */}
          {labelled ? (
            <FormLabel component="legend" id={bound.labelId} required={labelRequired}>
              {f.displayLabel}
            </FormLabel>
          ) : null}
          {renderControl(bound)}
        </>
      )}
      {text ? <FormHelperText {...f.helperTextA11y}>{text}</FormHelperText> : null}
    </FormControl>
  )
}
