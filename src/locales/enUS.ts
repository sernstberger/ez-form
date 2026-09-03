import type { EzLocalization } from './types'

/**
 * English (US): every default string the library ships, restated as a MUI-style
 * locale object. Applying it changes nothing — it *is* the default — so it
 * serves two purposes: a reset (`createTheme(theme, enUS)` after another
 * locale) and the template for a locale of your own (copy the file, translate
 * the values; `src/locales/locales.test.tsx` pins every key here to the
 * component's own default so the two cannot drift).
 *
 * Interpolated strings are functions, the way MUI's own `labelDisplayedRows`
 * is, so a translation can put the label or the number wherever its grammar
 * wants it.
 */
export const enUS = {
  components: {
    EzForm: {
      defaultProps: {
        optionalText: '(optional)',
        requiredIndicatorText: (requiredIndicator) =>
          requiredIndicator === 'optional'
            ? 'All fields are required unless marked optional.'
            : 'Required fields are marked with an asterisk (*).',
        submitPendingText: 'Submitting…',
        submitSuccessText: 'Submitted.',
        submitErrorText: 'Submit failed.',
        confirmTitle: 'Submit?',
        messages: {
          fallbackLabel: 'This field',
          required: (label) => `${label} is required.`,
          min: (label, value) => `${label} must be at least ${value}.`,
          max: (label, value) => `${label} must be at most ${value}.`,
          minLength: (label, value) => `${label} must be at least ${value} characters.`,
          maxLength: (label, value) => `${label} must be at most ${value} characters.`,
          pattern: (label) => `${label} is invalid.`,
          validate: (label) => `${label} is invalid.`,
          exactLength: (label, length) => `${label} must be ${length} characters.`,
          invalidDate: (label) => `${label} is invalid.`,
          tooEarly: (label) => `${label} is too early.`,
          tooLate: (label) => `${label} is too late.`,
          mustBeFuture: (label) => `${label} must be in the future.`,
          mustBePast: (label) => `${label} must be in the past.`,
          unavailable: (label) => `${label} is not available.`,
        },
      },
    },
    EzFormErrorSummary: {
      defaultProps: { title: 'There is a problem' },
    },
    EzSubmitButton: {
      defaultProps: { children: 'Submit' },
    },
    EzClearButton: {
      defaultProps: { children: 'Clear', confirmTitle: 'Discard changes?' },
    },
    EzConfirmDialog: {
      defaultProps: { confirmLabel: 'Confirm', cancelLabel: 'Cancel' },
    },
    EzFormDialog: {
      defaultProps: {
        cancelLabel: 'Cancel',
        exitConfirm: {
          title: 'Discard changes?',
          confirmLabel: 'Discard',
          cancelLabel: 'Keep editing',
        },
      },
    },
    EzWizard: {
      defaultProps: {
        stepAnnouncement: ({ index, count, label }) => {
          const text = typeof label === 'string' || typeof label === 'number' ? String(label) : ''
          return `Step ${index + 1} of ${count}${text ? `, ${text}` : ''}`
        },
      },
    },
    EzWizardNav: {
      defaultProps: { prevLabel: 'Back', nextLabel: 'Next' },
    },
    EzFieldArray: {
      defaultProps: {
        addLabel: 'Add',
        removeLabel: 'Remove',
        rowText: 'Row',
        singularize: (label) => label.replace(/s$/, ''),
        removeRowLabel: (row) => `Remove ${row}`,
        moveUpLabel: (row) => `Move ${row} up`,
        moveDownLabel: (row) => `Move ${row} down`,
        addedMessage: (row) => `Row ${row} added`,
        removedMessage: (row) => `Row ${row} removed`,
        movedMessage: (row, direction) => `Row ${row} moved ${direction}`,
      },
    },
    EzAddressField: {
      defaultProps: {
        streetLabel: 'Street address',
        street2Label: 'Apartment, suite, etc.',
        cityLabel: 'City',
        stateLabel: 'State',
        zipLabel: 'ZIP code',
        lookupFilledText: 'Address filled',
      },
    },
    EzPasswordField: {
      defaultProps: { showLabel: 'Show password', hideLabel: 'Hide password' },
    },
    EzPasswordStrength: {
      defaultProps: {
        labels: ['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong'],
        slotProps: { bar: { 'aria-label': 'Password strength' } },
      },
    },
    EzSsnField: {
      defaultProps: {
        invalidMessage: 'Enter a 9-digit Social Security number',
        showLabel: 'Show Social Security number',
        hideLabel: 'Hide Social Security number',
      },
    },
    EzOtpField: {
      defaultProps: { characterLabel: (index, length) => `Character ${index} of ${length}` },
    },
    EzResendCodeButton: {
      defaultProps: {
        children: 'Resend code',
        sentText: 'Code sent',
        errorText: 'Code could not be sent',
      },
    },
    EzFileField: {
      defaultProps: {
        maxSizeMessage: 'File is larger than {size}',
        acceptMessage: 'File type not accepted',
        maxFilesMessage: 'Choose at most {count} files',
        dropText: 'Drag files here, or',
      },
    },
    EzEmailField: {
      defaultProps: { invalidMessage: 'Enter a valid email address' },
    },
    EzEmailListField: {
      defaultProps: {
        invalidMessage: 'Enter a valid email address',
        duplicateMessage: 'Already added',
        addedMessage: (email) => `${email} added`,
        addedManyMessage: (count) => `${count} addresses added`,
        removedMessage: (email) => `${email} removed`,
        removedManyMessage: (count) => `${count} addresses removed`,
      },
    },
    EzFeinField: {
      defaultProps: { invalidMessage: 'Enter a 9-digit employer identification number' },
    },
    EzPhoneField: {
      defaultProps: { invalidMessage: (digits) => `Enter a ${digits}-digit phone number` },
    },
    EzZipField: {
      defaultProps: { invalidMessage: 'Enter a 5-digit ZIP code' },
    },
    EzChipDeleteIcon: {
      defaultProps: { removeLabel: (label) => `Remove ${label}` },
    },
    EzReadOnlyField: {
      defaultProps: {
        yesText: 'Yes',
        noText: 'No',
        editLabel: 'Edit',
        editAriaLabel: (label) => `Edit ${label}`,
      },
    },
  },
} satisfies EzLocalization
