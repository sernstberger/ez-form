import { useState } from 'react'
import { useFormState } from 'react-hook-form'
import { useDefaultProps } from '@mui/material/DefaultPropsProvider'
import generateUtilityClasses from '@mui/material/generateUtilityClasses'
import IconButton, { type IconButtonProps } from '@mui/material/IconButton'
import { styled } from '@mui/material/styles'
import { TextField, type TextFieldProps } from '../TextField'
import { mergeDisabled } from '../mergeDisabled'
import { RevealToggle, type RevealIcons } from '../RevealToggle'
import { useEzFormContext } from '../../useEzFormContext'

export const passwordFieldClasses = generateUtilityClasses('EzPasswordField', ['root', 'toggle'])

const PasswordFieldRoot = styled(TextField, { name: 'EzPasswordField', slot: 'Root' })({})
const PasswordFieldToggle = styled(IconButton, { name: 'EzPasswordField', slot: 'Toggle' })({})

/**
 * `TextField` with `type` fixed to `password`/`text` by a local reveal toggle.
 * Omits `type` (the binding owns it, driven by the toggle) — everything else,
 * including validation rules, comes from `TextField`.
 */
export type PasswordFieldProps = Omit<TextFieldProps, 'type' | 'componentName'> & {
  /** Renders the show/hide toggle. Default `true`. */
  revealable?: boolean
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
    autoComplete = 'current-password',
    disabled,
    className,
    slotProps,
    icons,
    ...rest
  } = props
  // Local only: never reaches the form value, and resets on unmount since it starts false again.
  const [revealed, setRevealed] = useState(false)
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
      className={`${passwordFieldClasses.root}${className ? ` ${className}` : ''}`}
      slotProps={{
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
              onToggle={() => setRevealed((r) => !r)}
              showLabel="Show password"
              hideLabel="Hide password"
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
