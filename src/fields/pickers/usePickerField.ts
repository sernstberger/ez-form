import {
  useRef,
  type ClipboardEvent,
  type FocusEvent,
  type MouseEvent,
  type ReactNode,
} from 'react'
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
  /**
   * A consumer's clear handler passed as a *flat* prop, which is how MUI X types it on
   * `DateField` (the field is the text field there). The popup pickers have no flat
   * `onClear`; theirs arrives under `slotProps.field` and is picked up below.
   */
  onClear?: (event: MouseEvent) => void
  slotProps?: TSlotProps
}

/**
 * The part of the consumer's `slotProps.field` this hook merges by hand. Only the
 * popup pickers have this slot, and `clearable`/`onClear` are the only keys of it
 * this hook cares about; `TSlotProps` does not describe it at all, so — like
 * `ConsumerTextFieldSlotProps` below — it is read through this.
 */
interface ConsumerFieldSlotProps {
  onClear?: (event: MouseEvent) => void
}

/**
 * The parts of the consumer's `slotProps.textField` this hook merges by hand.
 * `TSlotProps` only guarantees `textField?: object`, so read them through this.
 */
interface ConsumerTextFieldSlotProps {
  /** A label-less picker is named here, not on the picker itself. */
  'aria-label'?: string
  'aria-labelledby'?: string
  onBlur?: (event: FocusEvent<HTMLDivElement>) => void
  slotProps?: Record<string, unknown> & {
    formHelperText?: object
    inputLabel?: { required?: boolean }
  }
  onPaste?: (event: ClipboardEvent<HTMLDivElement>) => void
  onClear?: (event: MouseEvent) => void
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
    onClear,
    slotProps,
  }: PickerFieldProps<TValue, TError> & PickerHandlers<TValue, TError, TSlotProps, TContext>,
) {
  const pickerError = useRef<TError | null>(null)
  /**
   * The clipboard text of the most recent paste onto the field, not yet
   * claimed by `onChange` below — `null` once claimed or once its microtask
   * has run with nothing to claim it. Only a paste needs this: per-section
   * typing already clamps each section to a valid value as it's entered
   * (MUI X's `useFieldCharacterEditing`), so it can't land on a fully
   * unparsable final state the way pasting an arbitrary string over the
   * whole field can.
   */
  const pendingPasteText = useRef<string | null>(null)
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
   * already-empty field *is* the current value, so the call — and even
   * `onError` — is swallowed before this hook ever sees it (confirmed: 0
   * calls to either, and no re-render of the consumer component at all, so
   * there is no synchronous or render-keyed signal to hook here).
   *
   * `onPaste` (`slotProps.textField.onPaste`, wired to the field root by MUI
   * X's `useField.js`: `onPaste?.(event); rootProps.onPaste(event);` — ours
   * runs first) is the only place the raw pasted text is ever observable:
   * MUI X's own paste handler (`useFieldRootProps.js`'s `handlePaste`) reads
   * `event.clipboardData.getData('text')` and, on a parse failure, resets the
   * field's sections back to empty placeholders without recording the text
   * anywhere else. (The field's *hidden* input, previously used here, is
   * never touched by a real paste at all — `handlePaste` calls
   * `updateValueFromValueStr` directly; that only reads from the hidden
   * input's own `change` event, which paste never dispatches.)
   *
   * `onChange`'s synchronous case (`DateField`, and any paste that changes
   * the value at all — even to something invalid like a `minDate` breach)
   * claims this text directly. For the popup pickers' swallowed case, this
   * queues a microtask: a real DOM paste dispatch (`fireEvent.paste`
   * included) runs every synchronous listener for the event — React's
   * `onChange` included — before yielding, so a microtask queued from
   * `onPaste` always runs after whichever `onChange` call the same paste was
   * going to produce, letting it tell "no onChange came for this paste"
   * apart from "onChange already handled it."
   */
  function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    const rawText = event.clipboardData.getData('text')
    pendingPasteText.current = rawText
    queueMicrotask(() => {
      if (pendingPasteText.current !== rawText) return
      pendingPasteText.current = null
      if (rawText && !pickerError.current) {
        pickerError.current = 'invalidDate' as TError
        f.field.onChange(f.field.value as TValue)
      }
    })
  }
  const labelText = typeof label === 'string' ? label : undefined
  const consumerTextField = slotProps?.textField as ConsumerTextFieldSlotProps | undefined
  const f = useEzField<TValue>(name, componentName, {
    label,
    rules: {
      required,
      validate: {
        ...toRecord<TValue>(validate),
        picker: () =>
          pickerError.current ? pickerMessage(pickerError.current, labelText, errorMessages) : true,
      },
    },
    optionalText,
    // A label-less picker is named through the text field it renders, so that is
    // where the dev-mode "no accessible name" check has to look. Read, not
    // removed: `slotProps.textField` is still spread onto the field below.
    'aria-label': consumerTextField?.['aria-label'],
    'aria-labelledby': consumerTextField?.['aria-labelledby'],
  })
  const text = f.helperText(helperText)
  /**
   * A consumer's own clear handler, from wherever MUI X types it for the component in
   * hand: a flat `onClear` on `DateField` (which *is* the text field), or
   * `slotProps.field.onClear` on the popup pickers — `BaseSingleInputPickersTextFieldProps`
   * explicitly `Omit`s `clearable`/`onClear` from `slotProps.textField`, so the field slot
   * is their only typed home there. `slotProps.textField.onClear` is read last as the
   * untyped-but-working fallback.
   *
   * All three have to be collected here because the `onClear` returned below sits under
   * `textField`, and MUI X's `useFieldTextFieldProps` resolves `slotProps.textField`
   * *after* both the flat props and the field slot's — so ez-form's handler would
   * otherwise silently replace a consumer's rather than compose with it, the same trap
   * this hook's `helperText`/`error`/`onBlur` merging already avoids.
   */
  const consumerField = (slotProps as { field?: ConsumerFieldSlotProps } | undefined)?.field
  const consumerOnClear = onClear ?? consumerField?.onClear ?? consumerTextField?.onClear

  /**
   * The bound `onChange`, named so `onClear` below can route through it rather than
   * reaching past it to `f.field.onChange` — everything a value change owes the form
   * (claiming a pending paste, deriving `pickerError`, then notifying the consumer)
   * lives here and stays in one place.
   */
  const handleChange = (value: TValue, context: TContext) => {
    // `DateField`'s synchronous case, and any paste that changes the value
    // at all (see `handlePaste` above): MUI X did call back here for the
    // same paste, so claim the pending clipboard text ourselves instead of
    // leaving it for the microtask.
    const rawText = pendingPasteText.current
    pendingPasteText.current = null
    const unparsable = value == null && !context.validationError && !!rawText
    pickerError.current = unparsable ? ('invalidDate' as TError) : context.validationError
    f.field.onChange(value)
    onChange?.(value, context)
  }

  return {
    name: f.field.name,
    label: f.displayLabel,
    value: (f.field.value as TValue | undefined) ?? null,
    inputRef: f.field.ref,
    disabled: mergeDisabled(disabled, f.field.disabled),
    onChange: handleChange,
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
        // Same "form's handler first" ordering as onBlur above — MUI X's own
        // useField.js runs this before its own paste handling regardless
        // (`onPaste?.(event); rootProps.onPaste(event)`), but a consumer
        // onPaste here is still ours to sequence, not MUI X's.
        onPaste: (event: ClipboardEvent<HTMLDivElement>) => {
          handlePaste(event)
          consumerTextField?.onPaste?.(event)
        },
        // #83: the clear button, when a consumer opts into `clearable`. MUI X's
        // `useField.js` `handleClear` runs `onClear?.(event)` and *then*
        // `clearValue()`, and `clearValue` (internals/hooks/useField/useFieldState.js)
        // only reaches `publishValue` — the call that becomes `onChange` — on the
        // branch where the value was *not* already empty. After an unparsable paste
        // the stored value is already `null` (the string never parsed) while
        // `pickerError` holds the `invalidDate` `handlePaste` set, so that branch is
        // skipped: no `onChange`, nothing resets the ref, and the field stays stuck
        // showing "… is invalid." with `aria-invalid="true"` and no way back.
        //
        // So this fills in exactly the change MUI X is about to skip, and only then:
        // routed through `handleChange` (not `f.field.onChange`) so an emptying clear
        // is indistinguishable from any other — same `pickerError` reset, and the
        // consumer's own `onChange` fires for it just as it does on the non-empty
        // branch, where MUI X's `publishValue` will call `handleChange` itself a beat
        // later. Guarding on the value keeps that from firing twice.
        //
        // Clearing `pickerError` also drops any *other* pending picker code
        // (`minDate`, …) — correct either way: an empty field cannot be out of range,
        // and the `required` rule is what should speak for an emptied required field,
        // not a stale range code. Ordered "form's handler first" like onBlur/onPaste.
        onClear: (event: MouseEvent) => {
          pendingPasteText.current = null
          if (f.field.value == null) {
            // `TValue` is not constrained to include `null` at the signature, but every
            // instantiation is `PickerValidDate | null` (all four pickers), and an empty
            // picker is exactly the `null` the `value` above already normalises to.
            // `validationError: null` is the truth for an empty field, and matches what
            // MUI X passes on its own clear path.
            handleChange(null as TValue, { validationError: null } as TContext)
          } else {
            // MUI X's `clearValue` will publish this one, so only the error state needs
            // resetting here — `handleChange` runs on its own for the value itself.
            pickerError.current = null
          }
          consumerOnClear?.(event)
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
