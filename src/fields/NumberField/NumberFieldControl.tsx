import {
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  type ChangeEvent,
  type ComponentPropsWithRef,
  type FocusEvent,
  type FocusEventHandler,
  type ReactNode,
  type Ref,
} from 'react'
import { NumberField as BaseNumberField } from '@base-ui/react/number-field'
import FormControl from '@mui/material/FormControl'
import FormHelperText from '@mui/material/FormHelperText'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import InputLabel from '@mui/material/InputLabel'
import OutlinedInput from '@mui/material/OutlinedInput'
import SvgIcon, { type SvgIconProps } from '@mui/material/SvgIcon'
import { useForkRef } from '@mui/material/utils'
import { getSeparators, groupWhileTyping, type Separators } from './groupWhileTyping'

// Inline copies of @mui/icons-material KeyboardArrowUp / KeyboardArrowDown.
const ArrowUpIcon = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path d="M7.41 15.41 12 10.83l4.59 4.58L18 14l-6-6-6 6z" />
  </SvgIcon>
)
const ArrowDownIcon = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
  </SvgIcon>
)

/** Placeholder so FormControl sets the shrink label state correctly on SSR (from the MUI recipe). */
function SSRInitialFilled(_: BaseNumberField.Root.Props) {
  return null
}
SSRInitialFilled.muiName = 'Input'

export interface NumberFieldInputProps {
  'aria-invalid'?: true
  'aria-describedby'?: string
  onBlur?: FocusEventHandler<HTMLInputElement>
  onFocus?: FocusEventHandler<HTMLInputElement>
}

export interface NumberFieldControlProps extends Omit<
  BaseNumberField.Root.Props,
  'render' | 'children'
> {
  label?: ReactNode
  size?: 'small' | 'medium'
  error?: boolean
  helperText?: ReactNode
  helperTextProps?: { id: string; role?: 'alert' }
  /** Forked with Base UI's own ref on the visible input (Root's `inputRef` is its hidden input). */
  inputRef?: Ref<HTMLInputElement>
  inputProps?: NumberFieldInputProps
}

interface NumberInputProps {
  baseProps: ComponentPropsWithRef<'input'>
  inputValue: string
  label: ReactNode
  size: 'small' | 'medium'
  inputRef: Ref<HTMLInputElement> | undefined
  inputProps: NumberFieldInputProps | undefined
  /** null turns live grouping off (`format.useGrouping === false`). */
  separators: Separators | null
}

// Module-level so useForkRef is a stable hook call, not one inside Base UI's render callback.
function NumberInput({
  baseProps,
  inputValue,
  label,
  size,
  inputRef,
  inputProps,
  separators,
}: NumberInputProps) {
  const { ref, ...rest } = baseProps
  const inputElementRef = useRef<HTMLInputElement | null>(null)
  const handleRef = useForkRef(useForkRef(ref, inputRef), inputElementRef)
  // Caret to restore after Base UI re-renders the controlled input with our grouped text.
  const pendingCaret = useRef<number | null>(null)

  useLayoutEffect(() => {
    const caret = pendingCaret.current
    pendingCaret.current = null
    const element = inputElementRef.current
    if (caret === null || !element || document.activeElement !== element) return
    element.setSelectionRange(caret, caret)
  }, [inputValue])

  return (
    <OutlinedInput
      label={label}
      size={size}
      inputRef={handleRef}
      value={inputValue}
      // Base UI's handlers go on the real <input>. InputBase chains onChange/onBlur/onFocus only
      // from `inputProps`; `slotProps.input` handlers are overwritten by its own, so use `inputProps`.
      inputProps={{
        ...rest,
        ...inputProps,
        onChange: (e) => {
          const event = e as ChangeEvent<HTMLInputElement>
          if (separators) {
            const typed = event.target.value
            const { text, caret } = groupWhileTyping(
              typed,
              event.target.selectionStart ?? typed.length,
              separators,
            )
            if (text !== typed) {
              // Base UI reads event.target.value and parses grouped text fine; the caret it
              // would otherwise leave behind is restored by the layout effect above.
              event.target.value = text
              pendingCaret.current = caret
            }
          }
          rest.onChange?.(event)
        },
        onBlur: (e) => {
          // InputBase types the event for input | textarea; this slot is always an <input>.
          const event = e as FocusEvent<HTMLInputElement>
          rest.onBlur?.(event)
          inputProps?.onBlur?.(event)
        },
        onFocus: (e) => {
          const event = e as FocusEvent<HTMLInputElement>
          rest.onFocus?.(event)
          inputProps?.onFocus?.(event)
        },
      }}
      endAdornment={
        <InputAdornment
          position="end"
          sx={{
            flexDirection: 'column',
            maxHeight: 'unset',
            alignSelf: 'stretch',
            borderLeft: '1px solid',
            borderColor: 'divider',
            ml: 0,
            '& button': { py: 0, flex: 1, borderRadius: 0.5 },
          }}
        >
          <BaseNumberField.Increment render={<IconButton size={size} aria-label="Increase" />}>
            <ArrowUpIcon fontSize={size} sx={{ transform: 'translateY(2px)' }} />
          </BaseNumberField.Increment>
          <BaseNumberField.Decrement render={<IconButton size={size} aria-label="Decrease" />}>
            <ArrowDownIcon fontSize={size} sx={{ transform: 'translateY(-2px)' }} />
          </BaseNumberField.Decrement>
        </InputAdornment>
      }
      sx={{ pr: 0 }}
    />
  )
}

/**
 * Base UI NumberField styled like a MUI outlined TextField. Adapted from
 * https://mui.com/material-ui/react-number-field/ with ez-form's a11y and ref
 * extension points. Unbound: `NumberField` wires it to the form.
 */
export function NumberFieldControl({
  id: idProp,
  label,
  size = 'medium',
  error,
  helperText,
  helperTextProps,
  inputRef,
  inputProps,
  ...rootProps
}: NumberFieldControlProps) {
  const generatedId = useId()
  const id = idProp ?? generatedId
  const { locale, format } = rootProps
  const separators = useMemo(
    () => (format?.useGrouping === false ? null : getSeparators(locale, format)),
    [locale, format],
  )
  return (
    // Root's `id` is the input's id; via context it also becomes the steppers' `aria-controls`.
    <BaseNumberField.Root
      {...rootProps}
      id={id}
      render={(props, state) => (
        <FormControl
          size={size}
          ref={props.ref}
          disabled={state.disabled}
          required={state.required}
          error={error}
          variant="outlined"
        >
          {props.children}
        </FormControl>
      )}
    >
      <SSRInitialFilled {...rootProps} />
      {label ? <InputLabel htmlFor={id}>{label}</InputLabel> : null}
      <BaseNumberField.Input
        render={(props, state) => (
          <NumberInput
            baseProps={props as ComponentPropsWithRef<'input'>}
            inputValue={state.inputValue}
            label={label}
            size={size}
            inputRef={inputRef}
            inputProps={inputProps}
            separators={separators}
          />
        )}
      />
      {helperText ? (
        <FormHelperText {...helperTextProps} sx={{ ml: 0 }}>
          {helperText}
        </FormHelperText>
      ) : null}
    </BaseNumberField.Root>
  )
}
