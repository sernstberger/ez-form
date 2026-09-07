import type { ReactNode } from 'react'
import MuiCheckbox, { type CheckboxProps as MuiCheckboxProps } from '@mui/material/Checkbox'
import type { FormControlLabelProps } from '@mui/material/FormControlLabel'
import { mergeSlotProps } from '@mui/material/utils'
import { BoundFieldBase } from '../BoundField'
import type { BooleanFieldRules } from '../../rules'

export type CheckboxProps = Omit<MuiCheckboxProps, 'name' | 'checked' | 'required'> & {
  name: string
  label: ReactNode
  helperText?: ReactNode
  /**
   * Where the label sits relative to the box: MUI's own `FormControlLabel.labelPlacement`,
   * `'end' | 'start' | 'top' | 'bottom'`, defaulting to `FormControlLabel`'s `'end'` (#139).
   *
   * This is *not* the form-level `labelPlacement` axis that `<Form>` and the text-shaped
   * fields share. A `FormControlLabel` puts the label inside the single `<label>` that is
   * also the click target, so there is no separate label element for that axis's label
   * column to fill — these two fields are `selfLabelled` and opt out of it entirely
   * (#133). Forwarded straight through `BoundField`'s `controlLabelProps`; anything else
   * `FormControlLabel` takes is reachable the same way from a
   * `<BoundField labelAs="control">`.
   */
  labelPlacement?: FormControlLabelProps['labelPlacement']
} & BooleanFieldRules

/**
 * @remarks When to use
 * Use `Checkbox` for a yes/no answer or opt-in recorded when the form is
 * submitted — "I accept the terms", "Same as shipping", "Insure a vehicle" —
 * or one of several independent options (`CheckboxGroup`). If the page has a
 * Submit button, this is almost always the right control. Prefer `Switch`
 * only for a setting that takes effect immediately, with no submit step.
 */
export function Checkbox({
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
}: CheckboxProps) {
  return (
    <BoundFieldBase<boolean>
      componentName="Checkbox"
      name={name}
      label={label}
      helperText={helperText}
      disabled={disabled}
      rules={{ required, validate }}
      labelAs="control"
      // MUI's `FormControlLabel.labelPlacement`, not the form-level axis (#139). Passed
      // only when the consumer set it: a `{ labelPlacement: undefined }` object would
      // still be spread onto `FormControlLabel`, and while `undefined` there falls back
      // to `'end'` today, saying nothing is what actually leaves MUI's default in charge.
      controlLabelProps={labelPlacement ? { labelPlacement } : undefined}
      // For the dev-mode "no accessible name" check only — read, not destructured, so
      // both still reach the control through `rest`.
      aria-label={rest['aria-label']}
      aria-labelledby={rest['aria-labelledby']}
      // The consumer's own description, merged with the helper text's id on the
      // control rather than replaced by it — read, not destructured, so the
      // (inert) copy on MUI's root through `rest` is unchanged (#102).
      aria-describedby={rest['aria-describedby']}
      render={({ field, required: isRequired, inputA11y }) => (
        <MuiCheckbox
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
