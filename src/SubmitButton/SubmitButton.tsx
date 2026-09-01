import Button, { type ButtonProps } from '@mui/material/Button'
import { useFormState } from 'react-hook-form'
import { useEzFormContext } from '../useEzFormContext'
import { mergeDisabled } from '../fields/mergeDisabled'

export type SubmitButtonProps = Omit<ButtonProps, 'type'>

export function SubmitButton({
  disabled,
  variant = 'contained',
  children = 'Submit',
  ...rest
}: SubmitButtonProps) {
  useEzFormContext('SubmitButton') // guard only; useFormState reads control from context
  const { isSubmitting, disabled: formDisabled } = useFormState()

  return (
    <Button
      type="submit"
      variant={variant}
      disabled={mergeDisabled(disabled, formDisabled)}
      loading={isSubmitting}
      {...rest}
    >
      {children}
    </Button>
  )
}
