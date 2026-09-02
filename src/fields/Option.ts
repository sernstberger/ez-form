/** One choice in Select, RadioGroup, Autocomplete, ToggleButtonGroup, and CheckboxGroup. Autocomplete options may carry extra fields. */
export interface Option {
  value: string | number
  label: string
  disabled?: boolean
}
