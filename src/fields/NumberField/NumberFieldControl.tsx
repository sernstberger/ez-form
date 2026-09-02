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
import { useDefaultProps } from '@mui/material/DefaultPropsProvider'
import generateUtilityClasses from '@mui/material/generateUtilityClasses'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import MuiTextField from '@mui/material/TextField'
import SvgIcon, { type SvgIconProps } from '@mui/material/SvgIcon'
import { styled, type Theme } from '@mui/material/styles'
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

export interface NumberFieldInputProps {
  'aria-invalid'?: true
  'aria-describedby'?: string
  onBlur?: FocusEventHandler<HTMLInputElement>
  onFocus?: FocusEventHandler<HTMLInputElement>
}

export interface NumberFieldControlProps extends Omit<
  BaseNumberField.Root.Props,
  'render' | 'children' | 'className'
> {
  /**
   * On the rendered `TextField` root, alongside `numberFieldClasses.root`. Base UI's
   * Root takes a `(state) => string` form too, but Root renders no element here —
   * `TextField` is the root — so this is the plain `string` MUI takes.
   */
  className?: string
  label?: ReactNode
  size?: 'small' | 'medium'
  error?: boolean
  helperText?: ReactNode
  helperTextProps?: { id: string; role?: 'alert' }
  /** Forked with Base UI's own ref on the visible input (Root's `inputRef` is its hidden input). */
  inputRef?: Ref<HTMLInputElement>
  inputProps?: NumberFieldInputProps
}

export const numberFieldClasses = generateUtilityClasses('EzNumberField', [
  'root',
  'steppers',
  'increment',
  'decrement',
])

const NumberFieldRoot = styled(MuiTextField, { name: 'EzNumberField', slot: 'Root' })({})

// The steppers stack vertically in a divided column flush with the outlined
// border — the component's minimum layout, so it lives on the styled slot's
// default style block rather than as `sx`, and stays overridable via
// `theme.components.EzNumberField.styleOverrides.steppers`.
const NumberFieldSteppers = styled(InputAdornment, { name: 'EzNumberField', slot: 'Steppers' })(
  ({ theme }) => ({
    flexDirection: 'column',
    maxHeight: 'unset',
    alignSelf: 'stretch',
    borderLeft: `1px solid ${(theme.vars ?? theme).palette.divider}`,
    marginLeft: 0,
  }),
)
// Half the theme's radius, matching the `borderRadius: 0.5` the pre-theming version
// asked `sx` for (sx multiplies `shape.borderRadius`). `theme.shape.borderRadius` is a
// unitless number while `theme.vars.shape.borderRadius` is already a CSS length, so
// only the former needs `px` before `calc` can halve it.
const stepperButton = ({ theme }: { theme: Theme }) => {
  const radius = (theme.vars ?? theme).shape.borderRadius
  return {
    paddingTop: 0,
    paddingBottom: 0,
    flex: 1,
    borderRadius: `calc(${typeof radius === 'number' ? `${radius}px` : radius} / 2)`,
  }
}
const NumberFieldIncrement = styled(IconButton, { name: 'EzNumberField', slot: 'Increment' })(
  stepperButton,
)
const NumberFieldDecrement = styled(IconButton, { name: 'EzNumberField', slot: 'Decrement' })(
  stepperButton,
)

