import type { ReactNode } from 'react'
import ToggleButton from '@mui/material/ToggleButton'
import MuiToggleButtonGroup, {
  type ToggleButtonGroupProps as MuiToggleButtonGroupProps,
} from '@mui/material/ToggleButtonGroup'
import { FieldFrame } from '../FieldFrame'
import type { LabelPlacementProps } from '../LabelPlacementContext'
import { mergeDisabled } from '../mergeDisabled'
import type { Option } from '../Option'
import type { FieldRules } from '../../rules'
import { warnDuplicateOptions } from '../../devWarn'

type Value = Option['value']

export type ToggleButtonGroupProps = Omit<
  MuiToggleButtonGroupProps,
  'name' | 'value' | 'defaultValue' | 'children'
> & {
  name: string
  /** Rendered as the legend above the buttons. */
  label: ReactNode
  options: readonly Option[]
  helperText?: ReactNode
  disabled?: boolean
} & Pick<FieldRules<Value | null | Value[]>, 'required' | 'validate'> &
  LabelPlacementProps

/**
 * Form value is `Option['value'] | null` under `exclusive`, else
 * `Option['value'][]`. MUI compares button values by identity, so typed
 * option values round-trip unchanged.
 */
export function ToggleButtonGroup({
  name,
  label,
  options,
  helperText,
  disabled,
  required,
  validate,
  exclusive,
  onChange,
  onBlur,
  labelPlacement,
  ...rest
}: ToggleButtonGroupProps) {
  warnDuplicateOptions('ToggleButtonGroup', name, options)
  return (
    <FieldFrame<Value | null | Value[]>
      componentName="ToggleButtonGroup"
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
      renderControl={({ field, inputA11y, labelId }) => (
        <MuiToggleButtonGroup
          {...rest}
          {...inputA11y}
          // No `aria-required`: ARIA does not support it on this element's
          // `role="group"` (unlike RadioGroup's `radiogroup`), and axe flags it.
          // `?? rest`: the legend's id wins when there is a legend, otherwise a
          // consumer's own `aria-labelledby` survives the spread above it.
          aria-labelledby={labelId ?? rest['aria-labelledby']}
          exclusive={exclusive}
          // FormControl's disabled context does not reach ToggleButton (not a form control).
          disabled={mergeDisabled(disabled, field.disabled)}
          value={field.value ?? (exclusive ? null : [])}
          onChange={(e, value) => {
            field.onChange(value)
            onChange?.(e, value)
          }}
          onBlur={(e) => {
            field.onBlur()
            onBlur?.(e)
          }}
        >
          {options.map((o, i) => (
            <ToggleButton
              key={String(o.value)}
              value={o.value}
              disabled={o.disabled}
              // hookform's ref on the first button: the group is focused on submit error.
              ref={i === 0 ? field.ref : undefined}
            >
              {o.label}
            </ToggleButton>
          ))}
        </MuiToggleButtonGroup>
      )}
    />
  )
}
