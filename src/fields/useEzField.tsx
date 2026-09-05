import { Fragment, useCallback, useId, type ReactNode } from 'react'
import { useController, type UseControllerReturn } from 'react-hook-form'
import { useEzFormContext } from '../useEzFormContext'
import { useRegisterFocusTarget } from '../Form/FieldFocusContext'
import { useRequiredIndicator } from '../Form/RequiredIndicatorContext'
import { useRuleMessages } from '../Form/RuleMessagesContext'
import { isRequired, normalizeRules, type FieldRules } from '../rules'
import { warnMissingLabel, warnUnknownFieldName } from '../devWarn'

export interface UseEzFieldOptions<TValue = unknown> {
  /** The field's label; when it is a string it names the field in default rule messages. */
  label?: ReactNode
  rules?: FieldRules<TValue>
  /**
   * The consumer's ARIA name for a field with no visible `label`. The hook owns
   * these: it decides whether the dev-mode "no accessible name" warning fires,
   * *and* hands them back on `nameA11y` for the field to put on its real control.
   *
   * Passing them on to the control is not optional. Left to the `{...rest}`
   * spread they reach MUI's root, which parks a root `aria-label` on the
   * `FormControl` **wrapper** — so the wrapper is named, the `<input>` is not,
   * axe reports clean, and the warning is silenced by a name that names nothing
   * (#99). A field must therefore route `nameA11y` to whichever element actually
   * carries the role (`slotProps.htmlInput` for the TextField family).
   */
  'aria-label'?: string
  'aria-labelledby'?: string
}

/** For the real `<input>` (or the radiogroup). `aria-invalid` is omitted when valid. */
export interface InputA11y {
  'aria-invalid': true | undefined
  'aria-describedby': string | undefined
}

/**
 * The consumer's ARIA name, for the element that carries the role.
 *
 * A key the consumer did not pass is **absent**, not `undefined`: this object is
 * spread over props MUI builds itself (`slotProps.htmlInput`, Autocomplete's
 * `getInputProps()`), and an explicit `undefined` would erase the `aria-labelledby`
 * those already set for a labelled field.
 */
export type NameA11y = Partial<Record<'aria-label' | 'aria-labelledby', string>>

/** For the `FormHelperText`: its id, and `role="alert"` while it shows an error. */
export interface HelperTextA11y {
  id: string
  role: 'alert' | undefined
}

/**
 * A consumer's `formHelperText` slot props, in either shape MUI accepts: the
 * object, or the `(ownerState) => props` callback. The merge is generic over
 * the caller's own slot type (`slotProps.formHelperText` on `TextFieldProps`,
 * say) so the result stays assignable back to the slot it came from — the type
 * is MUI's, not a re-declared copy of it.
 */
export type HelperTextSlotProps<TOwnerState = unknown, TProps = object> =
  TProps | ((ownerState: TOwnerState) => TProps) | undefined

export type UseEzFieldReturn = UseControllerReturn & {
  /** Derived from the `required` rule; drives `required`/`aria-required` on the input. */
  required: boolean
  invalid: boolean
  errorMessage: string | undefined
  helperTextId: string
  /** The text to show under the control: the error message, else the consumer's helper text. */
  helperText: (consumerText: ReactNode) => ReactNode
  /** a11y attributes for the control, linked to the helper text only when there is some. */
  inputA11y: (text: ReactNode) => InputA11y
  /**
   * The control's `aria-describedby`: the consumer's ids **and** the helper text's,
   * space-joined, because an accessible description is a list. Replacing one with the
   * other silently drops half of what the control was meant to say (#104).
   *
   * `undefined` when neither side has anything, so the attribute is dropped rather
   * than left pointing at nothing.
   */
  describedBy: (consumer: string | undefined, text: ReactNode) => string | undefined
  /**
   * The consumer's `aria-label` / `aria-labelledby`, for the field to put on the
   * element that carries the role. Spread it there; do not rely on `{...rest}`,
   * which lands them on MUI's wrapper instead (#99).
   */
  nameA11y: NameA11y
  helperTextA11y: HelperTextA11y
  /**
   * The `formHelperText` slot props for a field that also lets the consumer set
   * them. The binding's `role` is applied **after** the consumer's, so a consumer
   * `role` cannot displace `role="alert"` and leave the error rendered but never
   * announced (#104).
   *
   * MUI's own `mergeSlotProps` cannot do this: it exists to let the external value
   * win, which is right for `className`/`sx`/handlers and wrong for the one
   * attribute that makes the error reach a screen reader. The consumer's `role`
   * still applies whenever there is no error to announce, so only the alert case
   * is owned here.
   *
   * Whether the hook's `helperTextId` is pinned onto the slot depends on who wires
   * the control's `aria-describedby`, and the two must agree:
   *
   * - `TextField` (via `describedBy` on `slotProps.htmlInput`), `NumberField` and
   *   `OtpField` (via `inputA11y`) all point the control at `helperTextId`, so the
   *   helper text must carry it. They get it — it is the default.
   * - `Autocomplete` leaves the wiring to MUI, which generates its own id and links
   *   the input to that. Pinning ours there would orphan the link and strip the
   *   control's accessible description, so it opts out with `pinId: false`.
   *
   * Handles the function form MUI accepts for a slot's props.
   *
   * Two overloads, because the return shape follows the argument: called with no
   * consumer props it returns a plain `HelperTextA11y` — the object a field with no
   * consumer channel of its own (`NumberField`, `OtpField`) hands straight to its
   * control, with no function form to narrow away at each call site.
   */
  helperTextSlotProps: {
    (): HelperTextA11y
    <TOwnerState, TProps extends object>(
      consumer: HelperTextSlotProps<TOwnerState, TProps>,
      options?: { pinId?: boolean },
    ): TProps | ((ownerState: TOwnerState) => TProps)
  }
  /**
   * The label to render: unchanged in `asterisk` mode; in `optional` mode, an
   * optional field's label gets the form's `optionalText` appended (unless the
   * form set it to `false`). The input keeps `required`/`aria-required` either way.
   */
  displayLabel: ReactNode
  /**
   * `required={false}` in `optional` mode when the field is required (so the
   * label element renders no asterisk while the input keeps `required`);
   * `undefined` otherwise, so a label picks up `FormControl`'s own `required`
   * (asterisk mode, today's behavior) or MUI's own default.
   */
  labelRequired: false | undefined
}

