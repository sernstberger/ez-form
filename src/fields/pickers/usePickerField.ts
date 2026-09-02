import { useRef, type FocusEvent, type ReactNode } from 'react'
import { mergeSlotProps } from '@mui/material/utils'
import type { PickerChangeHandlerContext } from '@mui/x-date-pickers/models'
import type { FieldValues, Validate } from 'react-hook-form'
import { useEzField } from '../useEzField'
import { mergeDisabled } from '../mergeDisabled'
import type { FieldRules } from '../../rules'
import { pickerMessage, type PickerErrorMessages } from './pickerMessages'

/** The props every ez-form picker adds on top of the MUI X picker's own. */
export interface PickerFieldProps<TValue, TError extends string | null> {
  name: string
  label?: ReactNode
  helperText?: ReactNode
  disabled?: boolean
  /** Messages for the picker's own validation codes (`minDate`, `invalidDate`, …). */
  errorMessages?: PickerErrorMessages<TError>
  required?: FieldRules<TValue>['required']
  validate?: FieldRules<TValue>['validate']
  /**
   * Overrides `Form`'s `optionalText` for this field when the form's
   * `requiredIndicator` is `"optional"`; `false` hides it on this field.
   */
  optionalText?: ReactNode | false
}

/**
 * The only part of the change context this hook itself reads. `DatePicker` /
 * `TimePicker` / `DateTimePicker` call back with `PickerChangeHandlerContext`
 * (adds a required `source`); `DateField` calls back with the narrower
 * `FieldChangeHandlerContext` (`validationError` only). `TContext` defaults
 * to the wider popup-picker shape and `DateField` passes the narrower one
 * explicitly, so each binding's consumer `onChange` keeps its real MUI X type.
 */
interface ChangeContext<TError> {
  validationError: TError
}

interface PickerHandlers<
  TValue,
  TError,
  TSlotProps extends { textField?: object },
  TContext extends ChangeContext<TError>,
> {
  onChange?: (value: TValue, context: TContext) => void
  onError?: (error: TError, value: TValue) => void
  slotProps?: TSlotProps
}

/**
 * The parts of the consumer's `slotProps.textField` this hook merges by hand.
 * `TSlotProps` only guarantees `textField?: object`, so read them through this.
 */
interface ConsumerTextFieldSlotProps {
  onBlur?: (event: FocusEvent<HTMLDivElement>) => void
  slotProps?: Record<string, unknown> & {
    formHelperText?: object
    inputLabel?: { required?: boolean }
  }
}

const toRecord = <TValue>(
  validate: FieldRules<TValue>['validate'],
): Record<string, Validate<TValue, FieldValues>> =>
  validate === undefined ? {} : typeof validate === 'function' ? { validate } : validate

/**
 * Binds a MUI X picker to the form. The value is adapter-native (`Date` under
 * date-fns, `Dayjs` under dayjs) and stored as-is. The picker's own
 * validation code (from `onChange`'s context and `onError`) is kept in a ref
 * and read by an extra `validate` entry, so picker errors and rule errors
 * share one channel: helper text, `aria-invalid`, `role="alert"`, and the
 * submit block. The ref (not state) keeps the rule current for the validation
 * that runs inside `field.onChange`.
 *
 * Works for both the popup pickers (`DatePicker`, `TimePicker`,
 * `DateTimePicker` — the text field lives under `slotProps.textField`) and
 * `DateField` (which *is* the text field: `label`/`helperText`/`error`/
 * `required` are its own direct props). Either way the consumer's
 * `slotProps.textField` is where `PickerFieldUI` reads the `formHelperText`
 * slot from (MUI X merges `slotProps.textField` into the `PickersTextField`
 * it renders even for `DateField`), so this always returns that nesting; a
 * flat-prop component spreads the returned `slotProps.textField` fields onto
 * itself too — see `DateField.tsx`.
 */
export function usePickerField<
  TValue,
  TError extends string | null,
  TSlotProps extends { textField?: object },
  TContext extends ChangeContext<TError> = PickerChangeHandlerContext<TError>,
>(
  componentName: string,
  {
    name,
    label,
    helperText,
    disabled,
    errorMessages,
    required,
    validate,
    optionalText,
    onChange,
    onError,
    slotProps,
  }: PickerFieldProps<TValue, TError> & PickerHandlers<TValue, TError, TSlotProps, TContext>,
) {
  const pickerError = useRef<TError | null>(null)
  const labelText = typeof label === 'string' ? label : undefined
  const f = useEzField<TValue>(name, componentName, {
    label,
    rules: {
      required,
      validate: {
        ...toRecord<TValue>(validate),
        picker: () =>
          pickerError.current
            ? pickerMessage(
                pickerError.current,
                labelText,
                errorMessages as Record<string, string | undefined>,
              )
            : true,
      },
    },
    optionalText,
  })
  const text = f.helperText(helperText)
  const consumerTextField = slotProps?.textField as ConsumerTextFieldSlotProps | undefined

  return {
    name: f.field.name,
    label: f.displayLabel,
    value: (f.field.value as TValue | undefined) ?? null,
    inputRef: f.field.ref,
    disabled: mergeDisabled(disabled, f.field.disabled),
    onChange: (value: TValue, context: TContext) => {
      pickerError.current = context.validationError
      f.field.onChange(value)
      onChange?.(value, context)
    },
    onError: (error: TError, value: TValue) => {
      pickerError.current = error
      onError?.(error, value)
    },
    slotProps: {
      ...slotProps,
      // Merged by hand, one level deeper than `mergeSlotProps` goes: that is a
      // shallow merge with the consumer's props spread last, so a consumer
      // `textField.slotProps` would replace `{ formHelperText: { role } }`
      // wholesale and silently drop the error announcement. The form owns
      // `required`/`error`/`helperText`, so those are spread after the
      // consumer's — the same precedence TextField uses.
      textField: {
        ...consumerTextField,
        required: f.required,
        error: f.invalid,
        helperText: text,
        // Not merged through `mergeSlotProps`: its handler composition would run
        // the consumer's onBlur first, inverting the "form's handler first" rule.
        onBlur: (event: FocusEvent<HTMLDivElement>) => {
          f.field.onBlur()
          consumerTextField?.onBlur?.(event)
        },
        slotProps: {
          ...consumerTextField?.slotProps,
          formHelperText: mergeSlotProps(consumerTextField?.slotProps?.formHelperText, {
            role: f.helperTextA11y.role,
          }),
          // PickersTextField spreads `slotProps.inputLabel` straight onto the real MUI
          // `InputLabel` (see PickersTextField.js), the same shape TextField's own
          // `slotProps.inputLabel` uses; an explicit `required` there wins over the
          // ownerState-derived default while the root/native input keeps the `required`
          // set above, exactly like plain TextField's own asterisk suppression.
          inputLabel: mergeSlotProps(consumerTextField?.slotProps?.inputLabel, {
            required: f.labelRequired,
          }),
        },
      },
    } as TSlotProps,
  }
}
