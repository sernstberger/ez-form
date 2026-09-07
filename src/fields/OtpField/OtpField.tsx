import type { ReactNode } from 'react'
import type { OTPField } from '@base-ui/react/otp-field'
import { OtpFieldControl, type OtpFieldControlProps } from './OtpFieldControl'
import { useEzField } from '../useEzField'
import type { LabelPlacementProps } from '../LabelPlacementContext'
import { mergeDisabled } from '../mergeDisabled'
import { hasLabel } from '../../devWarn'
import { useRuleMessages } from '../../Form/RuleMessagesContext'
import type { FieldRules } from '../../rules'

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
  // Base UI's Root takes a `(state) => string` form; Root renders no element here
  // (`FormControl` is the root), so this is the plain `string` MUI takes — the same
  // narrowing `NumberField` makes, and the channel the placement classes use.
  | 'className'
> & {
  name: string
  className?: string
  label?: ReactNode
  helperText?: ReactNode
  size?: 'small' | 'medium'
  disabled?: boolean
  /** Number of characters. */
  length?: number
  /** Runs after the form's own handler. */
  onValueChange?: OTPField.Root.Props['onValueChange']
  /** Runs after the form's own handler, when focus leaves the group. */
  onBlur?: () => void
  /** See `OtpFieldControlProps['characterLabel']`; theme-defaultable via `EzOtpField`. */
  characterLabel?: OtpFieldControlProps['characterLabel']
} & Pick<FieldRules<string>, 'required' | 'validate'> &
  LabelPlacementProps

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
  length = 6,
  onValueChange,
  onBlur,
  labelPlacement,
  // Routed through the hook, then onto `OtpFieldControl`'s `className`, which
  // joins it with `otpFieldClasses.root` on the `FormControl` root — the same box
  // every other family's placement classes land on (#9, #66).
  className,
  ...rest
}: OtpFieldProps) {
  const messages = useRuleMessages()
  const l = typeof label === 'string' ? label : messages.fallbackLabel
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
          v === '' || v == null || v.length === length || messages.exactLength(l, length),
      },
    },
    // Read, not destructured: both still reach the control through `rest`.
    'aria-label': rest['aria-label'],
    'aria-labelledby': rest['aria-labelledby'],
    labelPlacement,
    className,
  })
  const text = f.helperText(helperText)

  return (
    <OtpFieldControl
      {...rest}
      className={f.layoutClassName}
      name={f.field.name}
      label={f.displayLabel}
      // `label`, not `displayLabel`: in `optional` mode `displayLabel` wraps a
      // missing label with the "(optional)" suffix, which is not a name. The
      // control uses this to decide whether slot 1 still needs its own hidden
      // label (#110), so it must ask the same question `warnMissingLabel` does.
      labelled={hasLabel(label)}
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
      // Through the hook, not `f.helperTextA11y`: the binding owns the helper-text
      // role wherever it is set (#104). `helperTextProps` is `@internal` and has no
      // consumer channel today, so there is nothing to merge — calling the hook is
      // what keeps the binding the owner if one is ever added.
      helperTextProps={f.helperTextSlotProps()}
      inputRef={f.field.ref}
      inputProps={{
        ...f.inputA11y(text),
        // Merged with the helper text's id rather than replaced by it: an accessible
        // description is a list (#102 row 8). Read from `rest`, not destructured out
        // of it — `rootProps` still carries it to `OTPField.Root`, which is the group
        // the field is named as, and the slots need their own copy.
        'aria-describedby': f.describedBy(rest['aria-describedby'], text),
        onBlur: () => {
          f.field.onBlur()
          onBlur?.()
        },
      }}
    />
  )
}
