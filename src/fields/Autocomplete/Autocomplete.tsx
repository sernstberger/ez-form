import type { ReactNode } from 'react'
import MuiAutocomplete, {
  type AutocompleteOwnerState,
  type AutocompleteProps as MuiAutocompleteProps,
  type AutocompleteRenderValue,
  type AutocompleteRenderValueGetItemProps,
  type AutocompleteValue,
} from '@mui/material/Autocomplete'
import MuiTextField, { type TextFieldProps as MuiTextFieldProps } from '@mui/material/TextField'
import { customVariantSlots, type EzTextFieldVariants } from '../textFieldVariants'
import Chip, { type ChipProps } from '@mui/material/Chip'
import { mergeSlotProps } from '@mui/material/utils'
import { ChipDeleteIcon } from '../ChipDeleteIcon'
import { useEzField } from '../useEzField'
import type { LabelPlacementProps } from '../LabelPlacementContext'
import { mergeDisabled } from '../mergeDisabled'
import type { Option } from '../Option'
import type { FieldRules } from '../../rules'
import { warnDuplicateOptions } from '../../devWarn'

/**
 * What the form stores: one value (or null), or an array under `multiple`;
 * typed text under `freeSolo`. MUI's own value type over `TValue` instead of
 * the option, with `disableClearable` pinned off (the form owns "empty").
 *
 * Empty is `null` for a single non-`freeSolo` field and `''` for a single
 * `freeSolo` one: there the value is text, and the empty text is `''` — the
 * same value a cleared `TextField` stores, so a `required` rule or a
 * `z.string()` schema reads "cleared" and "never typed" alike. The type still
 * admits `null` (MUI's), but the field never writes it under `freeSolo`.
 */
export type AutocompleteFormValue<
  TValue,
  Multiple extends boolean | undefined,
  FreeSolo extends boolean | undefined,
> = AutocompleteValue<TValue, Multiple, false, FreeSolo>

type MuiProps<
  TOption extends Option,
  Multiple extends boolean | undefined,
  FreeSolo extends boolean | undefined,
> = MuiAutocompleteProps<TOption, Multiple, false, FreeSolo>

export type AutocompleteProps<
  TOption extends Option,
  TValue = TOption['value'],
  Multiple extends boolean | undefined = false,
  FreeSolo extends boolean | undefined = false,
> = Omit<
  MuiProps<TOption, Multiple, FreeSolo>,
  'value' | 'defaultValue' | 'onChange' | 'renderInput' | 'disableClearable'
> &
  FieldRules<AutocompleteFormValue<TValue, Multiple, FreeSolo>> & {
    name: string
    label?: ReactNode
    helperText?: ReactNode
    /**
     * What the form stores for a chosen option. Defaults to `option.value`
     * (the same shape Select stores); return the option itself to store objects.
     */
    getOptionValue?: (option: TOption) => TValue
    onChange?: MuiProps<TOption, Multiple, FreeSolo>['onChange']
    /** Extra props for the MUI TextField that renders the input. */
    textFieldProps?: Omit<
      MuiTextFieldProps,
      | 'name'
      | 'value'
      | 'error'
      | 'inputRef'
      | 'required'
      | 'label'
      | 'helperText'
      | 'slotProps'
      | 'variant'
    > & {
      /**
       * UPSTREAM SHIM (#142). MUI's `variant`, reopened — see
       * `src/fields/textFieldVariants.ts`. `Omit`ted above and re-declared here
       * because MUI's `TextFieldProps` is a discriminated union over the closed
       * literal union; a custom variant renders `OutlinedInput` unless
       * `textFieldProps.slots.input` says otherwise.
       */
      variant?: EzTextFieldVariants
    }
    /**
     * Extra props for the `<input>` itself, merged over the ones MUI's
     * `getInputProps()` supplies. `textFieldProps` cannot reach here — it lands
     * on the TextField root, and the input's props are rebuilt by Autocomplete
     * on every render — so a field built on top of this one (`EmailListField`
     * intercepting comma, semicolon and paste) needs its own way in. Merged with
     * `mergeSlotProps` as the *external* side: a plain prop here wins over MUI's,
     * and a handler here runs before the input's own rather than replacing it.
     * Autocomplete's key handling lives on the root, though, so this cannot
     * override the keys it owns (Enter, Backspace, the arrows).
     */
    inputProps?: NonNullable<MuiTextFieldProps['slotProps']>['htmlInput']
  } & LabelPlacementProps

