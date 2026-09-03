---
version: alpha
name: ez-form
description: "The optional look of ez-form forms: a quiet, flat, blue-on-neutral system with stacked labels, hairline borders, an 8px radius and a soft focus ring, in a light and a dark scheme. Adapted from MUI's dashboard template. Components ship unstyled; this file is the taste, and src/theme/ezFormTheme.ts is its code form."

colors:
  brand:
    50: hsl(210, 100%, 95%)
    100: hsl(210, 100%, 92%)
    200: hsl(210, 100%, 80%)
    300: hsl(210, 100%, 65%)
    400: hsl(210, 98%, 48%)
    500: hsl(210, 98%, 42%)
    600: hsl(210, 98%, 55%)
    700: hsl(210, 100%, 35%)
    800: hsl(210, 100%, 16%)
    900: hsl(210, 100%, 21%)
  gray:
    50: hsl(220, 35%, 97%)
    100: hsl(220, 30%, 94%)
    200: hsl(220, 20%, 88%)
    300: hsl(220, 20%, 80%)
    400: hsl(220, 20%, 65%)
    500: hsl(220, 20%, 42%)
    600: hsl(220, 20%, 35%)
    700: hsl(220, 20%, 25%)
    800: hsl(220, 30%, 6%)
    900: hsl(220, 35%, 3%)
  green:
    50: hsl(120, 80%, 98%)
    100: hsl(120, 75%, 94%)
    200: hsl(120, 75%, 87%)
    300: hsl(120, 61%, 77%)
    400: hsl(120, 44%, 53%)
    500: hsl(120, 59%, 30%)
    600: hsl(120, 70%, 25%)
    700: hsl(120, 75%, 16%)
    800: hsl(120, 84%, 10%)
    900: hsl(120, 87%, 6%)
  orange:
    50: hsl(45, 100%, 97%)
    100: hsl(45, 92%, 90%)
    200: hsl(45, 94%, 80%)
    300: hsl(45, 90%, 65%)
    400: hsl(45, 90%, 40%)
    500: hsl(45, 90%, 35%)
    600: hsl(45, 91%, 25%)
    700: hsl(45, 94%, 20%)
    800: hsl(45, 95%, 16%)
    900: hsl(45, 93%, 12%)
  red:
    50: hsl(0, 100%, 97%)
    100: hsl(0, 92%, 90%)
    200: hsl(0, 94%, 80%)
    300: hsl(0, 90%, 65%)
    400: hsl(0, 90%, 40%)
    500: hsl(0, 90%, 30%)
    600: hsl(0, 91%, 25%)
    700: hsl(0, 94%, 18%)
    800: hsl(0, 95%, 12%)
    900: hsl(0, 93%, 6%)
  light:
    canvas: hsl(0, 0%, 99%)
    surface: hsl(220, 35%, 97%)
    ink: hsl(220, 30%, 6%)
    ink-muted: hsl(220, 20%, 35%)
    hairline: hsla(220, 20%, 80%, 0.4)
    primary: hsl(210, 98%, 48%)
    on-primary: hsl(210, 100%, 95%)
    error: hsl(0, 90%, 40%)
    success: hsl(120, 44%, 53%)
    warning: hsl(45, 90%, 40%)
  dark:
    canvas: hsl(220, 35%, 3%)
    surface: hsl(220, 30%, 7%)
    ink: hsl(0, 0%, 100%)
    ink-muted: hsl(220, 20%, 65%)
    hairline: hsla(220, 20%, 25%, 0.6)
    primary: hsl(210, 98%, 48%)
    on-primary: hsl(210, 100%, 95%)
    error: hsl(0, 90%, 65%)
    success: hsl(120, 59%, 30%)
    warning: hsl(45, 90%, 35%)

typography:
  fontFamily: Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif
  h1:
    fontSize: 48px
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: -0.5px
  h2:
    fontSize: 36px
    fontWeight: 600
    lineHeight: 1.2
  h3:
    fontSize: 30px
    fontWeight: 400
    lineHeight: 1.2
  h4:
    fontSize: 24px
    fontWeight: 600
    lineHeight: 1.5
  h5:
    fontSize: 20px
    fontWeight: 600
  h6:
    fontSize: 18px
    fontWeight: 600
  subtitle1:
    fontSize: 18px
  subtitle2:
    fontSize: 14px
    fontWeight: 500
  body1:
    fontSize: 14px
  body2:
    fontSize: 14px
    fontWeight: 400
  caption:
    fontSize: 12px
    fontWeight: 400
  label:
    fontSize: 12px
    fontWeight: 500

