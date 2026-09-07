import {
  useEffect,
  useId,
  useMemo,
  useRef,
  type ComponentProps,
  type ElementType,
  type ReactNode,
} from 'react'
import { useFormState } from 'react-hook-form'
import { useDefaultProps } from '@mui/material/DefaultPropsProvider'
import generateUtilityClasses from '@mui/material/generateUtilityClasses'
import { styled } from '@mui/material/styles'
import Link, { type LinkProps } from '@mui/material/Link'
import Typography, { type TypographyProps } from '@mui/material/Typography'
import { useEzFormContext } from '../useEzFormContext'
import { useOptionalWizard } from '../Wizard/useWizard'
import { useFailedConfirmAttempt, useRegisterErrorSummary } from './ErrorSummaryContext'
import { useCellLabels, useFocusTargetIds } from './FieldFocusContext'
import { flattenErrors, type ErrorEntry } from './flattenErrors'

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
 * Restricts a flattened error list to the given field paths and their descendants (an error on
 * `address.city` belongs to a step listing `address`). Used to scope the summary to the
 * current wizard step's own `fields`.
 */
function scopedTo(entries: ErrorEntry[], fields: readonly string[]): ErrorEntry[] {
  return entries.filter((e) => fields.some((f) => e.name === f || e.name.startsWith(`${f}.`)))
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

  // Root-level errors are dropped: every item here is a link that focuses the field it names,
  // and `root`/`root.*` names no field — the item would render with no `href`, no `link` role
  // and nothing to focus. `<FormError>` is what surfaces a root error, and it is the target
  // `<Form>`'s own post-submit focus step uses for one. Filtered here rather than inside
  // `flattenErrors` because `<Form>` needs the root leaves that walk finds (#124).
  const allEntries = useMemo(
    () => flattenErrors(errors).filter((e) => e.name !== 'root' && !e.name.startsWith('root.')),
    [errors],
  )
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
  }, [wizard?.lastFailed, submitCount, failedConfirmAttempt, visible])

  // The id of each field's focus target, registered by `useEzField`'s forked `field.ref` and
  // read here through `useSyncExternalStore` (see FieldFocusContext), rather than looked up in
  // the DOM after commit as this used to do. A field that has not registered yet has no entry
  // and simply gets no `href` — the same behaviour as before, and the item is still fully
  // usable either way since the click handler's `setFocus`, not the `href`, does the focusing.
  const fieldIds = useFocusTargetIds()
  // What a field inside a `<FieldArray layout="table">` cell is called there — "Line item 2
  // Qty" — registered by `useEzField` on the same store (#14). Prefixed to the item's text,
  // because the cell's own error text is visually hidden by default and the bare message
  // ("Qty must be at least 1") does not say which row it is about.
  const cellLabels = useCellLabels()

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
                {cellLabels[entry.name]
                  ? `${cellLabels[entry.name]}: ${entry.message}`
                  : entry.message}
              </FormErrorSummaryLink>
            </FormErrorSummaryItem>
          )
        })}
      </FormErrorSummaryList>
    </FormErrorSummaryRoot>
  )
}
