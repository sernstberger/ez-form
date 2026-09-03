/**
 * `ezFormTheme` — the one opt-in place that holds an opinion about how ez-form
 * should look. Every component in `src/` ships unstyled (PHILOSOPHY rule 2); this
 * preset is the code form of `DESIGN.md` at the repo root, and the two are kept in
 * lock-step by `ezFormTheme.test.tsx`, which parses that file's token block and
 * asserts it equals `ezFormTokens` below.
 *
 * The primitives (colour scales, palette, typography, shape) and most of the
 * component customisations are adapted from MUI's dashboard template —
 * `docs/data/material/getting-started/templates/shared-theme` at
 * https://github.com/mui/material-ui/tree/v9.4.0 — which is MIT licensed
 * (© MUI). Where this file departs from the template, a comment says why.
 *
 * Two things the template does not do, and this preset does:
 *
 * - **Stacked labels.** The label sits above the input, in place, with no floating
 *   animation and no notch in the border. See `MuiInputLabel` / `MuiOutlinedInput`
 *   below and the "#9" note on what a real stacked variant still needs.
 * - **Reduced motion (WCAG 2.3.3, #11).** `MuiCssBaseline` collapses every
 *   transition and animation under `prefers-reduced-motion: reduce`.
 */
import type {} from '@mui/x-date-pickers/themeAugmentation'
import { chipClasses } from '@mui/material/Chip'
import { menuItemClasses } from '@mui/material/MenuItem'
import { outlinedInputClasses } from '@mui/material/OutlinedInput'
import { svgIconClasses } from '@mui/material/SvgIcon'
import { alpha, createTheme, type Theme, type ThemeOptions } from '@mui/material/styles'
import type {} from './augmentation'

// ---------------------------------------------------------------------------
// Tokens. `DESIGN.md`'s YAML block carries these same values; the test keeps them equal.
// ---------------------------------------------------------------------------

