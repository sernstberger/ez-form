import type { ReactNode } from 'react'
import Button, { type ButtonProps } from '@mui/material/Button'
import { useDefaultProps } from '@mui/material/DefaultPropsProvider'
import generateUtilityClasses from '@mui/material/generateUtilityClasses'
import Stack, { type StackProps } from '@mui/material/Stack'
import { styled } from '@mui/material/styles'
import { useFormState } from 'react-hook-form'
import { SubmitButton, type SubmitButtonProps } from '../SubmitButton'
import { mergeDisabled } from '../fields/mergeDisabled'
import { useWizard } from './useWizard'

export interface WizardNavProps extends StackProps {
  /** Default `Back`. */
  prevLabel?: ReactNode
  /** Default `Next`. */
  nextLabel?: ReactNode
  /** Default `Submit` (SubmitButton's default). */
  submitLabel?: ReactNode
  slotProps?: {
    prev?: ButtonProps
    next?: ButtonProps
    submit?: SubmitButtonProps
  }
}

export const wizardNavClasses = generateUtilityClasses('EzWizardNav', [
  'root',
  'prev',
  'next',
  'submit',
])

// `justifyContent` isn't part of `StackOwnProps` (only `direction`/`spacing`
// are), so it can't be a JSX prop without `sx` — it's the styled slot's
// minimum default instead, still overridable via
// `theme.components.EzWizardNav.styleOverrides.root`.
const WizardNavRoot = styled(Stack, { name: 'EzWizardNav', slot: 'Root' })({
  justifyContent: 'space-between',
})
const WizardNavPrev = styled(Button, { name: 'EzWizardNav', slot: 'Prev' })({})
const WizardNavNext = styled(Button, { name: 'EzWizardNav', slot: 'Next' })({})
const WizardNavSubmit = styled(SubmitButton, { name: 'EzWizardNav', slot: 'Submit' })({})

/**
 * Back / Next for the current step; on the last step Next becomes
 * `<SubmitButton>`, so the whole schema (and `<Form confirm>`) applies.
 */
export function WizardNav(inProps: WizardNavProps) {
  const props = useDefaultProps({ props: inProps, name: 'EzWizardNav' })
  const {
    prevLabel = 'Back',
    nextLabel = 'Next',
    submitLabel,
    slotProps,
    direction = 'row',
    spacing = 1,
    className,
    ...rest
  } = props
  const { isFirst, isLast, pending, next, prev, layout } = useWizard('WizardNav')
  const { disabled: formDisabled } = useFormState()
  if (layout === 'page') return null
  const prevProps = { variant: 'text', ...slotProps?.prev } as const
  const nextProps = { variant: 'contained', ...slotProps?.next } as const
  return (
    <WizardNavRoot
      direction={direction}
      spacing={spacing}
      className={`${wizardNavClasses.root}${className ? ` ${className}` : ''}`}
      {...rest}
    >
      <WizardNavPrev
        type="button"
        onClick={prev}
        {...prevProps}
        className={`${wizardNavClasses.prev}${prevProps.className ? ` ${prevProps.className}` : ''}`}
        disabled={isFirst || mergeDisabled(prevProps.disabled, formDisabled)}
      >
        {prevLabel}
      </WizardNavPrev>
      {isLast ? (
        <WizardNavSubmit
          {...slotProps?.submit}
          className={`${wizardNavClasses.submit}${slotProps?.submit?.className ? ` ${slotProps.submit.className}` : ''}`}
        >
          {submitLabel ?? slotProps?.submit?.children}
        </WizardNavSubmit>
      ) : (
        <WizardNavNext
          type="button"
          onClick={() => void next()}
          loading={pending}
          {...nextProps}
          className={`${wizardNavClasses.next}${nextProps.className ? ` ${nextProps.className}` : ''}`}
          disabled={mergeDisabled(nextProps.disabled, formDisabled)}
        >
          {nextLabel}
        </WizardNavNext>
      )}
    </WizardNavRoot>
  )
}
