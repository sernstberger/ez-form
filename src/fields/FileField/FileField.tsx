import {
  Fragment,
  useEffect,
  useId,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
  type SyntheticEvent,
} from 'react'
import Button, { type ButtonProps } from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import { useDefaultProps } from '@mui/material/DefaultPropsProvider'
import FormControl from '@mui/material/FormControl'
import FormHelperText from '@mui/material/FormHelperText'
import generateUtilityClasses from '@mui/material/generateUtilityClasses'
import Stack from '@mui/material/Stack'
import { styled } from '@mui/material/styles'
import UploadFile from '@mui/icons-material/UploadFile'
import { ChipDeleteIcon } from '../ChipDeleteIcon'
import { useEzField } from '../useEzField'
import { useEzFormContext } from '../../useEzFormContext'
import { mergeDisabled } from '../mergeDisabled'
import type { FieldRules } from '../../rules'

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

export const fileFieldClasses = generateUtilityClasses('EzFileField', [
  'root',
  'fileList',
  'dropZone',
  'dragActive',
  'dropText',
])

// Chips wrap onto further rows once the row is full, with a gap above the
// button — the component's minimum layout so the list doesn't collide with
// it — so it lives on the styled slot's default style block, still
// overridable via `theme.components.EzFileField.styleOverrides.fileList`.
const FileFieldList = styled(Stack, { name: 'EzFileField', slot: 'FileList' })(({ theme }) => ({
  flexWrap: 'wrap',
  marginTop: theme.spacing(1),
}))

// The dashed outline is the affordance that says "drop here" — the component's
// minimum look for the mode, so it lives on the slot's default style block and
// every value is themeable via
// `theme.components.EzFileField.styleOverrides.dropZone` (and `.dragActive`,
// which the class-selector nesting below picks up).
const FileFieldDropZone = styled('div', { name: 'EzFileField', slot: 'DropZone' })(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: theme.spacing(1),
  padding: theme.spacing(3),
  border: `1px dashed ${(theme.vars ?? theme).palette.divider}`,
  borderRadius: (theme.vars ?? theme).shape.borderRadius,
  [`&.${fileFieldClasses.dragActive}`]: {
    borderColor: (theme.vars ?? theme).palette.primary.main,
    backgroundColor: (theme.vars ?? theme).palette.action.hover,
  },
}))

export type FileFieldValue = File | null | File[]

type PickerButtonProps = Omit<ButtonProps<'label'>, 'component' | 'htmlFor' | 'children' | 'role'>

export type FileFieldProps = {
  name: string
  /** The button text, and the input's accessible name. */
  label: ReactNode
  helperText?: ReactNode
  disabled?: boolean
  /**
   * Overrides `Form`'s `optionalText` for this field when the form's
   * `requiredIndicator` is `"optional"`; `false` hides it on this field.
   */
  optionalText?: ReactNode | false
  /**
   * Native `accept` (`".pdf,image/*"`). Also a validation rule: a picked or
   * dropped file that does not match is rejected with `acceptMessage`.
   */
  accept?: string
  /** Store `File[]` instead of `File | null`. */
  multiple?: boolean
  /** Maximum size per file, in bytes. A larger file is rejected with `maxSizeMessage`. */
  maxSize?: number
  /** Maximum number of files under `multiple`. Picking more is rejected with `maxFilesMessage`. */
  maxFiles?: number
  /** Rejection message for `maxSize`. `{size}` is replaced with the limit, humanized. */
  maxSizeMessage?: string
  /** Rejection message for `accept`. */
  acceptMessage?: string
  /** Rejection message for `maxFiles`. `{count}` is replaced with the limit. */
  maxFilesMessage?: string
  /** Render a drop zone around the picker button. */
  dropzone?: boolean
  /** The drop zone's visible instruction, shown above the picker button. */
  dropText?: ReactNode
  /** Replaces the default chip for each file, for per-file upload progress. */
  renderFile?: (file: File, index: number) => ReactNode
  /** Fires once per pick or drop with the files that passed `accept`/`maxSize`/`maxFiles`. */
  onFilesAdded?: (files: File[]) => void
  /**
   * @deprecated Use `slotProps.button` instead. Unlike this prop, `slotProps.button` is
   * merged key-by-key against `theme.components.EzFileField.defaultProps.slotProps.button`
   * (MUI's `resolveProps`), so a theme default and a per-instance override compose. This
   * prop is a flat object a theme can never reach into — kept only so existing callers
   * keep working; it is applied before `slotProps.button` and is overridden by it key for key.
   */
  buttonProps?: PickerButtonProps
  slotProps?: {
    /** Props for the picker's MUI Button (`variant`, `color`, `size`, `startIcon`, …). */
    button?: PickerButtonProps
  }
  /**
   * Runs after the form's handler on every value change: a pick of at least
   * one file (a cancelled dialog changes nothing), or a chip's delete click.
   */
  onChange?: (event: SyntheticEvent, value: FileFieldValue) => void
} & Pick<FieldRules<FileFieldValue>, 'required' | 'validate'>

