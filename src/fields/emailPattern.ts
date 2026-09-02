/**
 * The WHATWG HTML spec's `<input type="email">` validity regex, verbatim.
 *
 * Deliberately *not* an RFC 5322 parser: the spec calls this "a willful
 * violation of RFC 5322" precisely because full RFC syntax admits addresses no
 * mail system accepts and rejects none a user would plausibly type. Matching
 * the browser means a field validates exactly what a native email input would,
 * so client and browser never disagree about the same string.
 *
 * https://html.spec.whatwg.org/multipage/input.html#valid-e-mail-address
 */
export const EMAIL_PATTERN =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/

/**
 * Whether `value` is a valid email address by `EMAIL_PATTERN`. An empty string
 * is *not* valid here — emptiness is the `required` rule's business, not this
 * one's, and every caller checks for it separately before asking.
 */
export const isEmail = (value: string): boolean => EMAIL_PATTERN.test(value)

// TODO(#86): `EmailField` is being built in parallel and will want the same
// regex. When both have landed, whichever merges second should import from here
// rather than keeping a second copy — there must be exactly one definition of
// "a valid email address" in this library.
