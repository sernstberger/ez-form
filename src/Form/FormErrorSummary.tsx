import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ElementType,
  type ReactNode,
} from 'react'
import { useFormState, type FieldErrors } from 'react-hook-form'
import { useDefaultProps } from '@mui/material/DefaultPropsProvider'
import generateUtilityClasses from '@mui/material/generateUtilityClasses'
import { styled } from '@mui/material/styles'
import Link, { type LinkProps } from '@mui/material/Link'
import Typography, { type TypographyProps } from '@mui/material/Typography'
import { useEzFormContext } from '../useEzFormContext'
import { useOptionalWizard } from '../Wizard/useWizard'
import { useFailedConfirmAttempt, useRegisterErrorSummary } from './ErrorSummaryContext'

export const formErrorSummaryClasses = generateUtilityClasses('EzFormErrorSummary', [
  'root',
  'heading',
  'list',
  'item',
  'link',
])

/** Typography plus `component`, so the heading slot can pick its element (heading level). */
export type FormErrorSummaryHeadingProps = TypographyProps & { component?: ElementType }

export interface FormErrorSummaryProps extends Omit<ComponentProps<'div'>, 'title'> {
  /** Heading text. Default `"There is a problem"`. */
  title?: ReactNode
  slotProps?: {
    heading?: FormErrorSummaryHeadingProps
    list?: ComponentProps<'ul'>
    item?: ComponentProps<'li'>
    link?: LinkProps
  }
}

const FormErrorSummaryRoot = styled('div', { name: 'EzFormErrorSummary', slot: 'Root' })({})
const FormErrorSummaryHeading = styled(Typography, {
  name: 'EzFormErrorSummary',
  slot: 'Heading',
})({})
// A `<ul>`'s UA stylesheet adds a margin and marker indent that read as a stray list rather
// than an error region; removing the margin and reducing to a plain indent is the minimum,
// the same rule as `FormSection`'s fieldset reset. Overridable via
// `EzFormErrorSummary.styleOverrides.list`.
const FormErrorSummaryList = styled('ul', { name: 'EzFormErrorSummary', slot: 'List' })(
  ({ theme }) => ({
    margin: 0,
    paddingLeft: theme.spacing(2),
  }),
)
const FormErrorSummaryItem = styled('li', { name: 'EzFormErrorSummary', slot: 'Item' })({})
const FormErrorSummaryLink = styled(Link, { name: 'EzFormErrorSummary', slot: 'Link' })({})

/**
 * A `FieldError` leaf, recognised by hookform's own shape. Mirrors the check `Wizard` uses to
 * walk `formState.errors` (see `Wizard.tsx`'s `isFieldError` for the full reasoning): `type` is
 * always a string on a leaf, and `message`/`ref` are its discriminating optional siblings.
 */
function isFieldError(node: object): node is { type: string; message?: string; ref?: unknown } {
  return 'type' in node && typeof node.type === 'string' && ('message' in node || 'ref' in node)
}

interface ErrorEntry {
  name: string
  message: string
}

/**
 * Flattens `formState.errors` to `{ name, message }` leaves, in the order `Object.keys` visits
 * them at each level (schema order in practice, since react-hook-form builds the errors object
 * by walking the schema). A leaf with no `message` (e.g. a `refine` with no message) is skipped
 * — there is nothing to show as its link text.
 *
 * Ruling: DOM/schema order via `Object.keys` rather than a field-registration order — hookform
 * does not expose one, and this matches the order a sighted user reads the form top to bottom
 * in the common case (fields declared in schema order). Cost if wrong: a summary item and its
 * field appear in a different order than the form for a schema whose properties are declared
 * out of visual order — cosmetic, not a functional or a11y regression (each item's link still
 * focuses the right field).
 */
