import type { ComponentsOverrides, ComponentsProps } from '@mui/material/styles'
import type { ClearButtonProps } from '../ClearButton'
import type { SubmitButtonProps } from '../SubmitButton'
import type { ConfirmDialogProps } from '../ConfirmDialog'
import type { WizardStepperProps } from '../Wizard/WizardStepper'
import type { WizardNavProps } from '../Wizard/WizardNav'
import type { WizardProps } from '../Wizard/Wizard'
import type { ReadOnlyFieldProps } from '../fields/ReadOnlyField'
import type { NumberFieldControlProps } from '../fields/NumberField/NumberFieldControl'
import type { FormProps } from '../Form'
import type { FormErrorProps } from '../FormError'
import type { FormErrorSummaryProps } from '../Form/FormErrorSummary'
import type { FormSectionProps } from '../FormSection'
import type { FieldArrayProps } from '../FieldArray'
import type { PasswordFieldProps } from '../fields/PasswordField'
import type { PasswordStrengthProps } from '../fields/PasswordStrength'
import type { OtpFieldControlProps } from '../fields/OtpField/OtpFieldControl'
import type { FileFieldProps } from '../fields/FileField'
import type { TextareaFieldProps } from '../fields/TextareaField/TextareaField'
import type { ResendCodeButtonProps } from '../fields/OtpField/ResendCodeButton'
import type { PhoneFieldProps } from '../fields/PhoneField'

declare module '@mui/material/styles' {
  interface ComponentsPropsList {
    EzClearButton: Partial<ClearButtonProps>
    EzSubmitButton: Partial<SubmitButtonProps>
    EzConfirmDialog: Partial<ConfirmDialogProps>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    EzWizard: Partial<WizardProps<any>>
    EzWizardStepper: Partial<WizardStepperProps>
    EzWizardNav: Partial<WizardNavProps>
    EzReadOnlyField: Partial<ReadOnlyFieldProps>
    EzNumberField: Partial<NumberFieldControlProps>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    EzForm: Partial<FormProps<any, any>>
    EzFormError: Partial<FormErrorProps>
    EzFormErrorSummary: Partial<FormErrorSummaryProps>
    EzFormSection: Partial<FormSectionProps>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    EzFieldArray: Partial<FieldArrayProps<any>>
    EzPasswordField: Partial<PasswordFieldProps>
    EzPasswordStrength: Partial<PasswordStrengthProps>
    EzOtpField: Partial<OtpFieldControlProps>
    EzFileField: Partial<FileFieldProps>
    EzTextareaField: Partial<TextareaFieldProps>
    EzResendCodeButton: Partial<ResendCodeButtonProps>
    EzPhoneField: Partial<PhoneFieldProps>
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
    EzFormErrorSummary: 'root' | 'heading' | 'list' | 'item' | 'link'
    EzFormSection: 'root' | 'legend' | 'description' | 'content'
    EzFieldArray: 'root' | 'row' | 'actions' | 'add' | 'remove' | 'move' | 'status' | 'error'
    EzPasswordField: 'root' | 'toggle'
    EzPasswordStrength: 'root' | 'bar' | 'label'
    EzOtpField: 'root' | 'helperText'
    EzFileField: 'root' | 'fileList' | 'deleteIcon'
    EzTextareaField: 'root' | 'counter'
    EzResendCodeButton: 'root' | 'status'
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
    EzWizard?: {
      defaultProps?: ComponentsProps['EzWizard']
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
    EzFormErrorSummary?: {
      defaultProps?: ComponentsProps['EzFormErrorSummary']
      styleOverrides?: ComponentsOverrides<Theme>['EzFormErrorSummary']
    }
    EzFormSection?: {
      defaultProps?: ComponentsProps['EzFormSection']
      styleOverrides?: ComponentsOverrides<Theme>['EzFormSection']
    }
    EzFieldArray?: {
      defaultProps?: ComponentsProps['EzFieldArray']
      styleOverrides?: ComponentsOverrides<Theme>['EzFieldArray']
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
    }
    EzTextareaField?: {
      defaultProps?: ComponentsProps['EzTextareaField']
      styleOverrides?: ComponentsOverrides<Theme>['EzTextareaField']
    }
    EzResendCodeButton?: {
      defaultProps?: ComponentsProps['EzResendCodeButton']
      styleOverrides?: ComponentsOverrides<Theme>['EzResendCodeButton']
    }
    // Renders a `TextField` and adds no styled slot of its own, so it keeps
    // MUI's own `Mui*` style keys and registers `defaultProps` only — that is
    // what makes `format` / `invalidMessage` / `autoComplete` theme-settable.
    EzPhoneField?: {
      defaultProps?: ComponentsProps['EzPhoneField']
    }
  }
}