/**
 * "This effect has not run yet" marker for the rejection-revalidation effect below. A distinct
 * sentinel rather than `undefined`, because `undefined` is itself a real `rejection` value
 * (meaning "nothing rejected").
 */
const MOUNT = Symbol('mount')

/** 1 kB = 1000 B, matching how OS file dialogs and `accept`-adjacent UI report sizes. */
const SIZE_UNITS = ['B', 'kB', 'MB', 'GB', 'TB'] as const

/** `1500000` → `"1.5 MB"`; whole numbers lose the `.0` (`1000` → `"1 kB"`). */
function formatFileSize(bytes: number): string {
  let value = bytes
  let unit = 0
  while (value >= 1000 && unit < SIZE_UNITS.length - 1) {
    value /= 1000
    unit += 1
  }
  // One decimal, but only when it says something: 1.5 MB, not 1.0 MB.
  return `${Math.round(value * 10) / 10} ${SIZE_UNITS[unit]}`
}

/**
 * The matching the native input's `accept` does: a comma-separated list of
 * `.ext` (case-insensitive suffix), `type/subtype` (exact), or `type/*`
 * (prefix). An empty/absent `accept` matches everything.
 */
function matchesAccept(file: File, accept: string | undefined): boolean {
  const tokens = (accept ?? '')
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean)
  if (tokens.length === 0) return true
  const name = file.name.toLowerCase()
  const type = file.type.toLowerCase()
  return tokens.some((token) => {
    const t = token.toLowerCase()
    if (t.startsWith('.')) return name.endsWith(t)
    if (t.endsWith('/*')) return type.startsWith(t.slice(0, -1))
    return type === t
  })
}

/**
 * File input whose form value is `File | null`, or `File[]` under `multiple`.
 * A cancelled dialog keeps the current value; the native input is cleared
 * after every pick so choosing the same file again fires `change`.
 *
 * `accept`, `maxSize` and `maxFiles` reject at pick/drop time: the offending
 * file never enters the value, and the reason surfaces as the field's error
 * through a built-in `validate` rule, so it also fails a submit. Any change to
 * the value clears it — an accepted pick or drop, or a chip delete, which is how
 * a `maxFiles` rejection gets answered. That rule is only registered when one of those props is
 * set, so a field without limits registers and runs exactly what it did before.
 *
 * Under `multiple`, a pick or drop **appends** to the value (it used to
 * replace it): a drop zone used twice should accumulate, and `maxFiles` can
 * only mean "at most n in total" if it does. Files come off with their chips.
 */
