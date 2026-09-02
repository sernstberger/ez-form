import Button, { type ButtonProps } from '@mui/material/Button'
import { useFormState } from 'react-hook-form'
import { useEzFormContext } from '../useEzFormContext'
import { mergeDisabled } from '../fields/mergeDisabled'
import { useConfirm, type ConfirmOptions } from '../ConfirmDialog'
import { emptyOf } from './emptyOf'

export interface ClearButtonProps extends Omit<ButtonProps, 'type'> {
  /** `defaults` (hookform `reset()`) or `empty` (blank every field by its type). Default `defaults`. */
  to?: 'defaults' | 'empty'
  /** Ask first. `true` uses `Discard changes?`; pass `ConfirmOptions` for your own copy. */
  confirm?: true | ConfirmOptions
}

/**
 * Resets the form. Disabled while there is nothing to clear (`!isDirty`) and
 * while the form is disabled.
 */
export function ClearButton({
  to = 'defaults',
  confirm,
  disabled,
  variant = 'text',
  children = 'Clear',
  onClick,
  ...rest
}: ClearButtonProps) {
  const { reset } = useEzFormContext('ClearButton')
  const { isDirty, disabled: formDisabled, defaultValues } = useFormState()
  const { confirm: ask, dialog } = useConfirm()
  const options: ConfirmOptions | undefined =
    confirm === true ? { title: 'Discard changes?' } : confirm

  return (
    <>
      <Button
        type="button"
        variant={variant}
        disabled={mergeDisabled(disabled, formDisabled) || !isDirty}
        onClick={async (event) => {
          onClick?.(event)
          if (options && !(await ask(options))) return
          if (to === 'empty') reset(emptyOf(defaultValues) as typeof defaultValues)
          else reset()
        }}
        {...rest}
      >
        {children}
      </Button>
      {dialog}
    </>
  )
}
