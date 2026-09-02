import { useId, type ReactNode, type SyntheticEvent } from 'react'
import Button, { type ButtonProps } from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import { useDefaultProps } from '@mui/material/DefaultPropsProvider'
import FormControl from '@mui/material/FormControl'
import FormHelperText from '@mui/material/FormHelperText'
import generateUtilityClasses from '@mui/material/generateUtilityClasses'
import Stack from '@mui/material/Stack'
import SvgIcon, { type SvgIconProps } from '@mui/material/SvgIcon'
import { styled } from '@mui/material/styles'
import { useEzField } from '../useEzField'
import { mergeDisabled } from '../mergeDisabled'
import type { FieldRules } from '../../rules'

// Inline copies of @mui/icons-material CloudUpload and Close.
const UploadIcon = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path d="M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96M14 13v4h-4v-4H7l5-5 5 5z" />
  </SvgIcon>
)
const CloseIcon = (props: SvgIconProps) => (
  <SvgIcon {...props}>
    <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
  </SvgIcon>
)

// MUI's documented file-upload pattern: a visually hidden input inside a Button rendered as <label>.
const VisuallyHiddenInput = styled('input')({
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  height: 1,
  overflow: 'hidden',
  position: 'absolute',
  bottom: 0,
  left: 0,
  whiteSpace: 'nowrap',
  width: 1,
})

export const fileFieldClasses = generateUtilityClasses('EzFileField', ['root', 'fileList'])

// Chips wrap onto further rows once the row is full, with a gap above the
// button — the component's minimum layout so the list doesn't collide with
// it — so it lives on the styled slot's default style block, still
// overridable via `theme.components.EzFileField.styleOverrides.fileList`.
const FileFieldList = styled(Stack, { name: 'EzFileField', slot: 'FileList' })(({ theme }) => ({
  flexWrap: 'wrap',
  marginTop: theme.spacing(1),
}))

export type FileFieldValue = File | null | File[]

export type FileFieldProps = {
  name: string
  /** The button text, and the input's accessible name. */
  label: ReactNode
  helperText?: ReactNode
  disabled?: boolean
  /** Native `accept` (`".pdf,image/*"`). */
  accept?: string
  /** Store `File[]` instead of `File | null`. */
  multiple?: boolean
  /** Props for the MUI Button (`variant`, `color`, `size`, `startIcon`, …). */
  buttonProps?: Omit<ButtonProps<'label'>, 'component' | 'htmlFor' | 'children' | 'role'>
  /**
   * Runs after the form's handler on every value change: a pick of at least
   * one file (a cancelled dialog changes nothing), or a chip's delete click.
   */
  onChange?: (event: SyntheticEvent, value: FileFieldValue) => void
} & Pick<FieldRules<FileFieldValue>, 'required' | 'validate'>

/**
 * File input whose form value is `File | null`, or `File[]` under `multiple`.
 * A cancelled dialog keeps the current value; the native input is cleared
 * after every pick so choosing the same file again fires `change`.
 */
export function FileField(inProps: FileFieldProps) {
  const {
    name,
    label,
    helperText,
    disabled,
    accept,
    multiple,
    buttonProps,
    onChange,
    required,
    validate,
  } = useDefaultProps({ props: inProps, name: 'EzFileField' })
  const f = useEzField<FileFieldValue>(name, 'FileField', { label, rules: { required, validate } })
  const id = useId()
  const text = f.helperText(helperText)
  const value = f.field.value as FileFieldValue | undefined
  const files: File[] = Array.isArray(value) ? value : value ? [value] : []
  const isDisabled = mergeDisabled(disabled, f.field.disabled)

  const store = (event: SyntheticEvent, next: File[]) => {
    const value = multiple ? next : (next[0] ?? null)
    f.field.onChange(value)
    onChange?.(event, value)
  }

  return (
    <FormControl
      error={f.invalid}
      disabled={isDisabled}
      required={f.required}
      className={fileFieldClasses.root}
    >
      <Button
        variant="outlined" // guardrail: allow #62 literal variant on the picker button, tracked
        startIcon={<UploadIcon />}
        {...buttonProps}
        component="label"
        htmlFor={id}
        disabled={isDisabled}
        // A native <label htmlFor> already activates the input on click/Enter/Space with
        // no script; MUI's inferred role="button" then wraps a focusable descendant, which
        // axe's nested-interactive rule flags. Drop the redundant role, not the native label.
        role={undefined}
      >
        {label}
        {f.required ? <span aria-hidden="true">&thinsp;*</span> : null}
        <VisuallyHiddenInput
          id={id}
          type="file"
          name={f.field.name}
          ref={f.field.ref}
          accept={accept}
          multiple={multiple}
          required={f.required}
          disabled={isDisabled}
          {...f.inputA11y(text)}
          onBlur={() => f.field.onBlur()}
          onChange={(e) => {
            const picked = Array.from(e.target.files ?? [])
            if (picked.length === 0) return // cancelled dialog: keep what we have
            store(e, picked)
            // jsdom doesn't fully implement resetting a file input's value; browsers allow it
            // so the same file can be picked again and still fire change.
            try {
              e.target.value = ''
            } catch {
              // jsdom: assigning value on a file input can throw; safe to ignore.
            }
          }}
        />
      </Button>
      {files.length > 0 ? (
        <FileFieldList direction="row" spacing={1} useFlexGap className={fileFieldClasses.fileList}>
          {files.map((file) => (
            <Chip
              key={`${file.name}-${file.size}-${file.lastModified}`}
              label={file.name}
              disabled={isDisabled}
              onDelete={(event: SyntheticEvent) =>
                store(
                  event,
                  files.filter((other) => other !== file),
                )
              }
              // Chip clones this element with its own onClick; the default icon has no accessible
              // name, and SvgIcon defaults aria-hidden to true unless overridden here.
              deleteIcon={
                <CloseIcon
                  role="button"
                  aria-label={`Remove ${file.name}`}
                  aria-hidden={undefined}
                />
              }
            />
          ))}
        </FileFieldList>
      ) : null}
      {text ? <FormHelperText {...f.helperTextA11y}>{text}</FormHelperText> : null}
    </FormControl>
  )
}
