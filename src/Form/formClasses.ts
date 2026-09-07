import generateUtilityClasses from '@mui/material/generateUtilityClasses'

/**
 * The class hooks on `<Form>`'s own slots, for a theme's `styleOverrides` and for a
 * test query.
 *
 * In their own module rather than in `Form.tsx` because the placement CSS
 * (`src/fields/labelPlacementStyles.ts`) needs `description` to space it away from
 * the first field (#131), and `Form.tsx` imports *that* file — so importing the
 * other way round would close a cycle. A bare `generateUtilityClasses` call has no
 * dependencies of its own, which makes it the right half to move out.
 *
 * Re-exported from `./Form` and from the package root, so the public path is
 * unchanged.
 */
export const formClasses = generateUtilityClasses('EzForm', [
  'root',
  'title',
  'description',
  'status',
])
