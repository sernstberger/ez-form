import type { FieldErrors } from 'react-hook-form'

/**
 * A `FieldError` leaf, recognised by hookform's own shape. Mirrors the check `Wizard` uses to
 * walk `formState.errors` (see `Wizard.tsx`'s `isFieldError` for the full reasoning): `type` is
 * a string on a leaf raised by validation, and `message`/`ref` are its discriminating siblings.
 *
 * Ruling: a `message`-only leaf counts too (#124). `setError('root.server', { message })` —
 * the pattern this library documents for a server-side failure, and what every example uses —
 * produces `{ message, ref }` with **no `type`**, because `type` is optional in hookform's own
 * `ErrorOption` and only the resolver fills it in. The original `type`-required check therefore
 * skipped every `setError`-raised leaf silently, which is why `<Form>`'s post-submit read saw
 * an empty list against a `getErrors()` that plainly held `{ root: { server: { message } } }`.
 * A leaf is now "has a string `message`, or has a `type` and a `ref`" — the second half keeps
 * recognising a message-less validation leaf (a `refine` with no message) as a leaf to skip
 * rather than a branch to recurse into. Cost if wrong: a *value* object in the errors tree that
 * happens to carry a string `message` property would be read as an error leaf — impossible in
 * practice, since only hookform writes this tree and only errors go in it.
 */
function isFieldError(node: object): node is { type?: string; message?: string; ref?: unknown } {
  if ('message' in node && typeof (node as { message?: unknown }).message === 'string') return true
  return 'type' in node && typeof (node as { type?: unknown }).type === 'string' && 'ref' in node
}

export interface ErrorEntry {
  name: string
  message: string
}

/**
 * Flattens `formState.errors` to `{ name, message }` leaves, in the order `Object.keys` visits
 * them at each level (schema order in practice, since react-hook-form builds the errors object
 * by walking the schema). A leaf with no `message` (e.g. a `refine` with no message) is skipped
 * — there is nothing to show as its link text.
 *
 * Ruling: DOM/schema order via `Object.keys` rather than a field-registration order — hookform
 * does not expose one, and this matches the order a sighted user reads the form top to bottom
 * in the common case (fields declared in schema order). Cost if wrong: a summary item and its
 * field appear in a different order than the form for a schema whose properties are declared
 * out of visual order — cosmetic, not a functional or a11y regression (each item's link still
 * focuses the right field).
 *
 * Ruling: lifted out of `FormErrorSummary.tsx` into its own module (#124) rather than copied —
 * `<Form>`'s own post-submit focus step needs the identical walk to find the first field error
 * an `onSubmit` left behind, and two copies of a hookform-shape-sniffing walk would drift the
 * moment hookform changed that shape. Cost if wrong: one more file for one function.
 */
export function flattenErrors(errors: FieldErrors, prefix = ''): ErrorEntry[] {
  return Object.entries(errors).flatMap(([key, value]) => {
    if (value == null || typeof value !== 'object') return []
    const path = prefix ? `${prefix}.${key}` : key
    if (isFieldError(value)) {
      return typeof value.message === 'string' && value.message
        ? [{ name: path, message: value.message }]
        : []
    }
    return flattenErrors(value as FieldErrors, path)
  })
}
