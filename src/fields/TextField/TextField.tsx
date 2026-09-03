import MuiTextField, { type TextFieldProps as MuiTextFieldProps } from '@mui/material/TextField'
import { mergeSlotProps, useForkRef } from '@mui/material/utils'
import type { ReactNode } from 'react'
import { useEzField } from '../useEzField'
import { mergeDisabled } from '../mergeDisabled'
import { resolveAutoComplete } from '../resolveAutoComplete'
import { useAssisted } from '../../Form/AssistedContext'
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
   * Internal. A second ref to the `<input>`, forked with hookform's, for the
   * fields built on `TextField` that need the element themselves (`PhoneField`,
   * `SsnField`, `FeinField` restore the caret after a reformat).
   *
   * This is the *only* channel a field's own ref takes: it goes to MUI's
   * `inputRef`, and `InputBase` forks that with whatever the consumer put in
   * `slotProps.htmlInput.ref` — object or callback form alike, since MUI
   * resolves the callback itself. Composing the two in the field instead can
   * only see the object form and silently drops a callback-form ref (#92).
   * Every field using this `Omit`s it from its own public props.
   *
   * @internal
   */
  inputRef?: MuiTextFieldProps['inputRef']
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
  autoComplete: autoCompleteProp,
  componentName = 'TextField',
  inputRef: inputRefProp,
  ...rest
}: TextFieldProps) {
  const assisted = useAssisted()
  const autoComplete =
    autoCompleteProp ??
    resolveAutoComplete(type ? AUTO_COMPLETE_BY_TYPE[type] : undefined, assisted)
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
  // `useForkRef` is MUI's own composer; `InputBase` already wraps hookform's ref in the same hook,
  // so this extra layer changes nothing for a plain `TextField` without a consumer `inputRef`.
  const inputRef = useForkRef(ref, inputRefProp)

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
      inputRef={inputRef}
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
