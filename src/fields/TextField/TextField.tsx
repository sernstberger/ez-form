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
   * Renders this text in the input instead of the bound value, for the fields
   * whose stored value and displayed value deliberately differ: `PhoneField`
   * stores `'5555555555'` and displays `'555-555-5555'`. The binding is
   * unchanged — the form value, validation and `aria-*` wiring all still come
   * from `name` — so a field using this must map the typed text back to a
   * stored value in its own `onChange` before the form's handler sees it.
   *
   * Left `undefined` (the default, and every plain `<TextField>`), the bound
   * value is displayed as-is.
   */
  displayValue?: string
} & FieldRules<string>

// `type` → mobile keyboard (`inputMode`) and autofill (`autoComplete`) token. Only types
// with one unambiguous token are covered; a wrong guess is worse than none (#6, #7).
const INPUT_MODE_BY_TYPE: Partial<Record<string, string>> = {
  email: 'email',
  tel: 'tel',
  url: 'url',
  search: 'search',
}
const AUTO_COMPLETE_BY_TYPE: Partial<Record<string, string>> = {
  email: 'email',
  tel: 'tel',
  url: 'url',
}

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
  displayValue,
  type,
  autoComplete = type ? AUTO_COMPLETE_BY_TYPE[type] : undefined,
  ...rest
}: TextFieldProps) {
  const f = useEzField<string>(name, 'TextField', {
    label,
    rules: { required, min, max, minLength, maxLength, pattern, validate },
    optionalText,
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
      value={displayValue ?? value ?? ''}
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
      type={type}
      autoComplete={autoComplete}
      slotProps={{
        ...slotProps,
        formHelperText: mergeSlotProps(slotProps?.formHelperText, { role: f.helperTextA11y.role }),
        inputLabel: mergeSlotProps(slotProps?.inputLabel, { required: f.labelRequired }),
        htmlInput: mergeSlotProps(slotProps?.htmlInput, {
          inputMode: type ? INPUT_MODE_BY_TYPE[type] : undefined,
        }),
      }}
      {...rest}
    />
  )
}
