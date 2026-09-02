const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && Object.getPrototypeOf(v) === Object.prototype

/**
 * The "blank" shape of a values object, by the current type of each leaf:
 * string → '', number → null, boolean → false, array → [], anything else
 * that is not a plain object (Date, File, class instance) → null.
 * `null` / `undefined` stay as they are.
 */
export function emptyOf(values: unknown): unknown {
  if (values === null || values === undefined) return values
  if (typeof values === 'string') return ''
  if (typeof values === 'number') return null
  if (typeof values === 'boolean') return false
  if (Array.isArray(values)) return []
  if (isPlainObject(values)) {
    return Object.fromEntries(Object.entries(values).map(([k, v]) => [k, emptyOf(v)]))
  }
  return null
}
