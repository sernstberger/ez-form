import MuiTextField, { type TextFieldProps as MuiTextFieldProps } from '@mui/material/TextField'
import { mergeSlotProps } from '@mui/material/utils'
import type { ReactNode } from 'react'
import { useEzField } from '../useEzField'
import { mergeDisabled } from '../mergeDisabled'
import type { FieldRules } from '../../rules'

/**
 * Omit only what the binding owns (`name`, `value`, `error`, `inputRef`, and
 * `required`, which the `required` rule drives). Anything the consumer might
 * also want (event handlers, `helperText`, `disabled`, `id`, `slotProps`) is
 * merged, hookform's handler first.
 */
export type TextFieldProps = Omit<
  MuiTextFieldProps,
  'name' | 'value' | 'error' | 'inputRef' | 'required'
> & {
  name: string
  /**
   * Overrides `Form`'s `optionalText` for this field when the form's
   * `requiredIndicator` is `"optional"`; `false` hides it on this field.
   */
  optionalText?: ReactNode | false
  /**
   * Internal. The name a dev-mode warning should call this field: `Select`,
   * `PasswordField` and `TextareaField` all render *through* `TextField`, and a
   * warning that named `TextField` would point the consumer at a component they
   * never wrote. Every such wrapper `Omit`s this from its own public props, so it
   * is not part of any component's API.
   *
   * @internal
   */
  componentName?: string
} & FieldRules<string>

export function TextField({
  name,
  label,
  helperText,
  disabled,
  onChange,
  onBlur,
  slotProps,
  required,
  min,
  max,
  minLength,
  maxLength,
  pattern,
  validate,
  optionalText,
  componentName = 'TextField',
  ...rest
}: TextFieldProps) {
  const f = useEzField<string>(name, componentName, {
    label,
    rules: { required, min, max, minLength, maxLength, pattern, validate },
    optionalText,
    // Read, not destructured: both still reach MUI through `rest`. The hook only
    // needs to know a label-less field is named some other way before it warns.
    'aria-label': rest['aria-label'],
    'aria-labelledby': rest['aria-labelledby'],
  })
  const {
    ref,
    value,
    disabled: fieldDisabled,
    onChange: fieldOnChange,
    onBlur: fieldOnBlur,
    ...fieldProps
  } = f.field

  // MUI TextField sets aria-invalid and aria-describedby itself; only `role` comes from the hook.
  return (
    <MuiTextField
      {...fieldProps}
      label={f.displayLabel}
      value={value ?? ''}
      onChange={(e) => {
        fieldOnChange(e)
        onChange?.(e)
      }}
      onBlur={(e) => {
        fieldOnBlur()
        onBlur?.(e)
      }}
      disabled={mergeDisabled(disabled, fieldDisabled)}
      required={f.required}
      inputRef={ref}
      error={f.invalid}
      helperText={f.helperText(helperText)}
      slotProps={{
        ...slotProps,
        formHelperText: mergeSlotProps(slotProps?.formHelperText, { role: f.helperTextA11y.role }),
        inputLabel: mergeSlotProps(slotProps?.inputLabel, { required: f.labelRequired }),
      }}
      {...rest}
    />
  )
}
