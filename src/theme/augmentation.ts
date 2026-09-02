import type { ComponentsOverrides, ComponentsProps } from '@mui/material/styles'
import type { ClearButtonProps } from '../ClearButton'
import type { SubmitButtonProps } from '../SubmitButton'
import type { ConfirmDialogProps } from '../ConfirmDialog'
import type { FormDialogProps } from '../FormDialog'
import type { WizardStepperProps } from '../Wizard/WizardStepper'
import type { WizardNavProps } from '../Wizard/WizardNav'
import type { WizardProps } from '../Wizard/Wizard'
import type { ReadOnlyFieldProps } from '../fields/ReadOnlyField'
import type { NumberFieldControlProps } from '../fields/NumberField/NumberFieldControl'
import type { FormProps } from '../Form'
import type { FormErrorProps } from '../FormError'
import type { LiveRegionProps } from '../Form/LiveRegion'
import type { FormErrorSummaryProps } from '../Form/FormErrorSummary'
import type { FormSectionProps } from '../FormSection'
import type { FieldArrayProps } from '../FieldArray'
import type { AddressFieldProps } from '../fields/AddressField'
import type { PasswordFieldProps } from '../fields/PasswordField'
import type { PasswordStrengthProps } from '../fields/PasswordStrength'
import type { OtpFieldControlProps } from '../fields/OtpField/OtpFieldControl'
import type { FileFieldProps } from '../fields/FileField'
import type { TextareaFieldProps } from '../fields/TextareaField/TextareaField'
import type { ResendCodeButtonProps } from '../fields/OtpField/ResendCodeButton'
import type { PhoneFieldProps } from '../fields/PhoneField'
import type { EmailListFieldProps } from '../fields/EmailListField'
import type { EmailFieldProps } from '../fields/EmailField'
import type { FeinFieldProps } from '../fields/FeinField'
import type { PercentFieldProps } from '../fields/PercentField'
import type { SsnFieldProps } from '../fields/SsnField'
import type { ZipFieldProps } from '../fields/ZipField'
import type { StateSelectProps } from '../fields/StateSelect'

declare module '@mui/material/styles' {
  interface ComponentsPropsList {
    EzClearButton: Partial<ClearButtonProps>
    EzSubmitButton: Partial<SubmitButtonProps>
    EzConfirmDialog: Partial<ConfirmDialogProps>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    EzFormDialog: Partial<FormDialogProps<any, any>>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    EzWizard: Partial<WizardProps<any>>
    EzWizardStepper: Partial<WizardStepperProps>
    EzWizardNav: Partial<WizardNavProps>
    EzReadOnlyField: Partial<ReadOnlyFieldProps>
    EzNumberField: Partial<NumberFieldControlProps>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    EzForm: Partial<FormProps<any, any>>
    EzFormError: Partial<FormErrorProps>
    EzLiveRegion: Partial<LiveRegionProps>
    EzFormErrorSummary: Partial<FormErrorSummaryProps>
    EzFormSection: Partial<FormSectionProps>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    EzFieldArray: Partial<FieldArrayProps<any>>
    EzAddressField: Partial<AddressFieldProps>
    EzPasswordField: Partial<PasswordFieldProps>
    EzPasswordStrength: Partial<PasswordStrengthProps>
    EzOtpField: Partial<OtpFieldControlProps>
    EzFileField: Partial<FileFieldProps>
    EzTextareaField: Partial<TextareaFieldProps>
    EzResendCodeButton: Partial<ResendCodeButtonProps>
    EzPhoneField: Partial<PhoneFieldProps>
    EzEmailListField: Partial<EmailListFieldProps>
    EzEmailField: Partial<EmailFieldProps>
    EzFeinField: Partial<FeinFieldProps>
    EzPercentField: Partial<PercentFieldProps>
    EzSsnField: Partial<SsnFieldProps>
    EzZipField: Partial<ZipFieldProps>
    EzStateSelect: Partial<StateSelectProps>
  }