rounded:
  sm: 5px
  md: 8px
  lg: 10px
  pill: 999px

spacing:
  unit: 8px
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px

sizing:
  control-sm: 36px
  control-md: 40px
  focus-ring: 3px
---

## Overview

ez-form's components **ship unstyled**: nothing in `src/` carries a colour, a
radius or a padding a theme cannot override (see `docs/PHILOSOPHY.md`, rule 2).
This file is the one place that holds an opinion about how a form built with them
should look, and `src/theme/ezFormTheme.ts` — `createEzFormTheme()` /
`ezFormThemeOptions` — is its code form. The token block above and that file's
`ezFormTokens` are kept identical by `src/theme/ezFormTheme.test.tsx`; change one,
change the other.

The look is MUI's dashboard template
(`docs/data/material/getting-started/templates/shared-theme`, MIT), adapted for a
form library: quiet, flat, one blue, neutral buttons, hairline borders, a soft focus
ring, no ripple, no shadows except on floating surfaces. Two things the template
does not do that this system insists on: **labels are stacked above their inputs**
(no floating label, no notch, no label motion) and **motion respects
`prefers-reduced-motion`** (WCAG 2.3.3).

## Colors

### Roles

| Role                | Light                   | Dark                    | Used for                                            |
| ------------------- | ----------------------- | ----------------------- | --------------------------------------------------- |
| `canvas`            | `hsl(0, 0%, 99%)`       | `hsl(220, 35%, 3%)`     | page and input background                           |
| `surface`           | `hsl(220, 35%, 97%)`    | `hsl(220, 30%, 7%)`     | paper: dialogs, menus, cards                        |
| `ink`               | `gray.800`              | white                   | body text, labels, values                           |
| `ink-muted`         | `gray.600`              | `gray.400`              | helper text, secondary labels, placeholders (0.7 α) |
| `hairline`          | `gray.300` at 0.4 α     | `gray.700` at 0.6 α     | every border: inputs, dialogs, menus, dividers      |
| `primary`           | `brand.400`             | `brand.400`             | focus ring, checked states, active step, links      |
| `error` / `success` | `red.400` / `green.400` | `red.300` / `green.500` | validation, chips, step-completed dot               |

The scales (`brand`, `gray`, `green`, `orange`, `red`) are the template's. Tinted
backgrounds are always the scale's `50`/`100` in light and `800`/`900` in dark,
with the matching `200`/`700` border. `alpha()` is how a colour gets softer —
never a second, lighter colour.

### Contrast

Text on either surface is at least 4.5:1 in both schemes; borders and the focus ring
at least 3:1. The one deviation from the template is dark `error`: the template's
`red.500` reads at 2.2:1 on the dark canvas and `error` is the colour of every error
helper text, so it is `red.300` (6:1) here. The test asserts these numbers.

## Typography

Inter if the app loads it, otherwise the system sans — the preset ships no font.
Body copy is 14px; headings are tight (1.2) and semibold (600); the field label is
12px at weight 500 in `ink`, not muted — the label is the primary affordance of a
stacked field and must not read as helper text.

| Style     | Size    | Weight | Line height | Use                                     |
| --------- | ------- | ------ | ----------- | --------------------------------------- |
| `h4`      | 24px    | 600    | 1.5         | form title (`Form` `title`)             |
| `h5`/`h6` | 20/18px | 600    | —           | section legends, dialog titles          |
| `body1`   | 14px    | 400    | —           | inputs, values, buttons                 |
| `label`   | 12px    | 500    | —           | field labels, legends                   |
| `caption` | 12px    | 400    | —           | helper text, counters, read-only labels |

No uppercase transforms anywhere; buttons are sentence case.

## Layout

The spacing unit is 8px. Inside a field: 8px between label and control, 4px between
control and helper text. Between fields: 16px (`Stack spacing={2}`); between
sections: 24px. Controls are 40px tall (`control-md`), 36px in `size="small"`, with
12px horizontal padding; a multiline field and an `Autocomplete` wrapping chips grow
from that minimum rather than being clipped to it. Forms are single-column by
default; `AddressField` is the one grid (street / street2 / city · state · zip).

## Elevation & Depth

Flat by default: `Paper` is elevation 0 and every surface is separated by a
hairline border, not a shadow. Only floating surfaces cast one — the menu and the
dialog use the template's soft double shadow (`0 4px 16px` + `0 8px 16px -5px` at
0.07 α, 0.7/0.8 α in dark). Depth of an interactive control is a 1px inset
highlight, never a drop shadow.

