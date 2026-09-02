import Button, { type ButtonProps } from '@mui/material/Button'
import { styled } from '@mui/material/styles'
import { useDefaultProps } from '@mui/material/DefaultPropsProvider'
import generateUtilityClasses from '@mui/material/generateUtilityClasses'
import { useFormState } from 'react-hook-form'
import { useEzFormContext } from '../useEzFormContext'
import { mergeDisabled } from '../fields/mergeDisabled'
import { useConfirm, type ConfirmOptions } from '../ConfirmDialog'
import { emptyOf } from './emptyOf'

export const clearButtonClasses = generateUtilityClasses('EzClearButton', ['root'])

export interface ClearButtonProps extends Omit<ButtonProps, 'type'> {
  /** `defaults` (hookform `reset()`) or `empty` (blank every field by its type). Default `defaults`. */
  to?: 'defaults' | 'empty'
  /** Ask first. `true` uses `Discard changes?`; pass `ConfirmOptions` for your own copy. */
  confirm?: true | ConfirmOptions
}

const ClearButtonRoot = styled(Button, { name: 'EzClearButton', slot: 'Root' })({})

/**
 * Resets the form. Disabled while there is nothing to clear (`!isDirty`) and
 * while the form is disabled.
 */
export function ClearButton(inProps: ClearButtonProps) {
  const {
    to = 'defaults',
    confirm,
    disabled,
    variant = 'text',
    children = 'Clear',
    className,
    onClick,
    ...rest
  } = useDefaultProps({ props: inProps, name: 'EzClearButton' })
  const { reset } = useEzFormContext('ClearButton')
  const { isDirty, disabled: formDisabled, defaultValues } = useFormState()
  const { confirm: ask, dialog } = useConfirm()
  const options: ConfirmOptions | undefined =
    confirm === true ? { title: 'Discard changes?' } : confirm

  return (
    <>
      <ClearButtonRoot
        type="button"
        variant={variant}
        disabled={mergeDisabled(disabled, formDisabled) || !isDirty}
        className={`${clearButtonClasses.root}${className ? ` ${className}` : ''}`}
        onClick={async (event) => {
          onClick?.(event)
          if (options && !(await ask(options))) return
          if (to === 'empty') reset(emptyOf(defaultValues) as typeof defaultValues)
          else reset()
        }}
        {...rest}
      >
        {children}
      </ClearButtonRoot>
      {dialog}
    </>
  )
}
