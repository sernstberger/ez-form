/** One choice in Select, RadioGroup, and Autocomplete. Autocomplete options may carry extra fields. */
export interface Option {
  value: string | number
  label: string
  disabled?: boolean
}