const isOptionShaped = (v: unknown): v is Option =>
  typeof v === 'object' && v !== null && 'label' in v && 'value' in v

/**
 * MUI Autocomplete bound to the form through a value ↔ option mapping, so the
 * form stores a primitive (or, via `getOptionValue`, an object) and the
 * options array can change underneath it (async lookups). Handlers compose
 * after the form's own: `onChange(event, value, reason, details)`.
 */
export function Autocomplete<
  TOption extends Option,
  TValue = TOption['value'],
  Multiple extends boolean | undefined = false,
  FreeSolo extends boolean | undefined = false,
>({
  name,
  label,
  helperText,
  disabled,
  options,
  getOptionValue = (o) => o.value as TValue,
  onChange,
  textFieldProps,
  inputProps,
  multiple,
  freeSolo,
  isOptionEqualToValue,
  getOptionLabel,
  required,
  min,
  max,
  minLength,
  maxLength,
  pattern,
  validate,
  // Destructured out of `rest`: MUI spreads them onto the Autocomplete root, which
  // is the `FormControl` wrapper — a named `<div>` around an anonymous combobox
  // (#99). They are routed to `slotProps.htmlInput` on the rendered input below.
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  // Same wrapper problem, and the same fix. On the Autocomplete root this describes
  // the `FormControl` div, which nothing reads, while the `<input>` keeps only the
  // helper-text id — so a consumer's description never reached the combobox at all
  // (#102 row 8). It is merged with that id onto `slotProps.htmlInput` below,
  // because an accessible description is a list.
  'aria-describedby': ariaDescribedBy,
  labelPlacement,
  // Out of `rest`, which lands on the outer `MuiAutocomplete-root` div. The box
  // the placement rules select is the `FormControl` *inside* it — the `TextField`
  // from `renderInput` — so the hook joins the consumer's class with the placement
  // classes and both go there instead (#9, #66).
  className,
  ...rest
}: AutocompleteProps<TOption, TValue, Multiple, FreeSolo>) {
  // `getOptionValue` decides what this field stores, so that — not `option.value` — is the
  // value a duplicate actually collides on (it is also what `isOptionEqualToValue` compares).
  warnDuplicateOptions('Autocomplete', name, options, getOptionValue)

  type FormValue = AutocompleteFormValue<TValue, Multiple, FreeSolo>
  type MuiValue = AutocompleteValue<TOption, Multiple, false, FreeSolo>

  const f = useEzField<FormValue>(name, 'Autocomplete', {
    label,
    rules: { required, min, max, minLength, maxLength, pattern, validate },
    // Either channel names the field: on Autocomplete itself, or on the TextField
    // it renders. Both land on a wrapper if left alone, so both are collected here
    // and re-emitted onto the `<input>` through `f.nameA11y`.
    'aria-label': ariaLabel ?? textFieldProps?.['aria-label'],
    'aria-labelledby': ariaLabelledBy ?? textFieldProps?.['aria-labelledby'],
    labelPlacement,
    className,
  })

  // form → MUI: find the option for a stored value. When it is not in the
  // current list (async options, or an object stored via getOptionValue),
  // fall back to something MUI can still render.
  const resolve = (v: unknown): TOption | string => {
    const found = options.find((o) => Object.is(getOptionValue(o), v))
    if (found) return found
    if (typeof v === 'string' && freeSolo) return v
    if (isOptionShaped(v)) return v as TOption
    return { value: v as Option['value'], label: String(v) } as TOption
  }
  const toMui = (v: unknown): MuiValue =>
    (multiple
      ? ((v as unknown[] | null | undefined) ?? []).map(resolve)
      : v == null
        ? null
        : resolve(v)) as MuiValue

  // MUI → form: a string is freeSolo text, anything else is an option. MUI
  // reports a cleared single field as `null` (the Clear button, or the text
  // emptied by typing); under freeSolo that is empty *text*, stored as `''`.
  const toValue = (x: TOption | string): TValue | string =>
    typeof x === 'string' ? x : getOptionValue(x)
  const fromMui = (x: MuiValue): FormValue =>
    (Array.isArray(x)
      ? (x as (TOption | string)[]).map(toValue)
      : x == null
        ? freeSolo
          ? ''
          : null
        : toValue(x as TOption | string)) as FormValue

  // Either channel describes the field — on Autocomplete itself, or on the TextField
  // it renders — exactly as with the name above. Both land on a wrapper if left alone.
  const consumerDescribedBy = ariaDescribedBy ?? textFieldProps?.['aria-describedby']
  const text = f.helperText(helperText)

  const optionLabel: NonNullable<MuiProps<TOption, Multiple, FreeSolo>['getOptionLabel']> =
    getOptionLabel ?? ((o) => (typeof o === 'string' ? o : o.label))

  // MUI's own chip rendering under `multiple` (label, size, item props, then
  // `slotProps.chip`), plus a delete icon that is named and 24×24 — MUI's default
  // icon is neither (#90). Only the fallback: a consumer's `renderValue` takes
  // over entirely, and `slotProps.chip.deleteIcon`, spread last, still wins.
  // Typed over `true` rather than `Multiple`: the getter's shape is conditional
  // on it, and this only ever runs once `multiple` is set.
  const renderChips = (
    items: AutocompleteRenderValue<TOption, true, FreeSolo>,
    getItemProps: AutocompleteRenderValueGetItemProps<true>,
    ownerState: AutocompleteOwnerState<TOption, Multiple, false, FreeSolo>,
  ) => {
    // `slotProps.chip` may be a function of ownerState (MUI's `SlotProps` type);
    // MUI's own chip path spreads it as-is, so this is the one place it is honoured.
    // The cast narrows MUI's `SlotProps<ElementType<…>>` (a union over every
    // element that could take chip props) back to the chip props it holds.
    const chip = rest.slotProps?.chip
    const chipProps = (typeof chip === 'function' ? chip(ownerState) : chip) as
      Partial<ChipProps> | undefined
    return items.map((item, index) => {
      const { key, ...itemProps } = getItemProps({ index })
      const chipLabel = optionLabel(item)
      return (
        <Chip
          key={key}
          label={chipLabel}
          size={rest.size}
          {...itemProps}
          deleteIcon={<ChipDeleteIcon label={chipLabel} />}
          {...chipProps}
        />
      )
    })
  }

  return (
    <MuiAutocomplete<TOption, Multiple, false, FreeSolo>
      {...rest}
      options={options}
      multiple={multiple}
      freeSolo={freeSolo}
      disabled={mergeDisabled(disabled, f.field.disabled)}
      value={toMui(f.field.value)}
      onChange={(e, value, reason, details) => {
        f.field.onChange(fromMui(value))
        onChange?.(e, value, reason, details)
      }}
      isOptionEqualToValue={
        isOptionEqualToValue ??
        // `v` is `TOption | string` only under freeSolo; a non-string is always an option.
        ((o, v) =>
          Object.is(getOptionValue(o), typeof v === 'string' ? v : getOptionValue(v as TOption)))
      }
      getOptionLabel={optionLabel}
      renderValue={
        rest.renderValue ??
        (multiple
          ? (renderChips as MuiProps<TOption, Multiple, FreeSolo>['renderValue'])
          : undefined)
      }
      renderInput={(params) => (
        // MUI TextField sets aria-invalid/aria-describedby itself; only `role` comes from the hook.
        // InputBase forks `inputRef` with the Autocomplete's own input ref and calls
        // both onBlur handlers, so nothing from `params` is overridden here.
        <MuiTextField
          {...params}
          {...textFieldProps}
          // UPSTREAM SHIM (#142). The one MUI boundary: the cast widens back to MUI's
          // closed union, and `customVariantSlots` supplies the `slots.input` its
          // `variantComponent` map has no entry for. `params` carries no `slots`, so
          // the consumer's `textFieldProps.slots` is the only other source.
          variant={textFieldProps?.variant as MuiTextFieldProps['variant']}
          slots={customVariantSlots(textFieldProps?.variant, textFieldProps?.slots)}
          // On the rendered TextField, not on `MuiAutocomplete`: Autocomplete
          // renders an outer `MuiAutocomplete-root` div around the TextField, and
          // the `FormControl` box the placement rules select is the TextField's.
          // The hook has already joined the consumer's own `className` into it.
          className={f.layoutClassName}
          // `textFieldProps` may carry them; on the TextField root they would name and
          // describe the `FormControl` wrapper. `f.nameA11y` and `f.describedBy`
          // re-emit them on the `<input>` through `slotProps.htmlInput` below.
          aria-label={undefined}
          aria-labelledby={undefined}
          aria-describedby={undefined}
          label={f.displayLabel}
          required={f.required}
          error={f.invalid}
          helperText={text}
          inputRef={f.field.ref}
          onBlur={() => f.field.onBlur()}
          slotProps={{
            ...params.slotProps,
            // Through the hook, not a literal `{ role }`: the binding owns the
            // helper-text role wherever it is set, so the one attribute that makes an
            // error reach a screen reader cannot be displaced (#104). Nothing is
            // merged in — `renderInput`'s `params.slotProps` carries no
            // `formHelperText`, and `textFieldProps` `Omit`s `slotProps`, so there is
            // no consumer channel here today. Routing it through the hook is what
            // keeps the binding the owner if one is ever added.
            //
            // This field used to opt out of pinning the hook's `helperTextId` here
            // (`pinId: false`), because it left the `aria-describedby` wiring to MUI,
            // which generates its own id. That is exactly why a consumer's own
            // description could never reach the combobox: MUI overwrites the
            // attribute wholesale. The input's description is owned below now, the
            // same way `TextField` owns it, so the helper text carries the hook's id
            // like everywhere else and `pinId` is gone (#102 row 8).
            formHelperText: f.helperTextSlotProps(undefined),
            inputLabel: mergeSlotProps(params.slotProps?.inputLabel, { required: f.labelRequired }),
            // `inputProps` first: `mergeSlotProps` lets the *external* value win
            // for plain props (so a caller's `autoComplete` beats the `'off'`
            // Autocomplete sets) and composes handlers external-first. Note that
            // "first" only orders the input's own handlers: MUI's Autocomplete
            // binds its keydown on the *root*, which runs afterwards regardless,
            // so a caller cannot suppress Enter/Backspace by preventing default.
            // `f.nameA11y` last, and spread rather than merged: it is the field's
            // own routing of a prop the consumer wrote, so it must beat whatever
            // `getInputProps()` put there for the label-less case. Absent keys are
            // omitted, so a labelled field keeps MUI's own `aria-labelledby`.
            htmlInput: {
              ...mergeSlotProps(inputProps, params.slotProps?.htmlInput),
              ...f.nameA11y,
              // Last, so it beats the `aria-describedby` MUI's `getInputProps()` set
              // pointing at its own generated helper-text id. That id is the reason a
              // consumer's description used to vanish: MUI writes the whole attribute,
              // so anything else there was lost. Owned here instead, exactly as
              // `TextField` does it — the consumer's ids **and** the helper text's,
              // space-joined, because a description is a list (#102 row 8).
              'aria-describedby': f.describedBy(consumerDescribedBy, text),
            },
          }}
        />
      )}
    />
  )
}
