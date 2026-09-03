/**
 * Development-only warnings for mistakes that produce a working-looking form with an
 * accessibility hole: a field with no accessible name, duplicate option values, a wizard
 * step listing a field it never mounts. None of these throw — the form still renders — so
 * the warning is the only signal a consumer gets.
 *
 * `isDev` is a module-level `const` read from `process.env.NODE_ENV`, the substitution every
 * bundler performs (Vite, webpack, Rollup+replace, esbuild) before dead-code elimination.
 * That makes `if (!isDev) return` a statically false branch in a production build, so the
 * minifier drops each call site *and* the message strings it would have built. Writing the
 * check inline at each call site (`process.env.NODE_ENV !== 'production' && …`) would strip
 * just as well, but the one-per-key bookkeeping has to live somewhere; keeping the guard
 * here means a caller cannot forget it.
 *
 * Nothing in this file is exported from `src/index.ts`: these are diagnostics for people
 * building forms with the library, not API.
 */
const isDev = process.env.NODE_ENV !== 'production'

/**
 * Keys already warned about. Module-level, so a warning fires once per key for the life of
 * the page rather than once per render — a field remounting on every keystroke (a common
 * consequence of an inline `steps` array or a re-created component) would otherwise bury
 * the console.
 */
const warned = new Set<string>()

/**
 * `console.warn(message)` the first time this `key` is seen, and never again.
 *
 * `key` identifies the *mistake*, not the call: it should carry whatever distinguishes one
 * instance from another (the field name, the step id) so two different fields with the same
 * problem both get reported, while one field re-rendering reports once.
 */
export function devWarn(key: string, message: string): void {
  if (!isDev) return
  if (warned.has(key)) return
  warned.add(key)
  console.warn(message)
}

/** Test-only: forget which keys have warned, so each test starts from a clean slate. */
export function resetDevWarnings(): void {
  warned.clear()
}

/**
 * A field with no accessible name: no visible `label`, and neither of the ARIA escape
 * hatches. Checked against the props the field hands the hook rather than the rendered DOM,
 * so it costs nothing and runs before anything is painted — the trade being that a name
 * supplied some other way (a `slotProps.htmlInput['aria-label']`, say) is invisible here and
 * would warn falsely. That is why this is a warning and not an error.
 *
 * What counts as a label is `hasLabel` below.
 */
export function warnMissingLabel(
  componentName: string,
  name: string,
  label: unknown,
  ariaLabel: string | undefined,
  ariaLabelledBy: string | undefined,
): void {
  if (!isDev) return
  if (hasLabel(label) || ariaLabel || ariaLabelledBy) return
  devWarn(
    `missing-label:${componentName}:${name}`,
    `ez-form: <${componentName} name="${name}"> has no accessible name. ` +
      'Pass `label`, or `aria-label` / `aria-labelledby` if the name is supplied elsewhere.',
  )
}

/**
 * Does this `label` prop name anything? `ReactNode` has four empty forms — `undefined`,
 * `null`, `false` and `''` — and any element or non-empty string counts, since an
 * icon-only label element still names a field.
 *
 * Exported because `FieldFrame` has to ask the same question for a different reason: it
 * renders a legend only when there is something to put in it, and emits the legend's id
 * as `aria-labelledby` only then (#100). Sharing the predicate keeps the two in step —
 * the input that warns is exactly the input that gets no legend. Unlike the warnings,
 * this one runs in production too, so it carries no `isDev` guard.
 */
export function hasLabel(label: unknown): boolean {
  return label !== undefined && label !== null && label !== false && label !== ''
}

/**
 * Duplicate stored values in an options list. The stored value is what the form keeps and
 * what every field below keys its option elements on, so duplicates silently collapse the
 * selection: two radios both appear checked, a Select shows the wrong label, React logs a
 * duplicate-key warning that names neither the field nor the offending value.
 *
 * Values are compared as `String(value)` because that is what the DOM comparison in these
 * fields already reduces them to — `1` and `'1'` are the same option to a RadioGroup. An
 * object (only reachable via `Autocomplete`'s `getOptionValue`) is compared by its JSON
 * instead, so two structurally identical objects still read as a collision — which is what
 * `isOptionEqualToValue` will do with them at runtime.
 *
 * `getValue` exists for `Autocomplete`: a `getOptionValue` prop decides what that field
 * actually stores, so it, not `option.value`, is where a collision bites. Every other field
 * stores `option.value` and omits it.
 */
