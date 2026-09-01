import { useId, type ReactElement, type ReactNode } from 'react'
import FormControl from '@mui/material/FormControl'
import FormControlLabel from '@mui/material/FormControlLabel'
import FormHelperText from '@mui/material/FormHelperText'
import FormLabel from '@mui/material/FormLabel'
import type { ControllerRenderProps } from 'react-hook-form'
import { useEzField, type InputA11y } from './useEzField'
import { mergeDisabled } from './mergeDisabled'
import type { FieldRules } from '../rules'

/** What the frame hands to `renderControl`. The control composes its own handlers after `field.onChange`. */
export interface BoundField {
  field: ControllerRenderProps
  invalid: boolean
  required: boolean
  /** Resolved against the helper text: `aria-describedby` is set only when there is text. */
  inputA11y: InputA11y
  /** Id of the legend when `labelAs="legend"`; put it in `aria-labelledby` on the group. */
  labelId: string
}

export interface FieldFrameProps<TValue> {
  componentName: string
  name: string
  label: ReactNode
  helperText?: ReactNode
  disabled?: boolean
  rules: FieldRules<TValue>
  /**
   * `control`: label beside the control (FormControlLabel) — Checkbox, Switch.
   * `legend`: label above a group of controls (fieldset + legend) — RadioGroup.
   */
  labelAs: 'control' | 'legend'
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
  labelAs,
  renderControl,
}: FieldFrameProps<TValue>) {
  const f = useEzField<TValue>(name, componentName, { label, rules })
  const labelId = useId()
  const text = f.helperText(helperText)
  const bound: BoundField = {
    field: f.field,
    invalid: f.invalid,
    required: f.required,
    inputA11y: f.inputA11y(text),
    labelId,
  }

  return (
    <FormControl
      component={labelAs === 'legend' ? 'fieldset' : 'div'}
      error={f.invalid}
      disabled={mergeDisabled(disabled, f.field.disabled)}
      required={f.required}
    >
      {labelAs === 'control' ? (
        // FormControlLabel does not read `required` from FormControl context; pass it explicitly.
        <FormControlLabel label={label} required={f.required} control={renderControl(bound)} />
      ) : (
        <>
          <FormLabel component="legend" id={labelId}>
            {label}
          </FormLabel>
          {renderControl(bound)}
        </>
      )}
      {text ? <FormHelperText {...f.helperTextA11y}>{text}</FormHelperText> : null}
    </FormControl>
  )
}
