import { Fragment, useId, type ReactNode } from 'react'
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
        /** An already-computed value to display, e.g. a caller's own `useWatch`-derived total. Wins over `name`; when set, the field never calls `useWatch` at all. */
        value: unknown
        /** Required: there is no `name` to humanize into a default. */
        label: ReactNode
      }
  )

const isEmpty = (v: unknown) =>
  v === '' || v === null || v === undefined || (Array.isArray(v) && v.length === 0)

function display(value: unknown, options?: readonly Option[]): ReactNode {
  /*
   * Composed as React nodes rather than `Array.join(', ')`.
   *
   * Today every non-array branch below returns a string, so the two produce identical output
   * and this is defensive, not a bug fix — `no-base-to-string` flags the `join` because the
   * declared return type is `ReactNode`, and that type is the contract. The moment any branch
   * returns an actual element (an `Option.label` widened to `ReactNode`, a formatted chip),
   * `join` would call `toString` on it and render "[object Object]"; composing nodes cannot.
   */
  if (Array.isArray(value)) {
    return value.map((v, i) => (
      <Fragment key={i}>
        {i > 0 ? ', ' : null}
        {display(v, options)}
      </Fragment>
    ))
  }
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

interface ReadOnlyFieldViewProps extends ReadOnlyFieldBaseProps {
  value: unknown
  /** Resolved label text (either the given `label`, or `humanize(name)`). */
  text: ReactNode
  /** Only present in `name` mode; used as the Edit button's last-resort accessible-name fallback. */
  name?: string
}

/**
 * The rendering half of `ReadOnlyField`, shared by both the watched and static
 * variants below: layout, `format`/`options`/`empty`, the Wizard Edit button,
 * and every theme slot. Neither variant that calls this reads or watches
 * anything — that's each caller's own job — so this component has no opinion
 * on where `value` came from.
 */
function ReadOnlyFieldView({
  value,
  text,
  name,
  options,
  format,
  empty = '—',
  editStep,
  slotProps,
}: ReadOnlyFieldViewProps) {
  const wizard = useOptionalWizard()
  const labelId = useId()
  const content = format ? format(value) : isEmpty(value) ? empty : display(value, options)
  // In `page` layout every step (and so every field) is already on screen at once, so
  // `wizard.go()` has nothing to do there — it's a no-op that always resolves `false`. An
  // Edit button that clicks to nowhere is a focusable dead control (WCAG 2.1.1/4.1.2), so
  // it's hidden rather than disabled: disabling would still leave a control whose purpose
  // (jump to the field) is meaningless when the field is already visible right there.
  const editable = editStep !== undefined && wizard !== null && wizard.layout !== 'page'

  const labelProps = { variant: 'caption', color: 'text.secondary', ...slotProps?.label } as const
  const valueProps = { variant: 'body1', ...slotProps?.value } as const
  const editableName = typeof text === 'string' ? text : (name ?? 'Edit')

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
            aria-label={`Edit ${editableName}`}
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

interface WatchedReadOnlyFieldProps extends ReadOnlyFieldBaseProps {
  name: string
  label?: ReactNode
}

/** `name` mode: reads the form path with `useWatch`. Never registered, never validated. */
function WatchedReadOnlyField({ name, label, ...rest }: WatchedReadOnlyFieldProps) {
  // `useWatch` is typed `any` for an untyped control; this field displays whatever is there
  // (`ReadOnlyFieldView.value` is `unknown` and `display`/`format` narrow it), so `unknown` is
  // both honest and what the consumer already accepts.
  const value: unknown = useWatch({ name })
  return <ReadOnlyFieldView value={value} text={label ?? humanize(name)} name={name} {...rest} />
}

interface StaticReadOnlyFieldProps extends ReadOnlyFieldBaseProps {
  value: unknown
  label: ReactNode
}

/**
 * `value` mode: renders an already-computed value. Calls `useWatch` for
 * nothing — react-hook-form counts every `useWatch`, `disabled` or not, as a
 * `formState.values` subscriber (`_valuesSubscriberCount`), which makes it
 * `cloneObject` the entire form's values on every field's change anywhere in
 * the form for as long as the hook is mounted. `disabled: true` only skips
 * that subscriber's own re-render, not the subscription itself — so the only
 * way to keep this mode free of a whole-form cost is to never call the hook.
 */
function StaticReadOnlyField({ value, label, ...rest }: StaticReadOnlyFieldProps) {
  return <ReadOnlyFieldView value={value} text={label} {...rest} />
}

/**
 * A value from the form, read-only: small secondary label above, the value
 * below. For review / summary steps. Typography, not a disabled TextField,
 * so the value keeps full contrast.
 */
export function ReadOnlyField(inProps: ReadOnlyFieldProps) {
  const props = useDefaultProps({ props: inProps, name: 'EzReadOnlyField' })
  useEzFormContext('ReadOnlyField')
  return 'value' in props && props.value !== undefined ? (
    <StaticReadOnlyField {...props} value={props.value} />
  ) : (
    <WatchedReadOnlyField {...props} name={props.name!} />
  )
}
