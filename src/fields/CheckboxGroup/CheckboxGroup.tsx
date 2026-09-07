import type { ChangeEvent, FocusEvent, ReactNode } from 'react'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import FormGroup, { type FormGroupProps } from '@mui/material/FormGroup'
import { FieldFrame } from '../FieldFrame'
import type { LabelPlacementProps } from '../LabelPlacementContext'
import type { Option } from '../Option'
import type { FieldRules } from '../../rules'
import { warnDuplicateOptions } from '../../devWarn'

type Value = Option['value']

export type CheckboxGroupProps = Omit<FormGroupProps, 'children' | 'onChange' | 'onBlur'> & {
  name: string
  /** Rendered as the legend above the checkboxes. */
  label: ReactNode
  options: readonly Option[]
  helperText?: ReactNode
  disabled?: boolean
  /** Runs after the form's handler with the full new array. */
  onChange?: (event: ChangeEvent<HTMLInputElement>, value: Value[]) => void
  /** The event's element is Checkbox's root button, not the hidden input. */
  onBlur?: (event: FocusEvent<HTMLElement>) => void
} & Pick<FieldRules<Value[]>, 'required' | 'validate'> &
  LabelPlacementProps

/**
 * N checkboxes, one array. MUI has no component for this; this is its
 * documented `FormGroup` + `Checkbox` pattern. The stored array keeps the
 * order of `options`, so the value is stable no matter the click order.
 * `required` means at least one is checked.
 */
export function CheckboxGroup({
  name,
  label,
  options,
  helperText,
  disabled,
  required,
  validate,
  onChange,
  onBlur,
  labelPlacement,
  ...rest
}: CheckboxGroupProps) {
  warnDuplicateOptions('CheckboxGroup', name, options)
  return (
    <FieldFrame<Value[]>
      componentName="CheckboxGroup"
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
      renderControl={({ field, inputA11y, labelId }) => {
        const selected: Value[] = Array.isArray(field.value) ? field.value : []
        return (
          // No `aria-required`: ARIA does not support it on `role="group"`
          // (unlike RadioGroup's `radiogroup`), and axe flags it. The legend's
          // asterisk and the required error carry that to the user.
          // `?? rest`: the legend's id wins when there is a legend, otherwise a
          // consumer's own `aria-labelledby` survives the spread above it.
          <FormGroup
            {...rest}
            {...inputA11y}
            role="group"
            aria-labelledby={labelId ?? rest['aria-labelledby']}
          >
            {options.map((o, i) => (
              <FormControlLabel
                key={String(o.value)}
                label={o.label}
                disabled={o.disabled}
                control={
                  <Checkbox
                    name={field.name}
                    checked={selected.includes(o.value)}
                    onChange={(e, checked) => {
                      const next = options
                        .map((opt) => opt.value)
                        .filter((v) => (v === o.value ? checked : selected.includes(v)))
                      field.onChange(next)
                      onChange?.(e, next)
                    }}
                    onBlur={(e) => {
                      field.onBlur()
                      onBlur?.(e)
                    }}
                    // hookform's ref on the first checkbox: the group is focused on submit error.
                    slotProps={i === 0 ? { input: { ref: field.ref } } : undefined}
                  />
                }
              />
            ))}
          </FormGroup>
        )
      }}
    />
  )
}
