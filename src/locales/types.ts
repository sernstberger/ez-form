import type { Components } from '@mui/material/styles'

/**
 * The shape of an ez-form locale object — exactly MUI's own (`{ components:
 * { <Name>: { defaultProps } } }`), so `createTheme(theme, esES)` merges it the
 * way it merges `@mui/material/locale`'s objects, and `useDefaultProps` in
 * every component picks the strings up as theme defaults. The `Ez*` keys and
 * their prop types come from `src/theme/augmentation.ts`.
 */
export interface EzLocalization {
  components: Components
}
