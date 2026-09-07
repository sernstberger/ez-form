import { Fragment, useCallback, useId, type ChangeEvent, type ReactNode } from 'react'
import {
  useController,
  type ControllerRenderProps,
  type UseControllerReturn,
} from 'react-hook-form'
import { useEzFormContext } from '../useEzFormContext'
import { useRegisterFocusTarget } from '../Form/FieldFocusContext'
import {
  fieldLayoutClasses,
  fieldLayoutClassName,
  useLabelPlacement,
  type LabelPlacement,
} from './LabelPlacementContext'
import { useFieldCell } from './FieldCellContext'
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
  /**
   * This field's own label placement, overriding the form's. Left `undefined`
   * (every field, normally) the form's `labelPlacement` applies — it is a
   * form-wide layout convention, and a per-field value is the escape hatch for
   * the one row that has to differ.
   */
  labelPlacement?: LabelPlacement
  /** The consumer's `className`, appended after the placement classes. */
  className?: string
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

/**
 * `useController`'s `field`, narrowed to the field's value type.
 *
 * Not `ControllerRenderProps<TFieldValues, TName>` with the form's own shape: an
 * ez-form field takes `name: string`, not `Path<TFieldValues>` — the form's value
 * type is never threaded through a field's props — so hookform's own path
 * machinery has nothing to resolve. `Path<Record<string, TValue>>` with `TValue`
 * still generic does not even evaluate: `string` fails the `PathImpl` constraint.
 * So `value` and `onChange` are restated over `TValue` and everything else
 * (`name`, `onBlur`, `disabled`, and the `ref` forked for #98) stays hookform's,
 * by `Omit`ting exactly the two keys being narrowed.
 *
 * `TValue | undefined`, not `TValue`: a form with no `defaultValues` entry for this
 * field renders it with `value === undefined`, which is why every call site that
 * casts today casts to `TValue | undefined` and then supplies its own fallback
 * (`?? null`, `?? ''`, `?? minBound ?? 0`). Typing it as bare `TValue` would erase
 * exactly the case each of those fallbacks exists for.
 *
 * `onChange` takes `TValue` **or** a `ChangeEvent`, because both are hookform's own
 * runtime contract: `TextField` hands the raw DOM event straight through
 * (`fieldOnChange(e)`) and hookform reads `target.value` off it, while every other
 * field passes the value it computed.
 */
export type TypedControllerRenderProps<TValue> = Omit<
  ControllerRenderProps,
  'value' | 'onChange'
> & {
  value: TValue | undefined
  onChange: (value: TValue | ChangeEvent<Element>) => void
}

