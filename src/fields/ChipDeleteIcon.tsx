import Cancel from '@mui/icons-material/Cancel'
import type { SvgIconProps } from '@mui/material/SvgIcon'
import { useDefaultProps } from '@mui/material/DefaultPropsProvider'
import generateUtilityClasses from '@mui/material/generateUtilityClasses'
import { styled } from '@mui/material/styles'
import { cx } from '../cx'

export const chipDeleteIconClasses = generateUtilityClasses('EzChipDeleteIcon', ['root'])

export type ChipDeleteIconProps = Omit<SvgIconProps, 'role' | 'aria-label' | 'aria-hidden'> & {
  /** What the chip shows — the option label, the file name, the address. */
  label: string
  /** The accessible name, built from `label`. Default `` `Remove ${label}` ``. */
  removeLabel?: (label: string) => string
}

// MUI's Chip delete icon renders at `fontSize: 22` with no hit-area padding —
// under the 24×24 CSS px target (WCAG 2.5.8). This is the functional minimum,
// still overridable via `theme.components.EzChipDeleteIcon.styleOverrides.root`;
// `boxSizing: 'content-box'` keeps the glyph itself unchanged, and Chip already
// centers the icon.
const ChipDeleteIconRoot = styled(Cancel, { name: 'EzChipDeleteIcon', slot: 'Root' })({
  minWidth: 24,
  minHeight: 24,
  boxSizing: 'content-box',
})

/**
 * The delete icon every chip in this library renders: MUI's own glyph, named
 * `Remove <label>` and sized to a 24×24 target. Chip clones it with its own
 * `onClick` and class; MUI's default icon has no name, and SvgIcon defaults
 * `aria-hidden` to true unless overridden here. Without a name the only way to
 * drop a chip by keyboard is Backspace, and a screen reader says nothing about
 * what the icon would remove.
 */
export function ChipDeleteIcon(inProps: ChipDeleteIconProps) {
  const {
    label,
    removeLabel = (l: string) => `Remove ${l}`,
    className,
    ...rest
  } = useDefaultProps({ props: inProps, name: 'EzChipDeleteIcon' })
  return (
    <ChipDeleteIconRoot
      {...rest}
      role="button"
      aria-label={removeLabel(label)}
      aria-hidden={undefined}
      className={cx(chipDeleteIconClasses.root, className)}
    />
  )
}