## Shapes

`rounded.md` (8px) is the radius of everything: inputs, buttons, menu items, step
connectors. Menus, dialogs and alerts use `rounded.lg` (10px). Chips are pills.
Nothing is square, nothing is a circle except the 12px step dot.

## Components

### Inputs (TextField, Select, Autocomplete, NumberField, pickers)

- Stacked label: `InputLabel` permanently shrunk, in normal flow, no transform, no
  animation; the outline never notches (`notched: false` on `OutlinedInput` and
  `PickersOutlinedInput`).
- Box: `canvas` background, 1px `hairline` border, `rounded.md`, 8px 12px padding,
  `minHeight` 40px. Hover: `gray.400` border. Focus: `brand.400` border plus a 3px
  ring of `brand.500` at 0.5 α. Error: `error` border.
- Helper text sits flush left under the box (no 14px floating-label inset), 4px
  below it.
- Placeholders are `gray.500` at 0.7 α.

### Choice controls (Checkbox, Radio, Switch, ToggleButtonGroup)

MUI's own glyphs; `brand.500` when checked; the shared 3px focus ring; no ripple.
Toggle buttons are `rounded.lg` with weight 500, the group under a soft shadow.

### Buttons

- No ripple, no uppercase, no shadow, `rounded.md`, 40px tall (36px small).
- `contained` primary is **neutral**, not blue: a `gray.700`→`gray.800` gradient
  with white text in light, `gray.100`→`gray.50` with black text in dark. Blue is
  reserved for `color="secondary"`.
- `outlined` is `ink` on `gray.50` at 0.3 α with a `gray.200` border; `text` is
  `gray.600`. Both lift to `gray.100` on hover.
- Icon buttons are bordered squares of the same size scale.

### Chips

Small by default, pill-shaped, 600-weight label, tinted by colour (`default`,
`success`, `error`) with the scale's `50`/`100` background and `100`/`200` border.
Never shorter than 24px: the delete icon ez-form renders is a 24×24 target.

### Feedback (Alert, Dialog, LinearProgress)

Alerts keep MUI's severity colour but take a `rounded.lg` corner and a 1px border of
that colour at 0.5 α; text is `ink`. Dialog paper is `rounded.lg` with a `hairline`
border. Progress bars are 8px tall and pill-ended.

### Wizard stepper

12px dots, no numbers: `gray.400` outline for upcoming steps, `primary` filled for
the active step, `success` filled for completed ones; 1px `hairline` connector;
completed labels at 0.6 opacity.

### ReadOnlyField

Label and Edit button share a row with an 8px gap (`spacing.sm`).

## Motion

Transitions are short (100–120ms, ease-in) and limited to border and background
colour. Under `@media (prefers-reduced-motion: reduce)` every transition and
animation collapses to 0.01ms — dialogs appear, step content expands, rather than
animating. This is a global rule in `MuiCssBaseline`, so it needs `<CssBaseline />`
in the tree.

## Do's and Don'ts

### Do

- Put the label above the input; let helper text sit under it, flush left.
- Use `alpha()` on a scale colour for a tint; use the scale's `50`/`900` for a
  tinted background.
- Keep the contained button neutral. A form has one primary action and it should
  not shout.
- Reach every default through `theme.components` — `Ez*` keys for ez-form's own
  parts, `Mui*` for MUI's.

### Don't

- Don't float a label, notch an outline, or animate a label.
- Don't add a shadow to a control or a card; a hairline border is the separation.
- Don't uppercase button text or use the ripple.
- Don't put a colour, radius or padding in `src/`; it goes in
  `src/theme/ezFormTheme.ts` (and here).
- Don't change a token in one file without the other; the test will fail.

## Responsive Behavior

Fields are `fullWidth` in their column; `AddressField` collapses to one column
below the `sm` breakpoint. Every interactive target is at least 24×24 px (WCAG
2.5.8); the 40px control height is the touch default, `size="small"` (36px) is for
dense desktop UIs only.

## Agent Prompt Guide

"Use ez-form's preset: `createEzFormTheme()` inside a `ThemeProvider` with
`CssBaseline`. Labels stacked above inputs, hairline `gray.300@0.4` borders, 8px
radius, 40px controls, neutral gray contained buttons, blue `brand.400` only for
focus/checked/active. Dark scheme via `defaultColorScheme: 'dark'` or
`palette: { mode: 'dark' }`. Override through `theme.components.Ez*` / `Mui*`, never
`sx` in library code."
