import { useId, type ReactNode } from 'react'
import Button, { type ButtonProps } from '@mui/material/Button'
import { useDefaultProps } from '@mui/material/DefaultPropsProvider'
import generateUtilityClasses from '@mui/material/generateUtilityClasses'
import { styled } from '@mui/material/styles'
import Typography, { type TypographyProps } from '@mui/material/Typography'
import { useWatch } from 'react-hook-form'
import { useEzFormContext } from '../../useEzFormContext'
import { useOptionalWizard } from '../../Wizard/useWizard'
import type { Option } from '../Option'
import { humanize } from './humanize'

interface ReadOnlyFieldBaseProps {
  /** Show the matching option label(s) instead of the raw value. */
  options?: readonly Option[]
  /** Custom rendering; wins over every default. */
  format?: (value: unknown) => ReactNode
  /** Shown for `'' | null | undefined | []`. Default `—`. */
  empty?: ReactNode
  /** Inside a `Wizard`: renders an Edit button that goes to this step. Ignored outside one. */
  editStep?: string
  slotProps?: {
    root?: React.ComponentProps<'div'>
    header?: React.ComponentProps<'div'>
    label?: TypographyProps
    value?: TypographyProps
    edit?: ButtonProps
  }
}

export type ReadOnlyFieldProps = ReadOnlyFieldBaseProps &
  (
    | {
        /** Form path to display. Read with `useWatch`; never registered, never validated. */
        name: string
        value?: never
        /** Defaults to a humanized `name` (`cardNumber` → `Card number`). */
        label?: ReactNode
      }
    | {
        name?: never
        /** An already-computed value to display, e.g. a caller's own `useWatch`-derived total. Wins over `name`; when set, the field never calls `useWatch` itself. */
        value: unknown
        /** Required: there is no `name` to humanize into a default. */
        label: ReactNode
      }
  )

const isEmpty = (v: unknown) =>
  v === '' || v === null || v === undefined || (Array.isArray(v) && v.length === 0)

function display(value: unknown, options?: readonly Option[]): ReactNode {
  if (Array.isArray(value)) return value.map((v) => display(v, options)).join(', ')
  if (options) {
    const match = options.find((o) => o.value === value)
    if (match) return match.label
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (value instanceof Date) return value.toLocaleString()
  if (typeof File !== 'undefined' && value instanceof File) return value.name
  return String(value)
}

export const readOnlyFieldClasses = generateUtilityClasses('EzReadOnlyField', [
  'root',
  'header',
  'label',
  'value',
  'edit',
])

const ReadOnlyFieldRoot = styled('div', { name: 'EzReadOnlyField', slot: 'Root' })({})
// The label and the Edit button sit in one row, label leading, Edit trailing.
// This layout is the component's minimum — it can't work without it — so it
// lives on the styled slot's default style block, still overridable via
// `theme.components.EzReadOnlyField.styleOverrides.header`.
const ReadOnlyFieldHeader = styled('div', { name: 'EzReadOnlyField', slot: 'Header' })({
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'baseline',
  justifyContent: 'space-between',
})
const ReadOnlyFieldLabel = styled(Typography, { name: 'EzReadOnlyField', slot: 'Label' })({})
const ReadOnlyFieldValue = styled(Typography, { name: 'EzReadOnlyField', slot: 'Value' })({})
const ReadOnlyFieldEdit = styled(Button, { name: 'EzReadOnlyField', slot: 'Edit' })({})

/**
 * A value from the form, read-only: small secondary label above, the value
 * below. For review / summary steps. Typography, not a disabled TextField,
 * so the value keeps full contrast.
 */
export function ReadOnlyField(inProps: ReadOnlyFieldProps) {
  const props = useDefaultProps({ props: inProps, name: 'EzReadOnlyField' })
  const { name, label, options, format, empty = '—', editStep, slotProps } = props
  useEzFormContext('ReadOnlyField')
  // `value` wins when given; the hook itself must still run every render (rules of
  // hooks), so it's disabled rather than skipped, and `name` falls back to a dummy
  // path so `useWatch` never subscribes to a real field while a `value` is in use.
  const hasValue = 'value' in props && props.value !== undefined
  const watched = useWatch({ name: name ?? '__ez_readonly_unused__', disabled: hasValue })
  const value = hasValue ? props.value : watched
  const wizard = useOptionalWizard()
  const labelId = useId()
  const text = label ?? (name !== undefined ? humanize(name) : undefined)
  const content = format ? format(value) : isEmpty(value) ? empty : display(value, options)
  // In `page` layout every step (and so every field) is already on screen at once, so
  // `wizard.go()` has nothing to do there — it's a no-op that always resolves `false`. An
  // Edit button that clicks to nowhere is a focusable dead control (WCAG 2.1.1/4.1.2), so
  // it's hidden rather than disabled: disabling would still leave a control whose purpose
  // (jump to the field) is meaningless when the field is already visible right there.
  const editable = editStep !== undefined && wizard !== null && wizard.layout !== 'page'

  const labelProps = { variant: 'caption', color: 'text.secondary', ...slotProps?.label } as const
  const valueProps = { variant: 'body1', ...slotProps?.value } as const

  return (
    <ReadOnlyFieldRoot
      {...slotProps?.root}
      aria-labelledby={labelId}
      className={`${readOnlyFieldClasses.root}${slotProps?.root?.className ? ` ${slotProps.root.className}` : ''}`}
    >
      <ReadOnlyFieldHeader
        {...slotProps?.header}
        className={`${readOnlyFieldClasses.header}${slotProps?.header?.className ? ` ${slotProps.header.className}` : ''}`}
      >
        <ReadOnlyFieldLabel
          id={labelId}
          {...labelProps}
          className={`${readOnlyFieldClasses.label}${labelProps.className ? ` ${labelProps.className}` : ''}`}
        >
          {text}
        </ReadOnlyFieldLabel>
        {editable && (
          <ReadOnlyFieldEdit
            type="button"
            onClick={() => void wizard.go(editStep)}
            aria-label={`Edit ${typeof text === 'string' ? text : (name ?? 'value')}`}
            {...slotProps?.edit}
            className={`${readOnlyFieldClasses.edit}${slotProps?.edit?.className ? ` ${slotProps.edit.className}` : ''}`}
          >
            Edit
          </ReadOnlyFieldEdit>
        )}
      </ReadOnlyFieldHeader>
      <ReadOnlyFieldValue
        {...valueProps}
        className={`${readOnlyFieldClasses.value}${valueProps.className ? ` ${valueProps.className}` : ''}`}
      >
        {content}
      </ReadOnlyFieldValue>
    </ReadOnlyFieldRoot>
  )
}
