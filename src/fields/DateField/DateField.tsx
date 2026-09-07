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
  // UPSTREAM SHIM (#142). `DateField` *is* the text field, so MUI X types a flat
  // `variant` on it as its own closed three-arm union. `PickerFieldProps` re-declares
  // it as the widened `EzTextFieldVariants`; without this `Omit` the two intersect to
  // the closed union again and `variant="stacked"` would not typecheck. The value is
  // routed through `slotProps.textField` either way (see `usePickerField`), which is
  // the channel MUI X resolves *last* — a flat `variant` here would be overridden by
  // it, so this is also the only spelling that cannot disagree with itself. Goes when
  // upstream ships.
  | 'variant'
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
 *
 * `onClear` is the third prop in that position but is *bound* rather than
 * omitted (#83): unlike `onBlur`/`onPaste`, `clearable` is the documented way
 * to let a user empty this field, so the flat `onClear` MUI X types alongside
 * it should keep working. It is handed to `usePickerField`, which composes it
 * after the form's own clear handling.
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
  onClear,
  slotProps,
  variant,
  // Out of `rest`, which reaches the picker root: the box the placement rules
  // select is the text field's `FormControl`, so the hook routes both there
  // through `slotProps.textField` (#9, #66).
  labelPlacement,
  className,
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
    onClear,
    slotProps,
    variant,
    labelPlacement,
    className,
  })
  return <MuiDateField {...rest} {...bound} />
}
