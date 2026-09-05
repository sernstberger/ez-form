import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useForkRef } from '@mui/material/utils'
import { FormSection, type FormSectionProps } from '../FormSection'
import { stepLabelId } from './WizardContext'
import { useWizard } from './useWizard'

/**
 * Whether an Enter keydown that reached the step's `<fieldset>` is the user saying "I'm done
 * with this screen" rather than a keystroke some field or control has its own meaning for.
 *
 * The load-bearing check is `defaultPrevented`. A field that consumes Enter marks the event
 * handled, which is the same signal the browser's own implicit-submission rule respects — so
 * this needs no allow-list of field types and stays correct for fields that do not exist yet.
 * Today that covers MUI `Autocomplete` (Enter with an open popup selects the highlighted
 * option and calls `preventDefault`, its own comment saying "Avoid early form validation, let
 * the end-users continue filling the form"), MUI `Select` (Enter on a closed select opens the
 * menu, likewise prevented) and `EmailListField` (Enter commits a chip). An *open*
 * `Select`/`Autocomplete` listbox and a picker popper are portalled out of this fieldset
 * entirely, so their keydown never reaches this handler in the first place — belt and braces.
 *
 * A *closed* date-picker field is the exception that proves the rule, and it arrives here by a
 * different route than the two above. `PickersInputBase`'s own Enter handler does not
 * `preventDefault` unconditionally: it looks up `closest('form')` and
 * `querySelector('[type="submit"]')` and **returns early, leaving the event unprevented, when
 * there is no submit trigger** (`@mui/x-date-pickers`, `PickersInputBase.js`). On a non-last
 * step there is none — that absence is the very bug #116 is about — so the picker no-ops and
 * this handler advances the step, exactly as it does for a plain text input. On the last step
 * a `SubmitButton` does exist, so the picker submits the form itself; this handler is not
 * installed there either way, so the two never race.
 *
 * The rest are the cases no `preventDefault` is involved in, so nothing else could catch them:
 * a `<textarea>`/`contenteditable`, where Enter is natively a newline; a button or link, where
 * Enter is that control's own activation (Back, a chip's delete, `ReadOnlyField`'s Edit); a
 * modified Enter, which belongs to whatever gesture the modifier names; an auto-repeat from a
 * held key; and an IME composition commit (`isComposing`, plus the legacy `keyCode === 229`
 * that some IMEs still report instead).
 */
function isPlainEnter(event: KeyboardEvent<HTMLFieldSetElement>) {
  if (event.key !== 'Enter') return false
  if (event.defaultPrevented || event.repeat) return false
  if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return false
  if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return false
  const target = event.target as HTMLElement | null
  if (!target) return false
  const tag = target.tagName
  if (tag === 'TEXTAREA' || tag === 'BUTTON' || tag === 'A' || target.isContentEditable) {
    return false
  }
  const role = target.getAttribute('role')
  if (role === 'button' || role === 'link') return false
  return true
}

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
 *
 * Ruling: Enter on a non-last step advances it, via one `onKeyDown` on this step's own
 * `<fieldset>` — not by making `WizardNav`'s Next a `type="submit"` button (#116). The
 * submit-button route is the browser-native one and was evaluated first, as it should be: it
 * would make Enter, implicit submission and an assistive-tech "submit" action all work with no
 * key handling at all. It loses on rule 4, "the form owns the lifecycle". `Wizard` renders
 * *inside* `<Form>`, so it cannot wrap `Form`'s own `onSubmit`; intercepting a non-last step's
 * submit would mean a capture-phase listener on the ancestor `<form>`, reached by DOM
 * traversal, calling `stopPropagation()` so the component that owns submission never sees the
 * event — a child swallowing the lifecycle owner's event, and a consumer's own handler on the
 * `<form>` broken with it. It also feeds `submitCount`, the `#101` re-entrancy ref and the
 * failed-submit navigation effect events that are not submits. And it would not even be free
 * of key handling: `Select` and `Autocomplete` both `preventDefault` Enter, so implicit
 * submission never fires for them regardless. Cost if wrong: this handler is more code than a
 * `type` attribute and has to name its own exclusions (see `isPlainEnter`) — a bounded, local
 * cost, against a lifecycle inversion every future `<Form>` change would have to work around.
 *
 * The last step is deliberately left alone: `WizardNav` renders a real `<SubmitButton>` there,
 * so native implicit submission already works and already fires exactly once.
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
    isLast,
    next,
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

  // `undefined` rather than a no-op handler on the last step, so the DOM carries no listener
  // at all where Enter is the browser's own to handle. `preventDefault` on the way through
  // stops jsdom's non-standard "fire a submit even with no submit button present" from also
  // running (a real browser has nothing to prevent here, since there is no submit control on a
  // non-last step — that absence is the whole bug), which keeps this one gesture from being
  // both an advance and a spurious submit under test. `next()` is already re-entrancy-safe: it
  // returns false while `pending`, so a fast double-Enter validates once and advances once.
  const onKeyDown =
    isLast || layout === 'page'
      ? undefined
      : (event: KeyboardEvent<HTMLFieldSetElement>) => {
          if (!isPlainEnter(event)) return
          event.preventDefault()
          void next()
        }

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
        onKeyDown={onKeyDown}
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
      onKeyDown={onKeyDown}
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
