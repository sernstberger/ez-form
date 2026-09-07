import type { ReactNode } from 'react'
import MuiRating, { type RatingProps as MuiRatingProps } from '@mui/material/Rating'
import { FieldFrame } from '../FieldFrame'
import type { LabelPlacementProps } from '../LabelPlacementContext'
import { mergeDisabled } from '../mergeDisabled'
import type { FieldRules } from '../../rules'

export type RatingProps = Omit<MuiRatingProps, 'name' | 'value' | 'defaultValue'> & {
  name: string
  /** Rendered as the legend above the stars. */
  label: ReactNode
  helperText?: ReactNode
  disabled?: boolean
} & Pick<FieldRules<number | null>, 'required' | 'validate'> & LabelPlacementProps

/**
 * Form value is `number | null`; clicking the selected star clears to `null`.
 * MUI renders one hidden radio per star and groups them by `name`, so the
 * field's name doubles as the radio group name.
 *
 * **The small size renders below the WCAG target-size minimum.** Every other
 * control ez-form renders is at least 24×24 CSS px, per WCAG 2.5.8 Target Size
 * (Minimum), and `Rating` at its default size is exactly 24×24. Set the `size`
 * prop to `small`, though, and MUI drops the star icon to `font-size: 18px`
 * with no padding — an 18×18 target.
 *
 * ez-form leaves that alone deliberately: MUI owns the small-variant sizing,
 * and padding a glyph you explicitly asked to be small is a styling judgement
 * this library does not make for you. If you need the small star to keep a
 * compliant target, add the padding in your own theme — the star still *looks*
 * small, the hit area does not:
 *
 * ```ts
 * createTheme({
 *   components: {
 *     MuiRating: {
 *       styleOverrides: {
 *         // 18px icon + 3px padding on each side = a 24×24 target.
 *         sizeSmall: { '& .MuiRating-icon': { padding: 3 } },
 *       },
 *     },
 *   },
 * })
 * ```
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
  labelPlacement,
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
      labelPlacement={labelPlacement}
      labelAs="legend"
      // For the dev-mode "no accessible name" check only — read, not destructured, so
      // both still reach the control through `rest`.
      aria-label={rest['aria-label']}
      aria-labelledby={rest['aria-labelledby']}
      // The consumer's own description, merged with the helper text's id on the
      // control rather than replaced by it — read, not destructured, so the
      // (inert) copy on MUI's root through `rest` is unchanged (#102).
      aria-describedby={rest['aria-describedby']}
      renderControl={({ field, required: isRequired, inputA11y, labelId }) => (
        <RatingControl
          {...rest}
          {...inputA11y}
          role="radiogroup"
          // `?? rest`: the legend's id wins when there is a legend, otherwise a
          // consumer's own `aria-labelledby` survives the spread above it.
          aria-labelledby={labelId ?? rest['aria-labelledby']}
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
