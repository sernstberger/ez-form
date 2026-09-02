import type { ReactNode } from 'react'
import MuiAutocomplete, {
  type AutocompleteProps as MuiAutocompleteProps,
  type AutocompleteValue,
} from '@mui/material/Autocomplete'
import MuiTextField, { type TextFieldProps as MuiTextFieldProps } from '@mui/material/TextField'
import { mergeSlotProps } from '@mui/material/utils'
import { useEzField } from '../useEzField'
import { mergeDisabled } from '../mergeDisabled'
import type { Option } from '../Option'
import type { FieldRules } from '../../rules'
import { warnDuplicateOptions } from '../../devWarn'

/**
 * What the form stores: one value (or null), or an array under `multiple`;
 * typed text under `freeSolo`. MUI's own value type over `TValue` instead of
 * the option, with `disableClearable` pinned off (the form owns "empty").
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
      'name' | 'value' | 'error' | 'inputRef' | 'required' | 'label' | 'helperText' | 'slotProps'
    >
    /**
     * Overrides `Form`'s `optionalText` for this field when the form's
     * `requiredIndicator` is `"optional"`; `false` hides it on this field.
     */
    optionalText?: ReactNode | false
  }

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
  optionalText,
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
    optionalText,
    // The name may be on the rendered input rather than on Autocomplete itself.
    // Read, not destructured: `rest` and `textFieldProps` still carry them onward.
    'aria-label': rest['aria-label'] ?? textFieldProps?.['aria-label'],
    'aria-labelledby': rest['aria-labelledby'] ?? textFieldProps?.['aria-labelledby'],
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

  // MUI → form: a string is freeSolo text, anything else is an option.
  const toValue = (x: TOption | string): TValue | string =>
    typeof x === 'string' ? x : getOptionValue(x)
  const fromMui = (x: MuiValue): FormValue =>
    (Array.isArray(x)
      ? (x as (TOption | string)[]).map(toValue)
      : x == null
        ? null
        : toValue(x as TOption | string)) as FormValue

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
      getOptionLabel={getOptionLabel ?? ((o) => (typeof o === 'string' ? o : o.label))}
      renderInput={(params) => (
        // MUI TextField sets aria-invalid/aria-describedby itself; only `role` comes from the hook.
        // InputBase forks `inputRef` with the Autocomplete's own input ref and calls
        // both onBlur handlers, so nothing from `params` is overridden here.
        <MuiTextField
          {...params}
          {...textFieldProps}
          label={f.displayLabel}
          required={f.required}
          error={f.invalid}
          helperText={f.helperText(helperText)}
          inputRef={f.field.ref}
          onBlur={() => f.field.onBlur()}
          slotProps={{
            ...params.slotProps,
            formHelperText: { role: f.helperTextA11y.role },
            inputLabel: mergeSlotProps(params.slotProps?.inputLabel, { required: f.labelRequired }),
          }}
        />
      )}
    />
  )
}
