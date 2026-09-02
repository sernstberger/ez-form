import ButtonBase from '@mui/material/ButtonBase'
import { useDefaultProps } from '@mui/material/DefaultPropsProvider'
import generateUtilityClasses from '@mui/material/generateUtilityClasses'
import Step from '@mui/material/Step'
import StepButton from '@mui/material/StepButton'
import StepContent from '@mui/material/StepContent'
import StepLabel from '@mui/material/StepLabel'
import Stepper, { type StepperProps } from '@mui/material/Stepper'
import { styled } from '@mui/material/styles'
import type { ReactNode } from 'react'
import type { WizardStepDef, WizardStepStatus } from './WizardContext'
import { useWizard } from './useWizard'

export type WizardStepperProps = Omit<
  StepperProps,
  'activeStep' | 'orientation' | 'nonLinear' | 'children'
>

export const wizardStepperClasses = generateUtilityClasses('EzWizardStepper', [
  'root',
  'verticalStepButton',
])

/** Vertical clickable step: `ButtonBase` wrapping `StepLabel` (see the
 * class-level comment for why this can't be `StepButton`). The default style
 * block is `StepButton`'s own vertical layout — the minimum needed for the
 * step to be usable — and is fully overridable via
 * `theme.components.EzWizardStepper.styleOverrides.verticalStepButton`. */
const VerticalStepButton = styled(ButtonBase, {
  name: 'EzWizardStepper',
  slot: 'VerticalStepButton',
})({
  width: '100%',
  justifyContent: 'flex-start',
  padding: 8,
  margin: -8,
  boxSizing: 'content-box',
})

/** The label content shared by upcoming steps and both clickable-step
 * renderers (horizontal `StepButton`, vertical `ButtonBase`): `optional`
 * always comes from here, and a visited step with an error is marked.
 * `StepButton` clones `{ icon, optional }` onto this element, so callers
 * that render it as `StepButton`'s child must still pass `optional` to
 * `StepButton` itself too — see the comment at that call site. */
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
export function WizardStepper(inProps: WizardStepperProps) {
  const props = useDefaultProps({ props: inProps, name: 'EzWizardStepper' })
  const { steps, index, orientation, stepStatus, go, setContentEl } = useWizard('WizardStepper')
  return (
    <Stepper
      {...props}
      className={`${wizardStepperClasses.root}${props.className ? ` ${props.className}` : ''}`}
      nonLinear
      activeStep={index}
      orientation={orientation}
    >
      {steps.map((step) => {
        const status = stepStatus(step.id)
        const clickable = status !== 'upcoming'
        let button: ReactNode
        if (!clickable) {
          button = stepLabel(step, status)
        } else if (orientation === 'vertical') {
          button = (
            <VerticalStepButton
              className={wizardStepperClasses.verticalStepButton}
              onClick={() => void go(step.id)}
            >
              {stepLabel(step, status)}
            </VerticalStepButton>
          )
        } else {
          button = (
            // `StepButton` clones `{ icon, optional }` onto its `StepLabel`
            // child (`cloneElement`, which overwrites): without `optional`
            // here too, that clone stamps `optional: undefined` over the
            // value `stepLabel()` already set, silently dropping it.
            <StepButton color="inherit" optional={step.optional} onClick={() => void go(step.id)}>
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
