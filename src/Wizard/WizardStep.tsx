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
 * and renders no legend. `page` layout: every *visible* step renders
 * unconditionally, in document order (by convention, the order `WizardStep`s
 * appear as children — the same order given to `steps`), each as its own
 * named section — the same markup as a horizontal step. A step hidden by
 * `when` renders nothing here too (silently — it's expected, not a mistake);
 * an `id` matching no step at all in `allSteps` also renders nothing but
 * warns in dev, so a stale/misspelled id is still noticed.
 */
export function WizardStep({ id, title, description, slotProps, children }: WizardStepProps) {
  const {
    steps,
    allSteps,
    current,
    orientation,
    layout,
    contentEl,
    id: wizardId,
  } = useWizard('WizardStep')
  if (layout === 'page') {
    const step = steps.find((s) => s.id === id)
    if (!step) {
      if (import.meta.env.DEV && !allSteps.some((s) => s.id === id)) {
        console.warn(`ez-form: <WizardStep id="${id}"> does not match any step in \`steps\`.`)
      }
      return null
    }
    return (
      <FormSection
        title={title === undefined ? step.label : title}
        description={description}
        slotProps={slotProps}
      >
        {children}
      </FormSection>
    )
  }
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