export const ezFormTokens = {
  colors: {
    brand: {
      50: 'hsl(210, 100%, 95%)',
      100: 'hsl(210, 100%, 92%)',
      200: 'hsl(210, 100%, 80%)',
      300: 'hsl(210, 100%, 65%)',
      400: 'hsl(210, 98%, 48%)',
      500: 'hsl(210, 98%, 42%)',
      600: 'hsl(210, 98%, 55%)',
      700: 'hsl(210, 100%, 35%)',
      800: 'hsl(210, 100%, 16%)',
      900: 'hsl(210, 100%, 21%)',
    },
    gray: {
      50: 'hsl(220, 35%, 97%)',
      100: 'hsl(220, 30%, 94%)',
      200: 'hsl(220, 20%, 88%)',
      300: 'hsl(220, 20%, 80%)',
      400: 'hsl(220, 20%, 65%)',
      500: 'hsl(220, 20%, 42%)',
      600: 'hsl(220, 20%, 35%)',
      700: 'hsl(220, 20%, 25%)',
      800: 'hsl(220, 30%, 6%)',
      900: 'hsl(220, 35%, 3%)',
    },
    green: {
      50: 'hsl(120, 80%, 98%)',
      100: 'hsl(120, 75%, 94%)',
      200: 'hsl(120, 75%, 87%)',
      300: 'hsl(120, 61%, 77%)',
      400: 'hsl(120, 44%, 53%)',
      500: 'hsl(120, 59%, 30%)',
      600: 'hsl(120, 70%, 25%)',
      700: 'hsl(120, 75%, 16%)',
      800: 'hsl(120, 84%, 10%)',
      900: 'hsl(120, 87%, 6%)',
    },
    orange: {
      50: 'hsl(45, 100%, 97%)',
      100: 'hsl(45, 92%, 90%)',
      200: 'hsl(45, 94%, 80%)',
      300: 'hsl(45, 90%, 65%)',
      400: 'hsl(45, 90%, 40%)',
      500: 'hsl(45, 90%, 35%)',
      600: 'hsl(45, 91%, 25%)',
      700: 'hsl(45, 94%, 20%)',
      800: 'hsl(45, 95%, 16%)',
      900: 'hsl(45, 93%, 12%)',
    },
    red: {
      50: 'hsl(0, 100%, 97%)',
      100: 'hsl(0, 92%, 90%)',
      200: 'hsl(0, 94%, 80%)',
      300: 'hsl(0, 90%, 65%)',
      400: 'hsl(0, 90%, 40%)',
      500: 'hsl(0, 90%, 30%)',
      600: 'hsl(0, 91%, 25%)',
      700: 'hsl(0, 94%, 18%)',
      800: 'hsl(0, 95%, 12%)',
      900: 'hsl(0, 93%, 6%)',
    },
    light: {
      canvas: 'hsl(0, 0%, 99%)',
      surface: 'hsl(220, 35%, 97%)',
      ink: 'hsl(220, 30%, 6%)',
      'ink-muted': 'hsl(220, 20%, 35%)',
      hairline: 'hsla(220, 20%, 80%, 0.4)',
      primary: 'hsl(210, 98%, 48%)',
      'on-primary': 'hsl(210, 100%, 95%)',
      error: 'hsl(0, 90%, 40%)',
      success: 'hsl(120, 44%, 53%)',
      warning: 'hsl(45, 90%, 40%)',
    },
    dark: {
      canvas: 'hsl(220, 35%, 3%)',
      surface: 'hsl(220, 30%, 7%)',
      ink: 'hsl(0, 0%, 100%)',
      'ink-muted': 'hsl(220, 20%, 65%)',
      hairline: 'hsla(220, 20%, 25%, 0.6)',
      primary: 'hsl(210, 98%, 48%)',
      'on-primary': 'hsl(210, 100%, 95%)',
      error: 'hsl(0, 90%, 65%)',
      success: 'hsl(120, 59%, 30%)',
      warning: 'hsl(45, 90%, 35%)',
    },
  },
  typography: {
    fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    h1: { fontSize: '48px', fontWeight: 600, lineHeight: 1.2, letterSpacing: '-0.5px' },
    h2: { fontSize: '36px', fontWeight: 600, lineHeight: 1.2 },
    h3: { fontSize: '30px', fontWeight: 400, lineHeight: 1.2 },
    h4: { fontSize: '24px', fontWeight: 600, lineHeight: 1.5 },
    h5: { fontSize: '20px', fontWeight: 600 },
    h6: { fontSize: '18px', fontWeight: 600 },
    subtitle1: { fontSize: '18px' },
    subtitle2: { fontSize: '14px', fontWeight: 500 },
    body1: { fontSize: '14px' },
    body2: { fontSize: '14px', fontWeight: 400 },
    caption: { fontSize: '12px', fontWeight: 400 },
    label: { fontSize: '12px', fontWeight: 500 },
  },
  rounded: { sm: '5px', md: '8px', lg: '10px', pill: '999px' },
  spacing: { unit: '8px', xs: '4px', sm: '8px', md: '12px', lg: '16px', xl: '24px' },
  sizing: { 'control-sm': '36px', 'control-md': '40px', 'focus-ring': '3px' },
} as const

const { brand, gray, green, orange, red } = ezFormTokens.colors

// ---------------------------------------------------------------------------
// Primitives — the template's `themePrimitives.ts`, minus what needs CSS variables
// (`baseShadow`) or a palette augmentation (`text.warning`).
// ---------------------------------------------------------------------------

// Each scheme's palette names its own `mode`. Without CSS variables MUI builds the
// palette from `colorSchemes[defaultColorScheme].palette` verbatim and only infers
// `mode: 'dark'` for a scheme given as `dark: true` — so a `defaultColorScheme:
// 'dark'` against a palette that does not say `mode: 'dark'` would get dark colours
// with light-mode behaviour (`applyStyles('dark')` never firing, for one).
const colorSchemes: NonNullable<ThemeOptions['colorSchemes']> = {
  light: {
    palette: {
      mode: 'light',
      primary: { light: brand[200], main: brand[400], dark: brand[700], contrastText: brand[50] },
      info: { light: brand[100], main: brand[300], dark: brand[600], contrastText: gray[50] },
      warning: { light: orange[300], main: orange[400], dark: orange[800] },
      error: { light: red[300], main: red[400], dark: red[800] },
      success: { light: green[300], main: green[400], dark: green[800] },
      grey: { ...gray },
      divider: alpha(gray[300], 0.4),
      background: {
        default: ezFormTokens.colors.light.canvas,
        paper: ezFormTokens.colors.light.surface,
      },
      text: { primary: gray[800], secondary: gray[600] },
      action: { hover: alpha(gray[200], 0.2), selected: alpha(gray[200], 0.3) },
    },
  },
  dark: {
    palette: {
      mode: 'dark',
      primary: { contrastText: brand[50], light: brand[300], main: brand[400], dark: brand[700] },
      info: { contrastText: brand[300], light: brand[500], main: brand[700], dark: brand[900] },
      warning: { light: orange[400], main: orange[500], dark: orange[700] },
      // The template's dark `error.main` is `red[500]` (30% lightness): 2.2:1 against
      // the dark canvas, and `error.main` is the colour of every error helper text.
      // `red[300]` reads at 6:1; the test below asserts it.
      error: { light: red[200], main: red[300], dark: red[500] },
      success: { light: green[400], main: green[500], dark: green[700] },
      grey: { ...gray },
      divider: alpha(gray[700], 0.6),
      background: {
        default: ezFormTokens.colors.dark.canvas,
        paper: ezFormTokens.colors.dark.surface,
      },
      text: { primary: ezFormTokens.colors.dark.ink, secondary: gray[400] },
      action: { hover: alpha(gray[600], 0.2), selected: alpha(gray[600], 0.3) },
    },
  },
}

