import type { ComponentsOverrides, ComponentsProps } from '@mui/material/styles'
import type { ClearButtonProps } from '../ClearButton'
import type { SubmitButtonProps } from '../SubmitButton'
import type { ConfirmDialogProps } from '../ConfirmDialog'

// Task 10 (WizardStepper, WizardNav) and Task 8 (ReadOnlyField) live in other
// worktrees and add their own props-type imports + entries below when they land.
// import type { WizardStepperProps } from '../Wizard/WizardStepper'
// import type { WizardNavProps } from '../Wizard/WizardNav'
// import type { ReadOnlyFieldProps } from '../fields/ReadOnlyField'

declare module '@mui/material/styles' {
  interface ComponentsPropsList {
    EzClearButton: Partial<ClearButtonProps>
    EzSubmitButton: Partial<SubmitButtonProps>
    EzConfirmDialog: Partial<ConfirmDialogProps>
    // EzWizardStepper: Partial<WizardStepperProps>
    // EzWizardNav: Partial<WizardNavProps>
    // EzReadOnlyField: Partial<ReadOnlyFieldProps>
  }

  interface ComponentNameToClassKey {
    EzClearButton: 'root'
    EzSubmitButton: 'root'
    EzConfirmDialog: 'root' | 'confirm' | 'cancel'
    // EzWizardStepper: 'root' | 'verticalStepButton'
    // EzWizardNav: 'root' | 'prev' | 'next' | 'submit'
    // EzReadOnlyField: 'root' | 'label' | 'value' | 'edit'
  }

  interface Components<Theme = unknown> {
    EzClearButton?: {
      defaultProps?: ComponentsProps['EzClearButton']
      styleOverrides?: ComponentsOverrides<Theme>['EzClearButton']
    }
    EzSubmitButton?: {
      defaultProps?: ComponentsProps['EzSubmitButton']
      styleOverrides?: ComponentsOverrides<Theme>['EzSubmitButton']
    }
    EzConfirmDialog?: {
      defaultProps?: ComponentsProps['EzConfirmDialog']
      styleOverrides?: ComponentsOverrides<Theme>['EzConfirmDialog']
    }
    // EzWizardStepper?: {
    //   defaultProps?: ComponentsProps['EzWizardStepper']
    //   styleOverrides?: ComponentsOverrides<Theme>['EzWizardStepper']
    // }
    // EzWizardNav?: {
    //   defaultProps?: ComponentsProps['EzWizardNav']
    //   styleOverrides?: ComponentsOverrides<Theme>['EzWizardNav']
    // }
    // EzReadOnlyField?: {
    //   defaultProps?: ComponentsProps['EzReadOnlyField']
    //   styleOverrides?: ComponentsOverrides<Theme>['EzReadOnlyField']
    // }
  }
}
