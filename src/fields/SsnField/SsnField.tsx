import { useFormState } from 'react-hook-form'
import { useDefaultProps } from '@mui/material/DefaultPropsProvider'
import generateUtilityClasses from '@mui/material/generateUtilityClasses'
import IconButton, { type IconButtonProps } from '@mui/material/IconButton'
import { styled } from '@mui/material/styles'
import { mergeSlotProps, useForkRef } from '@mui/material/utils'
import { TextField, type TextFieldProps } from '../TextField'
import { mergeDisabled } from '../mergeDisabled'
import { RevealToggle, type RevealIcons } from '../RevealToggle'
import { useRevealState } from '../useRevealState'
import { useEzFormContext } from '../../useEzFormContext'
import { cx } from '../../cx'
import { templateDigitCount } from '../formatTemplate'
import { useTemplateField } from '../useTemplateField'

export const ssnFieldClasses = generateUtilityClasses('EzSsnField', ['root', 'toggle'])

const SsnFieldRoot = styled(TextField, { name: 'EzSsnField', slot: 'Root' })({})
const SsnFieldToggle = styled(IconButton, { name: 'EzSsnField', slot: 'Toggle' })({})

/**
 * `type` is the binding's — it is `password` or `text` depending on the reveal
 * toggle, never a consumer's choice. `inputMode` and `autoComplete` are fixed
 * too, unlike `PhoneField`'s: there is no sectioned autofill token for an SSN
 * and no reason to want one, so `autoComplete` is pinned `off` rather than
 * offered as a prop. `pattern` would duplicate (and could contradict) the
 * built-in completeness rule, and `displayValue` is how the field shows
 * formatted text over a digits-only value.
 */
export type SsnFieldProps = Omit<
  TextFieldProps,
  'type' | 'inputMode' | 'autoComplete' | 'pattern' | 'displayValue' | 'componentName' | 'inputRef'
> & {
  /**
   * Shown when the value is non-empty but has fewer than nine digits. Default
   * `'Enter a 9-digit Social Security number'`.
   *
   * A `string`, not a `ReactNode`: this is a validation message, and
   * react-hook-form's `Message` is a string — it has to survive the trip
   * through `useController`'s rules to `fieldState.error.message`, exactly
   * like every message in `rules.ts`. Rich markup in an error belongs in a
   * `validate` of your own.
   */
  invalidMessage?: string
  /** Renders the show/hide toggle. Default `true`. */
  reveal?: boolean
  /** Accessible name for the toggle while the number is hidden. Default `'Show Social Security number'`. */
  showLabel?: string
  /** Accessible name for the toggle while the number is shown. Default `'Hide Social Security number'`. */
  hideLabel?: string
  /**
   * Icons for the toggle's two states, defaulted through `useDefaultProps` so
   * `theme.components.EzSsnField.defaultProps.icons` can swap them app-wide.
   * Replaces the built-in `Visibility`/`VisibilityOff` icons — `slotProps.toggle`
   * still reaches the toggle `IconButton` itself, but its `children` is always
   * overridden by this prop (or the default icons), not the other way around.
   */
  icons?: RevealIcons
  slotProps?: TextFieldProps['slotProps'] & { toggle?: IconButtonProps }
}

/**
 * The template is fixed, not a prop: unlike a phone number, an SSN has exactly
 * one canonical rendering, so a `format` prop would only offer ways to get it
 * wrong.
 */
const SSN_FORMAT = '###-##-####'
const SSN_CAPACITY = templateDigitCount(SSN_FORMAT)

/**
 * US Social Security number on top of `TextField`: the form value is the bare
 * nine-digit string (`'123456789'`, and `''` when empty — never `undefined`, so
 * `required` still applies) and the field displays it as `123-45-6789`.
 *
 * Hidden by default. While hidden the input is `type="password"`, so the
 * formatted text renders as the browser's dots and the number is safe from
 * shoulder-surfing; the toggle switches to `type="text"` to check an entry.
 * Typing, pasting a formatted number, and deleting through a separator all
 * work, and the caret stays with the digit being edited rather than jumping to
 * the end.
 */
