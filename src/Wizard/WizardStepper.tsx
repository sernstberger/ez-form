import ButtonBase from '@mui/material/ButtonBase'
import Step from '@mui/material/Step'
import StepButton from '@mui/material/StepButton'
import StepContent from '@mui/material/StepContent'
import StepLabel from '@mui/material/StepLabel'
import Stepper, { type StepperProps } from '@mui/material/Stepper'
import type { ReactNode } from 'react'
import type { WizardStepDef, WizardStepStatus } from './WizardContext'
import { useWizard } from './useWizard'

export type WizardStepperProps = Omit<
  StepperProps,
  'activeStep' | 'orientation' | 'nonLinear' | 'children'
>

/** The label content shared by both the horizontal `StepButton` and the
 * vertical plain-list button: a visited step with an error is marked. */
function stepLabel(step: WizardStepDef, status: WizardStepStatus) {
  return (
    <StepLabel optional={step.optional} error={status === 'visited'}>
      {step.label}
    </StepLabel>
  )
}

/**
 * MUI Stepper driven by the wizard: visited steps are buttons, upcoming
 * steps are plain labels, a visited step with an error is marked. Vertical:
 * the current step's `StepContent` hosts that `WizardStep`'s children.
 *
 * Horizontal steps use `StepButton`: MUI 9 renders that as a WAI-ARIA tabs
 * widget (`role="tablist"`/`"tab"`), which is correct there because step
 * content lives outside the `<ol>`. Vertical steps must NOT use `StepButton`
 * — MUI detects it anywhere in the tree and flips the whole `Stepper` to
 * `role="tablist"`, but a tablist may only contain `tab` elements, and
 * `StepContent` (which hosts real form fields) can't be one. So the vertical
 * list stays a plain list: visited steps render `ButtonBase` wrapping
 * `StepLabel`, i.e. what `StepButton` is internally minus the tab role.
 */
export function WizardStepper(props: WizardStepperProps) {
  const { steps, index, orientation, stepStatus, go, setContentEl } = useWizard('WizardStepper')
  return (
    <Stepper {...props} nonLinear activeStep={index} orientation={orientation}>
      {steps.map((step) => {
        const status = stepStatus(step.id)
        const clickable = status !== 'upcoming'
        let button: ReactNode
        if (!clickable) {
          button = <StepLabel optional={step.optional}>{step.label}</StepLabel>
        } else if (orientation === 'vertical') {
          button = (
            <ButtonBase
              focusRipple
              onClick={() => void go(step.id)}
              sx={{ width: '100%', justifyContent: 'flex-start', padding: '8px', margin: '-8px' }}
            >
              {stepLabel(step, status)}
            </ButtonBase>
          )
        } else {
          button = (
            <StepButton color="inherit" onClick={() => void go(step.id)}>
              {stepLabel(step, status)}
            </StepButton>
          )
        }
        return (
          <Step key={step.id} completed={status === 'completed'} disabled={status === 'upcoming'}>
            {button}
            {orientation === 'vertical' && (
              <StepContent>{status === 'current' && <div ref={setContentEl} />}</StepContent>
            )}
          </Step>
        )
      })}
    </Stepper>
  )
}
