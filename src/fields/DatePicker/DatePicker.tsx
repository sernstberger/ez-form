import {
  DatePicker as MuiDatePicker,
  type DatePickerProps as MuiDatePickerProps,
} from '@mui/x-date-pickers/DatePicker'
import type { DateValidationError, PickerValidDate } from '@mui/x-date-pickers/models'
import { usePickerField, type PickerFieldProps } from '../pickers/usePickerField'

export type DatePickerProps = Omit<
  MuiDatePickerProps,
  'name' | 'value' | 'defaultValue' | 'disabled' | 'label'
> &
  PickerFieldProps<PickerValidDate | null, DateValidationError>

/**
 * MUI X DatePicker bound to the form. Needs a `LocalizationProvider` above
 * it; the form stores the adapter's own date type (a `Date` under date-fns).
 */
export function DatePicker({
  name,
  label,
  helperText,
  disabled,
  errorMessages,
  required,
  validate,
  onChange,
  onError,
  slotProps,
  ...rest
}: DatePickerProps) {
  const bound = usePickerField<
    PickerValidDate | null,
    DateValidationError,
    NonNullable<DatePickerProps['slotProps']>
  >('DatePicker', {
    name,
    label,
    helperText,
    disabled,
    errorMessages,
    required,
    validate,
    onChange,
    onError,
    slotProps,
  })
  return <MuiDatePicker {...rest} {...bound} />
}
