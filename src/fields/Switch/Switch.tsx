import type { ReactNode } from 'react'
import MuiSwitch, { type SwitchProps as MuiSwitchProps } from '@mui/material/Switch'
import { mergeSlotProps } from '@mui/material/utils'
import { FieldFrame } from '../FieldFrame'
import type { LabelPlacementProps } from '../LabelPlacementContext'
import type { BooleanFieldRules } from '../../rules'

export type SwitchProps = Omit<MuiSwitchProps, 'name' | 'checked' | 'required'> & {
  name: string
  label: ReactNode
  helperText?: ReactNode
} & BooleanFieldRules &
  LabelPlacementProps

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
  onChange,
  onBlur,
  slotProps,
  labelPlacement,
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
      labelPlacement={labelPlacement}
      labelAs="control"
      // For the dev-mode "no accessible name" check only — read, not destructured, so
      // both still reach the control through `rest`.
      aria-label={rest['aria-label']}
      aria-labelledby={rest['aria-labelledby']}
      // The consumer's own description, merged with the helper text's id on the
      // control rather than replaced by it — read, not destructured, so the
      // (inert) copy on MUI's root through `rest` is unchanged (#102).
      aria-describedby={rest['aria-describedby']}
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
