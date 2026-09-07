import type { ReactNode } from 'react'
import { BoundField } from '../fields/BoundField'
import type { LabelPlacement } from '../fields/LabelPlacementContext'
import type { FieldRules } from '../rules'

/**
 * The reference custom control: a plain `<input type="text">` bound through the public
 * `<BoundField render={…}>`, with **no MUI component of any kind** inside `render`.
 *
 * This exists to run the full `describeFieldContract` against the public path (#28,
 * PHILOSOPHY rule 3). A field-shaped public API owes the shared contract, but the
 * contract renders a *concrete* field — `getControl`, `expectDisabled`, a schema,
 * defaults — so the only way to hold `<BoundField>` to it is to ship a control for it
 * to run against and exempt nothing.
 *
 * ### Why a bare `<input>`, and not a MUI or Base UI component
 *
 * A bare input is the case a consumer actually has: a third-party widget this library
 * does not wrap, with no MUI wiring to accidentally supply the a11y attributes the
 * binding is supposed to. Wrapping a MUI control here would let MUI's own label/helper
 * machinery cover for a `bound` member `render` forgot, and the run would prove
 * nothing about `<BoundField>`. Everything the contract asserts — the accessible name,
 * the merged description, `aria-invalid`, the focus move after a failed submit, the
 * placement classes — has to arrive from `bound` alone.
 *
 * It is also the exact code the README's "Wrap your own control" section shows, so the
 * documented example is the one under test.
 *
 * ### It is `src/test/`, not `src/`
 *
 * Not exported from the package: this is the contract's subject, not a component
 * consumers are meant to use. `src/test/` is already where the shared fixtures live
 * (`mockAddressLookup`, `pickers`), and the file is excluded from the build the same way.
 */
export interface ReferenceControlProps {
  name: string
  label?: ReactNode
  helperText?: ReactNode
  disabled?: boolean
  required?: boolean
  rules?: FieldRules<string>
  labelPlacement?: LabelPlacement
  'aria-label'?: string
  'aria-labelledby'?: string
  'aria-describedby'?: string
  onChange?: (value: string) => void
}

export function ReferenceControl({
  name,
  label,
  helperText,
  disabled,
  required,
  rules,
  labelPlacement,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  onChange,
}: ReferenceControlProps) {
  return (
    <BoundField<string>
      componentName="ReferenceControl"
      name={name}
      label={label}
      helperText={helperText}
      disabled={disabled}
      rules={{ required, ...rules }}
      labelPlacement={labelPlacement}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy}
      // No `labelAs`: this control renders its own `<label>`, which is what the
      // `'none'` default already does. Left unstated deliberately — an explicit prop
      // beats `useDefaultProps`, so stating the default here would make
      // `theme.components.EzBoundField.defaultProps.labelAs` unreachable and the
      // contract's row 6 unable to assert the wiring is connected at all.
      render={(bound) => (
        <>
          {/* The consumer's own label element, paired with `controlId`. `displayLabel`
              rather than the raw `label` so `optional` mode's suffix shows; `labelId`
              so a control that needed `aria-labelledby` could point at it. */}
          {bound.displayLabel ? (
            <label id={bound.labelId} htmlFor={bound.controlId}>
              {bound.displayLabel}
              {(bound.labelRequired ?? bound.required) ? ' *' : null}
            </label>
          ) : null}
          <input
            type="text"
            id={bound.controlId}
            name={bound.field.name}
            // hookform's ref, forked in `useEzField` to also register this field's
            // focus target for `<FormErrorSummary>` (#98). Without it a failed submit
            // leaves focus on the submit button.
            ref={bound.field.ref}
            // `?? ''`: a form with no `defaultValues` entry renders `value ===
            // undefined`, which would make this input uncontrolled on the first
            // render and controlled on the next.
            value={bound.field.value ?? ''}
            disabled={bound.field.disabled}
            required={bound.required}
            onChange={(e) => {
              bound.field.onChange(e.target.value)
              onChange?.(e.target.value)
            }}
            onBlur={bound.field.onBlur}
            // The consumer's ARIA name, for a field with no visible label. Left off,
            // the name would land on the `FormControl` wrapper and this input would be
            // anonymous while axe reported clean (#99).
            {...bound.nameA11y}
            // `aria-invalid` plus the *merged* `aria-describedby` — the consumer's own
            // ids joined with the helper text's, not one replacing the other
            // (#102/#104).
            {...bound.inputA11y}
          />
        </>
      )}
    />
  )
}