export function FileField(inProps: FileFieldProps) {
  const {
    name,
    label,
    helperText,
    disabled,
    accept,
    multiple,
    maxSize,
    maxFiles,
    maxSizeMessage = 'File is larger than {size}',
    acceptMessage = 'File type not accepted',
    maxFilesMessage = 'Choose at most {count} files',
    dropzone = false,
    dropText = 'Drag files here, or',
    renderFile,
    onFilesAdded,
    buttonProps,
    slotProps,
    onChange,
    required,
    validate,
    optionalText,
  } = useDefaultProps({ props: inProps, name: 'EzFileField' })
  // The reason the last pick/drop rejected a file. Held here rather than pushed
  // through `setError` so it composes exactly like `required`: the built-in
  // `validate` entry below reports it, so a submit fails on it too.
  const [rejection, setRejection] = useState<string | undefined>(undefined)
  const limited = maxSize !== undefined || maxFiles !== undefined || accept !== undefined
  const f = useEzField<FileFieldValue>(name, 'FileField', {
    label,
    rules: {
      required,
      // Without a limit prop there is nothing to reject, so `validate` stays
      // exactly what the consumer passed (usually nothing) — a field with no
      // limits registers and runs no more rules than it did before.
      validate: limited
        ? {
            // Consumer entries first: a built-in key must not be silently replaced.
            ...(validate === undefined
              ? {}
              : typeof validate === 'function'
                ? { validate }
                : validate),
            // Closes over this render's state. hookform reads the rules off the
            // field on every validation run (ezResolver's `options.fields`), and
            // useController keeps that entry pointing at the latest render's
            // rules, so a rejection set below is what the next run sees.
            accepted: () => rejection ?? true,
          }
        : validate,
    },
    optionalText,
  })
  const { trigger } = useEzFormContext('FileField')
  const id = useId()
  const text = f.helperText(helperText)
  const value = f.field.value as FileFieldValue | undefined
  const files: File[] = Array.isArray(value) ? value : value ? [value] : []
  const isDisabled = mergeDisabled(disabled, f.field.disabled)
  const [dragActive, setDragActive] = useState(false)

  // Every value change clears the rejection, not just an accepted pick: removing
  // a chip is exactly how a user answers a `maxFiles` rejection, so leaving the
  // message set there would strand the field in an error it can never clear.
  const store = (event: SyntheticEvent, next: File[]) => {
    const value = multiple ? next : (next[0] ?? null)
    setRejection(undefined)
    f.field.onChange(value)
    onChange?.(event, value)
  }

  /**
   * The one path every pick and drop takes. Rejects on the first failing rule
   * (a rejection is about the pick, so a second reason adds nothing) and stores
   * nothing; otherwise stores — which clears any previous rejection — and tells
   * the consumer which files were added.
   */
  const add = (event: SyntheticEvent, picked: File[]) => {
    if (picked.length === 0) return // cancelled dialog: keep what we have
    if (maxSize !== undefined && picked.some((file) => file.size > maxSize)) {
      return setRejection(maxSizeMessage.replace('{size}', formatFileSize(maxSize)))
    }
    if (picked.some((file) => !matchesAccept(file, accept))) return setRejection(acceptMessage)
    // `maxFiles` counts a list, so it only means anything under `multiple` —
    // a single-file field always holds exactly one, as its doc comment says.
    if (multiple && maxFiles !== undefined && files.length + picked.length > maxFiles) {
      return setRejection(maxFilesMessage.replace('{count}', String(maxFiles)))
    }
    const next = multiple ? [...files, ...picked] : picked
    store(event, next)
    onFilesAdded?.(picked)
  }

  // A rejection has to appear — and disappear — now, not at the next submit: the
  // default `mode` is `onSubmit`, so nothing re-validates on its own. Changing
  // the state re-registers the `accepted` rule with (or without) the message,
  // and this effect then re-runs it. It fires on *both* edges: only re-running
  // on the setting edge would leave a cleared rejection's stale error on screen.
  // The remembered previous value skips the mount pass, so a fresh field is never validated
  // into an error it hasn't earned.
  //
  // This tracks the last `rejection` rather than a "have I run once" boolean: under
  // StrictMode the effect runs twice on mount, and a boolean ref would be set by the first
  // pass and then read as "not the mount pass" by the second — firing `trigger` on a freshly
  // mounted field and updating the form outside `act`. Comparing values is idempotent, so
  // running the effect any number of times with an unchanged `rejection` does nothing.
  const lastRejection = useRef<string | undefined | typeof MOUNT>(MOUNT)
  useEffect(() => {
    const previous = lastRejection.current
    lastRejection.current = rejection
    if (previous === MOUNT || previous === rejection) return
    void trigger(name)
  }, [rejection, trigger, name])

  // Slot default (see ConfirmDialog's `confirmProps`): `slotProps.button` is what
  // `useDefaultProps`/`resolveProps` deep-merges key-by-key against
  // `theme.components.EzFileField.defaultProps.slotProps.button` — a flat prop like
  // the deprecated `buttonProps` is only ever wholesale-replaced-or-ignored, never
  // merged, so it cannot carry a themeable default. `variant: 'outlined'` here is the
  // library fallback and loses to any key `slotProps.button` (theme or instance)
  // supplies — see #62.
  const pickerButtonProps = { variant: 'outlined' as const, ...buttonProps, ...slotProps?.button }

  const picker = (
    <Button
      startIcon={<UploadFile />}
      {...pickerButtonProps}
      component="label"
      htmlFor={id}
      disabled={isDisabled}
      // A native <label htmlFor> already activates the input on click/Enter/Space with
      // no script; MUI's inferred role="button" then wraps a focusable descendant, which
      // axe's nested-interactive rule flags. Drop the redundant role, not the native label.
      role={undefined}
    >
      {f.displayLabel}
      {/* `labelRequired === false` is `requiredIndicator="optional"` suppressing the
          asterisk (the field is still required, just not marked with `*`); `undefined`
          leaves this exactly as before ("asterisk" mode, or no requiredIndicator at all). */}
      {f.required && f.labelRequired !== false ? <span aria-hidden="true">&thinsp;*</span> : null}
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
          add(e, Array.from(e.target.files ?? []))
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
  )

  return (
    <FormControl
      error={f.invalid}
      disabled={isDisabled}
      required={f.required}
      className={fileFieldClasses.root}
    >
      {dropzone ? (
        // Not focusable and given no role on purpose: the Button inside is the
        // keyboard and screen-reader path, so drag-and-drop adds no second tab
        // stop and no fake widget. `dragActive` is a visual cue only.
        <FileFieldDropZone
          className={`${fileFieldClasses.dropZone}${dragActive ? ` ${fileFieldClasses.dragActive}` : ''}`}
          onDragOver={(event: DragEvent<HTMLDivElement>) => {
            event.preventDefault()
            if (!isDisabled) setDragActive(true)
          }}
          // Leaving for a child (the picker button inside) is not leaving the
          // zone; without this the highlight flickers as the pointer crosses it.
          onDragLeave={(event: DragEvent<HTMLDivElement>) => {
            const next = event.relatedTarget
            if (next instanceof Node && event.currentTarget.contains(next)) return
            setDragActive(false)
          }}
          onDrop={(event: DragEvent<HTMLDivElement>) => {
            event.preventDefault()
            setDragActive(false)
            if (isDisabled) return
            const dropped = Array.from(event.dataTransfer?.files ?? [])
            add(event, multiple ? dropped : dropped.slice(0, 1))
          }}
        >
          <span className={fileFieldClasses.dropText}>{dropText}</span>
          {picker}
        </FileFieldDropZone>
      ) : (
        picker
      )}
      {files.length > 0 ? (
        <FileFieldList direction="row" spacing={1} useFlexGap className={fileFieldClasses.fileList}>
          {files.map((file, index) =>
            renderFile ? (
              <Fragment key={`${file.name}-${file.size}-${file.lastModified}`}>
                {renderFile(file, index)}
              </Fragment>
            ) : (
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
                deleteIcon={<ChipDeleteIcon label={file.name} />}
              />
            ),
          )}
        </FileFieldList>
      ) : null}
      {text ? <FormHelperText {...f.helperTextA11y}>{text}</FormHelperText> : null}
    </FormControl>
  )
}
