import { useId, type FocusEvent, type ReactNode, type Ref } from 'react'
import { OTPField } from '@base-ui/react/otp-field'
import { useDefaultProps } from '@mui/material/DefaultPropsProvider'
import FormControl from '@mui/material/FormControl'
import FormHelperText from '@mui/material/FormHelperText'
import FormLabel from '@mui/material/FormLabel'
import generateUtilityClasses from '@mui/material/generateUtilityClasses'
import { styled } from '@mui/material/styles'

export interface OtpFieldInputProps {
  'aria-invalid'?: true
  'aria-describedby'?: string
  onBlur?: () => void
}

export interface OtpFieldControlProps extends Omit<OTPField.Root.Props, 'render' | 'children'> {
  label?: ReactNode
  size?: 'small' | 'medium'
  error?: boolean
  helperText?: ReactNode
  helperTextProps?: { id: string; role?: 'alert' }
  /** Hookform's ref: the first slot, which is what a submit error focuses. */
  inputRef?: Ref<HTMLInputElement>
  inputProps?: OtpFieldInputProps
}

export const otpFieldClasses = generateUtilityClasses('EzOtpField', ['root', 'helperText'])

const Slots = styled('div')(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(1),
}))

// FormHelperText's own left margin lines up with a TextField's outline notch;
// OTPField.Root has none, so the helper text would sit indented under the
// slots with no notch to match. Zeroing it is the component's minimum — the
// helper text otherwise reads as misaligned — so it lives on the styled
// slot's default style block, still overridable via
// `theme.components.EzOtpField.styleOverrides.helperText`.
const OtpFieldHelperText = styled(FormHelperText, { name: 'EzOtpField', slot: 'HelperText' })({
  marginLeft: 0,
})

/** One slot, in the outlined TextField's voice: same border, radius, focus ring, and error color. */
const Slot = styled(OTPField.Input, {
  shouldForwardProp: (prop) => prop !== 'small',
})<{ small: boolean }>(({ theme, small }) => ({
  width: small ? 32 : 40,
  height: small ? 32 : 40,
  padding: 0,
  textAlign: 'center',
  font: 'inherit',
  fontSize: theme.typography.pxToRem(small ? 14 : 16),
  color: (theme.vars || theme).palette.text.primary,
  background: 'transparent',
  border: `1px solid ${(theme.vars || theme).palette.divider}`,
  borderRadius: (theme.vars || theme).shape.borderRadius,
  outline: 'none',
  '&:hover:not(:disabled)': { borderColor: (theme.vars || theme).palette.text.primary },
  '&:focus': {
    borderColor: (theme.vars || theme).palette.primary.main,
    boxShadow: `inset 0 0 0 1px ${(theme.vars || theme).palette.primary.main}`,
  },
  '&:disabled': {
    color: (theme.vars || theme).palette.text.disabled,
    borderColor: (theme.vars || theme).palette.action.disabledBackground,
  },
  '[aria-invalid="true"]&': {
    borderColor: (theme.vars || theme).palette.error.main,
    '&:focus': { boxShadow: `inset 0 0 0 1px ${(theme.vars || theme).palette.error.main}` },
  },
}))

/**
 * Base UI OTPField styled like a row of small outlined MUI inputs. Unbound:
 * `OtpField` wires it to the form. Base UI puts `aria-describedby` on its
 * group div and derives `aria-invalid` from its own Field context, so the
 * a11y props go on every slot input instead (element props win).
 */
export function OtpFieldControl(inProps: OtpFieldControlProps) {
  const props = useDefaultProps({ props: inProps, name: 'EzOtpField' })
  const {
    id: idProp,
    label,
    size = 'medium',
    error,
    helperText,
    helperTextProps,
    inputRef,
    inputProps,
    length,
    disabled,
    required,
    ...rootProps
  } = props
  const generatedId = useId()
  const id = idProp ?? generatedId
  const { onBlur, ...a11y } = inputProps ?? {}
  // Focus moving between slots is not leaving the field: only report a blur
  // once focus lands outside the group, so the form does not mark the field
  // touched (and validate it) after every character.
  const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
    const group = event.currentTarget.closest('[role="group"]')
    if (group?.contains(event.relatedTarget as Node | null)) return
    onBlur?.()
  }
  return (
    <FormControl
      size={size}
      error={error}
      disabled={disabled}
      required={required}
      className={otpFieldClasses.root}
    >
      {label ? <FormLabel htmlFor={id}>{label}</FormLabel> : null}
      <OTPField.Root
        {...rootProps}
        id={id}
        length={length}
        disabled={disabled}
        required={required}
        render={<Slots />}
      >
        {Array.from({ length }, (_, index) => (
          <Slot
            key={index}
            small={size === 'small'}
            {...a11y}
            ref={index === 0 ? inputRef : undefined}
            aria-label={index === 0 ? undefined : `Character ${index + 1} of ${length}`}
            onBlur={handleBlur}
          />
        ))}
      </OTPField.Root>
      {helperText ? (
        <OtpFieldHelperText {...helperTextProps} className={otpFieldClasses.helperText}>
          {helperText}
        </OtpFieldHelperText>
      ) : null}
    </FormControl>
  )
}
