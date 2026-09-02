import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import { FormSection, type FormSectionProps } from '../FormSection'
import { stepLabelId } from './WizardContext'
import { useWizard } from './useWizard'

export interface WizardStepProps {
  id: string
  /** Legend of the step's section. Defaults to the step's `label`; `null` renders no legend. */
  title?: ReactNode | null
  description?: ReactNode
  slotProps?: FormSectionProps['slotProps']
  children: ReactNode
}

/**
 * One step's content, always a `FormSection` (a step is a group). Horizontal:
 * the legend is the step label (a heading). Vertical: the label is already
 * visible in the stepper, so the section is named by it via `aria-labelledby`
 * and renders no legend.
 */
export function WizardStep({ id, title, description, slotProps, children }: WizardStepProps) {
  const { current, orientation, contentEl, id: wizardId } = useWizard('WizardStep')
  if (current.id !== id) return null
  if (orientation === 'vertical') {
    if (!contentEl) return null
    return createPortal(
      <FormSection
        aria-labelledby={stepLabelId(wizardId, id)}
        description={description}
        slotProps={slotProps}
      >
        {children}
      </FormSection>,
      contentEl,
    )
  }
  return (
    <FormSection
      title={title === undefined ? current.label : title}
      description={description}
      slotProps={slotProps}
    >
      {children}
    </FormSection>
  )
}
