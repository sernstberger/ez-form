import type { EzLocalization } from './types'

/**
 * Spanish (Spain). The register is the one MUI's own `esES` uses: formal,
 * addressed with the neutral imperative (`Introduzca`, `Elija`) so it reads as
 * "usted" without ever naming the person. Same shape and the same keys as
 * `enUS` — `locales.test.tsx` checks both at the type level and at runtime.
 */
export const esES = {
  components: {
    EzForm: {
      defaultProps: {
        optionalText: '(opcional)',
        requiredIndicatorText: (requiredIndicator) =>
          requiredIndicator === 'optional'
            ? 'Todos los campos son obligatorios salvo los marcados como opcionales.'
            : 'Los campos obligatorios están marcados con un asterisco (*).',
        submitPendingText: 'Enviando…',
        submitSuccessText: 'Enviado.',
        submitErrorText: 'No se pudo enviar.',
        confirmTitle: '¿Enviar?',
        messages: {
          fallbackLabel: 'Este campo',
          required: (label) => `${label} es obligatorio.`,
          min: (label, value) => `${label} debe ser como mínimo ${value}.`,
          max: (label, value) => `${label} debe ser como máximo ${value}.`,
          minLength: (label, value) => `${label} debe tener al menos ${value} caracteres.`,
          maxLength: (label, value) => `${label} debe tener como máximo ${value} caracteres.`,
          pattern: (label) => `${label} no es válido.`,
          validate: (label) => `${label} no es válido.`,
          exactLength: (label, length) => `${label} debe tener ${length} caracteres.`,
          invalidDate: (label) => `${label} no es válido.`,
          tooEarly: (label) => `${label} es demasiado temprano.`,
          tooLate: (label) => `${label} es demasiado tarde.`,
          mustBeFuture: (label) => `${label} debe estar en el futuro.`,
          mustBePast: (label) => `${label} debe estar en el pasado.`,
          unavailable: (label) => `${label} no está disponible.`,
        },
      },
    },
    EzFormErrorSummary: {
      defaultProps: { title: 'Hay un problema' },
    },
    EzSubmitButton: {
      defaultProps: { children: 'Enviar' },
    },
    EzClearButton: {
      defaultProps: { children: 'Limpiar', confirmTitle: '¿Descartar los cambios?' },
    },
    EzConfirmDialog: {
      defaultProps: { confirmLabel: 'Confirmar', cancelLabel: 'Cancelar' },
    },
    EzFormDialog: {
      defaultProps: {
        cancelLabel: 'Cancelar',
        exitConfirm: {
          title: '¿Descartar los cambios?',
          confirmLabel: 'Descartar',
          cancelLabel: 'Seguir editando',
        },
      },
    },
    EzWizard: {
      defaultProps: {
        stepAnnouncement: ({ index, count, label }) => {
          const text = typeof label === 'string' || typeof label === 'number' ? String(label) : ''
          return `Paso ${index + 1} de ${count}${text ? `, ${text}` : ''}`
        },
      },
    },
    EzWizardNav: {
      defaultProps: { prevLabel: 'Atrás', nextLabel: 'Siguiente' },
    },
    EzFieldArray: {
      defaultProps: {
        addLabel: 'Añadir',
        removeLabel: 'Eliminar',
        rowText: 'Fila',
        // Spanish plurals end in -es or -s; as naive as the English strip, and
        // `singular` is still the fix when the guess is wrong.
        singularize: (label) => label.replace(/(es|s)$/, ''),
        removeRowLabel: (row) => `Eliminar ${row}`,
        moveUpLabel: (row) => `Subir ${row}`,
        moveDownLabel: (row) => `Bajar ${row}`,
        addedMessage: (row) => `Fila ${row} añadida`,
        removedMessage: (row) => `Fila ${row} eliminada`,
        movedMessage: (row, direction) =>
          `Fila ${row} movida ${direction === 'up' ? 'hacia arriba' : 'hacia abajo'}`,
      },
    },
    EzAddressField: {
      defaultProps: {
        streetLabel: 'Dirección',
        street2Label: 'Piso, puerta, etc.',
        cityLabel: 'Ciudad',
        stateLabel: 'Estado',
        zipLabel: 'Código postal',
      },
    },
    EzPasswordField: {
      defaultProps: { showLabel: 'Mostrar la contraseña', hideLabel: 'Ocultar la contraseña' },
    },
    EzPasswordStrength: {
      defaultProps: {
        labels: ['Muy débil', 'Débil', 'Aceptable', 'Segura', 'Muy segura'],
        slotProps: { bar: { 'aria-label': 'Seguridad de la contraseña' } },
      },
    },
    EzSsnField: {
      defaultProps: {
        invalidMessage: 'Introduzca un número de la Seguridad Social de 9 dígitos',
        showLabel: 'Mostrar el número de la Seguridad Social',
        hideLabel: 'Ocultar el número de la Seguridad Social',
      },
    },
    EzOtpField: {
      defaultProps: { characterLabel: (index, length) => `Carácter ${index} de ${length}` },
    },
    EzResendCodeButton: {
      defaultProps: {
        children: 'Reenviar el código',
        sentText: 'Código enviado',
        errorText: 'No se pudo enviar el código',
      },
    },
    EzFileField: {
      defaultProps: {
        maxSizeMessage: 'El archivo supera los {size}',
        acceptMessage: 'Tipo de archivo no admitido',
        maxFilesMessage: 'Elija como máximo {count} archivos',
        dropText: 'Arrastre los archivos aquí o',
      },
    },
    EzEmailField: {
      defaultProps: { invalidMessage: 'Introduzca una dirección de correo electrónico válida' },
    },
    EzEmailListField: {
      defaultProps: {
        invalidMessage: 'Introduzca una dirección de correo electrónico válida',
        duplicateMessage: 'Ya se ha añadido',
        addedMessage: (email) => `${email} añadido`,
        addedManyMessage: (count) => `${count} direcciones añadidas`,
        removedMessage: (email) => `${email} eliminado`,
        removedManyMessage: (count) => `${count} direcciones eliminadas`,
      },
    },
    EzFeinField: {
      defaultProps: {
        invalidMessage: 'Introduzca un número de identificación de empleador de 9 dígitos',
      },
    },
    EzPhoneField: {
      defaultProps: {
        invalidMessage: (digits) => `Introduzca un número de teléfono de ${digits} dígitos`,
      },
    },
    EzZipField: {
      defaultProps: { invalidMessage: 'Introduzca un código postal de 5 dígitos' },
    },
    EzChipDeleteIcon: {
      defaultProps: { removeLabel: (label) => `Eliminar ${label}` },
    },
    EzReadOnlyField: {
      defaultProps: {
        yesText: 'Sí',
        noText: 'No',
        editLabel: 'Editar',
        editAriaLabel: (label) => `Editar ${label}`,
      },
    },
  },
} satisfies EzLocalization
