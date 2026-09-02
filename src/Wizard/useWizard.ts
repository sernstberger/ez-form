import { useContext } from 'react'
import { WizardContext, type WizardContextValue } from './WizardContext'

/** The wizard's state and navigation. Throws outside `<Wizard>`, naming the caller. */
export function useWizard(componentName = 'useWizard'): WizardContextValue {
  const ctx = useContext(WizardContext)
  if (!ctx) throw new Error(`ez-form: <${componentName}> must be rendered inside <Wizard>`)
  return ctx
}

/** For components that adapt to a wizard when there is one (ReadOnlyField's Edit link). */
export function useOptionalWizard(): WizardContextValue | null {
  return useContext(WizardContext)
}