function flattenErrors(errors: FieldErrors, prefix = ''): ErrorEntry[] {
  return Object.entries(errors).flatMap(([key, value]) => {
    if (value == null || typeof value !== 'object') return []
    const path = prefix ? `${prefix}.${key}` : key
    if (isFieldError(value)) {
      return typeof value.message === 'string' && value.message
        ? [{ name: path, message: value.message }]
        : []
    }
    return flattenErrors(value as FieldErrors, path)
  })
}

/**
 * Restricts a flattened error list to the given field paths and their descendants (an error on
 * `address.city` belongs to a step listing `address`). Used to scope the summary to the
 * current wizard step's own `fields`.
 */
function scopedTo(entries: ErrorEntry[], fields: readonly string[]): ErrorEntry[] {
  return entries.filter((e) => fields.some((f) => e.name === f || e.name.startsWith(`${f}.`)))
}

/**
 * The id of a registered field's rendered element, found by its `name` attribute in the DOM.
 *
 * Ruling: every ez-form field goes through `useController` (`useEzField`), and hookform wraps
 * whatever `ref` a `useController` field passes it in a minimal proxy (`{ focus, select,
 * setCustomValidity, reportValidity }`, see react-hook-form's `useController` source) before
 * storing it — `control._fields[name]._f.ref` is never the real DOM element for these fields,
 * so it has no `id` to read. A DOM query by `name` is the only place the real element (and
 * whatever id MUI generated for it) is still reachable. `undefined` (nothing rendered with
 * this name yet, or a group whose control has no `name` of its own) omits `href` entirely
 * rather than pointing at nothing; the item is still fully usable either way since the click
 * handler's `setFocus` — not the `href` — does the actual focusing. Cost if wrong: a false
 * match if two different fields ever rendered the same `name` in the same form, which is not
 * a state ez-form (or plain HTML) supports today.
 */
function fieldElementId(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined
  const el = document.querySelector(`[name="${CSS.escape(name)}"]`)
  return el instanceof HTMLElement && el.id ? el.id : undefined
}

/**
 * Lists the errors from the form's (or, inside a `Wizard`, the current step's) last failed
 * validation attempt, GOV.UK-style: focus moves to a heading on failure, and each item is a
 * link that focuses its field. Placed by the consumer — under the form title, or inside the
 * current `WizardStep` — rather than owned by `<Form>`, since a wizard summary should scope to
 * one step while a plain form's should not.
 */
