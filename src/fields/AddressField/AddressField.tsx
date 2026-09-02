import type { ReactNode } from 'react'
import { useDefaultProps } from '@mui/material/DefaultPropsProvider'
import generateUtilityClasses from '@mui/material/generateUtilityClasses'
import { styled } from '@mui/material/styles'
import { TextField, type TextFieldProps } from '../TextField'
import { StateSelect, type StateSelectProps } from '../StateSelect'
import { ZipField, type ZipFieldProps } from '../ZipField'
import { FormSection, type FormSectionProps } from '../../FormSection'
import { useEzFormContext } from '../../useEzFormContext'
import { cx } from '../../cx'

/** The object an `AddressField` reads and writes at its `name`. */
export interface AddressValue {
  street: string
  /** Present only while `street2` is rendered; the part is optional. */
  street2?: string | undefined
  city: string
  /** USPS abbreviation, as `StateSelect` stores it. */
  state: string
  /** Five digits, as `ZipField` stores it. */
  zip: string
}

export const addressFieldClasses = generateUtilityClasses('EzAddressField', [
  'root',
  'street',
  'street2',
  'city',
  'state',
  'zip',
])

/**
 * The composite's minimum layout, not decoration: five controls that must not
 * stack into one column on a wide form. A four-column grid with named areas
 * lets a theme re-order or re-span any part through
 * `EzAddressField.styleOverrides.root` (change `gridTemplateAreas`) without
 * touching the component, and collapses to one column on small screens.
 */
const AddressFieldRoot = styled('div', { name: 'EzAddressField', slot: 'Root' })(({ theme }) => ({
  display: 'grid',
  gap: theme.spacing(2),
  gridTemplateColumns: '1fr',
  gridTemplateAreas: `"street" "street2" "city" "state" "zip"`,
  [theme.breakpoints.up('sm')]: {
    gridTemplateColumns: 'repeat(4, 1fr)',
    gridTemplateAreas: `"street street street street" "street2 street2 street2 street2" "city city state zip"`,
  },
}))

// Each part is placed by grid area rather than source order, so the areas above
// are the single place a theme changes the layout.
const AddressFieldStreet = styled(TextField, { name: 'EzAddressField', slot: 'Street' })({
  gridArea: 'street',
})
const AddressFieldStreet2 = styled(TextField, { name: 'EzAddressField', slot: 'Street2' })({
  gridArea: 'street2',
})
const AddressFieldCity = styled(TextField, { name: 'EzAddressField', slot: 'City' })({
  gridArea: 'city',
})
const AddressFieldState = styled(StateSelect, { name: 'EzAddressField', slot: 'State' })({
  gridArea: 'state',
})
const AddressFieldZip = styled(ZipField, { name: 'EzAddressField', slot: 'Zip' })({
  gridArea: 'zip',
})

/** Rules the composite applies to each required part; the parts own the rest. */
type PartRules = Pick<TextFieldProps, 'required' | 'disabled'>

export interface AddressFieldProps extends PartRules {
  /** Base path for the group; parts register at `${name}.street`, `${name}.city`, … */
  name: string
  /**
   * Renders the group as a `FormSection` fieldset named by this legend. Without
   * it the parts sit in a plain container, named by their own labels only.
   */
  legend?: ReactNode
  /** Text under the legend, wired to the fieldset via `aria-describedby`. */
  description?: ReactNode
  /**
   * Prefixes every part's `autoComplete` token — `"shipping"` gives
   * `autoComplete="shipping street-address"`, and so on. Any
   * [autofill section token](https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#autofill)
   * works, including a `section-*` name.
   */
  autoCompleteSection?: 'shipping' | 'billing' | (string & {})
  /** Renders the optional second street line. Default `true`. */
  street2?: boolean
  streetLabel?: ReactNode
  street2Label?: ReactNode
  cityLabel?: ReactNode
  stateLabel?: ReactNode
  zipLabel?: ReactNode
  className?: string
  /**
   * Per-part props. `name` is omitted from every part: the composite derives
   * all five paths from its own `name`, and since a slot spreads *after* the
   * defaults, a slot `name` would silently rebind that part to another path —
   * the value would land outside the address object while the part still
   * looked correct. Everything else (per-part `helperText`, an extra rule, a
   * `size`) passes through and wins over the composite's default.
   */
  slotProps?: {
    section?: Omit<FormSectionProps, 'title' | 'description'>
    street?: Omit<Partial<TextFieldProps>, 'name'>
    street2?: Omit<Partial<TextFieldProps>, 'name'>
    city?: Omit<Partial<TextFieldProps>, 'name'>
    state?: Omit<Partial<StateSelectProps>, 'name'>
    zip?: Omit<Partial<ZipFieldProps>, 'name'>
  }
}

