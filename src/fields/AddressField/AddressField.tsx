import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { useDefaultProps } from '@mui/material/DefaultPropsProvider'
import generateUtilityClasses from '@mui/material/generateUtilityClasses'
import ListItemText from '@mui/material/ListItemText'
import Paper, { type PaperProps } from '@mui/material/Paper'
import { styled } from '@mui/material/styles'
import { mergeSlotProps } from '@mui/material/utils'
import { TextField, type TextFieldProps } from '../TextField'
import { Autocomplete, type AutocompleteProps } from '../Autocomplete'
import { StateSelect, type StateSelectProps } from '../StateSelect'
import { ZipField, type ZipFieldProps } from '../ZipField'
import { resolveAutoComplete } from '../resolveAutoComplete'
import { FormSection, type FormSectionProps } from '../../FormSection'
import { LiveRegion, type LiveRegionProps } from '../../Form/LiveRegion'
import { useAssisted } from '../../Form/AssistedContext'
import { useEzFormContext } from '../../useEzFormContext'
import { cx } from '../../cx'
import type { AddressLookupProvider, AddressSuggestion } from './addressLookup'
import { useAddressLookup } from './useAddressLookup'

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
  'attribution',
  'status',
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
// The same `Street` slot, so `styleOverrides.street` reaches the part whichever
// component renders it. `styled` erases the generic; the cast restores it.
const AddressFieldStreetLookup = styled(Autocomplete, {
  name: 'EzAddressField',
  slot: 'Street',
})({ gridArea: 'street' }) as typeof Autocomplete
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
// The provider's attribution line under the listbox. The functional minimum
// (the listbox's own text style, a little inset) so a "Powered by …" line does
// not sit flush against the last option; `styleOverrides.attribution` restyles it.
const AddressFieldAttribution = styled('div', { name: 'EzAddressField', slot: 'Attribution' })(
  ({ theme }) => ({
    ...theme.typography.caption,
    color: (theme.vars ?? theme).palette.text.secondary,
    padding: theme.spacing(1, 2),
  }),
)
// Visually hidden (LiveRegion's default): the filled-in parts are the sighted
// feedback for a pick, so a visible line would only repeat what is on screen.
const AddressFieldStatus = styled(LiveRegion, { name: 'EzAddressField', slot: 'Status' })({})

/**
 * Reaches the listbox paper through context rather than a per-render slot
 * component: a component created inside `AddressField`'s render would be a new
 * type every render, remounting the open popup on every keystroke. The popup is
 * portaled, and context crosses portals.
 */
const AttributionContext = createContext<ReactNode>(null)

/**
 * MUI's Autocomplete paper with the attribution appended after the listbox. MUI
 * renders its own styled paper `as` this component, so its `MuiAutocomplete-paper`
 * styles and overrides still apply; this only adds the footer.
 */
function AddressFieldLookupPaper({ children, ...props }: PaperProps) {
  const attribution = useContext(AttributionContext)
  return (
    <Paper {...props}>
      {children}
      {attribution != null && attribution !== false && (
        <AddressFieldAttribution
          className={addressFieldClasses.attribution}
          // As MUI's own "No options" row: a click on the footer (a link in it,
          // say) must not blur the input and close the popup under the pointer.
          onMouseDown={(event) => event.preventDefault()}
        >
          {attribution}
        </AddressFieldAttribution>
      )}
    </Paper>
  )
}

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
  /**
   * Turns the street part into an address search: rows from `lookup.search`
   * appear under it as the user types, and picking one runs `lookup.resolve`
   * and fills every part it returns. Text typed without a pick stays as the
   * street, so manual entry is never blocked. Without it the street is a
   * plain `TextField`.
   */
  lookup?: AddressLookupProvider
  /** How long typing must pause before `lookup.search` runs. Default 300ms. */
  lookupDebounceMs?: number
  /** Shorter queries do not search. Default 3. */
  lookupMinChars?: number
  /** Announced (visually hidden) after a pick fills the parts. Default `'Address filled'`. */
  lookupFilledText?: ReactNode
  className?: string
  /**
   * Per-part props. `name` is omitted from every part: the composite derives
   * all five paths from its own `name`, and since a slot spreads *after* the
   * defaults, a slot `name` would silently rebind that part to another path —
   * the value would land outside the address object while the part still
   * looked correct. Everything else (per-part `helperText`, an extra rule, a
   * `size`) passes through and wins over the composite's default.
   *
   * Under `lookup` the street is an `Autocomplete`, and `slotProps.street` is
   * mapped onto it: the rules, `label`, `helperText`, `disabled`, `className`,
   * `optionalText`, `autoComplete` and `slotProps.htmlInput` reach the field
   * directly, `onChange` fires per keystroke as on a `TextField`, and every
   * other MUI TextField prop reaches the input via `textFieldProps`.
   */
  slotProps?: {
    section?: Omit<FormSectionProps, 'title' | 'description'>
    street?: Omit<Partial<TextFieldProps>, 'name'>
    street2?: Omit<Partial<TextFieldProps>, 'name'>
    city?: Omit<Partial<TextFieldProps>, 'name'>
    state?: Omit<Partial<StateSelectProps>, 'name'>
    zip?: Omit<Partial<ZipFieldProps>, 'name'>
    /** The `lookup` status region. `message`/`announcementKey` are owned by the field. */
    status?: Omit<LiveRegionProps, 'message' | 'announcementKey'>
  }
}