interface NumberInputProps {
  baseProps: ComponentPropsWithRef<'input'>
  inputValue: string
  label: ReactNode
  size: 'small' | 'medium'
  error: boolean | undefined
  helperText: ReactNode
  helperTextProps: { id: string; role?: 'alert' } | undefined
  disabled: boolean
  required: boolean
  className: string | undefined
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
  error,
  helperText,
  helperTextProps,
  disabled,
  required,
  className,
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
    <NumberFieldRoot
      // `id` on TextField itself so its FormControl/InputLabel/helper-text wiring
      // uses Base UI's id (`htmlFor`, `aria-describedby`) instead of one of its own.
      id={rest.id}
      className={`${numberFieldClasses.root}${className ? ` ${className}` : ''}`}
      label={label}
      size={size}
      error={error}
      helperText={helperText}
      disabled={disabled}
      required={required}
      slotProps={{
        formHelperText: helperTextProps,
        // `htmlInput` is the native <input> InputBase renders; `slots.input` /
        // `inputComponent` is InputBase's own wrapper and would give Base UI and
        // InputBase two owners of one controlled input (see #26).
        htmlInput: {
          ...rest,
          ...inputProps,
          ref: handleRef,
          value: inputValue,
          onChange: (e: ChangeEvent<HTMLInputElement>) => {
            // Skip the rewrite mid-composition: reassigning `.value` while an IME is
            // composing cancels the composition. React types `nativeEvent` as `Event`,
            // but a change from typing is an InputEvent, which carries `isComposing`.
            const composing = (e.nativeEvent as InputEvent).isComposing === true
            if (separators && !composing) {
              const typed = e.currentTarget.value
              const { text, caret } = groupWhileTyping(
                typed,
                e.currentTarget.selectionStart ?? typed.length,
                separators,
              )
              if (text !== typed) {
                // Base UI's onChange reads `currentTarget.value` and parses grouped text fine
                // (its parser strips the group separator).
                e.currentTarget.value = text
                if (text === inputValue) {
                  // Base UI will call setInputValue(text) with the value it already holds, so
                  // React bails out and no commit follows — the layout effect above would never
                  // run. This happens whenever an edit deletes a separator we put straight back
                  // (backspace at `1,|000`). Nothing is re-rendering, so place the caret now.
                  e.currentTarget.setSelectionRange(caret, caret)
                } else {
                  // The text differs from what the input already showed, so assigning `.value`
                  // above moved the caret to the end (React's own `updateInput` would have left
                  // it alone — it skips the assignment when `node.value` already equals the new
                  // prop, which is not the case here). Restore it in the layout effect, after
                  // the commit Base UI is about to trigger.
                  pendingCaret.current = caret
                }
              }
            }
            rest.onChange?.(e)
          },
          onBlur: (e: FocusEvent<HTMLInputElement>) => {
            rest.onBlur?.(e)
            inputProps?.onBlur?.(e)
          },
          onFocus: (e: FocusEvent<HTMLInputElement>) => {
            rest.onFocus?.(e)
            inputProps?.onFocus?.(e)
          },
        },
        input: {
          endAdornment: (
            <NumberFieldSteppers position="end" className={numberFieldClasses.steppers}>
              <BaseNumberField.Increment
                render={
                  <NumberFieldIncrement
                    size={size}
                    aria-label="Increase"
                    className={numberFieldClasses.increment}
                  />
                }
              >
                <ArrowUpIcon fontSize={size} />
              </BaseNumberField.Increment>
              <BaseNumberField.Decrement
                render={
                  <NumberFieldDecrement
                    size={size}
                    aria-label="Decrease"
                    className={numberFieldClasses.decrement}
                  />
                }
              >
                <ArrowDownIcon fontSize={size} />
              </BaseNumberField.Decrement>
            </NumberFieldSteppers>
          ),
        },
      }}
    />
  )
}

/**
 * Base UI NumberField rendered through MUI's `TextField`: Base UI owns the value,
 * the keyboard stepping and the a11y wiring, and its `Input` render props go to
 * `slotProps.htmlInput` so TextField supplies the label, helper text and outlined
 * look. Unbound: `NumberField` wires it to the form.
 */
export function NumberFieldControl(inProps: NumberFieldControlProps) {
  const props = useDefaultProps({ props: inProps, name: 'EzNumberField' })
  const {
    id: idProp,
    label,
    size = 'medium',
    error,
    helperText,
    helperTextProps,
    inputRef,
    inputProps,
    className,
    ...rootProps
  } = props
  const generatedId = useId()
  const id = idProp ?? generatedId
  const { locale, format } = rootProps
  const separators = useMemo(
    () => (format?.useGrouping === false ? null : getSeparators(locale, format)),
    [locale, format],
  )
  return (
    // Root's `id` is the input's id; via context it also becomes the steppers' `aria-controls`.
    <BaseNumberField.Root {...rootProps} id={id}>
      <BaseNumberField.Input
        render={(inputRenderProps, state) => (
          <NumberInput
            baseProps={inputRenderProps as ComponentPropsWithRef<'input'>}
            inputValue={state.inputValue}
            label={label}
            size={size}
            error={error}
            helperText={helperText}
            helperTextProps={helperTextProps}
            disabled={state.disabled}
            required={state.required}
            className={className}
            inputRef={inputRef}
            inputProps={inputProps}
            separators={separators}
          />
        )}
      />
    </BaseNumberField.Root>
  )
}
