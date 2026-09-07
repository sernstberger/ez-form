/**
 * What one row of a field array looks like to whatever renders it.
 *
 * Its own module rather than a declaration inside `FieldArray.tsx`: `<FieldArray>` publishes
 * these to `Form/FieldArrayRowsContext`, which `useFieldArrayRows` reads, and which
 * `FieldArray.tsx` in turn imports — so the type has to sit below both to keep the import
 * graph acyclic.
 */
export interface FieldArrayRow {
  /** Zero-based position in the array. */
  index: number
  /**
   * hookform's stable `field.id` — the React `key` for the row.
   *
   * Applied for you inside `<FieldArray>`; it is yours to apply when you render rows from
   * `useFieldArrayRows`, and doing so is the point of that hook: an index makes a fine-looking
   * key right up until a row is removed or moved, after which it addresses a different row.
   */
  id: string
  /** Builds the full form path for a field in this row: `name('email')` → `applicants.0.email`. */
  name: (field: string) => string
}
