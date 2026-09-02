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
}

/**
 * The only part of the change context every binding actually reads.
 * `DatePicker`/`TimePicker`/`DateTimePicker` call back with the wider
 * `PickerChangeHandlerContext` (adds a required `source`); `DateField` calls
 * back with the narrower `FieldChangeHandlerContext` (`validationError`
 * only). Both bindings only need `validationError`, so the shared core is
 * typed against this minimal shape rather than either concrete one.
 */
interface ChangeContext<TError> {
  validationError: TError
}

interface PickerHandlers<TValue, TError, TSlotProps extends { textField?: object }> {
  onChange?: (value: TValue, context: PickerChangeHandlerContext<TError>) => void
  onError?: (error: TError, value: TValue) => void
  slotProps?: TSlotProps
}

/**
 * The parts of the consumer's `slotProps.textField` this hook merges by hand.
 * `TSlotProps` only guarantees `textField?: object`, so read them through this.
 */
interface ConsumerTextFieldSlotProps {
  onBlur?: (event: FocusEvent<HTMLDivElement>) => void
  slotProps?: Record<string, unknown> & { formHelperText?: object }
}

const toRecord = <TValue>(
  validate: FieldRules<TValue>['validate'],
): Record<string, Validate<TValue, FieldValues>> =>
  validate === undefined ? {} : typeof validate === 'function' ? { validate } : validate

/**
 * The parts every picker binding needs regardless of where the underlying
 * MUI X component wants its text-field props (nested under
 * `slotProps.textField` for the popup pickers, flat on the props for
 * `DateField`). Holds the picker's own validation code in a ref, read by an
 * extra `validate` entry, so picker errors and rule errors share one
 * channel: helper text, `aria-invalid`, `role="alert"`, and the submit
 * block. The ref (not state) keeps the rule current for the validation that
 * runs inside `field.onChange`.
 */
function usePickerFieldCore<
  TValue,
  TError extends string | null,
  TContext extends ChangeContext<TError>,
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
    onChange,
    onError,
  }: PickerFieldProps<TValue, TError> & {
    onChange?: (value: TValue, context: TContext) => void
    onError?: (error: TError, value: TValue) => void
  },
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
  })
  return {
    f,
    text: f.helperText(helperText),
    common: {
      name: f.field.name,
      label,
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
    },
  }
}

/**
 * Binds a MUI X popup picker (`DatePicker`, `TimePicker`, `DateTimePicker`)
 * to the form. The value is adapter-native (`Date` under date-fns, `Dayjs`
 * under dayjs) and stored as-is. See `usePickerFieldCore` for the shared
 * validation wiring.
 */
export function usePickerField<
  TValue,
  TError extends string | null,
  TSlotProps extends { textField?: object },
>(
  componentName: string,
  props: PickerFieldProps<TValue, TError> & PickerHandlers<TValue, TError, TSlotProps>,
) {
  const { slotProps } = props
  const { f, text, common } = usePickerFieldCore<
    TValue,
    TError,
    PickerChangeHandlerContext<TError>
  >(componentName, props)
  const consumerTextField = slotProps?.textField as ConsumerTextFieldSlotProps | undefined

  return {
    ...common,
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
        },
      },
    } as TSlotProps,
  }
}

/**
 * The `formHelperText` slot is read from `slotProps.textField.slotProps`, one
 * level deeper than `DateField`'s other own props — `PickerFieldUI` merges
 * `slotProps.textField` into the `PickersTextField` it renders, and that is
 * where `PickersTextField` itself reads `slotProps.formHelperText` (see
 * `usePickerField`, which nests the same way for the popup pickers). `object`
 * (not a narrower shape) so this is assignable from MUI's own
 * `SlotComponentPropsFromProps`, which also allows a `(ownerState) => props`
 * function form; the fields actually used are read through
 * `ConsumerFlatFieldSlotProps` below, the same pattern `usePickerField` uses.
 */
interface FlatPickerHandlers<
  TValue,
  TError extends string | null,
  TFieldSlotProps extends { textField?: object } | undefined,
> {
  onChange?: (value: TValue, context: ChangeContext<TError>) => void
  onError?: (error: TError, value: TValue) => void
  onBlur?: (event: FocusEvent<HTMLDivElement>) => void
  slotProps?: TFieldSlotProps
}

/**
 * The parts of the consumer's `slotProps.textField` this hook merges by hand.
 * `TFieldSlotProps` only guarantees `textField?: object`, so read them through this.
 */
interface ConsumerFlatFieldSlotProps {
  slotProps?: Record<string, unknown> & { formHelperText?: object }
}

/**
 * Binds a MUI X field-only component (`DateField`) to the form. Unlike the
 * popup pickers, `DateField` *is* the text field: `label`/`helperText`/
 * `error`/`required`/`onBlur` are its own direct props, not nested under
 * `slotProps.textField` — but the `formHelperText` slot (needed for the
 * error's `role="alert"`) is still read from `slotProps.textField.slotProps`,
 * because that's the shape `PickerFieldUI` merges into the underlying
 * `PickersTextField`. So this returns the text-field props flat, and merges
 * only `slotProps` by hand, one level deeper, the same way `usePickerField`
 * does for the popup pickers.
 */
export function usePickerFieldFlat<
  TValue,
  TError extends string | null,
  TFieldSlotProps extends { textField?: object } | undefined,
>(
  componentName: string,
  props: PickerFieldProps<TValue, TError> & FlatPickerHandlers<TValue, TError, TFieldSlotProps>,
) {
  const { onBlur: consumerOnBlur, slotProps: consumerSlotProps } = props
  const { f, text, common } = usePickerFieldCore<TValue, TError, ChangeContext<TError>>(
    componentName,
    props,
  )
  const consumerTextField = consumerSlotProps?.textField as ConsumerFlatFieldSlotProps | undefined

  return {
    ...common,
    required: f.required,
    error: f.invalid,
    helperText: text,
    // Not merged through `mergeSlotProps`: its handler composition would run
    // the consumer's onBlur first, inverting the "form's handler first" rule.
    onBlur: (event: FocusEvent<HTMLDivElement>) => {
      f.field.onBlur()
      consumerOnBlur?.(event)
    },
    slotProps: {
      ...consumerSlotProps,
      textField: {
        ...consumerTextField,
        slotProps: {
          ...consumerTextField?.slotProps,
          formHelperText: mergeSlotProps(consumerTextField?.slotProps?.formHelperText, {
            role: f.helperTextA11y.role,
          }),
        },
      },
    } as TFieldSlotProps,
  }
}
