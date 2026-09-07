import {
  TimePicker as MuiTimePicker,
  type TimePickerProps as MuiTimePickerProps,
} from '@mui/x-date-pickers/TimePicker'
import type { TimeValidationError, PickerValidDate } from '@mui/x-date-pickers/models'
import { usePickerField, type PickerFieldProps } from '../pickers/usePickerField'

export type TimePickerProps = Omit<
  MuiTimePickerProps,
  'name' | 'value' | 'defaultValue' | 'disabled' | 'label'
> &
  PickerFieldProps<PickerValidDate | null, TimeValidationError>

/** MUI X TimePicker bound to the form; see DatePicker for the value contract. */
export function TimePicker({
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
  // Out of `rest`, which reaches the picker root: the box the placement rules
  // select is the text field's `FormControl`, so the hook routes both there
  // through `slotProps.textField` (#9, #66).
  labelPlacement,
  className,
  ...rest
}: TimePickerProps) {
  const bound = usePickerField<
    PickerValidDate | null,
    TimeValidationError,
    NonNullable<TimePickerProps['slotProps']>
  >('TimePicker', {
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
    labelPlacement,
    className,
  })
  return <MuiTimePicker {...rest} {...bound} />
}
