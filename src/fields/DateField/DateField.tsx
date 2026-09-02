import {
  DateField as MuiDateField,
  type DateFieldProps as MuiDateFieldProps,
} from '@mui/x-date-pickers/DateField'
import type { DateValidationError, PickerValidDate } from '@mui/x-date-pickers/models'
import { usePickerField, type PickerFieldProps } from '../pickers/usePickerField'

export type DateFieldProps = Omit<
  MuiDateFieldProps,
  | 'name'
  | 'value'
  | 'defaultValue'
  | 'disabled'
  | 'label'
  | 'error'
  | 'required'
  | 'helperText'
  | 'onBlur'
  | 'onPaste'
> &
  PickerFieldProps<PickerValidDate | null, DateValidationError>

/**
 * `DateField`'s own `onChange` context (`FieldChangeHandlerContext`, from
 * `@mui/x-date-pickers/internals`, not exported off the public `models`
 * barrel) only carries `validationError` — no `source`, unlike the popup
 * pickers' `PickerChangeHandlerContext`. Declared locally so `usePickerField`
 * can be instantiated against `DateField`'s real callback shape.
 */
interface DateFieldChangeContext {
  validationError: DateValidationError
}

/**
 * MUI X DateField bound to the form. Needs a `LocalizationProvider` above it,
 * same as `DatePicker`; the form stores the adapter's own date type (a `Date`
 * under date-fns). A keyboard-only, no-popup field: typing a date beats
 * paging a calendar back years, so prefer this over `DatePicker` for
 * birthdays and other far-away dates.
 *
 * `DateField` *is* the text field: it also accepts `label`/`helperText`/
 * `error`/`required` as flat top-level props (and `onBlur`, but that one is
 * omitted from `DateFieldProps` below — see why underneath). `useSlotProps`
 * (the resolver `PickerFieldUI` uses) merges `slotProps.textField` *after*
 * those flat props (`{ ...additionalProps, ...externalForwardedProps,
 * ...externalSlotProps }`), so `slotProps.textField` always wins. That means
 * this must pass the form's `required`/`error`/`helperText`/`onBlur`
 * *through* `slotProps.textField`, exactly as `usePickerField` already
 * returns them for the popup pickers — never as flat props here, or a
 * consumer's own `slotProps.textField` (e.g. `{ helperText: 'hint' }`) would
 * silently override the form's error text, clear `aria-invalid`, or drop the
 * required marker.
 *
 * `onBlur` and `onPaste` are both omitted from `DateFieldProps` entirely (not
 * just left unbound): MUI's `DateFieldProps` accepts each as a flat prop, and
 * since this component never sets either, a naive `<DateField onPaste={fn}
 * />` would typecheck while `fn` silently fell into `...rest` and was never
 * called — a consumer `onBlur`/`onPaste` only takes effect through
 * `slotProps={{ textField: { onBlur, onPaste } }}`.
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
  slotProps,
  ...rest
}: DateFieldProps) {
  const bound = usePickerField<
    PickerValidDate | null,
    DateValidationError,
    NonNullable<DateFieldProps['slotProps']>,
    DateFieldChangeContext
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
    slotProps,
  })
  return <MuiDateField {...rest} {...bound} />
}