export function FormErrorSummary(inProps: FormErrorSummaryProps) {
  const {
    title = 'There is a problem',
    slotProps,
    className,
    ...rest
  } = useDefaultProps({
    props: inProps,
    name: 'EzFormErrorSummary',
  })
  const { control, setFocus } = useEzFormContext('FormErrorSummary')
  const { errors, submitCount } = useFormState({ control })
  const wizard = useOptionalWizard()
  const failedConfirmAttempt = useFailedConfirmAttempt()
  const headingId = `${useId()}-heading`

  const allEntries = useMemo(() => flattenErrors(errors), [errors])
  const entries = wizard?.lastFailed ? scopedTo(allEntries, wizard.lastFailed) : allEntries

  // Outside a wizard: any failed attempt with errors left standing — a failed handleSubmit
  // (submitCount > 0) or a failed <Form confirm> pre-submit validation, which never reaches
  // handleSubmit so never bumps submitCount (see failedConfirmAttempt's doc). Inside a wizard:
  // a failed Next/go against the current step (wizard.lastFailed is non-null) *or* a failed
  // final submit on the last step, which — like the confirm path outside a wizard — goes
  // straight through handleSubmit and never touches validateCurrent/lastFailed; scoping then
  // falls through to every current error rather than wizard.lastFailed, since there is no
  // step-local failure to scope to and the wizard's own submitCount already means the last
  // step's own fields (a submit only fires from the last step's SubmitButton). A wizard's last
  // step can also carry `<Form confirm>` (e.g. a Review step's Submit) — that pre-submit
  // `trigger()` never reaches `handleSubmit` on a failed validation either, so it needs
  // `failedConfirmAttempt` here too, the same as the non-wizard branch (see #81, filed
  // alongside the Insurance example that first combined the two).
  const attempted = wizard
    ? wizard.lastFailed != null || submitCount > 0 || failedConfirmAttempt > 0
    : submitCount > 0 || failedConfirmAttempt > 0
  const visible = attempted && entries.length > 0

  const headingRef = useRef<HTMLElement>(null)
  // Re-focus on each new failed attempt. A wizard step's own `lastFailed` gets a fresh array
  // reference on every failed validation of that step — even a repeat failure with the exact
  // same fields — specifically so this effect's dependency (compared by reference, not value)
  // sees a change; a plain form's `submitCount` increments on every submit; `failedConfirmAttempt`
  // increments on every failed confirm-path validation. All three are stable between re-renders
  // that aren't a new attempt, so the effect fires only when there is something new to announce
  // — and, inside a wizard, also on the final submit's own submitCount bump, since that failure
  // never touches `lastFailed`. Ruling: kept as three separate deps rather than one joined
  // string key — joining `wizard.lastFailed` by value (e.g. `.join(',')`) would collapse two
  // consecutive failures with identical fields back into "no change", defeating the whole
  // point of giving `lastFailed` a fresh reference on each failure.
  useEffect(() => {
    if (visible) headingRef.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizard?.lastFailed, submitCount, failedConfirmAttempt, visible])

  // href lookups touch the DOM (see fieldElementId's ruling), so they run after commit rather
  // than during render; entries with no match yet (or none at all) simply render without an
  // href, and the click handler's setFocus still fully focuses the field either way.
  const [fieldIds, setFieldIds] = useState<Record<string, string | undefined>>({})
  useEffect(() => {
    if (!visible) return
    setFieldIds(
      Object.fromEntries(entries.map((entry) => [entry.name, fieldElementId(entry.name)])),
    )
    // `entries` is a new array/object every render (flattenErrors/scopedTo are not memoized on
    // identity); comparing its serialized field names keeps this from looping forever while
    // still re-running whenever the actual set of listed fields changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, entries.map((e) => e.name).join(',')])

  const register = useRegisterErrorSummary()
  useEffect(() => register(), [register])

  if (!visible) return null

  const headingProps = { component: 'h2', variant: 'h6', ...slotProps?.heading } as const

  return (
    <FormErrorSummaryRoot
      aria-labelledby={headingId}
      {...rest}
      className={`${formErrorSummaryClasses.root}${className ? ` ${className}` : ''}`}
    >
      <FormErrorSummaryHeading
        {...headingProps}
        id={headingId}
        ref={headingRef}
        tabIndex={-1}
        className={`${formErrorSummaryClasses.heading}${headingProps.className ? ` ${headingProps.className}` : ''}`}
      >
        {title}
      </FormErrorSummaryHeading>
      <FormErrorSummaryList
        {...slotProps?.list}
        className={`${formErrorSummaryClasses.list}${slotProps?.list?.className ? ` ${slotProps.list.className}` : ''}`}
      >
        {entries.map((entry) => {
          const fieldId = fieldIds[entry.name]
          return (
            <FormErrorSummaryItem
              key={entry.name}
              {...slotProps?.item}
              className={`${formErrorSummaryClasses.item}${slotProps?.item?.className ? ` ${slotProps.item.className}` : ''}`}
            >
              <FormErrorSummaryLink
                href={fieldId ? `#${fieldId}` : undefined}
                {...slotProps?.link}
                className={`${formErrorSummaryClasses.link}${slotProps?.link?.className ? ` ${slotProps.link.className}` : ''}`}
                onClick={(event) => {
                  event.preventDefault()
                  setFocus(entry.name)
                  slotProps?.link?.onClick?.(event)
                }}
              >
                {entry.message}
              </FormErrorSummaryLink>
            </FormErrorSummaryItem>
          )
        })}
      </FormErrorSummaryList>
    </FormErrorSummaryRoot>
  )
}
