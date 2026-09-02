import { mergeSlotProps } from '@mui/material/utils'
import { Select, type SelectProps } from '../Select'
import type { Option } from '../Option'
import { useEzFormContext } from '../../useEzFormContext'

export type StateSelectProps = Omit<SelectProps, 'options'> & {
  /** Adds Puerto Rico, Guam, the U.S. Virgin Islands, American Samoa, and the Northern Mariana Islands. Default `false`. */
  territories?: boolean
  autoComplete?: string
}

/** The 50 states plus the District of Columbia. Values are USPS abbreviations. */
export const US_STATES: readonly Option[] = [
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'DC', label: 'District of Columbia' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
]

/** U.S. territories, added to `US_STATES` when `territories` is true. */
export const US_TERRITORIES: readonly Option[] = [
  { value: 'AS', label: 'American Samoa' },
  { value: 'GU', label: 'Guam' },
  { value: 'MP', label: 'Northern Mariana Islands' },
  { value: 'PR', label: 'Puerto Rico' },
  { value: 'VI', label: 'U.S. Virgin Islands' },
]

/**
 * `Select` pre-loaded with the 50 states + DC (USPS abbreviation values, full-name
 * labels); `territories` adds the five U.S. territories. `autoComplete` reaches the
 * hidden native `<input>` MUI's `Select` renders for autofill/native form semantics
 * via `slotProps.htmlInput` — the same path a plain `TextField` uses, verified because
 * `Select`'s own `SelectProps`/`inputProps` legacy APIs don't exist in MUI 9.
 */
export function StateSelect({
  territories = false,
  autoComplete = 'address-level1',
  slotProps,
  ...rest
}: StateSelectProps) {
  // Ahead of Select's own guard, so the "outside <Form>" error names <StateSelect>.
  useEzFormContext('StateSelect')
  const options = territories ? [...US_STATES, ...US_TERRITORIES] : US_STATES
  return (
    <Select
      {...rest}
      options={options}
      slotProps={{
        ...slotProps,
        htmlInput: mergeSlotProps(slotProps?.htmlInput, { autoComplete }),
      }}
    />
  )
}
