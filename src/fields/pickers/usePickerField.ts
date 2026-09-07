import {
  useRef,
  type ClipboardEvent,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react'
import { mergeSlotProps } from '@mui/material/utils'
import type { TextFieldVariants } from '@mui/material/TextField'
import type { PickerChangeHandlerContext } from '@mui/x-date-pickers/models'
import type { FieldValues, Validate } from 'react-hook-form'
import { PickersVariantInput, type EzTextFieldVariants } from '../textFieldVariants'
import { useEzField } from '../useEzField'
import { useFieldCell } from '../FieldCellContext'
import { isPlainKey, preventMuiDefault } from '../../keys'
import type { LabelPlacement } from '../LabelPlacementContext'
import { mergeDisabled } from '../mergeDisabled'
import { useRuleMessages } from '../../Form/RuleMessagesContext'
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
   * UPSTREAM SHIM (#142). The rendered `PickersTextField`'s `variant` — the same
   * top-level prop every other box input in ez-form takes. `EzTextFieldVariants` is
   * MUI's `TextFieldVariants` plus whatever augments `TextFieldPropsVariantOverrides`
   * (ez-form's `'stacked'`, and any variant a consumer declares). Left unset, the
   * theme's `MuiPickersTextField.defaultProps.variant` decides, which
   * `createEzFormTheme()` sets to `'stacked'`.
   *
   * A consumer's own `slotProps.textField.variant` wins over this: it is the same
   * prop one level down, and this is the shorthand.
   */
  variant?: EzTextFieldVariants
  /**
   * This picker's own label placement, overriding the form's (#9, #66). The
   * classes go on `slotProps.textField` rather than the picker root, because the
   * `FormControl` box the placement rules select is `MuiPickersTextField-root` —
   * the picker itself renders no box of its own.
   */
  labelPlacement?: LabelPlacement
  /** The consumer's `className`, appended after the placement classes. */
  className?: string
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
  /** Joined after the placement classes, not replaced by them (#9, #66). */
  className?: string
  /** A label-less picker is named here, not on the picker itself. */
  'aria-label'?: string
  'aria-labelledby'?: string
  /** The consumer's own description, for the same reason and by the same route. */
  'aria-describedby'?: string
  onBlur?: (event: FocusEvent<HTMLDivElement>) => void
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void
  slotProps?: Record<string, unknown> & {
    formHelperText?: object
    inputLabel?: { required?: boolean }
    /**
     * MUI X's `PickersInputBase` — the element that actually carries
     * `role="group"`. See the `input` merge below for why the name has to go here.
     */
    input?: object
  }
  /**
   * UPSTREAM SHIM (#142). MUI X types this on `slotProps.textField` as its own
   * closed three-arm union, which `PickerFieldProps.variant` widens. Read here so a
   * consumer's own value wins over the top-level prop; see the `variant` merge below
   * for the one cast at the MUI X boundary.
   */
  variant?: EzTextFieldVariants
  /**
   * A consumer's own `slots` for the text field, spread *after* the shim's
   * `{ input: PickersVariantInput }` so `slots.input` still wins — the upstream
   * escape hatch, exactly as on `TextField`.
   */
  slots?: Record<string, unknown>
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
    onChange,
    onError,
    onClear,
    slotProps,
    variant,
    labelPlacement,
    className,
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
        // Re-emitting the current value is what re-runs the `picker` rule with the
        // code just set.
        //
        // The `?? null` is a deliberate **behaviour** change, not just a cast removal
        // (#28). A field with no `defaultValues` entry has `field.value === undefined`,
        // and this used to write that `undefined` straight back — the only path in this
        // hook that ever put one in the form. It is now normalised to `null`: the same
        // normalisation the returned `value` getter makes below, and the `null` a
        // consumer already receives for "no date" from MUI X's own clear path. `TValue`
        // is `PickerValidDate | null` at every instantiation, so `null` is always in it.
        // Pinned by "re-emits null, not undefined, for a field with no default value".
        f.field.onChange(f.field.value ?? (null as TValue))
      }
    })
  }
  const labelText = typeof label === 'string' ? label : undefined
  const consumerTextField = slotProps?.textField as ConsumerTextFieldSlotProps | undefined
  const ruleMessages = useRuleMessages()
  const f = useEzField<TValue>(name, componentName, {
    label,
    labelPlacement,
    // Both consumer channels, in the order the rest of this hook uses them: the
    // flat `className` first, then the text field slot's own — a picker takes
    // either, and neither may be dropped by the placement classes.
    className: [className, consumerTextField?.className].filter(Boolean).join(' ') || undefined,
    rules: {
      required,
      validate: {
        ...toRecord<TValue>(validate),
        picker: () =>
          pickerError.current
            ? pickerMessage(pickerError.current, labelText, errorMessages, ruleMessages)
            : true,
      },
    },
    // A label-less picker is named through the text field it renders, so that is
    // where the dev-mode "no accessible name" check has to look. Read, and also
    // *removed* from what reaches the text field root — see the `slotProps.input`
    // merge below for why.
    'aria-label': consumerTextField?.['aria-label'],
    'aria-labelledby': consumerTextField?.['aria-labelledby'],
  })
  const text = f.helperText(helperText)
  // Inside a `<FieldArray layout="table">` cell Enter belongs to the table (#14), and this
  // is the one component that would otherwise take it: `PickersInputBase` submits the form
  // itself on Enter whenever the form has a submit button — `closestForm.requestSubmit(
  // submitTrigger)` — guarded by `event.defaultMuiPrevented`, which it checks *after* calling
  // the consumer's `onKeyDown` (`useField.js`: `onKeyDown?.(event); rootProps.onKeyDown(
  // event)`, then `PickersInputBase.js` `handleKeyDown`). So this is the one place that can
  // disarm it; the table's own handler, further up, sees the same dispatch only after the
  // submit would already have been requested. Outside a cell nothing changes.
  const cell = useFieldCell()
  /**
   * The field id `PickersTextField` would otherwise generate for itself, pinned so the
   * helper-text id it derives (`${id}-helper-text`, PickersTextField.js) is knowable
   * here. A consumer's own `id` wins, and is used for the derivation too, so the two
   * cannot disagree.
   */
  const fieldId = (consumerTextField as { id?: string } | undefined)?.id ?? f.helperTextId
  /**
   * The group's full description: the consumer's ids first, then MUI X's helper-text
   * id — which it only creates when there *is* helper text, so the same condition
   * decides whether to include it. `undefined` when neither side has anything, which
   * leaves MUI X's own attribute alone rather than blanking it.
   */
  const describedBy =
    [consumerTextField?.['aria-describedby'], text ? `${fieldId}-helper-text` : undefined]
      .filter(Boolean)
      .join(' ') || undefined
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
    value: f.field.value ?? null,
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
        // Before the consumer's spread, so a consumer `id` still wins; see `fieldId`.
        id: fieldId,
        ...consumerTextField,
        // UPSTREAM SHIM (#142). The one MUI X boundary. `PickersTextField` resolves
        // its input as `slots?.input ?? VARIANT_COMPONENT[variant]`
        // (PickersTextField.js) — the same shape `TextField` uses — so a variant
        // outside MUI X's own closed union only needs `slots.input` filled in.
        // `PickersVariantInput` resolves the three built-ins itself and falls back to
        // `PickersOutlinedInput`, so it is the right slot value whatever the variant
        // is, including the theme's default.
        //
        // The cast is confined to this line: `PickersTextFieldProps['variant']` is a
        // closed union and re-declaring it through every picker's generic `slotProps`
        // is the re-implementation PHILOSOPHY rule 1 forbids. A consumer's own
        // `slotProps.textField.variant` wins over the top-level prop — same
        // precedence as `id` above. Both lines go when upstream ships.
        variant: (consumerTextField?.variant ?? variant) as TextFieldVariants,
        slots: { input: PickersVariantInput, ...consumerTextField?.slots },
        // After the spread, because the placement classes are binding-owned: the
        // hook has already joined the consumer's own `className` (the flat prop
        // and this slot's, in that order) into it, so nothing is dropped (#9, #66).
        className: f.layoutClassName,
        // Same wrapper bug as #99, one component over. On the `textField` root these
        // land on `MuiPickersTextField-root`, which is a `FormControl` **div** with no
        // role at all — so the name describes a `<div>` nothing reads while the
        // `role="group"` element the user operates stays anonymous, and the
        // missing-label warning above is silenced by a name that names nothing. The
        // same is true of `aria-describedby`: MUI X puts the helper-text id on the
        // group itself, so a consumer's description on the root reached nothing at
        // all (#102 rows 1 and 8). All three are re-emitted onto that group through
        // `slotProps.input` below.
        'aria-label': undefined,
        'aria-labelledby': undefined,
        'aria-describedby': undefined,
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
        // See `cell` above. Same "form's handler first" ordering as onBlur/onPaste.
        onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
          if (cell && isPlainKey(event, 'Enter')) preventMuiDefault(event)
          consumerTextField?.onKeyDown?.(event)
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
          // `helperTextRole`, not `helperTextSlotProps`: the binding's `role` has to
          // land *after* the consumer's so a consumer `role` cannot displace
          // `role="alert"` and leave the error rendered but never announced (#104) —
          // but the hook's `helperTextId` must **not** be pinned here (#127). MUI X
          // owns this `<p>`'s id: `PickersTextField` derives it as
          // `${fieldId}-helper-text`, and `fieldId` above *is* `f.helperTextId`,
          // pinned so the derivation is knowable. Pinning the same id on the slot
          // would give the `<input>` and the `<p>` one id and leave the group's
          // `aria-describedby` pointing at nothing. The hook keeps one copy of the
          // ordering rule either way — see `helperTextRole` in `useEzField`.
          //
          // Every other key the consumer put on this slot — `className`, `style`,
          // `sx`, handlers — passes through untouched; `role` under error is the only
          // one the binding takes, and only for as long as there is an error.
          formHelperText: f.helperTextRole(consumerTextField?.slotProps?.formHelperText),
          // PickersTextField spreads `slotProps.inputLabel` straight onto the real MUI
          // `InputLabel` (see PickersTextField.js), the same shape TextField's own
          // `slotProps.inputLabel` uses; an explicit `required` there wins over the
          // ownerState-derived default while the root/native input keeps the `required`
          // set above, exactly like plain TextField's own asterisk suppression.
          inputLabel: mergeSlotProps(consumerTextField?.slotProps?.inputLabel, {
            required: f.labelRequired,
          }),
          // The one channel that reaches the `role="group"` element. `PickersTextField`
          // hard-codes `role="group"` and `aria-labelledby={inputLabelId}` onto its
          // `PickersInputBase` and *then* spreads this slot's props over them
          // (PickersTextField.js), so a name set here wins — and `inputLabelId` is
          // itself `undefined` without a label (`label && id ? … : undefined`), which
          // is #100's empty-`aria-labelledby` trap avoided for free.
          //
          // Spread rather than merged for the same reason `Autocomplete` spreads
          // `f.nameA11y` last: this is the field's own routing of a prop the consumer
          // wrote, so it must beat what MUI X put there for the label-less case. Keys
          // the consumer did not pass are absent, not `undefined`, so a labelled picker
          // keeps MUI X's `aria-labelledby`.
          //
          // `aria-describedby` is the same routing plus a merge, because unlike the
          // name it has an existing value worth keeping: MUI X sets the group's
          // description to the helper text's id, and that id is *its* — derived as
          // `${id}-helper-text` from the field id it generates. So the field id is
          // pinned here (`id` below) and the same derivation is repeated, giving the
          // consumer's ids **and** the helper text's, space-joined — a description is
          // a list, so replacing one with the other drops half of what the control
          // says (#102 row 8). Omitted entirely when neither side has anything, so
          // MUI X's own value is left untouched on a picker with no helper text and
          // no consumer description.
          input: {
            ...consumerTextField?.slotProps?.input,
            ...f.nameA11y,
            ...(describedBy === undefined ? null : { 'aria-describedby': describedBy }),
          },
        },
      },
    } as TSlotProps,
  }
}
