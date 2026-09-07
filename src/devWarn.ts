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
 * Exported because `BoundField` has to ask the same question for a different reason: it
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
 * Where `ezResolver` leaves the schema's top-level key set for this check to find, and the
 * only channel between them. A property on the resolver function, not a React context,
 * because the resolver is already on `control._options.resolver` — reachable from the
 * `control` every field already holds — so nothing new is provided, rendered, or shipped:
 * in production `ezResolver` never assigns it and this module's every reader is stripped.
 *
 * A symbol rather than a string key so it cannot collide with anything hookform or a
 * consumer's own resolver wrapper puts on that function.
 */
export const schemaKeys = Symbol.for('ez-form.schemaKeys')

/** What a resolver carrying the marker looks like. */
interface MarkedResolver {
  [schemaKeys]?: ReadonlySet<string>
}

/**
 * A field whose `name` names nothing the form has: the typo case (#108). `name` is a plain
 * `string` — making it `Path<TIn>` needs a structural path from `<Form>`'s generic through
 * `children: ReactNode` to the field, which does not exist — so a mistyped `name` compiles,
 * renders, accepts typing, and submits the untouched default. Nothing throws and nothing is
 * logged; this warning is the only signal.
 *
 * ### The schema is the authority, not `defaultValues`
 *
 * The first build of this check asked `_defaultValues` alone, and the test suite immediately
 * caught it warning about `role`, `plan`, `seats`, `tos` and `newsletter` across
 * `Form.test.tsx` and `Wizard.stories.tsx` — every one a real field, in the schema, simply
 * left out of a partial `defaultValues` (`Wizard.stories.tsx` types its defaults
 * `Partial<Input>` on purpose). Omitting a default is a supported pattern, so a
 * defaults-only check is wrong by construction, and wrong on this library's own stories.
 *
 * `ezResolver` therefore hands over the schema's top-level keys (see `schemaKeys`), and those
 * are what a name is judged against. `defaultValues` only ever *widens* the accepted set —
 * a `z.looseObject` passes through keys the shape does not list, and a consumer may seed
 * state under a name the schema strips — so a name has to be missing from both to be a typo.
 * The schema is required, though: with no readable schema this warns about nothing at all,
 * because defaults alone cannot tell a typo from a field the consumer chose not to seed.
 *
 * ### Why the *root segment*, and only the root segment
 *
 * A warning that cries wolf gets muted, so this checks the least it can while still catching
 * the mistake: the first path segment. `emial` has an unknown root. Every dynamic name this
 * library produces has a **known** root and an unpredictable tail, and the tail is where the
 * rest of the false positives live:
 *
 * - `FieldArray` rows: `items.1.qty` after Add. `_defaultValues.items` still holds the one
 *   seeded row and `_formValues.items[1]` is `{}` (hookform appends the row before the field
 *   registers a value), so *both* value trees say `items.1.qty` is absent. Verified. A
 *   full-path check warns on every added row. Root `items` is known, so this stays quiet.
 * - `AddressField`: renders `address.street`, `address.city`, … from one `name="address"`.
 *   Root `address` is known.
 * - Any consumer's own nested or computed name, for the same reason.
 *
 * Trading depth for silence is the right trade: a typo in a *leaf* (`address.ctiy`) still
 * lands outside the schema's shape and is caught on submit, while a typo in the root is the
 * one that vanishes without a trace. Catching less, never falsely, is what makes the warning
 * worth reading.
 *
 * ### Timing
 *
 * This runs during the field's render, so `_names.mount` is **empty on the first pass** — the
 * field asking has not registered yet, and neither has anything after it. `_names` alone would
 * warn about every field on a form's first paint. The schema keys are fixed when the resolver
 * is built, before any field registers, which is what makes a first-render answer possible at
 * all — and it is also why an async `defaultValues` needs no special case: the schema is
 * already there while the values are still loading. `_names` is still consulted, because it
 * grows on re-render and covers a root that has neither a schema key nor a default.
 *
 * ### The guard that keeps it silent when it cannot know
 *
 * No readable schema (see `topLevelSchemaKeys`) means no opinion — the check is skipped
 * whole. That covers a schema wrapped in a `.transform`, a pipe or a union, and it is what
 * keeps the warning from firing on a form it does not actually understand.
 */
export function warnUnknownFieldName(
  componentName: string,
  name: string,
  control: NameCheckControl,
): void {
  if (!isDev) return
  if (!isUnknownName(name, control)) return
  devWarn(
    `unknown-field-name:${componentName}:${name}`,
    `ez-form: <${componentName} name="${name}"> — the form has no "${rootSegment(name)}". ` +
      'The field renders and accepts input, but its value is dropped on submit. ' +
      'Check for a typo against the schema and `defaultValues`.',
  )
}