export function warnDuplicateOptions<TOption extends { value: string | number }>(
  componentName: string,
  name: string,
  options: readonly TOption[],
  getValue: (option: TOption) => unknown = (option) => option.value,
): void {
  if (!isDev) return
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const option of options) {
    const value = getValue(option)
    const key = typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value)
    if (seen.has(key)) duplicates.add(key)
    seen.add(key)
  }
  if (duplicates.size === 0) return
  devWarn(
    `duplicate-options:${componentName}:${name}`,
    `ez-form: <${componentName} name="${name}"> has duplicate option values: ` +
      `${[...duplicates].join(', ')}. Option values must be unique.`,
  )
}

/**
 * A wizard step whose `fields` names something the form has never heard of — a typo, or a
 * field renamed on one side only. `trigger` on a name hookform does not know resolves to
 * "valid", so Next advances past a control the consumer meant to validate, silently.
 *
 * ### Why "unknown to the form" rather than "not mounted"
 *
 * Two of this library's own documented patterns legitimately list a `fields` entry that is
 * not mounted at the moment Next runs, and both must stay silent:
 *
 * - **A conditional field** (README "Conditional fields"): the field is listed so `trigger`
 *   runs the schema's `superRefine` for it, and is unmounted precisely when its condition is
 *   false. That is the pattern working, not a mistake.
 * - **An empty `FieldArray`**: `fields: ['debts']` validates the array-level schema
 *   (`z.array(…).min(n)`) with no rows registered at all. `useFieldArray` also registers into
 *   `_names.array`, never `_names.mount`, so an array name is *never* in `mount` — a
 *   mount-only check would warn on every field-array step, empty or not.
 *
 * What both have in common is that the name is still *known*: it has a value under the form's
 * defaults. A genuine typo has none. So the check asks "does the form know this name at all",
 * combining hookform's two name sets with the value tree — which is the question that
 * actually distinguishes the mistake from the patterns.
 *
 * ### Reading hookform's internals
 *
 * `control._names.mount` / `._names.array` are the registered-field and field-array name
 * sets. They are underscore-prefixed but publicly typed on `Control` (as `Names`) and stable
 * across react-hook-form's 7.x line, and they are the only place "is this registered"
 * exists. Both are read defensively; when `mount` is empty nothing has registered yet (or a
 * future version moved it) and the check is skipped entirely rather than warning about every
 * field.
 *
 * A step's `fields` may name a parent path (`address` covering `address.city`), so a listed
 * name counts as known when a registered name is it or is nested under it.
 */
export function warnUnmountedStepFields(
  stepId: string,
  fields: readonly string[],
  names: { mount: ReadonlySet<string>; array: ReadonlySet<string> } | undefined,
  /** Thunk, not a snapshot: production never calls it, so it costs nothing there. */
  getValues: () => unknown,
): void {
  if (!isDev) return
  if (!names || names.mount.size === 0) return
  const registered = [...names.mount, ...names.array]
  const unregistered = fields.filter(
    (field) => !registered.some((n) => n === field || n.startsWith(`${field}.`)),
  )
  if (unregistered.length === 0) return
  const values = getValues()
  const missing = unregistered.filter((field) => !hasPath(values, field))
  if (missing.length === 0) return
  devWarn(
    `unmounted-step-fields:${stepId}:${missing.join(',')}`,
    `ez-form: <Wizard> step "${stepId}" lists field(s) in \`fields\` that the form does not ` +
      `know: ${missing.join(', ')}. Validation silently passes them — check for a typo or a ` +
      'renamed field.',
  )
}

/**
 * Does the form's value tree have this dotted path? Walks rather than indexing so
 * `address.city` resolves, and treats a present-but-`undefined` key as absent — an
 * unmounted conditional field still has its `defaultValues` entry, which is the whole
 * signal this is looking for.
 *
 * An index into an **empty array** (`debts.0.amount` with no rows yet) counts as known: the
 * array exists, so the path is well-formed and the rows simply have not been added. Without
 * this, a step listing a row-level path would warn until the user adds a row — the same
 * empty-`FieldArray` false positive the caller exists to avoid, one level deeper.
 */
function hasPath(values: unknown, path: string): boolean {
  let node = values
  for (const key of path.split('.')) {
    if (typeof node !== 'object' || node === null) return false
    if (Array.isArray(node) && node.length === 0 && /^\d+$/.test(key)) return true
    if (!(key in node)) return false
    node = (node as Record<string, unknown>)[key]
  }
  return node !== undefined
}