const t = ezFormTokens.typography
const typography: ThemeOptions['typography'] = {
  // The template assumes Inter is loaded by the app; the fallbacks make an app that
  // does not load it degrade to its system font instead of Times.
  fontFamily: t.fontFamily,
  h1: t.h1,
  h2: t.h2,
  h3: t.h3,
  h4: t.h4,
  h5: t.h5,
  h6: t.h6,
  subtitle1: t.subtitle1,
  subtitle2: t.subtitle2,
  body1: t.body1,
  body2: t.body2,
  caption: t.caption,
}

const shape: ThemeOptions['shape'] = { borderRadius: parseInt(ezFormTokens.rounded.md, 10) }

/**
 * WCAG 2.3.3 (Animation from Interactions, AAA) and the platform's own
 * `prefers-reduced-motion` signal. MUI's `transitions.create` cannot read a media
 * query, so this is one global rule rather than per-component `defaultProps`:
 * `!important` in a stylesheet outranks the inline `transition` MUI's `Collapse`,
 * `Fade` and `Grow` set on the element, so `Dialog`, the wizard's `StepContent`
 * and the ripple all become instant for a user who asked for that — and stay
 * animated for everyone else.
 */
const REDUCED_MOTION = {
  '@media (prefers-reduced-motion: reduce)': {
    '*, *::before, *::after': {
      transitionDuration: '0.01ms !important',
      transitionDelay: '0ms !important',
      animationDuration: '0.01ms !important',
      animationDelay: '0ms !important',
      animationIterationCount: '1 !important',
      scrollBehavior: 'auto !important',
    },
  },
} as const

// ---------------------------------------------------------------------------
// Components — the template's `customizations/*`, cut to what ez-form renders.
// ---------------------------------------------------------------------------

/** The template's flat, bordered input box, shared by MUI's `OutlinedInput` and MUI X's. */
const outlinedRoot = (theme: Theme) => ({
  padding: '8px 12px',
  color: theme.palette.text.primary,
  borderRadius: theme.shape.borderRadius,
  border: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.background.default,
  transition: 'border 120ms ease-in',
  '&:hover': { borderColor: gray[400] },
  ...theme.applyStyles('dark', { '&:hover': { borderColor: gray[500] } }),
})

const focusRing = (color: string) => ({
  outline: `${ezFormTokens.sizing['focus-ring']} solid ${alpha(color, 0.5)}`,
  outlineOffset: '2px',
})

