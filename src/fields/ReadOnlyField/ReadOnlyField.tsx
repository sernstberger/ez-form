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

export interface ReadOnlyFieldProps {
  /** Form path to display. Read with `useWatch`; never registered, never validated. */
  name: string
  /** Defaults to a humanized `name` (`cardNumber` → `Card number`). */
  label?: ReactNode
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
  const value = useWatch({ name })
  const wizard = useOptionalWizard()
  const labelId = useId()
  const text = label ?? humanize(name)
  const content = format ? format(value) : isEmpty(value) ? empty : display(value, options)
  const editable = editStep !== undefined && wizard !== null

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
            aria-label={`Edit ${typeof text === 'string' ? text : name}`}
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
