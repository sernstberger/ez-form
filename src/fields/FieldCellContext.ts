import { createContext, useContext } from 'react'

/**
 * What a field learns from the table cell it is rendered in (`<FieldArray
 * layout="table">`, #14).
 *
 * Provided per cell by `FieldArray`, read by `useEzField` — the one hook every field
 * already calls — so cell mode reaches every family without a per-field prop: the
 * field's own label is visually hidden and its control is named by the row header
 * plus the column header (`aria-labelledby="<rowHeaderId> <headerId>"` → "Line item 2
 * Qty"). The `label` prop stays required and stays in the DOM, so `describeFieldContract`
 * and `getByLabelText` keep working.
 *
 * Internal: not exported from `src/index.ts`.
 */
export interface FieldCellContextValue {
  /** `id` of the row's `<th scope="row">`. */
  rowHeaderId: string
  /** `id` of the column's `<th scope="col">`. */
  headerId: string
  /**
   * `"<row name> <column header>"` as plain text, for `<FormErrorSummary>`'s item text —
   * or `undefined` when the header is not a string and there is nothing to spell out.
   */
  label: string | undefined
  /**
   * Whether the helper text (and so the error message) is visually hidden in this cell:
   * `cellErrors="summary"`. `false` under `cellErrors="inline"`, where the text shows
   * under the control and the row grows. Either way the text stays the control's
   * `aria-describedby` target.
   */
  helperTextHidden: boolean
}

export const FieldCellContext = createContext<FieldCellContextValue | null>(null)

/** The enclosing table cell, or `null` for every field not inside one. */
export function useFieldCell(): FieldCellContextValue | null {
  return useContext(FieldCellContext)
}