export function SsnField(inProps: SsnFieldProps) {
  // Ahead of TextField's own guard, so the "outside <Form>" error names <SsnField>.
  const { control } = useEzFormContext('SsnField')
  const props = useDefaultProps({ props: inProps, name: 'EzSsnField' })
  const {
    name,
    invalidMessage = 'Enter a 9-digit Social Security number',
    reveal = true,
    showLabel = 'Show Social Security number',
    hideLabel = 'Hide Social Security number',
    icons,
    disabled,
    className,
    validate,
    slotProps,
    ...rest
  } = props

  // Local only: never reaches the form value, and resets on unmount since it starts false again.
  // The hook also owns the focus/caret restoration the `type` swap would otherwise destroy.
  const { revealed, toggle, inputRef: revealInputRef, recordFocus } = useRevealState()
  const { toggle: toggleSlotProps, ...restSlotProps } = slotProps ?? {}

  // No per-field disable registration exists in this codebase (see TextField/NumberField/etc,
  // all driven by `useController.field.disabled`), so the form-level flag `useFormState`
  // reports is the same value `<TextField>`'s own `useEzField` will derive for this field.
  const { disabled: formDisabled } = useFormState({ control })
  const toggleDisabled = mergeDisabled(disabled, formDisabled)

  const { displayValue, htmlInputProps } = useTemplateField({
    name,
    format: SSN_FORMAT,
    capacity: SSN_CAPACITY,
  })

  // Two internal refs want this one input: the template hook's (caret
  // restoration after a reformat) and the reveal hook's (caret restoration
  // after a `type` swap). `useForkRef` is MUI's own composer. The fork goes
  // through `inputRef`, which MUI forks again with any consumer
  // `slotProps.htmlInput.ref` in either form; see `TemplateFieldBinding`.
  const { ref: templateInputRef, ...templateInputProps } = htmlInputProps
  const inputRef = useForkRef(templateInputRef, revealInputRef)

  const consumerValidate =
    validate === undefined ? {} : typeof validate === 'function' ? { validate } : validate

  return (
    <SsnFieldRoot
      {...rest}
      name={name}
      componentName="SsnField"
      // While hidden the browser masks whatever text the input holds, so the
      // formatted value shows as dots; revealed, the same text shows as
      // `123-45-6789`. Either way the stored value is the bare digits.
      type={revealed ? 'text' : 'password'}
      autoComplete="off"
      inputRef={inputRef}
      disabled={disabled}
      displayValue={displayValue}
      className={cx(ssnFieldClasses.root, className)}
      validate={{
        // Consumer entries first: a built-in key must not be silently replaced.
        ...consumerValidate,
        complete: (v) => {
          const value = typeof v === 'string' ? v : ''
          return value === '' || value.length === SSN_CAPACITY || invalidMessage
        },
      }}
      slotProps={{
        ...restSlotProps,
        // The toggle owns the end adornment (like PasswordField's does); other
        // `input` slot props a consumer sets (readOnly, startAdornment, …) still
        // pass through — only `endAdornment` itself is not overridable here.
        input: {
          ...restSlotProps?.input,
          endAdornment: reveal ? (
            <RevealToggle
              component={SsnFieldToggle}
              revealed={revealed}
              onToggle={toggle}
              onRecordFocus={recordFocus}
              showLabel={showLabel}
              hideLabel={hideLabel}
              disabled={toggleDisabled}
              className={ssnFieldClasses.toggle}
              icons={icons}
              slotProps={toggleSlotProps}
            />
          ) : undefined,
        },
        htmlInput: mergeSlotProps(restSlotProps?.htmlInput, {
          inputMode: 'numeric',
          ...templateInputProps,
        }),
      }}
    />
  )
}
