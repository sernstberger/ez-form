import { useState } from 'react'
import { useFormState } from 'react-hook-form'
import { useDefaultProps } from '@mui/material/DefaultPropsProvider'
import generateUtilityClasses from '@mui/material/generateUtilityClasses'
import IconButton, { type IconButtonProps } from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import SvgIcon, { type SvgIconProps } from '@mui/material/SvgIcon'
import { styled } from '@mui/material/styles'
import { mergeSlotProps } from '@mui/material/utils'
import { TextField, type TextFieldProps } from '../TextField'
import { mergeDisabled } from '../mergeDisabled'
import { useEzFormContext } from '../../useEzFormContext'

// Inline copies of @mui/icons-material Visibility / VisibilityOff (not a dependency;
// see NumberField's steppers for the same approach and reasoning).
const VisibilityIcon = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5M12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5m0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3" />
  </SvgIcon>
)
const VisibilityOffIcon = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7M2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3zM7.53 9.8l1.55 1.55c-.05.21-.08.42-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2m4.31-.78 3.15 3.15.02-.16c0-1.66-1.34-3-3-3z" />
  </SvgIcon>
)

export const passwordFieldClasses = generateUtilityClasses('EzPasswordField', ['root', 'toggle'])

const PasswordFieldRoot = styled(TextField, { name: 'EzPasswordField', slot: 'Root' })({})
const PasswordFieldToggle = styled(IconButton, { name: 'EzPasswordField', slot: 'Toggle' })({})

/**
 * `TextField` with `type` fixed to `password`/`text` by a local reveal toggle.
 * Omits `type` (the binding owns it, driven by the toggle) — everything else,
 * including validation rules, comes from `TextField`.
 */
export type PasswordFieldProps = Omit<TextFieldProps, 'type'> & {
  /** Renders the show/hide toggle. Default `true`. */
  revealable?: boolean
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
            <InputAdornment position="end">
              <PasswordFieldToggle
                {...mergeSlotProps(toggleSlotProps, {
                  className: passwordFieldClasses.toggle,
                })}
                type="button"
                aria-label={revealed ? 'Hide password' : 'Show password'}
                aria-pressed={revealed}
                edge="end"
                disabled={toggleDisabled}
                onClick={(e) => {
                  setRevealed((r) => !r)
                  toggleSlotProps?.onClick?.(e)
                }}
              >
                {revealed ? <VisibilityOffIcon /> : <VisibilityIcon />}
              </PasswordFieldToggle>
            </InputAdornment>
          ) : undefined,
        },
      }}
    />
  )
}
