import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useForkRef } from '@mui/material/utils'
import { FormSection, type FormSectionProps } from '../FormSection'
import { stepLabelId } from './WizardContext'
import { useWizard } from './useWizard'

export interface WizardStepProps {
  id: string
  /** Legend of the step's section. Defaults to the step's `label`; `null` renders no legend. */
  title?: ReactNode | null
  description?: ReactNode
  slotProps?: FormSectionProps['slotProps']
  children: ReactNode
}

/**
 * One step's content, always a `FormSection` (a step is a group). Horizontal:
 * the legend is the step label (a heading). Vertical: the label is already
 * visible in the stepper, so the section is named by it via `aria-labelledby`
 * and renders no legend. `page` layout: every *visible* step renders
 * unconditionally, in document order (by convention, the order `WizardStep`s
 * appear as children — the same order given to `steps`), each as its own
 * named section — the same markup as a horizontal step. A step hidden by
 * `when` renders nothing here too (silently — it's expected, not a mistake);
 * an `id` matching no step at all in `allSteps` also renders nothing but
 * warns in dev, so a stale/misspelled id is still noticed.
 *
 * On every user-initiated step change (`focusRequest`, which `Wizard` raises for
 * `next`/`prev`/`go` only) the newly current step moves focus to its own heading.
 *
 * Ruling: focus the step's container, not its first field. This is the APG guidance for
 * multi-step forms — focusing an input announces the input and skips the step's name and
 * position, so the user hears "Email, edit" with no idea they moved. The preference order is
 * the visible heading (horizontal: the legend `FormSection` renders), then the element naming
 * the section (vertical: the stepper label this step already points at with
 * `aria-labelledby`, since it renders no legend of its own), then the `<fieldset>` itself for
 * a `title={null}` step, which has no naming element to reach. Cost if wrong: focus lands
 * somewhere less informative and the user navigates to find the step — an annoyance, not a
 * trap; nothing becomes unreachable.
 */
export function WizardStep({ id, title, description, slotProps, children }: WizardStepProps) {
  const {
    steps,
    allSteps,
    current,
    orientation,
    layout,
    contentEl,
    focusRequest,
    id: wizardId,
  } = useWizard('WizardStep')

  const headingRef = useRef<HTMLElement>(null)
  const fieldsetRef = useRef<HTMLFieldSetElement>(null)
  // Every hook runs before the early returns below, so they stay unconditional even though a
  // `steps` wizard bails out at `current.id !== id` for all but the current step.
  const legendRef = useForkRef(headingRef, slotProps?.legend?.ref)

  // `page` renders every step at once and never navigates, so it never moves focus.
  const focusMe = layout !== 'page' && focusRequest.stepId === id && current.id === id
  const labelledById = orientation === 'vertical' ? stepLabelId(wizardId, id) : undefined
  const { seq } = focusRequest

  useEffect(() => {
    // `seq: 0` is the resting value the wizard mounts with, so initial mount never steals
    // focus; a failed-submit jump doesn't raise a request either, leaving that arrival to
    // `<FormErrorSummary>`.
    if (!focusMe || seq === 0) return
    const target =
      headingRef.current ??
      (labelledById ? document.getElementById(labelledById) : null) ??
      fieldsetRef.current
    if (!target) return
    // A heading, a stepper label and a fieldset are all non-focusable elements. `tabIndex` is
    // set here, at the moment of focusing, rather than standing in the markup: a permanent
    // `tabIndex={-1}` puts these nodes in a screen reader's "clickable" set on every render,
    // and nothing about this component wants them reachable at any other time. It is taken
    // off again on blur — once the user has tabbed away into the step's fields, the heading
    // has served its purpose and should go back to being ordinary text. A target that already
    // carried a `tabindex` (a consumer's own) is focused as-is and left untouched.
    if (target.hasAttribute('tabindex')) {
      target.focus()
      return
    }
    target.setAttribute('tabindex', '-1')
    const drop = () => target.removeAttribute('tabindex')
    target.addEventListener('blur', drop, { once: true })
    target.focus()
    return () => {
      target.removeEventListener('blur', drop)
      drop()
    }
  }, [focusMe, seq, labelledById])

  if (layout === 'page') {
    const step = steps.find((s) => s.id === id)
    if (!step) {
      if (import.meta.env.DEV && !allSteps.some((s) => s.id === id)) {
        console.warn(`ez-form: <WizardStep id="${id}"> does not match any step in \`steps\`.`)
      }
      return null
    }
    return (
      <FormSection
        title={title === undefined ? step.label : title}
        description={description}
        slotProps={slotProps}
      >
        {children}
      </FormSection>
    )
  }
  if (current.id !== id) return null
  if (orientation === 'vertical') {
    if (!contentEl) return null
    return createPortal(
      <FormSection
        ref={fieldsetRef}
        aria-labelledby={labelledById}
        description={description}
        slotProps={slotProps}
      >
        {children}
      </FormSection>,
      contentEl,
    )
  }
  const effectiveTitle = title === undefined ? current.label : title
  return (
    <FormSection
      ref={fieldsetRef}
      title={effectiveTitle}
      description={description}
      slotProps={{
        ...slotProps,
        // `FormSection` puts `slotProps.legend` on the `Typography` *inside* the `<legend>`,
        // which is the heading element itself — the node to focus. A caller's own `ref` there
        // is forked in rather than overwritten. With no title there is no heading to ref, and
        // the effect above falls through to the fieldset.
        legend:
          effectiveTitle == null ? slotProps?.legend : { ...slotProps?.legend, ref: legendRef },
      }}
    >
      {children}
    </FormSection>
  )
}
