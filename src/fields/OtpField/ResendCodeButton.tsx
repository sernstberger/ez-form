import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react'
import Button, { type ButtonProps } from '@mui/material/Button'
import { styled } from '@mui/material/styles'
import { useDefaultProps } from '@mui/material/DefaultPropsProvider'
import generateUtilityClasses from '@mui/material/generateUtilityClasses'
import { useFormState } from 'react-hook-form'
import { useEzFormContext } from '../../useEzFormContext'
import { mergeDisabled } from '../mergeDisabled'

export const resendCodeButtonClasses = generateUtilityClasses('EzResendCodeButton', [
  'root',
  'status',
])

export interface ResendCodeButtonProps extends Omit<ButtonProps, 'type' | 'onClick'> {
  /** Called on click; awaited if it returns a promise (disabled while pending). */
  onResend: () => void | Promise<void>
  /** Seconds the button stays disabled after a resend. Default 30. */
  cooldown?: number
  /**
   * Shown in the `status` slot when `onResend` rejects, instead of "Code
   * sent". No cooldown starts on failure — the button re-enables immediately
   * so the consumer can retry. Default "Code could not be sent".
   */
  errorText?: ReactNode
  /**
   * Called with the rejection when `onResend` fails, for logging. The error
   * is otherwise swallowed — the `status` slot is what surfaces it to the
   * user, so this is optional and never required to avoid an unhandled
   * rejection.
   */
  onResendError?: (error: unknown) => void
  /** The status region (a visible `role="status"`), which announces "Code sent" once per resend. */
  slotProps?: { status?: ComponentProps<'span'> }
}

const ResendCodeButtonRoot = styled(Button, { name: 'EzResendCodeButton', slot: 'Root' })({})
const ResendCodeButtonStatus = styled('span', {
  name: 'EzResendCodeButton',
  slot: 'Status',
})({})

/**
 * Resends a one-time code, then disables itself for `cooldown` seconds with
 * the remaining time in its own label. The countdown text is not a live
 * region — announcing every second would spam assistive tech — so a
 * separate `status` slot announces "Code sent" once per click, cleared
 * before the next resend so repeated clicks re-announce.
 *
 * A rejected `onResend` is caught, not left to reject unhandled: the
 * `status` slot announces `errorText` instead of "Code sent", no cooldown
 * starts (the button re-enables immediately so the user can retry), and
 * `onResendError` (if given) receives the error for logging.
 */
export function ResendCodeButton(inProps: ResendCodeButtonProps) {
  const {
    onResend,
    cooldown = 30,
    errorText = 'Code could not be sent',
    onResendError,
    disabled,
    children = 'Resend code',
    className,
    slotProps,
    ...rest
  } = useDefaultProps({ props: inProps, name: 'EzResendCodeButton' })
  useEzFormContext('ResendCodeButton') // guard only; useFormState reads control from context
  const { disabled: formDisabled } = useFormState()

  const [pending, setPending] = useState(false)
  const [remaining, setRemaining] = useState(0)
  const [status, setStatus] = useState<ReactNode>('')
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined)

  useEffect(
    () => () => {
      clearInterval(intervalRef.current)
    },
    [],
  )

  const handleClick = async () => {
    setStatus('')
    setPending(true)
    try {
      await onResend()
    } catch (error) {
      setPending(false)
      setStatus(errorText)
      onResendError?.(error)
      return
    }
    setPending(false)
    setStatus('Code sent')
    setRemaining(cooldown)
    clearInterval(intervalRef.current)
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const cooling = remaining > 0
  const label = cooling ? `${children} (${remaining}s)` : children
  const { status: statusSlotProps } = slotProps ?? {}

  return (
    <>
      <ResendCodeButtonRoot
        type="button"
        disabled={mergeDisabled(disabled, formDisabled) || pending || cooling}
        className={`${resendCodeButtonClasses.root}${className ? ` ${className}` : ''}`}
        onClick={handleClick}
        {...rest}
      >
        {label}
      </ResendCodeButtonRoot>
      <ResendCodeButtonStatus
        role="status"
        {...statusSlotProps}
        className={`${resendCodeButtonClasses.status}${statusSlotProps?.className ? ` ${statusSlotProps.className}` : ''}`}
      >
        {status}
      </ResendCodeButtonStatus>
    </>
  )
}
