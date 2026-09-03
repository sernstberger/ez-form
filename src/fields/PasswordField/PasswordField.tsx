import { useFormState } from 'react-hook-form'
import { useDefaultProps } from '@mui/material/DefaultPropsProvider'
import generateUtilityClasses from '@mui/material/generateUtilityClasses'
import IconButton, { type IconButtonProps } from '@mui/material/IconButton'
import { styled } from '@mui/material/styles'
import { TextField, type TextFieldProps } from '../TextField'
import { mergeDisabled } from '../mergeDisabled'
import { useAssisted } from '../../Form/AssistedContext'
import { RevealToggle, type RevealIcons } from '../RevealToggle'
import { useRevealState } from '../useRevealState'
import { useEzFormContext } from '../../useEzFormContext'
import { cx } from '../../cx'

export const passwordFieldClasses = generateUtilityClasses('EzPasswordField', ['root', 'toggle'])

const PasswordFieldRoot = styled(TextField, { name: 'EzPasswordField', slot: 'Root' })({})
const PasswordFieldToggle = styled(IconButton, { name: 'EzPasswordField', slot: 'Toggle' })({})

/**
 * `TextField` with `type` fixed to `password`/`text` by a local reveal toggle.
 * Omits `type` (the binding owns it, driven by the toggle) — everything else,
 * including validation rules, comes from `TextField`. `inputRef` is the
 * internal channel the reveal hook's caret ref takes; a consumer ref belongs in
 * `slotProps.htmlInput`.
 */
export type PasswordFieldProps = Omit<TextFieldProps, 'type' | 'componentName' | 'inputRef'> & {
  /** Renders the show/hide toggle. Default `true`. */
  revealable?: boolean
  /** Accessible name for the toggle while the password is hidden. Default `'Show password'`. */
  showLabel?: string
  /** Accessible name for the toggle while the password is shown. Default `'Hide password'`. */
  hideLabel?: string
  /**
   * Icons for the toggle's two states, defaulted through `useDefaultProps` so
   * `theme.components.EzPasswordField.defaultProps.icons` can swap them app-wide.
   * Replaces the built-in `Visibility`/`VisibilityOff` icons — `slotProps.toggle`
   * still reaches the toggle `IconButton` itself, but its `children` is always
   * overridden by this prop (or the default icons), not the other way around.
   */
  icons?: RevealIcons
  slotProps?: TextFieldProps['slotProps'] & { toggle?: IconButtonProps }
}

export function PasswordField(inProps: PasswordFieldProps) {
  // Ahead of TextField's own guard, so the "outside <Form>" error names <PasswordField>.
  const { control } = useEzFormContext('PasswordField')
  const props = useDefaultProps({ props: inProps, name: 'EzPasswordField' })
  const {
    revealable = true,
    autoComplete: autoCompleteProp,
    showLabel = 'Show password',
    hideLabel = 'Hide password',
    disabled,
    className,
    slotProps,
    icons,
    ...rest
  } = props
  // `resolveAutoComplete`'s `"off"` is what every other field gets under `assisted`, but
  // Chromium (and most password managers) does not reliably honour `off` for a password
  // input — it still offers to fill or save. `"new-password"` is the one token browsers
  // consistently treat as "do not fill from a saved credential", which is exactly what
  // assisted mode wants here regardless of whether this field is a sign-in or a
  // sign-up/change field (#65 requirement 3).
  const assisted = useAssisted()
  const autoComplete = autoCompleteProp ?? (assisted ? 'new-password' : 'current-password')
  // Local only: never reaches the form value, and resets on unmount since it starts false again.
  // The hook also owns the focus/caret restoration the `type` swap would otherwise destroy.
  // The hook's ref must reach the `<input>` for caret restoration to work. It
  // goes through `TextField`'s internal `inputRef`, which MUI's `InputBase`
  // forks with any consumer `slotProps.htmlInput.ref` in either form — object
  // or callback. Composing the two here could only see the object form and
  // silently dropped a callback-form ref (#96, the same shape as #92).
  const { revealed, toggle, inputRef, recordFocus } = useRevealState()
  const { toggle: toggleSlotProps, ...restSlotProps } = slotProps ?? {}
  // No per-field disable registration exists in this codebase (see TextField/NumberField/etc,
  // all driven by `useController.field.disabled`), so the form-level flag `useFormState`
  // reports is the same value `<TextField>`'s own `useEzField` will derive for this field.
  const { disabled: formDisabled } = useFormState({ control })
  const toggleDisabled = mergeDisabled(disabled, formDisabled)

  return (
    <PasswordFieldRoot
      {...rest}
      componentName="PasswordField"
      type={revealed ? 'text' : 'password'}
      autoComplete={autoComplete}
      disabled={disabled}
      inputRef={inputRef}
      className={cx(passwordFieldClasses.root, className)}
      slotProps={{
        // `htmlInput` passes through untouched (`restSlotProps`): this field
        // adds nothing to it, and its own ref went via `inputRef` above.
        ...restSlotProps,
        // The toggle owns the end adornment (like NumberField owns its steppers there);
        // other `input` slot props a consumer sets (readOnly, startAdornment, …) still pass
        // through — only `endAdornment` itself is not overridable through this prop.
        input: {
          ...restSlotProps?.input,
          endAdornment: revealable ? (
            <RevealToggle
              component={PasswordFieldToggle}
              revealed={revealed}
              onToggle={toggle}
              onRecordFocus={recordFocus}
              showLabel={showLabel}
              hideLabel={hideLabel}
              disabled={toggleDisabled}
              className={passwordFieldClasses.toggle}
              icons={icons}
              slotProps={toggleSlotProps}
            />
          ) : undefined,
        },
      }}
    />
  )
}