/** Prefixes an autofill token with the section name, when one was given. */
const token = (section: string | undefined, field: string) =>
  section ? `${section} ${field}` : field

/**
 * A US street address as five bound parts under one nested object `name`:
 * `street`, an optional `street2`, `city`, `state` (`StateSelect`) and `zip`
 * (`ZipField`). Each part is the real field component, so a per-part error,
 * `required`, `disabled` and focus-on-error behave exactly as they do when the
 * five fields are written out by hand — this composite only supplies the
 * names, the autofill tokens, the labels and the layout.
 *
 * `required` applies to street, city, state and zip; `street2` is optional by
 * definition and never picks it up. `autoCompleteSection` prefixes every token
 * at once (`"shipping"` → `shipping street-address`, …), which is what makes a
 * browser fill a shipping and a billing address on the same page separately.
 */
export function AddressField(inProps: AddressFieldProps) {
  const {
    name,
    legend,
    description,
    autoCompleteSection,
    street2 = true,
    streetLabel = 'Street address',
    street2Label = 'Apartment, suite, etc.',
    cityLabel = 'City',
    stateLabel = 'State',
    zipLabel = 'ZIP code',
    required,
    disabled,
    className,
    slotProps,
    ...rest
  } = useDefaultProps({ props: inProps, name: 'EzAddressField' })
  // Guard here as well as in each part, so the "outside <Form>" error names
  // <AddressField> rather than whichever part happened to render first.
  useEzFormContext('AddressField')

  const parts = (
    <AddressFieldRoot {...rest} className={cx(addressFieldClasses.root, className)}>
      <AddressFieldStreet
        name={`${name}.street`}
        label={streetLabel}
        autoComplete={token(autoCompleteSection, 'street-address')}
        required={required}
        disabled={disabled}
        {...slotProps?.street}
        className={cx(addressFieldClasses.street, slotProps?.street?.className)}
      />
      {street2 && (
        <AddressFieldStreet2
          name={`${name}.street2`}
          label={street2Label}
          autoComplete={token(autoCompleteSection, 'address-line2')}
          disabled={disabled}
          {...slotProps?.street2}
          className={cx(addressFieldClasses.street2, slotProps?.street2?.className)}
        />
      )}
      <AddressFieldCity
        name={`${name}.city`}
        label={cityLabel}
        autoComplete={token(autoCompleteSection, 'address-level2')}
        required={required}
        disabled={disabled}
        {...slotProps?.city}
        className={cx(addressFieldClasses.city, slotProps?.city?.className)}
      />
      <AddressFieldState
        name={`${name}.state`}
        label={stateLabel}
        autoComplete={token(autoCompleteSection, 'address-level1')}
        required={required}
        disabled={disabled}
        {...slotProps?.state}
        className={cx(addressFieldClasses.state, slotProps?.state?.className)}
      />
      <AddressFieldZip
        name={`${name}.zip`}
        label={zipLabel}
        autoComplete={token(autoCompleteSection, 'postal-code')}
        required={required}
        disabled={disabled}
        {...slotProps?.zip}
        className={cx(addressFieldClasses.zip, slotProps?.zip?.className)}
      />
    </AddressFieldRoot>
  )

  if (legend == null && description == null) return parts
  return (
    <FormSection {...slotProps?.section} title={legend} description={description}>
      {parts}
    </FormSection>
  )
}
