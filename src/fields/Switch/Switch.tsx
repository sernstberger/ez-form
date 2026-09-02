import type { ReactNode } from 'react'
import MuiSwitch, { type SwitchProps as MuiSwitchProps } from '@mui/material/Switch'
import { mergeSlotProps } from '@mui/material/utils'
import { FieldFrame } from '../FieldFrame'
import type { BooleanFieldRules } from '../../rules'

export type SwitchProps = Omit<MuiSwitchProps, 'name' | 'checked' | 'required'> & {
  name: string
  label: ReactNode
  helperText?: ReactNode
  /**
   * Overrides `Form`'s `optionalText` for this field when the form's
   * `requiredIndicator` is `"optional"`; `false` hides it on this field.
   */
  optionalText?: ReactNode | false
} & BooleanFieldRules

/**
 * @remarks When to use
 * Use `Switch` only for a setting that takes effect immediately, with no
 * submit step — dark mode, notifications on a settings page that autosaves,
 * a UI mode toggle whose `onChange` does the work. MUI 9's `Switch` sets
 * `role="switch"` on the input, and assistive tech announces "on/off" —
 * correct for an immediate setting, wrong for an answer that is only
 * recorded on submit. If the page has a Submit button, use `Checkbox`
 * instead.
 */
export function Switch({
  name,
  label,
  helperText,
  disabled,
  required,
  validate,
  optionalText,
  onChange,
  onBlur,
  slotProps,
  ...rest
}: SwitchProps) {
  return (
    <FieldFrame<boolean>
      componentName="Switch"
      name={name}
      label={label}
      helperText={helperText}
      disabled={disabled}
      rules={{ required, validate }}
      optionalText={optionalText}
      labelAs="control"
      // For the dev-mode "no accessible name" check only — read, not destructured, so
      // both still reach the control through `rest`.
      aria-label={rest['aria-label']}
      aria-labelledby={rest['aria-labelledby']}
      renderControl={({ field, required: isRequired, inputA11y }) => (
        <MuiSwitch
          {...rest}
          name={field.name}
          checked={Boolean(field.value)}
          onChange={(e, checked) => {
            field.onChange(checked)
            onChange?.(e, checked)
          }}
          onBlur={(e) => {
            field.onBlur()
            onBlur?.(e)
          }}
          slotProps={{
            ...slotProps,
            // FormControlLabel clones its own resolved `required` onto this component's
            // top-level `required` prop (suppressed to `false` in `optional` mode so its
            // asterisk hides); the native input's `required` is set here instead, so it
            // stays correct regardless of what FormControlLabel clones in.
            input: mergeSlotProps(slotProps?.input, {
              ref: field.ref,
              required: isRequired,
              ...inputA11y,
            }),
          }}
        />
      )}
    />
  )
}
