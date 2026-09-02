import { useDefaultProps } from '@mui/material/DefaultPropsProvider'
import { mergeSlotProps, useForkRef } from '@mui/material/utils'
import { TextField, type TextFieldProps } from '../TextField'
import { resolveAutoComplete } from '../resolveAutoComplete'
import { useAssisted } from '../../Form/AssistedContext'
import { useEzFormContext } from '../../useEzFormContext'
import { templateDigitCount } from '../formatTemplate'
import { useTemplateField } from '../useTemplateField'

/**
 * `type`, `inputMode` and `pattern` are the binding's: an EIN is always typed
 * on a numeric keypad, and a `pattern` rule would duplicate (and could
 * contradict) the built-in completeness rule below. `displayValue` is how this
 * field shows formatted text over a digits-only value, so it is the binding's
 * too. `autoComplete` is re-declared as an ordinary `string` so a consumer can
 * override the `'off'` default — there is no autofill token for a tax ID, and a
 * browser guessing one over a federal identifier is worse than none.
 */
export type FeinFieldProps = Omit<
  TextFieldProps,
  'type' | 'inputMode' | 'autoComplete' | 'pattern' | 'displayValue'
> & {
  /**
   * Display template: each `#` is one digit slot, every other character is a
   * separator inserted between them. Defaults to `'##-#######'`, the IRS's own
   * two-then-seven shape. The number of `#`s is also how many digits the field
   * accepts and what the built-in completeness rule requires.
   */
  format?: string
  /**
   * Shown when the value is non-empty but has fewer digits than `format`
   * holds. Default `'Enter a 9-digit employer identification number'`.
   *
   * A `string`, not a `ReactNode`: this is a validation message, and
   * react-hook-form's `Message` is a string — it has to survive the trip
   * through `useController`'s rules to `fieldState.error.message`, exactly
   * like every message in `rules.ts`.
   */
  invalidMessage?: string
  autoComplete?: string
}

const DEFAULT_FORMAT = '##-#######'

/**
 * US employer identification number on top of `TextField`: the form value is
 * the bare digit string (`'123456789'`, and `''` when empty, never `undefined`,
 * so `required` still applies) and `format` decides only how it is displayed.
 * Typing, pasting a formatted EIN, and deleting through the separator all work,
 * and the caret stays with the digit being edited rather than jumping to the end.
 *
 * All of that value and caret arithmetic is `useTemplateField`, shared with
 * `PhoneField` and `SsnField`. Unlike `PhoneField` this passes no
 * `normalizeDigits`: there is no country-code convention for an EIN, so an
 * over-long paste simply truncates at the template's capacity.
 */
export function FeinField(inProps: FeinFieldProps) {
  // Ahead of TextField's own guard, so the "outside <Form>" error names <FeinField>.
  useEzFormContext('FeinField')
  const props = useDefaultProps({ props: inProps, name: 'EzFeinField' })
  const {
    name,
    format = DEFAULT_FORMAT,
    invalidMessage = 'Enter a 9-digit employer identification number',
    autoComplete: autoCompleteProp,
    validate,
    slotProps,
    ...rest
  } = props
  const assisted = useAssisted()
  // The default is already `'off'`, so assisted mode cannot change it — the
  // helper is consulted anyway so this field resolves its token by the same one
  // rule as every other, rather than quietly opting out of #65's single owner.
  const autoComplete = autoCompleteProp ?? resolveAutoComplete('off', assisted)

  const capacity = templateDigitCount(format)

  const { displayValue, htmlInputProps } = useTemplateField({ name, format, capacity })

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
      autoComplete={autoComplete}
      displayValue={displayValue}
      validate={{
        // Consumer entries first: a built-in key must not be silently replaced.
        ...consumerValidate,
        complete: (v) => {
          const value = typeof v === 'string' ? v : ''
          return value === '' || value.length === capacity || invalidMessage
        },
      }}
      slotProps={{
        ...slotProps,
        htmlInput: {
          ...mergeSlotProps(slotProps?.htmlInput, {
            inputMode: 'numeric',
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
