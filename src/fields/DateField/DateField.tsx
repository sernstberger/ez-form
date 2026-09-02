import {
  DateField as MuiDateField,
  type DateFieldProps as MuiDateFieldProps,
} from '@mui/x-date-pickers/DateField'
import type { DateValidationError, PickerValidDate } from '@mui/x-date-pickers/models'
import { usePickerFieldFlat, type PickerFieldProps } from '../pickers/usePickerField'

export type DateFieldProps = Omit<
  MuiDateFieldProps,
  'name' | 'value' | 'defaultValue' | 'disabled' | 'label' | 'error' | 'required' | 'helperText'
> &
  PickerFieldProps<PickerValidDate | null, DateValidationError>

/**
 * MUI X DateField bound to the form. Needs a `LocalizationProvider` above it,
 * same as `DatePicker`; the form stores the adapter's own date type (a `Date`
 * under date-fns). A keyboard-only, no-popup field: typing a date beats
 * paging a calendar back years, so prefer this over `DatePicker` for
 * birthdays and other far-away dates.
 */
export function DateField({
  name,
  label,
  helperText,
  disabled,
  errorMessages,
  required,
  validate,
  onChange,
  onError,
  onBlur,
  slotProps,
  ...rest
}: DateFieldProps) {
  const bound = usePickerFieldFlat<
    PickerValidDate | null,
    DateValidationError,
    NonNullable<DateFieldProps['slotProps']>
  >('DateField', {
    name,
    label,
    helperText,
    disabled,
    errorMessages,
    required,
    validate,
    onChange,
    onError,
    onBlur,
    slotProps,
  })
  return <MuiDateField {...rest} {...bound} />
}
