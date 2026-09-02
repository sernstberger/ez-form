import type { ReactNode } from 'react'
import type { ValidationRule } from 'react-hook-form'
import { useWatch } from 'react-hook-form'
import { useDefaultProps } from '@mui/material/DefaultPropsProvider'
import generateUtilityClasses from '@mui/material/generateUtilityClasses'
import { styled } from '@mui/material/styles'
import { TextField, type TextFieldProps } from '../TextField'
import { useEzFormContext } from '../../useEzFormContext'

export const textareaFieldClasses = generateUtilityClasses('EzTextareaField', ['root', 'counter'])

// The length meter, rendered as a trailing element inside the `FormHelperText` row so
// it stays under the same `aria-describedby` id `TextField` already points at. `span`,
// not `Typography`: it sits inside `FormHelperText`, which supplies its own typography.
const TextareaFieldCounter = styled('span', { name: 'EzTextareaField', slot: 'Counter' })({})

export type TextareaFieldProps = Omit<TextFieldProps, 'multiline' | 'rows' | 'componentName'> & {
  /**
   * Shows the length meter (`n` or `n / max`) even with no `maxLength` rule.
   * A `maxLength` rule always shows the meter; this only adds it when there
   * is no bound to count against.
   */
  showCount?: boolean
}

const bound = (rule: ValidationRule<number> | undefined): number | undefined =>
  rule === undefined ? undefined : typeof rule === 'number' ? rule : rule.value

/**
 * `TextField` with `multiline` fixed on: a taller default (`minRows: 4`,
 * `maxRows: 12`, both themeable) and an optional length meter. The meter
 * reads the live value with `useWatch` (this component owns no field of its
 * own) and renders as a trailing counter alongside `helperText`, which
 * `TextField` still fully replaces with the error message when the
 * `maxLength` rule fails — the over-limit case is reported there, never by
 * colour alone.
 */
export function TextareaField(inProps: TextareaFieldProps) {
  const props = useDefaultProps({ props: inProps, name: 'EzTextareaField' })
  const {
    name,
    helperText,
    maxLength,
    showCount,
    minRows = 4,
    maxRows = 12,
    className,
    ...rest
  } = props
  useEzFormContext('TextareaField')
  // `useWatch` is typed `any` for an untyped control; the `typeof value === 'string'` check
  // below is what actually narrows it, so `unknown` loses nothing.
  const value: unknown = useWatch({ name })
  const max = bound(maxLength)
  const length = typeof value === 'string' ? value.length : 0
  // Boolean OR, not a nullish fallback: the meter shows if either the consumer asked for it
  // or a maxLength gives it something to count against.
  const showMeter = showCount === true || max !== undefined

  const composedHelperText: ReactNode = showMeter ? (
    <>
      {helperText}
      {helperText ? ' ' : null}
      <TextareaFieldCounter className={textareaFieldClasses.counter}>
        {max !== undefined ? `${length} / ${max}` : length}
      </TextareaFieldCounter>
    </>
  ) : (
    helperText
  )

  return (
    <TextField
      name={name}
      componentName="TextareaField"
      helperText={composedHelperText}
      maxLength={maxLength}
      minRows={minRows}
      maxRows={maxRows}
      multiline
      className={`${textareaFieldClasses.root}${className ? ` ${className}` : ''}`}
      {...rest}
    />
  )
}
