/**
 * Joins a component's own utility class with an optional consumer `className`.
 *
 * Internal only — deliberately not exported from `src/index.ts`. It is not a
 * `clsx` substitute (no arrays, objects, or conditionals): every call site is a
 * slot appending one caller-supplied class, which is the only shape the
 * `<name>Classes` pattern produces.
 */
export const cx = (base: string, extra?: string) => (extra ? `${base} ${extra}` : base)
