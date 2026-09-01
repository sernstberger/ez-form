import type { ReactElement, ReactNode } from 'react'
import type { CheckboxProps as MuiCheckboxProps } from '@mui/material/Checkbox'
import FormControl from '@mui/material/FormControl'
import FormControlLabel from '@mui/material/FormControlLabel'
import FormHelperText from '@mui/material/FormHelperText'
import type { RefCallBack } from 'react-hook-form'
import { useBooleanField } from './useBooleanField'
import { mergeDisabled } from './mergeDisabled'
import type { BooleanFieldRules } from '../rules'

/** Handler shapes shared by MUI Checkbox and Switch (both come from SwitchBase). */
type ControlHandlers = Pick<MuiCheckboxProps, 'onChange' | 'onBlur'>

/** What the binding hands to the MUI control. Merge `inputProps` into `slotProps.input`. */
export interface BoundBooleanControl {
  name: string
  checked: boolean
  onChange: NonNullable<ControlHandlers['onChange']>
  onBlur: NonNullable<ControlHandlers['onBlur']>
  /**
   * For the real `<input>`: hookform's ref (so the first invalid field is
   * focused on submit) and the a11y attributes that link the helper text.
   * `aria-invalid` is omitted when valid, which is equivalent to `"false"`.
   */
  inputProps: {
    ref: RefCallBack
    'aria-invalid': true | undefined
    'aria-describedby': string | undefined
  }
}

export interface BooleanFieldControlProps extends BooleanFieldRules, ControlHandlers {
  componentName: string
  name: string
  label: ReactNode
  helperText?: ReactNode
  disabled?: boolean
  /** Renders the MUI control with the bound props applied. */
  renderControl: (bound: BoundBooleanControl) => ReactElement
}

/**
 * Internal frame shared by Checkbox and Switch: FormControl + FormControlLabel
 * + FormHelperText, the rule/required wiring, a11y attributes, and consumer
 * handlers composed after hookform's. Not exported from the package.
 */
export function BooleanFieldControl({
  componentName,
  name,
  label,
  helperText,
  disabled,
  required,
  validate,
  onChange,
  onBlur,
  renderControl,
}: BooleanFieldControlProps) {
  const f = useBooleanField(name, componentName, { label, rules: { required, validate } })
  const text = f.errorMessage ?? helperText

  return (
    <FormControl
      error={f.invalid}
      disabled={mergeDisabled(disabled, f.disabled)}
      required={f.required}
    >
      <FormControlLabel
        label={label}
        required={f.required}
        control={renderControl({
          name: f.name,
          checked: f.checked,
          onChange: (e, checked) => {
            f.onChange(e)
            onChange?.(e, checked)
          },
          onBlur: (e) => {
            f.onBlur()
            onBlur?.(e)
          },
          inputProps: {
            ref: f.inputRef,
            'aria-invalid': f.invalid || undefined,
            'aria-describedby': text ? f.helperTextId : undefined,
          },
        })}
      />
      {text ? <FormHelperText id={f.helperTextId}>{text}</FormHelperText> : null}
    </FormControl>
  )
}