export type UseEzFieldReturn<TValue = unknown> = Omit<UseControllerReturn, 'field'> & {
  /** `useController`'s own `field`, with `value`/`onChange` narrowed to `TValue` (#28). */
  field: TypedControllerRenderProps<TValue>
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
   * The `formHelperText` slot props with the binding's `role` applied **after**
   * the consumer's, so a consumer `role` cannot displace `role="alert"` and leave
   * the error rendered but never announced (#104). The id is *not* pinned — see
   * `helperTextSlotProps`, which is this plus the pin, for the usual case.
   *
   * This is the smaller of the two rules, named on its own for the one field family
   * that needs the ordering without the id: the pickers, where MUI X derives the
   * helper text's id itself (`${fieldId}-helper-text`) and `usePickerField` reuses
   * `helperTextId` as the *field* id to predict it. Pinning here would give the
   * `<input>` and the `<p>` the same id and leave the group's `aria-describedby`
   * pointing at nothing (#127).
   *
   * MUI's own `mergeSlotProps` is not used for this: it exists to let the external
   * value win, which is wrong for the one attribute that makes the error reach a
   * screen reader — and for the function form it would rewrite the `ownerState` the
   * consumer's function receives. See `applyOwned`. The consumer's `role` still
   * applies whenever there is no error to announce, so only the alert case is
   * owned here.
   *
   * Handles the function form MUI accepts for a slot's props.
   */
  helperTextRole: <TOwnerState, TProps extends object>(
    consumer: HelperTextSlotProps<TOwnerState, TProps>,
  ) => TProps | ((ownerState: TOwnerState) => TProps)
  /**
   * The `formHelperText` slot props for a field that also lets the consumer set
   * them: `helperTextRole`'s ordering (the binding's `role` last, #104) **plus**
   * the hook's `helperTextId` pinned onto the slot.
   *
   * The id is pinned because every field using this points its control's
   * `aria-describedby` at that id and the two must agree — `TextField` and
   * `Autocomplete` through `describedBy` on `slotProps.htmlInput`, `NumberField`
   * and `OtpField` through `describedBy` on their `inputProps`, the `FieldFrame`
   * family through `bound.inputA11y`.
   *
   * `Autocomplete` used to opt out of the pin (a `pinId: false` option) on the
   * grounds that MUI generated its own id and linked the input to that. That was
   * also why a consumer's own `aria-describedby` could never reach the combobox:
   * MUI writes the whole attribute. It owns the attribute itself now, so the
   * option is gone and the helper has one shape again (#102 row 8). A field that
   * genuinely cannot take the pin calls `helperTextRole` instead of passing a
   * flag, so this keeps one unconditional return shape.
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
  /**
   * The resolved label placement for this field: its own `labelPlacement` prop if
   * it has one, else the form's.
   */
  labelPlacement: LabelPlacement
  /**
   * `className` for the field's `FormControl` root: the `EzFieldLayout-*` classes
   * the placement rules are keyed by, plus whatever `className` the consumer
   * passed.
   *
   * Every family puts this on its root. That is the whole per-field cost of the
   * axis — the rules themselves live once on `<Form>`'s `EzForm` Root slot, and
   * the markup is unchanged, so `<label for>` / `aria-labelledby` /
   * `aria-describedby` are byte-identical under all three placements (#9, #66).
   */
  layoutClassName: string
}

/**
 * Merges the consumer's `formHelperText` slot props with the binding's, then puts
 * the binding's keys back **on top**.
 *
 * A plain spread, deliberately **not** MUI's `mergeSlotProps`, in both branches.
 *
 * `mergeSlotProps` would be wrong for the function form: it calls the consumer's
 * function with `{ ...ownerState, ...defaultSlotProps }` (mergeSlotProps.js), so
 * the binding's `id`/`role` would be merged into the `ownerState` the consumer
 * sees. `TextField`'s ownerState is its own props, so a consumer reading
 * `ownerState.id` would get the internal helper-text id instead of the `id` they
 * passed to the field. The consumer's function must see the component's real
 * ownerState, untouched.
 *
 * And for the object form it would add nothing: everything `mergeSlotProps`
 * composes beyond a spread — `className` via clsx, merged `style`, concatenated
 * `sx`, chained event handlers — is keyed off those keys being present in the
 * *defaults* argument, and `owned` only ever holds `id`/`role`. So it reduces to
 * `{ ...owned, ...consumer }`, and since the binding's keys have to win it would
 * then need `owned` re-applied on top anyway — which is exactly the spread below.
 * (Verified against `className`/`style`/`sx`/handler consumers: identical output.)
 *
 * Nothing is lost by that: `owned` carries no key a consumer could want composed
 * with, so every other key on the slot passes through untouched either way.
 *
 * The function form stays *a function*: resolving it here would hand the consumer
 * an `ownerState` this hook does not have.
 *
 * Shared by `helperTextRole` and `helperTextSlotProps` so "the binding's keys go
 * last" is written once; the two differ only in what `owned` holds.
 */
const applyOwned = <TOwnerState, TProps extends object>(
  consumer: HelperTextSlotProps<TOwnerState, TProps>,
  owned: object | null,
): TProps | ((ownerState: TOwnerState) => TProps) =>
  typeof consumer === 'function'
    ? (ownerState: TOwnerState) => ({ ...consumer(ownerState), ...owned })
    : ({ ...consumer, ...owned } as TProps)

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
    labelPlacement: labelPlacementProp,
    className,
  }: UseEzFieldOptions<TValue> = {},
): UseEzFieldReturn<TValue> {
  // Guard, and — dev only — the one place that can see both the field's `name` and the
  // form's own defaults: `useController` below reads `control` from the same context.
  const { control } = useEzFormContext(componentName)
  warnMissingLabel(componentName, name, label, ariaLabel, ariaLabelledBy)
  warnUnknownFieldName(componentName, name, control)
  const { requiredIndicator, optionalText } = useRequiredIndicator()
  const { labelPlacement: formLabelPlacement } = useLabelPlacement()
  const labelPlacement = labelPlacementProp ?? formLabelPlacement
  // The table cell this field sits in, if any (#14). Read here, in the one hook every
  // field calls, for the same reason the placement axis is: it reaches every family
  // without a new element in the tree or a prop on each field.
  const cell = useFieldCell()
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
  /**
   * The binding's share of the `formHelperText` slot, applied **last** and
   * deliberately not merged: while an error shows, the live region is the
   * binding's (#104). With no error the `role` key is left off entirely, so a
   * consumer's own `role` survives the spread — `role: undefined` would erase it.
   *
   * The one copy of that rule: `helperTextRole` returns it as-is and
   * `helperTextSlotProps` adds the id to it, so a field taking the ordering
   * without the pin (the pickers, #127) cannot drift from one taking both.
   */
  const ownedRole = invalid ? { role: 'alert' as const } : null
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
    helperTextRole: <TOwnerState, TProps extends object>(
      consumer: HelperTextSlotProps<TOwnerState, TProps>,
    ) => applyOwned<TOwnerState, TProps>(consumer, ownedRole),
    helperTextSlotProps: <TOwnerState, TProps extends object>(
      consumer?: HelperTextSlotProps<TOwnerState, TProps>,
    ) => {
      // The ordering rule plus the id pin. `ownedRole` is the single copy of the
      // ordering, shared with `helperTextRole` above so the two cannot drift.
      const owned = { id: helperTextId, ...ownedRole }
      // No consumer channel: the plain object, matching the no-argument overload.
      // `role: undefined` is stated so the shape is always `HelperTextA11y`; `owned`
      // then supplies the id, and `alert` under error.
      if (consumer === undefined) return { role: undefined, ...owned }
      return applyOwned<TOwnerState, TProps>(consumer, owned)
    },
    // In a table cell the control is named by the row header plus the column header
    // (#14), *unless* the consumer named it themselves — the #99/#100 channels keep
    // winning, so a cell field with its own `aria-label` says exactly that. The field's
    // visible `label` still renders (visually hidden by the cell class) and is still the
    // `<label for>` target, so `getByLabelText` finds it; `aria-labelledby` outranks it
    // in the accname algorithm, which is what makes the name "Line item 2 Qty".
    nameA11y: {
      ...(ariaLabel === undefined ? null : { 'aria-label': ariaLabel }),
      ...(ariaLabelledBy === undefined
        ? cell && ariaLabel === undefined
          ? { 'aria-labelledby': `${cell.rowHeaderId} ${cell.headerId}` }
          : null
        : { 'aria-labelledby': ariaLabelledBy }),
    },
    displayLabel,
    labelRequired: optional && required ? false : undefined,
    labelPlacement,
    layoutClassName: cellClassName(fieldLayoutClassName(labelPlacement, className), cell),
  }
}

/**
 * The placement classes plus, inside a table cell, the cell classes (#14): `cell`
 * always, `cellHelperHidden` under `cellErrors="summary"`. Appended after the
 * consumer's `className` — they are layout state, not a placement, so the
 * always-present placement class stays exactly where it was.
 */
function cellClassName(base: string, cell: ReturnType<typeof useFieldCell>): string {
  if (!cell) return base
  const hidden = cell.helperTextHidden ? ` ${fieldLayoutClasses.cellHelperHidden}` : ''
  return `${base} ${fieldLayoutClasses.cell}${hidden}`
}
