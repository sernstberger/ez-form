import type { ReactNode } from 'react'
import MuiRating, { type RatingProps as MuiRatingProps } from '@mui/material/Rating'
import { FieldFrame } from '../FieldFrame'
import { mergeDisabled } from '../mergeDisabled'
import type { FieldRules } from '../../rules'

export type RatingProps = Omit<MuiRatingProps, 'name' | 'value' | 'defaultValue'> & {
  name: string
  /** Rendered as the legend above the stars. */
  label: ReactNode
  helperText?: ReactNode
  disabled?: boolean
} & Pick<FieldRules<number | null>, 'required' | 'validate'>

/**
 * Form value is `number | null`; clicking the selected star clears to `null`.
 * MUI renders one hidden radio per star and groups them by `name`, so the
 * field's name doubles as the radio group name.
 */
export function Rating({
  name,
  label,
  helperText,
  disabled,
  required,
  validate,
  onChange,
  onBlur,
  ...rest
}: RatingProps) {
  return (
    <FieldFrame<number | null>
      componentName="Rating"
      name={name}
      label={label}
      helperText={helperText}
      disabled={disabled}
      rules={{ required, validate }}
      labelAs="legend"
      renderControl={({ field, required: isRequired, inputA11y, labelId }) => (
        <RatingControl
          {...rest}
          {...inputA11y}
          role="radiogroup"
          aria-labelledby={labelId}
          aria-required={isRequired || undefined}
          name={field.name}
          value={(field.value as number | null | undefined) ?? null}
          disabled={mergeDisabled(disabled, field.disabled)}
          fieldRef={field.ref}
          onChange={(e, value) => {
            field.onChange(value)
            onChange?.(e, value)
          }}
          onBlur={(e) => {
            field.onBlur()
            onBlur?.(e)
          }}
        />
      )}
    />
  )
}

/** MUI Rating has no input slot; hand hookform the first radio via a callback ref on the root. */
function RatingControl({
  fieldRef,
  ...props
}: MuiRatingProps & { fieldRef: (el: HTMLInputElement | null) => void }) {
  return (
    <MuiRating
      {...props}
      ref={(root: HTMLSpanElement | null) => fieldRef(root?.querySelector('input') ?? null)}
    />
  )
}
