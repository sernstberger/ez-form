import { useDefaultProps } from '@mui/material/DefaultPropsProvider'
import generateUtilityClasses from '@mui/material/generateUtilityClasses'
import LinearProgress, { type LinearProgressProps } from '@mui/material/LinearProgress'
import { styled } from '@mui/material/styles'
import Typography, { type TypographyProps } from '@mui/material/Typography'
import { useWatch } from 'react-hook-form'
import { useEzFormContext } from '../../useEzFormContext'
import { scorePassword } from './score'

export type PasswordStrengthScore = 0 | 1 | 2 | 3 | 4

const DEFAULT_LABELS = [
  'Very weak',
  'Weak',
  'Fair',
  'Strong',
  'Very strong',
] as const satisfies readonly [string, string, string, string, string]

// error/error/warning/info/success — MUI palette keys only, so a theme that
// redefines `error`/`warning`/`info`/`success` reaches this without any
// literal color the theme can't override.
const COLOR_BY_SCORE = [
  'error',
  'error',
  'warning',
  'info',
  'success',
] as const satisfies readonly LinearProgressProps['color'][]

export interface PasswordStrengthProps {
  /** Form path to watch. Read with `useWatch`; never registered, never validated. */
  name: string
  /** Defaults to a small built-in heuristic (length, character classes, repeats). */
  score?: (password: string) => PasswordStrengthScore
  /** Defaults to `['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong']`. */
  labels?: readonly [string, string, string, string, string]
  slotProps?: {
    root?: React.ComponentProps<'div'>
    bar?: LinearProgressProps
    label?: TypographyProps
  }
}

export const passwordStrengthClasses = generateUtilityClasses('EzPasswordStrength', [
  'root',
  'bar',
  'label',
])

const PasswordStrengthRoot = styled('div', { name: 'EzPasswordStrength', slot: 'Root' })({})
const PasswordStrengthBar = styled(LinearProgress, {
  name: 'EzPasswordStrength',
  slot: 'Bar',
})({})
const PasswordStrengthLabel = styled(Typography, {
  name: 'EzPasswordStrength',
  slot: 'Label',
})({})

/**
 * A strength meter bound to a password field's live value — never registers
 * or validates. `LinearProgress` under the hood, but exposed as an ARIA
 * `meter` (a progress bar communicates "how much work is done", a meter
 * communicates "how good is this value", which is the read here) with its
 * own `aria-value*`/`role` overriding MUI's `progressbar` defaults, plus a
 * visible label in an `aria-live="polite"` region so screen reader users
 * hear the tier change as they type. `aria-label="Password strength"` is a
 * default only — `slotProps.bar['aria-label']` (or a theme's
 * `defaultProps.slotProps.bar`) can localise or replace it; `role` and
 * `aria-value*` stay fixed, since those carry the meter's actual semantics.
 */
export function PasswordStrength(inProps: PasswordStrengthProps) {
  const props = useDefaultProps({ props: inProps, name: 'EzPasswordStrength' })
  const { name, score = scorePassword, labels = DEFAULT_LABELS, slotProps } = props
  useEzFormContext('PasswordStrength')
  const value: unknown = useWatch({ name })
  const password = typeof value === 'string' ? value : ''

  const isEmpty = password.length === 0
  const level = isEmpty ? 0 : score(password)
  const label = isEmpty ? '' : labels[level]

  return (
    <PasswordStrengthRoot
      {...slotProps?.root}
      className={`${passwordStrengthClasses.root}${slotProps?.root?.className ? ` ${slotProps.root.className}` : ''}`}
    >
      <PasswordStrengthBar
        variant="determinate"
        value={(level / 4) * 100}
        color={COLOR_BY_SCORE[level]}
        aria-label="Password strength"
        {...slotProps?.bar}
        role="meter"
        aria-valuemin={0}
        aria-valuemax={4}
        aria-valuenow={level}
        aria-valuetext={isEmpty ? undefined : label}
        className={`${passwordStrengthClasses.bar}${slotProps?.bar?.className ? ` ${slotProps.bar.className}` : ''}`}
      />
      <PasswordStrengthLabel
        variant="caption"
        aria-live="polite"
        {...slotProps?.label}
        className={`${passwordStrengthClasses.label}${slotProps?.label?.className ? ` ${slotProps.label.className}` : ''}`}
      >
        {label}
      </PasswordStrengthLabel>
    </PasswordStrengthRoot>
  )
}
