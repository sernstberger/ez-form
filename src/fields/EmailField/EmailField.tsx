import type { FocusEvent } from 'react'
import { useDefaultProps } from '@mui/material/DefaultPropsProvider'
import { mergeSlotProps } from '@mui/material/utils'
import { TextField, type TextFieldProps } from '../TextField'
import { useEzFormContext } from '../../useEzFormContext'

/**
 * `type` is the binding's: an email field is always `type="email"`, which is
 * also where `inputMode="email"` comes from (`TextField` derives it). A
 * `pattern` rule would duplicate — and could contradict — the built-in format
 * rule below. `autoComplete` is re-declared as an ordinary `string` so a
 * consumer can pass a sectioned token — `'shipping email'`, `'work email'` —
 * over the `'email'` default.
 */
export type EmailFieldProps = Omit<
  TextFieldProps,
  'type' | 'inputMode' | 'autoComplete' | 'pattern'
> & {
  /**
   * Shown when the value is non-empty and not a valid email address. Default
   * `'Enter a valid email address'`.
   *
   * A `string`, not a `ReactNode`: this is a validation message, and
   * react-hook-form's `Message` is a string — it has to survive the trip
   * through `useController`'s rules to `fieldState.error.message`, exactly like
   * every message in `rules.ts`.
   */
  invalidMessage?: string
  /**
   * Trims surrounding whitespace and lower-cases the value on blur, so what is
   * submitted is canonical however it was typed or pasted (`' Ada@Example.COM '`
   * → `'ada@example.com'`). Default `true`; `false` stores exactly what was
   * typed. A consumer `onBlur` still fires either way.
   */
  normalize?: boolean
  autoComplete?: string
}

/**
 * The WHATWG HTML "valid e-mail address" grammar, verbatim from
 * https://html.spec.whatwg.org/multipage/input.html#valid-e-mail-address — the
 * same production a browser's own `<input type="email">` validity check uses.
 * Reusing it rather than inventing a regex means the field's rule agrees with
 * the browser's native bubble instead of disagreeing with it in either
 * direction.
 */
const EMAIL_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/

/** Trimmed and lower-cased, the canonical form this field stores on blur. */
function canonicalize(value: string): string {
  return value.trim().toLowerCase()
}

/**
 * Email address on top of `TextField`: `type="email"` (so the mobile keyboard
 * gets the `@` key and `inputMode="email"`), `autoComplete="email"`, and a
 * built-in format rule using HTML's own email grammar. The form value is the
 * address string (`''` when empty, never `undefined`, so `required` still
 * applies), trimmed and lower-cased on blur unless `normalize={false}`.
 */
export function EmailField(inProps: EmailFieldProps) {
  // Ahead of TextField's own guard, so the "outside <Form>" error names <EmailField>.
  useEzFormContext('EmailField')
  const props = useDefaultProps({ props: inProps, name: 'EzEmailField' })
  const {
    name,
    invalidMessage = 'Enter a valid email address',
    normalize = true,
    autoComplete = 'email',
    validate,
    slotProps,
    ...rest
  } = props

  const consumerValidate =
    validate === undefined ? {} : typeof validate === 'function' ? { validate } : validate

  /**
   * Rewrites the input to its canonical form on blur, in the **capture** phase
   * so it lands before every bubbling blur handler — hookform's included. That
   * ordering is the whole point: the form then commits and validates the
   * canonical value through its own normal blur path, so `mode="onBlur"`
   * reports on the fixed value and the default `mode="onSubmit"` still reports
   * nothing until submit. Normalizing with a `setValue` *after* hookform's
   * handler would instead have had to decide for itself when to re-validate,
   * and got it wrong in one mode or the other.
   *
   * The rewrite goes through the native value setter plus a dispatched `input`
   * event rather than a plain assignment, because the input is controlled:
   * React owns the displayed value, so the change has to reach the form for it
   * to stick. (React's own `onChange` is delegated from a native `input`
   * event, which is why this is the event that reaches it.)
   */
  const normalizeOnBlur = (event: FocusEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    // Read off the element rather than a prop: `readOnly` can arrive through
    // `slotProps.input` (MUI's) or `slotProps.htmlInput`, and a value the user
    // was never able to edit is not this field's to rewrite. `disabled` needs
    // no check — a disabled input cannot be focused, so it never blurs.
    if (input.readOnly) return
    const next = canonicalize(input.value)
    // Only when it actually differs, so an already-canonical value fires no
    // extra change and never marks the field dirty on its own.
    if (next !== input.value) {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setter?.call(input, next)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    }
  }

  return (
    <TextField
      {...rest}
      name={name}
      type="email"
      autoComplete={autoComplete}
      slotProps={{
        ...slotProps,
        htmlInput: mergeSlotProps(slotProps?.htmlInput, {
          // Capture phase: the rewrite must land *before* the bubbling blur
          // handlers — hookform's, which validates under `mode="onBlur"` —
          // so the form validates the canonical value rather than the typed one.
          ...(normalize ? { onBlurCapture: normalizeOnBlur } : {}),
        }),
      }}
      validate={{
        // Consumer entries first: a built-in key must not be silently replaced.
        ...consumerValidate,
        // The rule reads the value the same way it is stored, so it agrees with
        // what blur will canonicalize to rather than rejecting a value the field
        // is about to fix itself.
        email: (v: string) =>
          v == null || v === '' || EMAIL_RE.test(canonicalize(v)) || invalidMessage,
      }}
    />
  )
}
