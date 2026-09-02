import type { ComponentsOverrides, ComponentsProps } from '@mui/material/styles'
import type { ClearButtonProps } from '../ClearButton'
import type { SubmitButtonProps } from '../SubmitButton'
import type { ConfirmDialogProps } from '../ConfirmDialog'
import type { WizardStepperProps } from '../Wizard/WizardStepper'
import type { WizardNavProps } from '../Wizard/WizardNav'
import type { ReadOnlyFieldProps } from '../fields/ReadOnlyField'
import type { NumberFieldControlProps } from '../fields/NumberField/NumberFieldControl'
import type { FormProps } from '../Form'
import type { FormSectionProps } from '../FormSection'
import type { PasswordFieldProps } from '../fields/PasswordField'
import type { PasswordStrengthProps } from '../fields/PasswordStrength'
import type { OtpFieldControlProps } from '../fields/OtpField/OtpFieldControl'
import type { FileFieldProps } from '../fields/FileField'
import type { TextareaFieldProps } from '../fields/TextareaField/TextareaField'

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
    EzFormSection: Partial<FormSectionProps>
    EzPasswordField: Partial<PasswordFieldProps>
    EzPasswordStrength: Partial<PasswordStrengthProps>
    EzOtpField: Partial<OtpFieldControlProps>
    EzFileField: Partial<FileFieldProps>
    EzTextareaField: Partial<TextareaFieldProps>
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
    EzFormSection: 'root' | 'legend' | 'description' | 'content'
    EzPasswordField: 'root' | 'toggle'
    EzPasswordStrength: 'root' | 'bar' | 'label'
    EzOtpField: 'root' | 'helperText'
    EzFileField: 'root' | 'fileList'
    EzTextareaField: 'root' | 'counter'
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
    EzFormSection?: {
      defaultProps?: ComponentsProps['EzFormSection']
      styleOverrides?: ComponentsOverrides<Theme>['EzFormSection']
    }
    EzPasswordField?: {
      defaultProps?: ComponentsProps['EzPasswordField']
      styleOverrides?: ComponentsOverrides<Theme>['EzPasswordField']
    }
    EzPasswordStrength?: {
      defaultProps?: ComponentsProps['EzPasswordStrength']
      styleOverrides?: ComponentsOverrides<Theme>['EzPasswordStrength']
    }
    EzOtpField?: {
      defaultProps?: ComponentsProps['EzOtpField']
      styleOverrides?: ComponentsOverrides<Theme>['EzOtpField']
    }
    EzFileField?: {
      defaultProps?: ComponentsProps['EzFileField']
      styleOverrides?: ComponentsOverrides<Theme>['EzFileField']
    EzTextareaField?: {
      defaultProps?: ComponentsProps['EzTextareaField']
      styleOverrides?: ComponentsOverrides<Theme>['EzTextareaField']
    }
  }
}