const components: ThemeOptions['components'] = {
  MuiCssBaseline: {
    styleOverrides: REDUCED_MOTION,
  },

  // --- inputs ---------------------------------------------------------------

  MuiButtonBase: {
    // The template turns the ripple off everywhere; motion is the border/colour
    // change and the focus ring.
    defaultProps: { disableTouchRipple: true, disableRipple: true },
    styleOverrides: {
      root: ({ theme }) => ({
        boxSizing: 'border-box',
        transition: 'all 100ms ease-in',
        '&:focus-visible': focusRing(theme.palette.primary.main),
      }),
    },
  },
  MuiButton: {
    styleOverrides: {
      root: ({ theme }) => ({
        boxShadow: 'none',
        borderRadius: theme.shape.borderRadius,
        textTransform: 'none',
        variants: [
          {
            props: { size: 'small' },
            style: { height: ezFormTokens.sizing['control-sm'], padding: '8px 12px' },
          },
          { props: { size: 'medium' }, style: { height: ezFormTokens.sizing['control-md'] } },
          {
            props: { color: 'primary', variant: 'contained' },
            style: {
              color: 'white',
              backgroundColor: gray[900],
              backgroundImage: `linear-gradient(to bottom, ${gray[700]}, ${gray[800]})`,
              boxShadow: `inset 0 1px 0 ${gray[600]}, inset 0 -1px 0 1px hsl(220, 0%, 0%)`,
              border: `1px solid ${gray[700]}`,
              '&:hover': {
                backgroundImage: 'none',
                backgroundColor: gray[700],
                boxShadow: 'none',
              },
              '&:active': { backgroundColor: gray[800] },
              ...theme.applyStyles('dark', {
                color: 'black',
                backgroundColor: gray[50],
                backgroundImage: `linear-gradient(to bottom, ${gray[100]}, ${gray[50]})`,
                boxShadow: 'inset 0 -1px 0  hsl(220, 30%, 80%)',
                border: `1px solid ${gray[50]}`,
                '&:hover': {
                  backgroundImage: 'none',
                  backgroundColor: gray[300],
                  boxShadow: 'none',
                },
                '&:active': { backgroundColor: gray[400] },
              }),
            },
          },
          {
            props: { color: 'secondary', variant: 'contained' },
            style: {
              color: 'white',
              backgroundColor: brand[300],
              backgroundImage: `linear-gradient(to bottom, ${alpha(brand[400], 0.8)}, ${brand[500]})`,
              boxShadow: `inset 0 2px 0 ${alpha(brand[200], 0.2)}, inset 0 -2px 0 ${alpha(brand[700], 0.4)}`,
              border: `1px solid ${brand[500]}`,
              '&:hover': { backgroundColor: brand[700], boxShadow: 'none' },
              '&:active': { backgroundColor: brand[700], backgroundImage: 'none' },
            },
          },
          {
            props: { variant: 'outlined' },
            style: {
              color: theme.palette.text.primary,
              border: '1px solid',
              borderColor: gray[200],
              backgroundColor: alpha(gray[50], 0.3),
              '&:hover': { backgroundColor: gray[100], borderColor: gray[300] },
              '&:active': { backgroundColor: gray[200] },
              ...theme.applyStyles('dark', {
                backgroundColor: gray[800],
                borderColor: gray[700],
                '&:hover': { backgroundColor: gray[900], borderColor: gray[600] },
                '&:active': { backgroundColor: gray[900] },
              }),
            },
          },
          {
            props: { color: 'secondary', variant: 'outlined' },
            style: {
              color: brand[700],
              border: '1px solid',
              borderColor: brand[200],
              backgroundColor: brand[50],
              '&:hover': { backgroundColor: brand[100], borderColor: brand[400] },
              '&:active': { backgroundColor: alpha(brand[200], 0.7) },
              ...theme.applyStyles('dark', {
                color: brand[50],
                border: '1px solid',
                borderColor: brand[900],
                backgroundColor: alpha(brand[900], 0.3),
                '&:hover': { borderColor: brand[700], backgroundColor: alpha(brand[900], 0.6) },
                '&:active': { backgroundColor: alpha(brand[900], 0.5) },
              }),
            },
          },
          {
            props: { variant: 'text' },
            style: {
              color: gray[600],
              '&:hover': { backgroundColor: gray[100] },
              '&:active': { backgroundColor: gray[200] },
              ...theme.applyStyles('dark', {
                color: gray[50],
                '&:hover': { backgroundColor: gray[700] },
                '&:active': { backgroundColor: alpha(gray[700], 0.7) },
              }),
            },
          },
          {
            props: { color: 'secondary', variant: 'text' },
            style: {
              color: brand[700],
              '&:hover': { backgroundColor: alpha(brand[100], 0.5) },
              '&:active': { backgroundColor: alpha(brand[200], 0.7) },
              ...theme.applyStyles('dark', {
                color: brand[100],
                '&:hover': { backgroundColor: alpha(brand[900], 0.5) },
                '&:active': { backgroundColor: alpha(brand[900], 0.3) },
              }),
            },
          },
        ],
      }),
    },
  },
  MuiIconButton: {
    styleOverrides: {
      root: ({ theme }) => ({
        boxShadow: 'none',
        borderRadius: theme.shape.borderRadius,
        textTransform: 'none',
        fontWeight: theme.typography.fontWeightMedium,
        letterSpacing: 0,
        color: theme.palette.text.primary,
        border: '1px solid ',
        borderColor: gray[200],
        backgroundColor: alpha(gray[50], 0.3),
        '&:hover': { backgroundColor: gray[100], borderColor: gray[300] },
        '&:active': { backgroundColor: gray[200] },
        ...theme.applyStyles('dark', {
          backgroundColor: gray[800],
          borderColor: gray[700],
          '&:hover': { backgroundColor: gray[900], borderColor: gray[600] },
          '&:active': { backgroundColor: gray[900] },
        }),
        variants: [
          {
            props: { size: 'small' },
            style: {
              width: ezFormTokens.sizing['control-sm'],
              height: ezFormTokens.sizing['control-sm'],
              padding: '0.25rem',
              [`& .${svgIconClasses.root}`]: { fontSize: '1rem' },
            },
          },
          {
            props: { size: 'medium' },
            style: {
              width: ezFormTokens.sizing['control-md'],
              height: ezFormTokens.sizing['control-md'],
            },
          },
        ],
      }),
    },
  },
  MuiToggleButtonGroup: {
    styleOverrides: {
      root: ({ theme }) => ({
        borderRadius: ezFormTokens.rounded.lg,
        boxShadow: `0 4px 16px ${alpha(gray[400], 0.2)}`,
        '& .Mui-selected': { color: brand[500] },
        ...theme.applyStyles('dark', {
          '& .Mui-selected': { color: '#fff' },
          boxShadow: `0 4px 16px ${alpha(brand[700], 0.5)}`,
        }),
      }),
    },
  },
  MuiToggleButton: {
    styleOverrides: {
      root: ({ theme }) => ({
        padding: '12px 16px',
        textTransform: 'none',
        borderRadius: ezFormTokens.rounded.lg,
        fontWeight: 500,
        ...theme.applyStyles('dark', {
          color: gray[400],
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.5)',
          '&.Mui-selected': { color: brand[300] },
        }),
      }),
    },
  },
  // The template redraws the checkbox box and swaps its glyphs for icon elements
  // carrying `sx`; that needs JSX and a styling literal this file will not hold, so
  // Checkbox, Radio and Switch keep MUI's glyphs and take only the shared focus ring
  // (`MuiButtonBase` above) and the brand colour.
  MuiCheckbox: {
    styleOverrides: {
      root: {
        '&.Mui-focusVisible': focusRing(brand[500]),
        '&.Mui-checked': { color: brand[500] },
      },
    },
  },
  MuiRadio: {
    styleOverrides: {
      root: {
        '&.Mui-focusVisible': focusRing(brand[500]),
        '&.Mui-checked': { color: brand[500] },
      },
    },
  },
  MuiInputBase: {
    styleOverrides: {
      root: { border: 'none' },
      input: { '&::placeholder': { opacity: 0.7, color: gray[500] } },
    },
  },
  MuiOutlinedInput: {
    // Stacked labels, part 2: the border never opens a notch for the label, because
    // the label is no longer over the border.
    defaultProps: { notched: false },
    styleOverrides: {
      input: { padding: 0 },
      root: ({ theme }) => ({
        ...outlinedRoot(theme),
        [`&.${outlinedInputClasses.focused}`]: {
          outline: `${ezFormTokens.sizing['focus-ring']} solid ${alpha(brand[500], 0.5)}`,
          borderColor: brand[400],
        },
        [`&.${outlinedInputClasses.error}`]: { borderColor: theme.palette.error.main },
        variants: [
          // `minHeight`, not the template's `height`: a multiline `TextareaField` and
          // an `Autocomplete` wrapping chips must be free to grow.
          { props: { size: 'small' }, style: { minHeight: ezFormTokens.sizing['control-sm'] } },
          { props: { size: 'medium' }, style: { minHeight: ezFormTokens.sizing['control-md'] } },
        ],
      }),
      notchedOutline: { border: 'none' },
    },
  },
  MuiPickersOutlinedInput: {
    defaultProps: { notched: false },
    styleOverrides: {
      root: ({ theme }) => ({
        ...outlinedRoot(theme),
        minHeight: ezFormTokens.sizing['control-md'],
        '&.Mui-focused': {
          outline: `${ezFormTokens.sizing['focus-ring']} solid ${alpha(brand[500], 0.5)}`,
          borderColor: brand[400],
        },
        '&.Mui-error': { borderColor: theme.palette.error.main },
      }),
      // MUI X pads the sections container to the 56px outlined height; the root's own
      // 8px 12px above already sets the field's height.
      sectionsContainer: { padding: 0 },
      notchedOutline: { border: 'none' },
    },
  },
  // Autocomplete pads its input root itself (9px, plus room for the clear and popup
  // icons); with the outlined root already padded above, keep only its right-hand
  // reservation for the icons.
  MuiAutocomplete: {
    styleOverrides: {
      inputRoot: {
        [`&.${outlinedInputClasses.root}`]: { padding: '4px 39px 4px 12px' },
        [`&.${outlinedInputClasses.root} .${outlinedInputClasses.input}`]: { padding: '4px 0' },
      },
    },
  },
  MuiInputAdornment: {
    styleOverrides: {
      root: ({ theme }) => ({
        color: theme.palette.grey[500],
        // The bordered `IconButton` above is a standalone control; inside an input
        // (`PasswordField`'s reveal toggle, a picker's clear button) it is part of the
        // field and takes the field's border, not one of its own.
        '& .MuiIconButton-root': { border: 'none', backgroundColor: 'transparent' },
        ...theme.applyStyles('dark', { color: theme.palette.grey[400] }),
      }),
    },
  },
  MuiFormLabel: {
    styleOverrides: {
      root: ({ theme }) => ({
        ...theme.typography.caption,
        fontWeight: ezFormTokens.typography.label.fontWeight,
        color: theme.palette.text.primary,
        marginBottom: ezFormTokens.spacing.sm,
        '&.Mui-focused': { color: theme.palette.text.primary },
      }),
    },
  },
  // Stacked labels, part 1. MUI has no stacked variant (#9): `InputLabel` is always
  // absolutely positioned over the input and translated up on focus/fill. Rendering
  // it permanently shrunk, in normal flow, with no transform and no animation puts it
  // above the input for good. `MuiPickersTextField` renders MUI's own `InputLabel`,
  // so the pickers follow.
  MuiInputLabel: {
    defaultProps: { shrink: true, disableAnimation: true },
    styleOverrides: {
      root: {
        position: 'relative',
        transform: 'none',
        transformOrigin: 'top left',
        maxWidth: '100%',
        padding: 0,
        pointerEvents: 'auto',
        whiteSpace: 'normal',
      },
    },
  },
  // The helper text no longer lines up with a floating label's 14px inset.
  MuiFormHelperText: {
    styleOverrides: {
      root: { marginLeft: 0, marginRight: 0, marginTop: ezFormTokens.spacing.xs },
    },
  },
  MuiSelect: {
    styleOverrides: {
      select: { display: 'flex', alignItems: 'center' },
    },
  },
  MuiMenuItem: {
    styleOverrides: {
      root: ({ theme }) => ({
        borderRadius: theme.shape.borderRadius,
        padding: '6px 8px',
        [`&.${menuItemClasses.focusVisible}`]: { backgroundColor: 'transparent' },
        [`&.${menuItemClasses.selected}`]: {
          [`&.${menuItemClasses.focusVisible}`]: {
            backgroundColor: alpha(theme.palette.action.selected, 0.3),
          },
        },
      }),
    },
  },
  MuiMenu: {
    styleOverrides: {
      list: { padding: '8px' },
      paper: ({ theme }) => ({
        marginTop: '4px',
        borderRadius: theme.shape.borderRadius,
        border: `1px solid ${theme.palette.divider}`,
        backgroundImage: 'none',
        background: 'hsl(0, 0%, 100%)',
        boxShadow:
          'hsla(220, 30%, 5%, 0.07) 0px 4px 16px 0px, hsla(220, 25%, 10%, 0.07) 0px 8px 16px -5px',
        '& .Mui-selected': { backgroundColor: alpha(theme.palette.action.selected, 0.3) },
        ...theme.applyStyles('dark', {
          background: gray[900],
          boxShadow:
            'hsla(220, 30%, 5%, 0.7) 0px 4px 16px 0px, hsla(220, 25%, 10%, 0.8) 0px 8px 16px -5px',
        }),
      }),
    },
  },

  // --- data display -----------------------------------------------------------

  MuiChip: {
    defaultProps: { size: 'small' },
    styleOverrides: {
      root: ({ theme }) => ({
        border: '1px solid',
        borderRadius: ezFormTokens.rounded.pill,
        [`& .${chipClasses.label}`]: { fontWeight: 600 },
        variants: [
          {
            props: { color: 'default' },
            style: {
              borderColor: gray[200],
              backgroundColor: gray[100],
              [`& .${chipClasses.label}`]: { color: gray[500] },
              [`& .${chipClasses.icon}`]: { color: gray[500] },
              ...theme.applyStyles('dark', {
                borderColor: gray[700],
                backgroundColor: gray[800],
                [`& .${chipClasses.label}`]: { color: gray[300] },
                [`& .${chipClasses.icon}`]: { color: gray[300] },
              }),
            },
          },
          {
            props: { color: 'success' },
            style: {
              borderColor: green[200],
              backgroundColor: green[50],
              [`& .${chipClasses.label}`]: { color: green[500] },
              [`& .${chipClasses.icon}`]: { color: green[500] },
              ...theme.applyStyles('dark', {
                borderColor: green[800],
                backgroundColor: green[900],
                [`& .${chipClasses.label}`]: { color: green[300] },
                [`& .${chipClasses.icon}`]: { color: green[300] },
              }),
            },
          },
          {
            props: { color: 'error' },
            style: {
              borderColor: red[100],
              backgroundColor: red[50],
              [`& .${chipClasses.label}`]: { color: red[500] },
              [`& .${chipClasses.icon}`]: { color: red[500] },
              ...theme.applyStyles('dark', {
                borderColor: red[800],
                backgroundColor: red[900],
                [`& .${chipClasses.label}`]: { color: red[200] },
                [`& .${chipClasses.icon}`]: { color: red[300] },
              }),
            },
          },
          {
            props: { size: 'small' },
            style: {
              // The template caps a small chip at 20px; the delete icon ez-form renders is a
              // 24×24 target (`EzChipDeleteIcon`), so the chip must be at least that tall.
              minHeight: 24,
              [`& .${chipClasses.label}`]: { fontSize: theme.typography.caption.fontSize },
            },
          },
          {
            props: { size: 'medium' },
            style: { [`& .${chipClasses.label}`]: { fontSize: theme.typography.caption.fontSize } },
          },
        ],
      }),
    },
  },

  // --- feedback ---------------------------------------------------------------

  // The template's Alert is one orange banner. ez-form's `FormError` is an error
  // Alert and stories use success ones, so the severity keeps its own colour and
  // only the shape (radius, hairline border) is the template's.
  MuiAlert: {
    styleOverrides: {
      root: ({ theme }) => ({
        borderRadius: ezFormTokens.rounded.lg,
        border: '1px solid',
        variants: (['error', 'warning', 'info', 'success'] as const).map((severity) => ({
          props: { severity },
          style: {
            borderColor: alpha(theme.palette[severity].main, 0.5),
            color: theme.palette.text.primary,
          },
        })),
      }),
    },
  },
  MuiDialog: {
    styleOverrides: {
      paper: ({ theme }) => ({
        borderRadius: ezFormTokens.rounded.lg,
        border: '1px solid',
        borderColor: theme.palette.divider,
        backgroundImage: 'none',
      }),
    },
  },
  MuiLinearProgress: {
    styleOverrides: {
      root: ({ theme }) => ({
        height: 8,
        borderRadius: 8,
        backgroundColor: gray[200],
        ...theme.applyStyles('dark', { backgroundColor: gray[800] }),
      }),
    },
  },

  // --- surfaces ---------------------------------------------------------------

  MuiPaper: {
    defaultProps: { elevation: 0 },
  },

  // --- navigation (wizard stepper) ----------------------------------------------

  MuiStepConnector: {
    styleOverrides: {
      line: ({ theme }) => ({
        borderTop: '1px solid',
        borderColor: theme.palette.divider,
        flex: 1,
        borderRadius: '99px',
      }),
    },
  },
  MuiStepIcon: {
    styleOverrides: {
      root: ({ theme }) => ({
        color: 'transparent',
        border: `1px solid ${gray[400]}`,
        width: 12,
        height: 12,
        borderRadius: '50%',
        '& text': { display: 'none' },
        '&.Mui-active': { border: 'none', color: theme.palette.primary.main },
        '&.Mui-completed': { border: 'none', color: theme.palette.success.main },
        ...theme.applyStyles('dark', {
          border: `1px solid ${gray[700]}`,
          '&.Mui-active': { border: 'none', color: theme.palette.primary.light },
          '&.Mui-completed': { border: 'none', color: theme.palette.success.light },
        }),
      }),
    },
  },
  MuiStepLabel: {
    styleOverrides: {
      label: ({ theme }) => ({
        '&.Mui-completed': { opacity: 0.6, ...theme.applyStyles('dark', { opacity: 0.5 }) },
      }),
    },
  },

  // --- ez-form's own slots --------------------------------------------------------

  // #38: the label and the Edit button share a row with no gap by default.
  EzReadOnlyField: {
    styleOverrides: {
      header: { gap: ezFormTokens.spacing.sm },
    },
  },
}

