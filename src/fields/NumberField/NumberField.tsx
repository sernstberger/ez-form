import type { FocusEventHandler, ReactNode } from 'react'
import type { NumberField as BaseNumberField } from '@base-ui/react/number-field'
import type { ValidationRule } from 'react-hook-form'
import { NumberFieldControl } from './NumberFieldControl'
import { useEzField } from '../useEzField'
import { mergeDisabled } from '../mergeDisabled'
import type { FieldRules } from '../../rules'

export type NumberFieldProps = Omit<
  BaseNumberField.Root.Props,
  | 'name'
  | 'value'
  | 'defaultValue'
  | 'onValueChange'
  | 'required'
  | 'disabled'
  | 'min'
  | 'max'
  | 'render'
  | 'children'
> & {
  name: string
  label?: ReactNode
  helperText?: ReactNode
  size?: 'small' | 'medium'
  disabled?: boolean
  /** Runs after the form's own handler. */
  onValueChange?: BaseNumberField.Root.Props['onValueChange']
  onBlur?: FocusEventHandler<HTMLInputElement>
  /**
   * One prop for both: the bound the stepper stops at and the validation
   * message (`<label> must be at least <value>.`). Typed input may go past it
   * and shows the message; set `allowOutOfRange={false}` to clamp instead.
   */
  min?: ValidationRule<number>
  max?: ValidationRule<number>
} & Pick<FieldRules<number | null>, 'required' | 'validate'>

const bound = (rule: ValidationRule<number> | undefined): number | undefined =>
  rule === undefined ? undefined : typeof rule === 'number' ? rule : rule.value

/**
 * Numeric input whose form value is `number | null` (empty is `null`), so
 * `z.number()` works and `min`/`max` compare as numbers.
 */
export function NumberField({
  name,
  label,
  helperText,
  disabled,
  required,
  min,
  max,
  validate,
  onValueChange,
  onBlur,
  allowOutOfRange = true,
  ...rest
}: NumberFieldProps) {
  const f = useEzField<number | null>(name, 'NumberField', {
    label,
    rules: { required, min, max, validate },
  })
  const text = f.helperText(helperText)

  return (
    <NumberFieldControl
      {...rest}
      name={f.field.name}
      label={label}
      value={f.field.value ?? null}
      onValueChange={(value, details) => {
        f.field.onChange(value)
        onValueChange?.(value, details)
      }}
      min={bound(min)}
      max={bound(max)}
      allowOutOfRange={allowOutOfRange}
      required={f.required}
      disabled={mergeDisabled(disabled, f.field.disabled)}
      error={f.invalid}
      helperText={text}
      helperTextProps={f.helperTextA11y}
      inputRef={f.field.ref}
      inputProps={{
        ...f.inputA11y(text),
        onBlur: (e) => {
          f.field.onBlur()
          onBlur?.(e)
        },
      }}
    />
  )
}
