import { useEffect, useRef, useState, type ReactNode } from 'react'
import Button, { type ButtonProps } from '@mui/material/Button'
import { styled } from '@mui/material/styles'
import { useDefaultProps } from '@mui/material/DefaultPropsProvider'
import generateUtilityClasses from '@mui/material/generateUtilityClasses'
import { useFormState } from 'react-hook-form'
import { useEzFormContext } from '../../useEzFormContext'
import { mergeDisabled } from '../mergeDisabled'
import { LiveRegion, type LiveRegionProps } from '../../Form/LiveRegion'

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
  /** Announced in the `status` slot once `onResend` resolves. Default "Code sent". */
  sentText?: ReactNode
  /**
   * Called with the rejection when `onResend` fails, for logging. The error
   * is otherwise swallowed — the `status` slot is what surfaces it to the
   * user, so this is optional and never required to avoid an unhandled
   * rejection.
   */
  onResendError?: (error: unknown) => void
  /** The status region (a visible `role="status"`), which announces "Code sent" once per resend. */
  slotProps?: { status?: Omit<LiveRegionProps, 'message' | 'announcementKey'> }
}

const ResendCodeButtonRoot = styled(Button, { name: 'EzResendCodeButton', slot: 'Root' })({})
// Visible (it is sighted confirmation of the resend as well as the announcement),
// so it opts out of LiveRegion's visually-hidden default.
const ResendCodeButtonStatus = styled(LiveRegion, {
  name: 'EzResendCodeButton',
  slot: 'Status',
})({})

/**
 * Resends a one-time code, then disables itself for `cooldown` seconds with
 * the remaining time in its own label. The countdown text is not a live
 * region — announcing every second would spam assistive tech — so a
 * separate `status` slot announces "Code sent" once per click, remounted per
 * announcement so repeated clicks re-announce.
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
    sentText = 'Code sent',
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
  // `{ text, seq }`, not a bare node: `seq` becomes the region's
  // `announcementKey`, so two resends in a row both announce "Code sent" even
  // though the text is identical. The previous shape leaned on the `await` in
  // `handleClick` to separate the clear from the set into two renders — true
  // today, but only by accident of the async path.
  const [status, setStatus] = useState<{ text: ReactNode; seq: number }>({ text: '', seq: 0 })
  const announce = (text: ReactNode) => setStatus((prev) => ({ text, seq: prev.seq + 1 }))
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined)

  useEffect(
    () => () => {
      clearInterval(intervalRef.current)
    },
    [],
  )

  const handleClick = async () => {
    setPending(true)
    try {
      await onResend()
    } catch (error) {
      setPending(false)
      announce(errorText)
      onResendError?.(error)
      return
    }
    setPending(false)
    announce(sentText)
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
  // The countdown is appended as a sibling node rather than interpolated into a template:
  // `children` is a `ReactNode`, so a consumer passing an element (an icon plus text, say)
  // would otherwise render the literal "[object Object] (30s)".
  const label = cooling ? (
    <>
      {children} ({remaining}s)
    </>
  ) : (
    children
  )
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
        visuallyHidden={false}
        {...statusSlotProps}
        message={status.text}
        announcementKey={status.seq}
        className={`${resendCodeButtonClasses.status}${statusSlotProps?.className ? ` ${statusSlotProps.className}` : ''}`}
      />
    </>
  )
}
