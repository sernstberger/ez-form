import { z } from 'zod'

export interface AddressSchemaOptions {
  /**
   * Include the optional `street2` key. Match it to `AddressField`'s own
   * `street2` prop: with the part hidden the value never exists, and a schema
   * that still declares it would let `undefined` through for a key nothing
   * writes. Default `true`.
   */
  street2?: boolean
  /**
   * Messages for the four required parts. Each defaults to
   * `'<Part> is required'`, matching the part labels `AddressField` defaults to.
   */
  messages?: {
    street?: string
    city?: string
    state?: string
    zip?: string
  }
}

/**
 * The `z.object` matching what `<AddressField>` writes, so a form using the
 * composite does not restate its five keys. Every part is a string; `street`,
 * `city`, `state` and `zip` must be non-empty, and `street2` (when included)
 * is optional.
 *
 * `zip` is only checked for presence here — `ZipField`'s own built-in rule
 * already rejects a non-empty value that isn't exactly five digits, and
 * duplicating it in zod would surface two messages for one mistake.
 *
 * ```ts
 * const schema = z.object({ shipping: addressSchema() })
 * ```
 */
export function addressSchema({ street2 = true, messages }: AddressSchemaOptions = {}) {
  const base = {
    street: z.string().min(1, { error: messages?.street ?? 'Street address is required' }),
    city: z.string().min(1, { error: messages?.city ?? 'City is required' }),
    state: z.string().min(1, { error: messages?.state ?? 'State is required' }),
    zip: z.string().min(1, { error: messages?.zip ?? 'ZIP code is required' }),
  }
  return street2 ? z.object({ ...base, street2: z.string().optional() }) : z.object(base)
}
