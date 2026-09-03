import type { ReactNode } from 'react'
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
  /** Ask first. `true` uses `confirmTitle` as the title; pass `ConfirmOptions` for your own copy. */
  confirm?: true | ConfirmOptions
  /**
   * Title of the dialog `confirm={true}` opens. Default `Discard changes?`.
   * Its own prop, rather than part of `confirm`, so a theme (a locale object)
   * can translate it without switching the confirmation on for every button.
   */
  confirmTitle?: ReactNode
  /**
   * Fires only once the clear has actually happened: with `confirm` set, right
   * after the dialog is confirmed and the form is `reset()`; not called at all
   * if the dialog is cancelled. Without `confirm` there is nothing to gate on,
   * so it fires immediately on click, same as `Button`'s own `onClick` — #75.
   * This matches `Form`'s `confirm`/`onSubmit` contract, where `onSubmit` never
   * runs on a cancelled confirm either.
   */
  onClick?: ButtonProps['onClick']
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
    confirmTitle = 'Discard changes?',
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
    confirm === true ? { title: confirmTitle } : confirm

  return (
    <>
      <ClearButtonRoot
        type="button"
        variant={variant}
        disabled={mergeDisabled(disabled, formDisabled) || !isDirty}
        className={`${clearButtonClasses.root}${className ? ` ${className}` : ''}`}
        onClick={async (event) => {
          // Ruling: gate the consumer's onClick behind confirm, matching Form's
          // confirm/onSubmit contract (onSubmit never runs on a cancelled confirm)
          // — #75. Previously onClick ran unconditionally, before the dialog was
          // even answered, so a caller wiring analytics/navigation/optimistic UI
          // through it could not tell from onClick alone whether the form was
          // actually cleared. Cost if wrong: an onClick that assumes "the form was
          // cleared" fires on a Cancel too.
          if (options && !(await ask(options))) return
          if (to === 'empty') reset(emptyOf(defaultValues) as typeof defaultValues)
          else reset()
          onClick?.(event)
        }}
        {...rest}
      >
        {children}
      </ClearButtonRoot>
      {dialog}
    </>
  )
}