  interface ComponentNameToClassKey {
    EzClearButton: 'root'
    EzSubmitButton: 'root'
    EzConfirmDialog: 'root' | 'confirm' | 'cancel'
    EzFormDialog: 'root' | 'form' | 'title' | 'content' | 'actions' | 'cancel' | 'submit'
    EzWizard: 'status'
    EzWizardStepper: 'root' | 'stepButton' | 'verticalStepButton'
    EzWizardNav: 'root' | 'prev' | 'next' | 'submit'
    EzReadOnlyField: 'root' | 'header' | 'label' | 'value' | 'edit'
    EzNumberField: 'root' | 'steppers' | 'increment' | 'decrement'
    EzForm: 'root' | 'title' | 'description' | 'status'
    EzFormError: 'root'
    EzLiveRegion: 'root'
    EzFormErrorSummary: 'root' | 'heading' | 'list' | 'item' | 'link'
    EzFormSection: 'root' | 'legend' | 'description' | 'content'
    EzFieldArray: 'root' | 'row' | 'actions' | 'add' | 'remove' | 'move' | 'status' | 'error'
    EzAddressField: 'root' | 'street' | 'street2' | 'city' | 'state' | 'zip'
    EzPasswordField: 'root' | 'toggle'
    EzSsnField: 'root' | 'toggle'
    EzPasswordStrength: 'root' | 'bar' | 'label'
    EzOtpField: 'root' | 'helperText'
    EzFileField: 'root' | 'fileList' | 'deleteIcon' | 'dropZone' | 'dragActive' | 'dropText'
    EzTextareaField: 'root' | 'counter'
    EzResendCodeButton: 'root' | 'status'
    EzEmailListField: 'chip' | 'deleteIcon' | 'status'
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
    EzFormDialog?: {
      defaultProps?: ComponentsProps['EzFormDialog']
      styleOverrides?: ComponentsOverrides<Theme>['EzFormDialog']
    }
    EzWizard?: {
      defaultProps?: ComponentsProps['EzWizard']
      styleOverrides?: ComponentsOverrides<Theme>['EzWizard']
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
    EzLiveRegion?: {
      defaultProps?: ComponentsProps['EzLiveRegion']
      styleOverrides?: ComponentsOverrides<Theme>['EzLiveRegion']
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
    EzAddressField?: {
      defaultProps?: ComponentsProps['EzAddressField']
      styleOverrides?: ComponentsOverrides<Theme>['EzAddressField']
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
    EzEmailListField?: {
      defaultProps?: ComponentsProps['EzEmailListField']
      styleOverrides?: ComponentsOverrides<Theme>['EzEmailListField']
    }
    // Also a plain `TextField` with no styled slot of its own, so it registers
    // `defaultProps` only — that is what makes `invalidMessage` / `normalize` /
    // `autoComplete` theme-settable.
    EzEmailField?: {
      defaultProps?: ComponentsProps['EzEmailField']
    }
    // Also a plain `TextField` with no styled slot of its own: `defaultProps`
    // only, which is what makes `format` / `invalidMessage` / `autoComplete`
    // theme-settable.
    EzFeinField?: {
      defaultProps?: ComponentsProps['EzFeinField']
    }
    // Renders a `NumberField`, whose own `EzNumberField` style keys reach it,
    // so this registers `defaultProps` only — that is what makes `scale` and
    // the bound/step defaults theme-settable.
    EzPercentField?: {
      defaultProps?: ComponentsProps['EzPercentField']
    }
    EzSsnField?: {
      defaultProps?: ComponentsProps['EzSsnField']
      styleOverrides?: ComponentsOverrides<Theme>['EzSsnField']
    }
    // A plain `TextField` with no styled slot of its own, so it registers
    // `defaultProps` only — that is what makes `invalidMessage` and
    // `autoComplete` theme-settable (a translated ZIP message, say).
    EzZipField?: {
      defaultProps?: ComponentsProps['EzZipField']
    }
    // A plain `Select` with no styled slot of its own: `defaultProps` only,
    // which is what makes `territories` and `autoComplete` theme-settable.
    EzStateSelect?: {
      defaultProps?: ComponentsProps['EzStateSelect']
    }
  }
}
