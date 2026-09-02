import Alert, { type AlertProps } from '@mui/material/Alert'
import { styled } from '@mui/material/styles'
import { useDefaultProps } from '@mui/material/DefaultPropsProvider'
import generateUtilityClasses from '@mui/material/generateUtilityClasses'
import { useFormState } from 'react-hook-form'
import { useEzFormContext } from '../useEzFormContext'

export const formErrorClasses = generateUtilityClasses('EzFormError', ['root'])

export type FormErrorProps = Omit<AlertProps, 'children'>

const FormErrorRoot = styled(Alert, { name: 'EzFormError', slot: 'Root' })({})

/**
 * Renders `formState.errors.root` (set via `form.setError('root.<key>', { message })`,
 * for example a rejected async `onSubmit`) as an MUI `Alert`. `Alert`'s default
 * `role="alert"` makes the message a live-region announcement. Renders nothing
 * when there is no root error, so it is safe to always mount.
 */
export function FormError(inProps: FormErrorProps) {
  const {
    severity = 'error',
    className,
    ...rest
  } = useDefaultProps({
    props: inProps,
    name: 'EzFormError',
  })
  useEzFormContext('FormError') // guard only; useFormState reads control from context
  const { errors } = useFormState()
  // `setError('root.<key>', { message })` (root.server, root.random, …) nests under
  // `errors.root[<key>]`; a bare `setError('root', { message })` sets `errors.root`
  // itself. Read whichever is present so either form works.
  // Required by TS 7 (`pnpm typecheck`); the linter's TS 6 API reads `errors.root`
  // differently and thinks it is redundant. See eslint.config.js on the two compilers.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  const root = errors.root as Record<string, { message?: string }> | undefined
  const message =
    root && typeof root.message === 'string'
      ? root.message
      : root && Object.values(root).find((e) => typeof e?.message === 'string')?.message

  if (!message) return null

  return (
    <FormErrorRoot
      severity={severity}
      className={`${formErrorClasses.root}${className ? ` ${className}` : ''}`}
      {...rest}
    >
      {message}
    </FormErrorRoot>
  )
}
