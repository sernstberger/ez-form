import Button, { type ButtonProps } from '@mui/material/Button'
import { styled } from '@mui/material/styles'
import { useDefaultProps } from '@mui/material/DefaultPropsProvider'
import generateUtilityClasses from '@mui/material/generateUtilityClasses'
import { useFormState } from 'react-hook-form'
import { useEzFormContext } from '../useEzFormContext'
import { mergeDisabled } from '../fields/mergeDisabled'

export const submitButtonClasses = generateUtilityClasses('EzSubmitButton', ['root'])

export type SubmitButtonProps = Omit<ButtonProps, 'type'>

const SubmitButtonRoot = styled(Button, { name: 'EzSubmitButton', slot: 'Root' })({})

export function SubmitButton(inProps: SubmitButtonProps) {
  const {
    disabled,
    variant = 'contained',
    children = 'Submit',
    className,
    ...rest
  } = useDefaultProps({ props: inProps, name: 'EzSubmitButton' })
  useEzFormContext('SubmitButton') // guard only; useFormState reads control from context
  const { isSubmitting, disabled: formDisabled } = useFormState()

  return (
    <SubmitButtonRoot
      type="submit"
      variant={variant}
      disabled={mergeDisabled(disabled, formDisabled)}
      loading={isSubmitting}
      className={`${submitButtonClasses.root}${className ? ` ${className}` : ''}`}
      {...rest}
    >
      {children}
    </SubmitButtonRoot>
  )
}
