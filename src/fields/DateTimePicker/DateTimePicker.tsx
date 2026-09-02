import {
  DateTimePicker as MuiDateTimePicker,
  type DateTimePickerProps as MuiDateTimePickerProps,
} from '@mui/x-date-pickers/DateTimePicker'
import type { DateTimeValidationError, PickerValidDate } from '@mui/x-date-pickers/models'
import { usePickerField, type PickerFieldProps } from '../pickers/usePickerField'

export type DateTimePickerProps = Omit<
  MuiDateTimePickerProps,
  'name' | 'value' | 'defaultValue' | 'disabled' | 'label'
> &
  PickerFieldProps<PickerValidDate | null, DateTimeValidationError>

/** MUI X DateTimePicker bound to the form; see DatePicker for the value contract. */
export function DateTimePicker({
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
}: DateTimePickerProps) {
  const bound = usePickerField<
    PickerValidDate | null,
    DateTimeValidationError,
    NonNullable<DateTimePickerProps['slotProps']>
  >('DateTimePicker', {
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
  return <MuiDateTimePicker {...rest} {...bound} />
}