/**
 * Binds a field to the enclosing <Form>. Rules are normalized here (bare value
 * → `{ value, message }` with a label-derived default) and handed to
 * `useController`, which stores them on the field for `ezResolver` to run.
 * Also the single owner of the a11y wiring every field applies: the helper
 * text id, `aria-invalid`/`aria-describedby` for the control, and
 * `role="alert"` on the helper text while it shows an error (the live region
 * that announces errors in onChange/onBlur modes).
 */
export function useEzField<TValue = unknown>(
  name: string,
  componentName: string,
  {
    label,
    rules = {},
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
  }: UseEzFieldOptions<TValue> = {},
): UseEzFieldReturn {
  // Guard, and — dev only — the one place that can see both the field's `name` and the
  // form's own defaults: `useController` below reads `control` from the same context.
  const { control } = useEzFormContext(componentName)
  warnMissingLabel(componentName, name, label, ariaLabel, ariaLabelledBy)
  warnUnknownFieldName(componentName, name, control)
  const { requiredIndicator, optionalText } = useRequiredIndicator()
  const messages = useRuleMessages()
  const normalized = normalizeRules(rules, typeof label === 'string' ? label : undefined, messages)
  const controller = useController({ name, rules: normalized })
  const helperTextId = useId()
  // Fork `field.ref`: hookform still gets the element (it is what `setFocus` and
  // `shouldFocusError` use), and the form also records it as this field's focus target so
  // `<FormErrorSummary>` can link to it (#98). Every field already routes `field.ref` to the
  // element focus should land on — the visible input, the group's first option, the combobox
  // — so this is the one place that sees all of them without touching a single field file.
  const registerFocusTarget = useRegisterFocusTarget()
  const hookformRef = controller.field.ref
  const fieldRef = useCallback(
    (element: HTMLElement | null) => {
      hookformRef(element)
      registerFocusTarget(name, element)
    },
    [hookformRef, registerFocusTarget, name],
  )
  const invalid = controller.fieldState.invalid
  const errorMessage = controller.fieldState.error?.message
  const required = isRequired(normalized)
  const optional = requiredIndicator === 'optional'
  const displayLabel =
    optional && !required && optionalText !== false ? (
      <Fragment>
        {label} {optionalText}
      </Fragment>
    ) : (
      label
    )
  return {
    ...controller,
    field: { ...controller.field, ref: fieldRef },
    required,
    invalid,
    errorMessage,
    helperTextId,
    helperText: (consumerText) => errorMessage ?? consumerText,
    inputA11y: (text) => ({
      'aria-invalid': invalid || undefined,
      'aria-describedby': text ? helperTextId : undefined,
    }),
    describedBy: (consumer, text) =>
      [consumer, text ? helperTextId : undefined].filter(Boolean).join(' ') || undefined,
    helperTextA11y: { id: helperTextId, role: invalid ? 'alert' : undefined },
    helperTextSlotProps: <TOwnerState, TProps extends object>(
      consumer?: HelperTextSlotProps<TOwnerState, TProps>,
      { pinId = true }: { pinId?: boolean } = {},
    ) => {
      // Last, and deliberately not merged: while an error shows, the live region is
      // the binding's. With no error the `role` key is left off entirely, so a
      // consumer's own `role` survives the spread — `role: undefined` would erase it.
      const owned = {
        ...(pinId ? { id: helperTextId } : null),
        ...(invalid ? { role: 'alert' as const } : null),
      }
      // No consumer channel: the plain object, matching the no-argument overload.
      // `role: undefined` is stated so the shape is always `HelperTextA11y`; `owned`
      // then supplies `alert` under error, and `id` only when `pinId` asked for it.
      if (consumer === undefined) return { role: undefined, ...owned }
      // The function form stays a function, so MUI still resolves it with the real
      // ownerState; calling it here would hand the consumer an ownerState we do not have.
      return typeof consumer === 'function'
        ? (ownerState: TOwnerState) => ({ ...consumer(ownerState), ...owned }) as TProps
        : ({ ...consumer, ...owned } as TProps)
    },
    nameA11y: {
      ...(ariaLabel === undefined ? null : { 'aria-label': ariaLabel }),
      ...(ariaLabelledBy === undefined ? null : { 'aria-labelledby': ariaLabelledBy }),
    },
    displayLabel,
    labelRequired: optional && required ? false : undefined,
  }
}