// ---------------------------------------------------------------------------
// Public surface
// ---------------------------------------------------------------------------

/**
 * The preset as plain `ThemeOptions`: spread it into your own `createTheme` call
 * when you want full control over the merge, e.g.
 * `createTheme({ ...ezFormThemeOptions, defaultColorScheme: 'dark' })`.
 */
export const ezFormThemeOptions: ThemeOptions = {
  colorSchemes,
  typography,
  shape,
  components,
}

type ColorSchemes = NonNullable<ThemeOptions['colorSchemes']>
type SchemeName = keyof ColorSchemes

/**
 * Build a theme from the preset plus your own options.
 *
 * With no scheme named, the theme carries both colour schemes and MUI's
 * `ThemeProvider` follows the OS (`prefers-color-scheme`) and `useColorScheme`.
 * Naming one — `defaultColorScheme: 'dark'`, or the `palette: { mode: 'dark' }`
 * idiom — pins the theme to that scheme alone.
 *
 * MUI computes a palette (`light`/`dark`/`contrastText`, the `mode`) only from
 * `createTheme`'s first argument, so the keys that feed that computation —
 * `colorSchemes`, `palette` (the `{ mode: 'dark' }` idiom included),
 * `defaultColorScheme`, `cssVariables` — are merged into the preset *before* it is
 * built: your scheme's palette keys win over the preset's, one palette key at a time
 * (`primary: { main }` replaces the preset's primary wholesale, so MUI derives its
 * shades from your `main`). `typography` and `shape` merge one key deep the same
 * way. Everything else (`components`, `spacing`, `transitions`, …) is deep-merged
 * into the built theme through `createTheme(options, ...args)`, so
 * `components.MuiButton.styleOverrides.root` in your options replaces the preset's
 * `root` and leaves the preset's other `MuiButton` keys intact.
 */
