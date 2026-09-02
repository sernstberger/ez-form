import type { ReactNode } from 'react'
import type { IconButtonProps } from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import { mergeSlotProps } from '@mui/material/utils'
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined'
import VisibilityOffOutlined from '@mui/icons-material/VisibilityOffOutlined'

/**
 * The icons a reveal toggle shows in its two states. Every field with a
 * toggle exposes this as a prop, defaulted through `useDefaultProps` so
 * `theme.components.Ez<Name>.defaultProps.icons` can swap them app-wide.
 */
export interface RevealIcons {
  show?: ReactNode
  hide?: ReactNode
}

export interface RevealToggleProps {
  /** Whether the value is currently visible: drives the label, `aria-pressed` and the icon. */
  revealed: boolean
  onToggle: () => void
  /** Accessible name while hidden, e.g. `'Show password'`. */
  showLabel: string
  /** Accessible name while revealed, e.g. `'Hide password'`. */
  hideLabel: string
  disabled?: boolean
  /** The owning field's `<name>Classes.toggle` hook. */
  className: string
  icons?: RevealIcons
  /** The owning field's `slotProps.toggle`, merged over the defaults below. */
  slotProps?: IconButtonProps
  /**
   * The owning field's styled `IconButton` slot — `styled(IconButton, { name:
   * 'Ez<Name>', slot: 'Toggle' })` — so each field keeps its own
   * `styleOverrides.toggle` key rather than sharing one.
   */
  component: React.ComponentType<IconButtonProps<'button'>>
}

/**
 * The show/hide adornment shared by `PasswordField` and `SsnField`. It owns
 * only the toggle's markup and its ARIA contract (`type="button"` so it never
 * submits, `aria-pressed` so the state is announced, an accessible name that
 * changes with the state); the reveal *state* stays in the field, because that
 * is what decides the input's `type` and, for `SsnField`, its displayed text.
 *
 * The styled slot arrives as `component` rather than being defined here: each
 * field registers its own `Ez<Name>` theme keys, so a single shared styled
 * component would collapse two `styleOverrides.toggle` keys into one.
 */
export function RevealToggle({
  revealed,
  onToggle,
  showLabel,
  hideLabel,
  disabled,
  className,
  icons,
  slotProps,
  component: Toggle,
}: RevealToggleProps) {
  return (
    <InputAdornment position="end">
      <Toggle
        {...mergeSlotProps(slotProps, { className })}
        type="button"
        aria-label={revealed ? hideLabel : showLabel}
        aria-pressed={revealed}
        edge="end"
        disabled={disabled}
        onClick={(e) => {
          onToggle()
          slotProps?.onClick?.(e)
        }}
      >
        {revealed
          ? (icons?.hide ?? <VisibilityOffOutlined />)
          : (icons?.show ?? <VisibilityOutlined />)}
      </Toggle>
    </InputAdornment>
  )
}
