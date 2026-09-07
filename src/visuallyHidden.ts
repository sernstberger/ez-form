import type { CSSObject } from '@mui/material/styles'

/**
 * The clip-rect "visually hidden" recipe: out of sight, still in the accessibility
 * tree. One copy, shared by `LiveRegion`'s default block and the table-cell label
 * rules in `labelPlacementStyles` (#14), so the two cannot drift.
 *
 * A style object rather than a component, because the callers apply it in
 * different ways — `LiveRegion` as a styled slot's own default, the placement CSS
 * as a nested rule on a label inside a field box — and both are theme-reachable
 * through the slot they land on.
 */
export const visuallyHidden: CSSObject = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  whiteSpace: 'nowrap',
  borderWidth: 0,
}
