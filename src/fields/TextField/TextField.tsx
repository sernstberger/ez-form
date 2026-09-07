import MuiTextField, { type TextFieldProps as MuiTextFieldProps } from '@mui/material/TextField'
import { mergeSlotProps, useForkRef } from '@mui/material/utils'
import { useEzField } from '../useEzField'
import type { LabelPlacementProps } from '../LabelPlacementContext'
import { mergeDisabled } from '../mergeDisabled'
import { resolveAutoComplete } from '../resolveAutoComplete'
import { useAssisted } from '../../Form/AssistedContext'
import type { FieldRules } from '../../rules'

/**
 * Omit only what the binding owns (`name`, `value`, `defaultValue`, `error`,
 * `inputRef`, and `required`, which the `required` rule drives). Anything the
 * consumer might also want (event handlers, `helperText`, `disabled`, `id`,
 * `slotProps`) is merged, hookform's handler first.
 *
 * `defaultValue` is omitted because the form owns the value: passing one
 * alongside the bound `value` is React's controlled/uncontrolled error, and the
 * initial value belongs on `<Form defaultValues>` instead (#104).
 */
export type TextFieldProps = Omit<
  MuiTextFieldProps,
  'name' | 'value' | 'defaultValue' | 'error' | 'inputRef' | 'required'
> & {
  name: string
  /**
   * Internal. A second ref to the `<input>`, forked with hookform's, for the
   * fields built on `TextField` that need the element themselves (`PhoneField`,
   * `SsnField`, `FeinField` restore the caret after a reformat).
   *
   * This is the *only* channel a field's own ref takes: it goes to MUI's
   * `inputRef`, and `InputBase` forks that with whatever the consumer put in
   * `slotProps.htmlInput.ref` — object or callback form alike, since MUI
   * resolves the callback itself. Composing the two in the field instead can
   * only see the object form and silently drops a callback-form ref (#92).
   * Every field using this `Omit`s it from its own public props.
   *
   * @internal
   */
  inputRef?: MuiTextFieldProps['inputRef']
  /**
   * Internal. The name a dev-mode warning should call this field: `Select`,
   * `PasswordField` and `TextareaField` all render *through* `TextField`, and a
   * warning that named `TextField` would point the consumer at a component they
   * never wrote. Every such wrapper `Omit`s this from its own public props, so it
   * is not part of any component's API.
   *
   * @internal
   */
  componentName?: string
  /**
   * Renders this text in the input instead of the bound value, for the fields
   * whose stored value and displayed value deliberately differ: `PhoneField`
   * stores `'5555555555'` and displays `'555-555-5555'`. The binding is
   * unchanged — the form value, validation and `aria-*` wiring all still come
   * from `name` — so a field using this must map the typed text back to a
   * stored value in its own `onChange` before the form's handler sees it.
   *
   * Left `undefined` (the default, and every plain `<TextField>`), the bound
   * value is displayed as-is.
   */
  displayValue?: string
} & FieldRules<string> &
  LabelPlacementProps

// `type` → mobile keyboard (`inputMode`) and autofill (`autoComplete`) token. Only types
// with one unambiguous token are covered; a wrong guess is worse than none (#6, #7).
const INPUT_MODE_BY_TYPE: Partial<Record<string, string>> = {
  email: 'email',
  tel: 'tel',
  url: 'url',
  search: 'search',
}
const AUTO_COMPLETE_BY_TYPE: Partial<Record<string, string>> = {
  email: 'email',
  tel: 'tel',
  url: 'url',
}

