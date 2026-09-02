import { useEffect, useRef, useState, type ComponentProps } from 'react'
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
 */
export function ResendCodeButton(inProps: ResendCodeButtonProps) {
  const {
    onResend,
    cooldown = 30,
    disabled,
    children = 'Resend code',
    className,
    slotProps,
    ...rest
  } = useDefaultProps({ props: inProps, name: 'EzResendCodeButton' })
  useEzFormContext('ResendCodeButton') // guard only; useFormState reads control from context
  const { isSubmitting, disabled: formDisabled } = useFormState()

  const [pending, setPending] = useState(false)
  const [remaining, setRemaining] = useState(0)
  const [status, setStatus] = useState('')
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
    } finally {
      setPending(false)
    }
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
        disabled={mergeDisabled(disabled, formDisabled) || isSubmitting || pending || cooling}
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