/**
 * Prefixes an autofill token with the section name, when one was given, then
 * runs it through `resolveAutoComplete` — this composite passes each part's
 * token down as an *explicit* `autoComplete` prop, so it has to apply the
 * assisted-mode rule itself rather than relying on the part's own default.
 */
const token = (section: string | undefined, field: string, assisted: boolean) =>
  resolveAutoComplete(section ? `${section} ${field}` : field, assisted)

/** What the lookup `Autocomplete` lists; the form stores `label`, never the id. */
interface LookupOption {
  value: string
  label: string
  suggestion: AddressSuggestion
}

/**
 * Suggestions → options. Two rows with the same street ("100 Main St" in two
 * towns) would store the same value, which `Autocomplete` rightly flags as a
 * duplicate; those rows get their locality folded into the label so each stays
 * distinct — and readable, since the label is what a screen reader hears.
 */
const toOptions = (suggestions: readonly AddressSuggestion[]): LookupOption[] => {
  const counts = new Map<string, number>()
  for (const s of suggestions) counts.set(s.label, (counts.get(s.label) ?? 0) + 1)
  return suggestions.map((suggestion) => ({
    value: suggestion.id,
    label:
      (counts.get(suggestion.label) ?? 0) > 1 && suggestion.secondary
        ? `${suggestion.label}, ${suggestion.secondary}`
        : suggestion.label,
    suggestion,
  }))
}

