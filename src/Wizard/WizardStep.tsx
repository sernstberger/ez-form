import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import { useWizard } from './useWizard'

export interface WizardStepProps {
  id: string
  children: ReactNode
}

/**
 * One step's content. Renders only while its step is current: in place for a
 * horizontal wizard, inside the stepper's `StepContent` (a portal, so form
 * context still reaches the fields) for a vertical one.
 */
export function WizardStep({ id, children }: WizardStepProps) {
  const { current, orientation, contentEl } = useWizard('WizardStep')
  if (current.id !== id) return null
  if (orientation === 'vertical') return contentEl ? createPortal(children, contentEl) : null
  return <>{children}</>
}
