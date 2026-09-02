import type { ComponentsOverrides, ComponentsProps } from '@mui/material/styles'
import type { ClearButtonProps } from '../ClearButton'
import type { SubmitButtonProps } from '../SubmitButton'
import type { ConfirmDialogProps } from '../ConfirmDialog'
import type { WizardStepperProps } from '../Wizard/WizardStepper'
import type { WizardNavProps } from '../Wizard/WizardNav'
import type { ReadOnlyFieldProps } from '../fields/ReadOnlyField'
import type { NumberFieldControlProps } from '../fields/NumberField/NumberFieldControl'
import type { FormProps } from '../Form'
import type { FormErrorProps } from '../FormError'

declare module '@mui/material/styles' {
  interface ComponentsPropsList {
    EzClearButton: Partial<ClearButtonProps>
    EzSubmitButton: Partial<SubmitButtonProps>
    EzConfirmDialog: Partial<ConfirmDialogProps>
    EzWizardStepper: Partial<WizardStepperProps>
    EzWizardNav: Partial<WizardNavProps>
    EzReadOnlyField: Partial<ReadOnlyFieldProps>
    EzNumberField: Partial<NumberFieldControlProps>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    EzForm: Partial<FormProps<any, any>>
    EzFormError: Partial<FormErrorProps>
  }

  interface ComponentNameToClassKey {
    EzClearButton: 'root'
    EzSubmitButton: 'root'
    EzConfirmDialog: 'root' | 'confirm' | 'cancel'
    EzWizardStepper: 'root' | 'stepButton' | 'verticalStepButton'
    EzWizardNav: 'root' | 'prev' | 'next' | 'submit'
    EzReadOnlyField: 'root' | 'header' | 'label' | 'value' | 'edit'
    EzNumberField: 'root' | 'steppers' | 'increment' | 'decrement'
    EzForm: 'root' | 'title' | 'description'
    EzFormError: 'root'
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
    EzWizardStepper?: {
      defaultProps?: ComponentsProps['EzWizardStepper']
      styleOverrides?: ComponentsOverrides<Theme>['EzWizardStepper']
    }
    EzWizardNav?: {
      defaultProps?: ComponentsProps['EzWizardNav']
      styleOverrides?: ComponentsOverrides<Theme>['EzWizardNav']
    }
    EzReadOnlyField?: {
      defaultProps?: ComponentsProps['EzReadOnlyField']
      styleOverrides?: ComponentsOverrides<Theme>['EzReadOnlyField']
    }
    EzNumberField?: {
      defaultProps?: ComponentsProps['EzNumberField']
      styleOverrides?: ComponentsOverrides<Theme>['EzNumberField']
    }
    EzForm?: {
      defaultProps?: ComponentsProps['EzForm']
      styleOverrides?: ComponentsOverrides<Theme>['EzForm']
    }
    EzFormError?: {
      defaultProps?: ComponentsProps['EzFormError']
      styleOverrides?: ComponentsOverrides<Theme>['EzFormError']
    }
  }
}