export function TextField({
  name,
  label,
  helperText,
  disabled,
  onChange,
  onBlur,
  slotProps,
  required,
  min,
  max,
  minLength,
  maxLength,
  pattern,
  validate,
  displayValue,
  type,
  autoComplete: autoCompleteProp,
  componentName = 'TextField',
  inputRef: inputRefProp,
  labelPlacement,
  // Routed through the hook rather than left in `rest`: MUI already puts a
  // TextField's `className` on the `FormControl` root, which is exactly the box
  // the placement classes go on, so the hook joins the two and the result lands
  // in one place (#9, #66).
  className,
  // Destructured out of `rest` on purpose. Left in it they reach MUI's root, which
  // puts a root `aria-label` on the `FormControl` **wrapper** — naming a `<div>`
  // while the `<input>` stays anonymous (#99). They go to `slotProps.htmlInput`
  // below instead, via the hook that also decides whether the missing-label
  // warning fires, so one place owns the name.
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  // Same wrapper problem, and the same fix: on the root this describes the
  // `FormControl` div, which nothing reads, while the `<input>` keeps only the
  // helper-text id. It is merged with that id onto `slotProps.htmlInput` below,
  // because an accessible description is a list — a consumer's extra description
  // and the error message are both meant to be read (#104).
  'aria-describedby': ariaDescribedBy,
  ...rest
}: TextFieldProps) {
  const assisted = useAssisted()
  const autoComplete =
    autoCompleteProp ??
    resolveAutoComplete(type ? AUTO_COMPLETE_BY_TYPE[type] : undefined, assisted)
  const f = useEzField<string>(name, componentName, {
    label,
    rules: { required, min, max, minLength, maxLength, pattern, validate },
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    labelPlacement,
    className,
  })
  const {
    ref,
    value,
    disabled: fieldDisabled,
    onChange: fieldOnChange,
    onBlur: fieldOnBlur,
    ...fieldProps
  } = f.field
  // `useForkRef` is MUI's own composer; `InputBase` already wraps hookform's ref in the same hook,
  // so this extra layer changes nothing for a plain `TextField` without a consumer `inputRef`.
  const inputRef = useForkRef(ref, inputRefProp)

  const text = f.helperText(helperText)

  // `{...rest}` is first, before every binding-owned prop, so a consumer prop that
  // collides with one cannot displace it. `name`/`value`/`defaultValue`/`error`/
  // `inputRef` are `Omit`ted from the props type, but a consumer building props
  // dynamically still reaches them at runtime, and `value` deciding what the input
  // shows is exactly the thing the binding must own (#104). Matches the order
  // `Autocomplete`, `NumberField` and `OtpField` already use.
  //
  // MUI TextField sets `aria-invalid` itself; the helper-text `role` and the
  // description come from the hook.
  return (
    <MuiTextField
      {...rest}
      {...fieldProps}
      className={f.layoutClassName}
      label={f.displayLabel}
      value={displayValue ?? value ?? ''}
      onChange={(e) => {
        fieldOnChange(e)
        onChange?.(e)
      }}
      onBlur={(e) => {
        fieldOnBlur()
        onBlur?.(e)
      }}
      disabled={mergeDisabled(disabled, fieldDisabled)}
      required={f.required}
      inputRef={inputRef}
      error={f.invalid}
      helperText={text}
      type={type}
      autoComplete={autoComplete}
      slotProps={{
        ...slotProps,
        // Not `mergeSlotProps`: that exists to let the consumer's value win, which is
        // right for `className`/`sx`/handlers and wrong for `role`. The hook re-applies
        // `role="alert"` after the consumer's props so an error cannot render announced
        // by nothing, and pins the id the description below points at (#104).
        formHelperText: f.helperTextSlotProps(slotProps?.formHelperText),
        inputLabel: mergeSlotProps(slotProps?.inputLabel, { required: f.labelRequired }),
        htmlInput: mergeSlotProps(slotProps?.htmlInput, {
          inputMode: type ? INPUT_MODE_BY_TYPE[type] : undefined,
          // The name goes on the element that carries the role. For a plain
          // TextField that is this `<input>`; under `select` MUI moves the role to
          // the trigger and takes its name from `slotProps.select` instead (below).
          ...(rest.select ? null : f.nameA11y),
          // `slotProps.htmlInput` is spread after `InputBase`'s own
          // `aria-describedby`, so this is the one channel that can widen it from
          // the helper-text id alone to that id *plus* the consumer's. A `select`
          // TextField's `htmlInput` is the hidden native input, not the combobox,
          // so its description is routed through `slotProps.select` instead (below).
          ...(rest.select ? null : { 'aria-describedby': f.describedBy(ariaDescribedBy, text) }),
        }),
        // A `select` TextField renders a hidden native input plus a separate
        // `role="combobox"` trigger div; `htmlInput` reaches only the hidden one, so
        // the name has to be routed to the trigger to be announced. `SelectDisplayProps`
        // rather than a plain `aria-labelledby`, because `SelectInput` hard-codes the
        // trigger's `aria-labelledby` to its own `labelId` (`undefined` with no label,
        // which is how the name went missing) and only spreads `SelectDisplayProps`
        // afterwards — that spread is the one channel that reaches the element.
        ...(rest.select
          ? {
              select: mergeSlotProps(slotProps?.select, {
                SelectDisplayProps: f.nameA11y,
                // MUI puts `aria-describedby={helperTextId}` on the `Select` and then
                // spreads the slot's props after it, so this is where a `select`
                // TextField's description gets widened to include the consumer's.
                'aria-describedby': f.describedBy(ariaDescribedBy, text),
              }),
            }
          : null),
      }}
    />
  )
}