export function createEzFormTheme(options: ThemeOptions = {}): Theme {
  const {
    colorSchemes: schemesIn,
    palette,
    defaultColorScheme: defaultIn,
    cssVariables,
    typography: typographyIn,
    shape: shapeIn,
    ...rest
  } = options
  const { mode, ...paletteRest } = palette ?? {}
  const defaultColorScheme = defaultIn ?? mode ?? 'light'

  const merged: ColorSchemes = { ...colorSchemes }
  const overlays: Partial<Record<SchemeName, ColorSchemes[SchemeName]>> = { ...schemesIn }
  if (palette) {
    const own = overlays[defaultColorScheme]
    overlays[defaultColorScheme] = {
      ...(typeof own === 'object' ? own : {}),
      palette: { ...(typeof own === 'object' ? own.palette : {}), ...paletteRest },
    }
  }
  for (const name of Object.keys(overlays) as SchemeName[]) {
    const overlay = overlays[name]
    const base = merged[name]
    if (overlay === undefined || typeof overlay === 'boolean') {
      if (overlay !== undefined) merged[name] = overlay
      continue
    }
    const basePalette = typeof base === 'object' ? base.palette : undefined
    // `mode` last, for the same reason the preset's schemes carry it (see above).
    merged[name] = { ...overlay, palette: { ...basePalette, ...overlay.palette, mode: name } }
  }

  // A theme that carries `colorSchemes` makes MUI's `ThemeProvider` a colour-scheme
  // provider: the scheme it renders comes from its own `defaultMode` (`'system'`,
  // i.e. `prefers-color-scheme`, whenever both schemes exist) and `useColorScheme`,
  // not from the theme's `defaultColorScheme`. So: no scheme named → both schemes
  // ship and the app follows the OS; a scheme named → only that scheme ships, and
  // the provider has nothing else to pick, so the theme is pinned to it.
  const pinned = defaultIn ?? mode
  const schemes = pinned ? { [pinned]: merged[pinned] } : merged

  return createTheme(
    {
      ...ezFormThemeOptions,
      colorSchemes: schemes,
      defaultColorScheme,
      ...(cssVariables !== undefined && { cssVariables }),
      typography:
        typeof typographyIn === 'function' ? typographyIn : { ...typography, ...typographyIn },
      shape: { ...shape, ...shapeIn },
    },
    rest,
  )
}
