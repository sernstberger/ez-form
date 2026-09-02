import { useDefaultProps } from '@mui/material/DefaultPropsProvider'
import { mergeSlotProps, useForkRef } from '@mui/material/utils'
import { TextField, type TextFieldProps } from '../TextField'
import { resolveAutoComplete } from '../resolveAutoComplete'
import { useAssisted } from '../../Form/AssistedContext'
import { useEzFormContext } from '../../useEzFormContext'
import { templateDigitCount } from '../formatTemplate'
import { useTemplateField } from '../useTemplateField'

/**
 * `type`, `inputMode` and `pattern` are the binding's: a phone field is always
 * `type="tel"` with the telephone keypad, and a `pattern` rule would duplicate
 * (and could contradict) the built-in completeness rule below. `displayValue`
 * is how this field shows formatted text over a digits-only value, so it is
 * the binding's too. `autoComplete` is re-declared as an ordinary `string` so
 * a consumer can pass a sectioned token — `'shipping tel'`, `'work tel'` —
 * over the `'tel'` default.
 */
export type PhoneFieldProps = Omit<
  TextFieldProps,
  'type' | 'inputMode' | 'autoComplete' | 'pattern' | 'displayValue'
> & {
  /**
   * Display template: each `#` is one digit slot, every other character is a
   * separator inserted between them. Defaults to `'###-###-####'`. The number
   * of `#`s is also how many digits the field accepts and what the built-in
   * completeness rule requires, so `'(###) ###-####'` still means ten digits
   * while `'###-####'` means seven.
   */
  format?: string
  /**
   * Shown when the value is non-empty but has fewer digits than `format`
   * holds. Defaults to `Enter a <n>-digit phone number`, with `<n>` derived
   * from the template so a custom `format` gets a matching default.
   *
   * A `string`, not a `ReactNode`: this is a validation message, and
   * react-hook-form's `Message` is a string — it has to survive the trip
   * through `useController`'s rules to `fieldState.error.message`, exactly
   * like every message in `rules.ts`. Rich markup in an error belongs in a
   * `validate` of your own.
   */
  invalidMessage?: string
  autoComplete?: string
}

const DEFAULT_FORMAT = '###-###-####'

/**
 * A US 11-digit entry is the country code plus the number — `+1 555 555 5555`
 * pasted from a contact card — so the leading `1` is dropped rather than
 * truncating the last digit off the real number. Only for a template holding
 * ten digits; a shorter or longer template has no such convention.
 */
function stripCountryCode(digits: string, capacity: number): string {
  if (capacity === 10 && digits.length === 11 && digits.startsWith('1')) return digits.slice(1)
  return digits
}

/**
 * US phone number on top of `TextField`: the form value is the bare digit
 * string (`'5555555555'`, and `''` when empty — never `undefined`, so
 * `required` still applies) and `format` decides only how it is displayed.
 * Typing, pasting a formatted number, and deleting through a separator all
 * work, and the caret stays with the digit being edited rather than jumping to
 * the end.
 */
export function PhoneField(inProps: PhoneFieldProps) {
  // Ahead of TextField's own guard, so the "outside <Form>" error names <PhoneField>.
  useEzFormContext('PhoneField')
  const props = useDefaultProps({ props: inProps, name: 'EzPhoneField' })
  const {
    name,
    format = DEFAULT_FORMAT,
    invalidMessage,
    autoComplete: autoCompleteProp,
    validate,
    slotProps,
    ...rest
  } = props
  const assisted = useAssisted()
  const autoComplete = autoCompleteProp ?? resolveAutoComplete('tel', assisted)

  const capacity = templateDigitCount(format)
  const message = invalidMessage ?? `Enter a ${capacity}-digit phone number`

  const { displayValue, htmlInputProps } = useTemplateField({
    name,
    format,
    capacity,
    normalizeDigits: (digits) => stripCountryCode(digits, capacity),
  })

  // The hook's ref must reach the `<input>` for caret restoration to work, and a
  // consumer may have passed one of their own. `useForkRef` (MUI's own composer)
  // keeps both rather than letting either replace the other.
  const { ref: templateInputRef, ...templateInputProps } = htmlInputProps
  const inputRef = useForkRef(
    templateInputRef,
    slotProps?.htmlInput && 'ref' in slotProps.htmlInput
      ? (slotProps.htmlInput.ref as React.Ref<HTMLInputElement>)
      : null,
  )

  const consumerValidate =
    validate === undefined ? {} : typeof validate === 'function' ? { validate } : validate

  return (
    <TextField
      {...rest}
      name={name}
      type="tel"
      autoComplete={autoComplete}
      displayValue={displayValue}
      validate={{
        // Consumer entries first: a built-in key must not be silently replaced.
        ...consumerValidate,
        complete: (v) => {
          const value = typeof v === 'string' ? v : ''
          return value === '' || value.length === capacity || message
        },
      }}
      slotProps={{
        ...slotProps,
        htmlInput: {
          ...mergeSlotProps(slotProps?.htmlInput, {
            inputMode: 'tel',
            ...templateInputProps,
          }),
          // After the merge, deliberately: `mergeSlotProps` spreads the
          // consumer's props last, so a consumer `ref` would replace the hook's
          // and silently disable caret restoration. `inputRef` already includes
          // that consumer ref, so nothing is dropped.
          ref: inputRef,
        },
      }}
    />
  )
}