/** The slice of hookform's `control` the name checks read. */
export interface NameCheckControl {
  _defaultValues?: unknown
  _names?: { mount: ReadonlySet<string>; array: ReadonlySet<string> }
  _options?: { resolver?: unknown }
}

/**
 * Whether `name`'s root segment names nothing this form knows about — the shared discriminator
 * behind `warnUnknownFieldName` and `warnUnknownFieldArrayName`.
 *
 * `false` is the answer both for "the form has this name" and for "cannot tell", which is what
 * makes it safe to warn on `true`: see `warnUnknownFieldName`'s doc for why it checks only the
 * root segment, why an unreadable schema means no opinion, and why the schema keys — fixed
 * when the resolver is built, before any field registers — are what let this answer on the
 * very first render.
 */
export function isUnknownName(name: string, control: NameCheckControl | undefined): boolean {
  if (!name) return false
  const resolver = control?._options?.resolver
  const fromSchema =
    typeof resolver === 'function' ? (resolver as MarkedResolver)[schemaKeys] : undefined
  // No readable schema, no opinion. `defaultValues` alone cannot tell a typo from a field
  // the consumer chose not to seed, so without the schema there is nothing to warn about.
  if (!fromSchema?.size) return false
  const root = rootSegment(name)
  if (fromSchema.has(root)) return false
  const defaults = control?._defaultValues
  if (typeof defaults === 'object' && defaults !== null && !Array.isArray(defaults)) {
    // A key the schema does not list but the form was seeded with: a `z.looseObject` passes
    // it through, and a consumer may park state under a name the schema strips. Not a typo.
    if (Object.keys(defaults).includes(root)) return false
  }
  const names = control?._names
  if (names) {
    for (const registered of [...names.mount, ...names.array]) {
      if (registered === root || rootSegment(registered) === root) return false
    }
  }
  return true
}

/**
 * `useFieldArrayRows(name)` for a name this form has no array under.
 *
 * This asks the #108 question — is the *root segment* a name the schema, the seeded defaults
 * or the registered names know? — rather than "has a `<FieldArray name>` published rows for it
 * yet", which is not the same question and answers wrongly for the case the hook exists to
 * serve. The owning array is routinely unmounted when a reader renders: that is the whole
 * point of the latch. It may also never have mounted at all — its `<WizardStep>` is hidden
 * behind a `when`, or the form is controlled to a step before it — and a reader on a step the
 * user reached first would then warn about a perfectly correct name. The schema, by contrast,
 * lists `coApplicants` whether or not any step showing it has rendered.
 *
 * The cost of the narrower question is that a *correctly spelled* name that no `<FieldArray>`
 * anywhere actually owns — a plain `z.array()` the consumer never wrapped in one — stays
 * silent. That is the right trade: it renders nothing either way, and a warning that fires on
 * correct code is worse than one that misses.
 */
export function warnUnknownFieldArrayName(
  name: string,
  control: NameCheckControl | undefined,
): void {
  if (!isDev) return
  if (!isUnknownName(name, control)) return
  devWarn(
    `unknown-field-array-name:${name}`,
    `ez-form: useFieldArrayRows("${name}") — the form has no "${rootSegment(name)}". ` +
      'It renders nothing. Check the name against the <FieldArray> that owns those rows; ' +
      'that array does not have to be mounted, but it must belong to the same <Form>.',
  )
}

/**
 * The schema's top-level keys, or `undefined` when they cannot be read — which is the
 * difference between "the form has no `emial`" and "cannot tell", and the check stays silent
 * on the second.
 *
 * Only a plain `z.object` (including `strictObject`, and one carrying a `.refine` /
 * `.superRefine`, which keep `def.type === 'object'`) answers. A schema wrapped in a union,
 * a pipe, a `.transform` or an `.optional()` reports its own `def.type` with no `shape`
 * (verified against zod 4), and every one of those is a shape this cannot enumerate — so it
 * declines rather than guessing, and the check falls back to `defaultValues` alone.
 *
 * `_zod.def` is zod 4's internal def object. It is read defensively and behind two `typeof`
 * checks: a future zod that moves it makes this return `undefined`, which costs the warning
 * and nothing else.
 */
export function topLevelSchemaKeys(schema: unknown): ReadonlySet<string> | undefined {
  if (!isDev) return undefined
  const def = (schema as { _zod?: { def?: { type?: unknown; shape?: unknown } } } | null)?._zod?.def
  if (def?.type !== 'object') return undefined
  const shape = def.shape
  if (typeof shape !== 'object' || shape === null) return undefined
  return new Set(Object.keys(shape))
}

/**
 * The first path segment of a hookform name. Both notations reach a field:
 * `items.0.qty` from `FieldArray`'s `name()` helper, `items[0].qty` if a consumer writes it
 * by hand (hookform accepts both), so `[` ends the segment as surely as `.` does.
 */
function rootSegment(name: string): string {
  const end = name.search(/[.[]/)
  return end === -1 ? name : name.slice(0, end)
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
