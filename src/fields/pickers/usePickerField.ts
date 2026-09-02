import { useEffect, useRef, type FocusEvent, type ReactNode } from 'react'
import { mergeSlotProps, useForkRef } from '@mui/material/utils'
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
  slotProps?: Record<string, unknown> & { formHelperText?: object }
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
    onChange,
    onError,
    slotProps,
  }: PickerFieldProps<TValue, TError> & PickerHandlers<TValue, TError, TSlotProps, TContext>,
) {
  const pickerError = useRef<TError | null>(null)
  /**
   * The raw text of the most recent hidden-input `change` (paste, or the
   * `fireEvent.change` test seam) not yet claimed by `onChange` below — `null`
   * once claimed or once its microtask has run. MUI X's field never records
   * or exposes this text once parsing fails, and per-section typing never
   * touches the hidden input's `change` event at all, so it is only ever set
   * for a paste/programmatic write.
   */
  const pendingRawText = useRef<string | null>(null)
  const hiddenInputRef = useRef<HTMLInputElement | null>(null)
  /**
   * MUI X leaves `validationError` at its default (`null`/falsy) for a string
   * with no recognisable date shape at all: `parseDateStr` in MUI X's
   * `useFieldState.updateValueFromValueStr` (internals/hooks/useField/
   * useFieldState.js) returns `null` for such a string, and `validateDate` /
   * `validateTime` / `validateDateTime` (validation/validateDate.js etc.) all
   * short-circuit `value === null` to `null` before running any other check.
   * `DateField` calls its own `onChange` unconditionally, so a genuine clear
   * and an unparsable paste both reach it as `(null, { validationError: null
   * })` — indistinguishable by that callback's own arguments alone.
   *
   * The popup pickers (`DatePicker`/`TimePicker`/`DateTimePicker`) go one step
   * further and never call `onChange` *at all* for this case: `usePicker`'s
   * `setValue` (internals/hooks/usePicker/hooks/useValueAndOpenStates.js)
   * guards `shouldFireOnChange = !valueManager.areValuesEqual(newValue,
   * value)`, and always takes that branch because `usePickerField` always
   * passes an explicit `value` prop (making the picker "controlled" in
   * MUI X's own eyes). An unparsable string parses to `null`, which for an
   * already-empty field *is* the current value, so the call is swallowed
   * before this hook ever sees it.
   *
   * Either way, the hidden `<input>`'s own native `change` event still fires
   * with the raw text the user entered — MUI X's controlled-value swallow
   * happens above that DOM event, not at it — so a listener attached via
   * `inputRef` sees it regardless. This function marks that text pending and
   * queues a microtask to claim it as `invalidDate` if nothing else claims it
   * first: a same-tick `onChange` call is a real MUI X event, synchronous
   * with a real DOM dispatch, so it always runs before any microtask queued
   * from the same native event.
   */
  function handleHiddenInputChange(event: Event) {
    const rawText = (event.target as HTMLInputElement).value
    pendingRawText.current = rawText
    queueMicrotask(() => {
      if (pendingRawText.current !== rawText) return
      pendingRawText.current = null
      if (rawText && !pickerError.current) {
        pickerError.current = 'invalidDate' as TError
        f.field.onChange(f.field.value as TValue)
      }
    })
  }
  const attachHiddenInputListener = (node: HTMLInputElement | null) => {
    hiddenInputRef.current?.removeEventListener('change', handleHiddenInputChange)
    hiddenInputRef.current = node
    node?.addEventListener('change', handleHiddenInputChange)
  }
  useEffect(
    () => () => hiddenInputRef.current?.removeEventListener('change', handleHiddenInputChange),
    [],
  )
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
  const text = f.helperText(helperText)
  const consumerTextField = slotProps?.textField as ConsumerTextFieldSlotProps | undefined
  const inputRef = useForkRef(f.field.ref, attachHiddenInputListener)

  return {
    name: f.field.name,
    label,
    value: (f.field.value as TValue | undefined) ?? null,
    inputRef,
    disabled: mergeDisabled(disabled, f.field.disabled),
    onChange: (value: TValue, context: TContext) => {
      // `DateField`'s synchronous case (see `handleHiddenInputChange` above):
      // MUI X did call back here for the same native event, so claim the
      // pending raw text ourselves instead of leaving it for the microtask.
      const rawText = pendingRawText.current
      pendingRawText.current = null
      const unparsable = value == null && !context.validationError && !!rawText
      pickerError.current = unparsable ? ('invalidDate' as TError) : context.validationError
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
        },
      },
    } as TSlotProps,
  }
}
