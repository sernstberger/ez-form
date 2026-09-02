import type { Message } from 'react-hook-form'
import type { ReactNode } from 'react'
import { mergeSlotProps } from '@mui/material/utils'
import { TextField, type TextFieldProps } from '../TextField'
import { resolveAutoComplete } from '../resolveAutoComplete'
import { useAssisted } from '../../Form/AssistedContext'
import { useEzFormContext } from '../../useEzFormContext'

export type ZipFieldProps = Omit<
  TextFieldProps,
  'type' | 'inputMode' | 'autoComplete' | 'pattern'
> & {
  /** Shown when the value is non-empty and not exactly 5 digits. Default `'Enter a 5-digit ZIP code'`. */
  invalidMessage?: ReactNode
  autoComplete?: string
}

const DIGITS_ONLY = /\D/g

/** Strips anything but digits and caps at 5, in place, before React reads the input's value. */
function stripToZip(e: React.FormEvent<HTMLInputElement>) {
  const el = e.currentTarget
  const digits = el.value.replace(DIGITS_ONLY, '').slice(0, 5)
  if (digits !== el.value) el.value = digits
}

/**
 * US ZIP code on top of `TextField`: digits only, capped at 5, `inputMode="numeric"`.
 * Form value is the digit string (`''` when empty, never `undefined`, so `required` still
 * applies). A built-in rule rejects a non-empty value that isn't exactly 5 digits.
 */
export function ZipField({
  validate,
  invalidMessage = 'Enter a 5-digit ZIP code',
  autoComplete: autoCompleteProp,
  slotProps,
  ...rest
}: ZipFieldProps) {
  // Ahead of TextField's own guard, so the "outside <Form>" error names <ZipField>.
  useEzFormContext('ZipField')
  const assisted = useAssisted()
  const autoComplete = autoCompleteProp ?? resolveAutoComplete('postal-code', assisted)
  const consumer =
    validate === undefined ? {} : typeof validate === 'function' ? { validate } : validate

  return (
    <TextField
      {...rest}
      autoComplete={autoComplete}
      validate={{
        // Consumer entries first: a built-in key must not be silently replaced.
        ...consumer,
        zip: (v: string) => v === '' || v == null || v.length === 5 || (invalidMessage as Message),
      }}
      slotProps={{
        ...slotProps,
        htmlInput: mergeSlotProps(slotProps?.htmlInput, {
          onInput: stripToZip,
          inputMode: 'numeric',
        }),
      }}
    />
  )
}