const PARTS = ['street', 'street2', 'city', 'state', 'zip'] as const

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
 *
 * With `lookup`, the street becomes an address search (see `AddressLookupProvider`).
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
    lookup,
    lookupDebounceMs,
    lookupMinChars,
    lookupFilledText = 'Address filled',
    required,
    disabled,
    className,
    slotProps,
    ...rest
  } = useDefaultProps({ props: inProps, name: 'EzAddressField' })
  // Guard here as well as in each part, so the "outside <Form>" error names
  // <AddressField> rather than whichever part happened to render first.
  const form = useEzFormContext('AddressField')
  const assisted = useAssisted()

  const lookupState = useAddressLookup({
    provider: lookup,
    name,
    ...(lookupDebounceMs !== undefined && { debounceMs: lookupDebounceMs }),
    ...(lookupMinChars !== undefined && { minChars: lookupMinChars }),
  })
  const lookupOptions = useMemo(() => toOptions(lookupState.options), [lookupState.options])

  // `seq` keys the live region, so a second pick with the identical message
  // still mounts a fresh node and is heard again.
  const [status, setStatus] = useState<{ text: ReactNode; seq: number }>({ text: '', seq: 0 })
  const announce = (text: ReactNode) => setStatus((prev) => ({ text, seq: prev.seq + 1 }))

  const fillFrom = async (suggestion: AddressSuggestion) => {
    const parts = await lookupState.resolve(suggestion)
    if (!parts) return
    for (const part of PARTS) {
      // A hidden second line has nothing to show a value in; writing it would
      // put state in the form that no control reflects.
      if (part === 'street2' && !street2) continue
      // Every rendered part is written, a part the provider did not supply as
      // `''`: a picked address is the whole address, and a unit number left
      // over from the previous pick would be a wrong address, not a partial one.
      form.setValue(`${name}.${part}`, parts[part] ?? '', {
        shouldDirty: true,
        shouldValidate: true,
      })
    }
    announce(lookupFilledText)
  }

  const renderStreet = () => {
    if (!lookup) {
      return (
        <AddressFieldStreet
          name={`${name}.street`}
          label={streetLabel}
          autoComplete={token(autoCompleteSection, 'street-address', assisted)}
          required={required}
          disabled={disabled}
          {...slotProps?.street}
          className={cx(addressFieldClasses.street, slotProps?.street?.className)}
        />
      )
    }
    // `slotProps.street` is a TextField's props; pulled apart into what the
    // Autocomplete takes directly and what goes to the TextField it renders.
    // `inputRef`, `displayValue` and `componentName` are TextField internals
    // with no counterpart here.
    const {
      required: streetRequired = required,
      disabled: streetDisabled = disabled,
      label: streetLabelOverride,
      helperText,
      className: streetClassName,
      min,
      max,
      minLength,
      maxLength,
      pattern,
      validate,
      optionalText,
      autoComplete: streetAutoComplete,
      onChange: streetOnChange,
      slotProps: streetSlotProps,
      inputRef: _inputRef,
      displayValue: _displayValue,
      componentName: _componentName,
      ...streetTextFieldProps
    } = slotProps?.street ?? {}
    return (
      <AttributionContext.Provider value={lookup.attribution}>
        <AddressFieldStreetLookup<LookupOption, string, false, true>
          name={`${name}.street`}
          label={streetLabelOverride ?? streetLabel}
          helperText={helperText}
          required={streetRequired}
          disabled={streetDisabled}
          min={min}
          max={max}
          minLength={minLength}
          maxLength={maxLength}
          pattern={pattern}
          // A TextField validator sees a string; so does this one — `null`
          // (the Clear button) is rewritten to `''` in `onChange` below.
          validate={validate as AutocompleteProps<LookupOption, string, false, true>['validate']}
          optionalText={optionalText}
          options={lookupOptions}
          loading={lookupState.loading}
          // Typed text is the value: a pick stores the row's label, and typing
          // commits on Enter, blur or Tab (`autoSelect`) so the street is never
          // silently empty after typing without picking.
          freeSolo
          autoSelect
          getOptionValue={(o) => o.label}
          // The provider already searched; re-filtering client-side would hide
          // rows whose label does not contain the typed text ("1600 penn" → "1600
          // Pennsylvania Ave NW" does, but a fuzzy or locality match would not).
          filterOptions={(x) => x}
          autoComplete
          includeInputInList
          renderOption={({ key, ...optionProps }, option) => (
            <li key={key} {...optionProps}>
              <ListItemText
                primary={option.suggestion.label}
                secondary={option.suggestion.secondary}
              />
            </li>
          )}
          slots={{ paper: AddressFieldLookupPaper }}
          onInputChange={(event, text, reason) => {
            if (reason === 'input') {
              lookupState.search(text)
              // The `input` reason carries the input's own change event; a
              // TextField `onChange` handler sees the same thing it would there.
              streetOnChange?.(event as React.ChangeEvent<HTMLInputElement>)
            } else if (reason === 'clear') {
              lookupState.clear()
            }
          }}
          onChange={(_event, value) => {
            // The Clear button hands the form `null`; the street is a string
            // part and reads as empty, the way a cleared TextField does.
            if (value === null) form.setValue(`${name}.street`, '', { shouldDirty: true })
            else if (typeof value !== 'string') void fillFrom(value.suggestion)
          }}
          textFieldProps={streetTextFieldProps}
          inputProps={mergeSlotProps(streetSlotProps?.htmlInput, {
            autoComplete:
              streetAutoComplete ?? token(autoCompleteSection, 'street-address', assisted),
          })}
          className={cx(addressFieldClasses.street, streetClassName)}
        />
      </AttributionContext.Provider>
    )
  }

  const parts = (
    <AddressFieldRoot {...rest} className={cx(addressFieldClasses.root, className)}>
      {renderStreet()}
      {street2 && (
        <AddressFieldStreet2
          name={`${name}.street2`}
          label={street2Label}
          autoComplete={token(autoCompleteSection, 'address-line2', assisted)}
          disabled={disabled}
          {...slotProps?.street2}
          className={cx(addressFieldClasses.street2, slotProps?.street2?.className)}
        />
      )}
      <AddressFieldCity
        name={`${name}.city`}
        label={cityLabel}
        autoComplete={token(autoCompleteSection, 'address-level2', assisted)}
        required={required}
        disabled={disabled}
        {...slotProps?.city}
        className={cx(addressFieldClasses.city, slotProps?.city?.className)}
      />
      <AddressFieldState
        name={`${name}.state`}
        label={stateLabel}
        autoComplete={token(autoCompleteSection, 'address-level1', assisted)}
        required={required}
        disabled={disabled}
        {...slotProps?.state}
        className={cx(addressFieldClasses.state, slotProps?.state?.className)}
      />
      <AddressFieldZip
        name={`${name}.zip`}
        label={zipLabel}
        autoComplete={token(autoCompleteSection, 'postal-code', assisted)}
        required={required}
        disabled={disabled}
        {...slotProps?.zip}
        className={cx(addressFieldClasses.zip, slotProps?.zip?.className)}
      />
    </AddressFieldRoot>
  )

  // The status region exists only under `lookup`, so a field without one
  // renders exactly what it did before the prop existed.
  const content = lookup ? (
    <>
      {parts}
      <AddressFieldStatus
        {...slotProps?.status}
        message={status.text}
        announcementKey={status.seq}
        className={cx(addressFieldClasses.status, slotProps?.status?.className)}
      />
    </>
  ) : (
    parts
  )

  if (legend == null && description == null) return content
  return (
    <FormSection {...slotProps?.section} title={legend} description={description}>
      {content}
    </FormSection>
  )
}
