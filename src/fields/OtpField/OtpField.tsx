import type { ReactNode } from 'react'
import type { OTPField } from '@base-ui/react/otp-field'
import { OtpFieldControl } from './OtpFieldControl'
import { useEzField } from '../useEzField'
import { mergeDisabled } from '../mergeDisabled'
import { FALLBACK_LABEL, type FieldRules } from '../../rules'

export type OtpFieldProps = Omit<
  OTPField.Root.Props,
  | 'name'
  | 'value'
  | 'defaultValue'
  | 'onValueChange'
  | 'required'
  | 'disabled'
  | 'render'
  | 'children'
  | 'length'
> & {
  name: string
  label?: ReactNode
  helperText?: ReactNode
  size?: 'small' | 'medium'
  disabled?: boolean
  /** Number of characters. */
  length?: number
  /**
   * Overrides `Form`'s `optionalText` for this field when the form's
   * `requiredIndicator` is `"optional"`; `false` hides it on this field.
   */
  optionalText?: ReactNode | false
  /** Runs after the form's own handler. */
  onValueChange?: OTPField.Root.Props['onValueChange']
  /** Runs after the form's own handler, when focus leaves the group. */
  onBlur?: () => void
} & Pick<FieldRules<string>, 'required' | 'validate'>

/**
 * One-time-code input whose form value is the joined string (`''` when
 * empty). A half-typed code is never valid: besides `required` and
 * `validate`, a built-in rule rejects any value that is neither empty nor
 * exactly `length` characters.
 */
export function OtpField({
  name,
  label,
  helperText,
  disabled,
  required,
  validate,
  optionalText,
  length = 6,
  onValueChange,
  onBlur,
  ...rest
}: OtpFieldProps) {
  const l = typeof label === 'string' ? label : FALLBACK_LABEL
  const consumer =
    validate === undefined ? {} : typeof validate === 'function' ? { validate } : validate
  const f = useEzField<string>(name, 'OtpField', {
    label,
    rules: {
      required,
      // Consumer entries first: a built-in key must not be silently replaced.
      validate: {
        ...consumer,
        complete: (v) =>
          v === '' || v == null || v.length === length || `${l} must be ${length} characters.`,
      },
    },
    optionalText,
  })
  const text = f.helperText(helperText)

  return (
    <OtpFieldControl
      {...rest}
      name={f.field.name}
      label={f.displayLabel}
      length={length}
      value={f.field.value ?? ''}
      onValueChange={(value, details) => {
        f.field.onChange(value)
        onValueChange?.(value, details)
      }}
      required={f.required}
      labelRequired={f.labelRequired}
      disabled={mergeDisabled(disabled, f.field.disabled)}
      error={f.invalid}
      helperText={text}
      helperTextProps={f.helperTextA11y}
      inputRef={f.field.ref}
      inputProps={{
        ...f.inputA11y(text),
        onBlur: () => {
          f.field.onBlur()
          onBlur?.()
        },
      }}
    />
  )
}
