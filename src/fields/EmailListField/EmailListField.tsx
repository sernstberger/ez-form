import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type FocusEvent,
  type KeyboardEvent,
} from 'react'
import Chip, { type ChipProps } from '@mui/material/Chip'
import Cancel from '@mui/icons-material/Cancel'
import { useDefaultProps } from '@mui/material/DefaultPropsProvider'
import generateUtilityClasses from '@mui/material/generateUtilityClasses'
import { styled } from '@mui/material/styles'
import { useWatch } from 'react-hook-form'
import type { Message } from 'react-hook-form'
import { Autocomplete, type AutocompleteProps } from '../Autocomplete'
import { useEzFormContext } from '../../useEzFormContext'
import { LiveRegion, type LiveRegionProps } from '../../Form/LiveRegion'
import { cx } from '../../cx'
import { isEmail } from '../emailPattern'

export const emailListFieldClasses = generateUtilityClasses('EzEmailListField', [
  'chip',
  'deleteIcon',
  'status',
])

/** One address the lookup returned. */
export interface EmailOption {
  /** The address itself — this, and only this, is what the form stores. */
  value: string
  /** How the chip and the option row read, typically `Ada Lovelace <ada@example.com>`. */
  label: string
  /** Directory results often carry an id, an avatar, a team; they reach `onChange` untouched. */
  [extra: string]: unknown
}

/**
 * `options` and `loading` are driven by `loadOptions`; `multiple` and `freeSolo`
 * are what this field *is*; `getOptionValue` would let the form store something
 * other than the address, which the `string[]` contract forbids; `inputValue`
 * and `renderValue` are how entry and chips are implemented here. Everything
 * else on `Autocomplete` — `onChange`, `textFieldProps`, the rules — passes
 * straight through.
 */
export type EmailListFieldProps = Omit<
  AutocompleteProps<EmailOption, string, true, true>,
  | 'options'
  | 'loading'
  | 'multiple'
  | 'freeSolo'
  | 'getOptionValue'
  | 'renderValue'
  | 'inputValue'
  | 'slotProps'
> & {
  /**
   * Looks addresses up as the user types — a directory, a contacts API, recent
   * recipients. Called with the current input text and an `AbortSignal` that is
   * aborted as soon as the next keystroke supersedes this query, so a slow
   * response can never overwrite a newer one.
   *
   * Without it the field is pure free entry: every address is typed.
   */
  loadOptions?: (query: string, signal: AbortSignal) => Promise<EmailOption[]>
  /** How long typing must pause before `loadOptions` runs. Default 250ms. */
  debounceMs?: number
  /**
   * Whether an address the lookup never returned can be added. Default `true`.
   * `false` makes the field a picker over `loadOptions` results only — typed
   * text matching no result is rejected with `invalidMessage`.
   */
  allowNew?: boolean
  /**
   * Shown when an entry is not a valid address (or, under `allowNew={false}`,
   * not one the lookup offered). Default `'Enter a valid email address'`.
   *
   * A `string`, not a `ReactNode`: it is a validation message, and
   * react-hook-form's `Message` is a string — it has to survive the trip
   * through `useController`'s rules to `fieldState.error.message`.
   */
  invalidMessage?: string
  /** Announced when a typed address is already in the list. Default `'Already added'`. */
  duplicateMessage?: string
  /** Announced when an address is added. Default `` `<email> added` ``. */
  addedMessage?: (email: string) => string
  /** Announced when an address is removed. Default `` `<email> removed` ``. */
  removedMessage?: (email: string) => string
  slotProps?: {
    chip?: ChipProps
    status?: Omit<LiveRegionProps, 'message' | 'announcementKey'>
  }
}

const EmailListFieldChip = styled(Chip, { name: 'EzEmailListField', slot: 'Chip' })({})
// MUI's Chip delete icon renders at `fontSize: 22` with no hit-area padding —
// under the 24×24 CSS px target (WCAG 2.5.8). This is the functional minimum,
// still overridable via `theme.components.EzEmailListField.styleOverrides.deleteIcon`;
// `boxSizing: 'content-box'` keeps the glyph itself unchanged, and Chip already
// centers the icon.
const EmailListFieldDeleteIcon = styled(Cancel, {
  name: 'EzEmailListField',
  slot: 'DeleteIcon',
})({
  minWidth: 24,
  minHeight: 24,
  boxSizing: 'content-box',
})
// Visually hidden (LiveRegion's default): the chips are the sighted feedback for
// an add or a remove, so a second visible line would only repeat what is on screen.
const EmailListFieldStatus = styled(LiveRegion, { name: 'EzEmailListField', slot: 'Status' })({})

/** Separators a mail client accepts between addresses, for typing and for paste. */
const SEPARATORS = /[,;\s]+/

/** Keys that end an address while typing. */
const COMMIT_KEYS = new Set([',', ';'])

/**
 * A multi-address input: each committed address becomes a chip, the form stores
 * a plain `string[]` of the addresses, and an optional `loadOptions` turns the
 * dropdown into a directory lookup.
 *
 * Entry follows what mail clients have taught people to expect. Enter, comma,
 * semicolon, a space after a complete address, and blurring the field all commit
 * what is typed; pasting `a@x.com, b@y.com; c@z.com` splits into three chips at
 * once. Duplicates collapse case-insensitively (compared lowercased, stored as
 * typed), and an address that fails validation still becomes a chip — in its
 * error state, with the field errored and submit blocked — rather than
 * vanishing, so the user can see and fix what they typed instead of guessing
 * what was thrown away.
 */
export function EmailListField(inProps: EmailListFieldProps) {
  // Ahead of Autocomplete's own guard, so the "outside <Form>" error names <EmailListField>.
  const form = useEzFormContext('EmailListField')
  const {
    loadOptions,
    debounceMs = 250,
    allowNew = true,
    invalidMessage = 'Enter a valid email address',
    duplicateMessage = 'Already added',
    addedMessage = (email: string) => `${email} added`,
    removedMessage = (email: string) => `${email} removed`,
    name,
    validate,
    onChange,
    onInputChange,
    textFieldProps,
    slotProps,
    ...rest
  } = useDefaultProps({ props: inProps, name: 'EzEmailListField' })

  const [inputValue, setInputValue] = useState('')
  const [options, setOptions] = useState<EmailOption[]>([])
  const [loading, setLoading] = useState(false)
  // `seq` keys the live region, so repeating an action with an identical message
  // (rejecting the same duplicate twice) still mounts a fresh node and is heard again.
  const [status, setStatus] = useState({ text: '', seq: 0 })
  const announce = (text: string) => setStatus((prev) => ({ text, seq: prev.seq + 1 }))

  // The committed list, read from the form rather than mirrored in state: a
  // reset or a programmatic `setValue` has to be able to change it, and a second
  // copy here would drift.
  const stored = useWatch({ name })
  const value: string[] = Array.isArray(stored) ? (stored as string[]) : []

  // Every address the lookup has ever returned, keyed lowercased, so a chip
  // added from a result keeps its `Name <email>` label after the options list has
  // moved on to the next query — and so `allowNew={false}` can tell an offered
  // address from an invented one.
  const knownRef = useRef(new Map<string, EmailOption>())
  for (const option of options) knownRef.current.set(option.value.toLowerCase(), option)

  // The in-flight lookup's aborter and the pending debounce timer, so the next
  // keystroke can cancel both. Refs, not state: nothing renders from either, and
  // as state each would force a render per keystroke just to clear itself.
  const abortRef = useRef<AbortController | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Unmounting mid-flight must not leave a timer to fire or a request to resolve
  // into a setState on a component that is gone.
  useEffect(
    () => () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current)
      abortRef.current?.abort()
    },
    [],
  )

  const cancelLookup = () => {
    if (timerRef.current !== null) clearTimeout(timerRef.current)
    timerRef.current = null
    // Abort at *keystroke* time, not when the next request starts: a response
    // arriving during the debounce window is already stale, and letting it land
    // would repopulate the list under a query the user has moved past.
    abortRef.current?.abort()
    abortRef.current = null
  }

  const runLookup = (query: string) => {
    if (!loadOptions) return
    cancelLookup()
    if (query === '') {
      setOptions([])
      setLoading(false)
      return
    }
    setLoading(true)
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      const controller = new AbortController()
      abortRef.current = controller
      loadOptions(query, controller.signal)
        .then((results) => {
          if (controller.signal.aborted) return
          setOptions(results)
          setLoading(false)
        })
        .catch(() => {
          // An abort is the expected outcome of typing on, not a failure worth
          // reporting. A real lookup error leaves the previous list alone and
          // stops the spinner, so the field degrades to free entry.
          if (controller.signal.aborted) return
          setLoading(false)
        })
    }, debounceMs)
  }

  const labelFor = (email: string) => knownRef.current.get(email.toLowerCase())?.label ?? email

  const isKnown = (email: string) => knownRef.current.has(email.toLowerCase())

  /** Whether one committed address passes this field's rules. Drives the chip state and `validate`. */
  const isAccepted = (email: string) => isEmail(email) && (allowNew || isKnown(email))

  /**
   * Folds `candidates` onto `base`: splits each on the separators, drops
   * case-insensitive duplicates (against `base` *and* against earlier
   * candidates in the same batch, so one paste cannot add the same address
   * twice), and keeps everything else — including addresses that fail
   * validation, which become errored chips rather than vanishing.
   */
  const fold = (base: readonly string[], candidates: readonly string[]) => {
    const next = [...base]
    for (const raw of candidates) {
      for (const candidate of raw.split(SEPARATORS).filter(Boolean)) {
        if (next.some((e) => e.toLowerCase() === candidate.toLowerCase())) continue
        next.push(candidate)
      }
    }
    return next
  }

  /**
   * Writes `next` to the form and announces the difference from `previous`.
   * Returns whether anything actually changed, so a caller that owns the input
   * text (the punctuation and blur commits) knows whether to clear it.
   */
  const applyChange = (previous: readonly string[], next: readonly string[]) => {
    const added = next.filter((e) => !previous.includes(e))
    const gone = previous.filter((e) => !next.includes(e))
    // The write happens even when the folded list equals `previous`. This runs
    // *after* `Autocomplete` has already written MUI's raw proposal to the form,
    // so "nothing changed" still has to be written back — otherwise a rejected
    // duplicate would stay in form state as the chip MUI appended.
    //
    // `shouldValidate` because a commit is exactly when an entry's validity
    // becomes knowable: the chip's error state and the field's message have to
    // settle in the same commit.
    form.setValue(name, next, { shouldValidate: true, shouldDirty: true, shouldTouch: true })
    if (added.length === 0 && gone.length === 0) {
      announce(duplicateMessage)
      return false
    }
    const [addedOne] = added
    const [goneOne] = gone
    if (added.length === 1 && addedOne !== undefined) announce(addedMessage(addedOne))
    else if (added.length > 1) announce(`${added.length} addresses added`)
    else if (gone.length === 1 && goneOne !== undefined) announce(removedMessage(goneOne))
    else if (gone.length > 1) announce(`${gone.length} addresses removed`)
    return true
  }

  /** Commits typed text (one address, or several separated) onto the current value. */
  const commit = (text: string) => applyChange(value, fold(value, [text]))

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const text = inputValue
    // Enter is left to MUI: its own `createOption` path fires on the root, after
    // and regardless of anything this handler does, so intercepting here would
    // only add a second commit. It lands in `onChange`, which folds it.
    if (COMMIT_KEYS.has(event.key) && text.trim() !== '') {
      event.preventDefault()
      if (commit(text)) setInputValue('')
      return
    }
    // Space only commits once what precedes it is already a complete address —
    // otherwise typing a display name ("Ada Lovelace <…") would commit a fragment.
    if (event.key === ' ' && isEmail(text.trim())) {
      event.preventDefault()
      if (commit(text)) setInputValue('')
    }
  }

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData('text')
    // A paste with no separator is an ordinary edit: let it land in the input so
    // the user can still correct it before committing.
    if (!SEPARATORS.test(pasted)) return
    event.preventDefault()
    // Whatever was already typed is part of the first address being pasted onto.
    if (commit(inputValue + pasted)) setInputValue('')
  }

  const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
    cancelLookup()
    setLoading(false)
    if (inputValue.trim() !== '' && commit(inputValue)) setInputValue('')
    textFieldProps?.onBlur?.(event)
  }

  return (
    <>
      <Autocomplete<EmailOption, string, true, true>
        {...rest}
        name={name}
        multiple
        freeSolo
        options={options}
        loading={loading}
        // Results are already the lookup's answer to this query; filtering them
        // again against the same text would drop rows a directory matched on a
        // name or an alias the label does not spell out.
        filterOptions={(x) => x}
        // Blur is committed by this field (so it can split and dedupe), and the
        // typed text must survive an unrelated blur, so MUI's own blur handling
        // stays off; Enter remains MUI's.
        autoSelect={false}
        clearOnBlur={false}
        inputValue={inputValue}
        onInputChange={(event, next, reason) => {
          setInputValue(next)
          if (reason === 'input') runLookup(next)
          // 'reset' fires when a chip is committed or removed, and 'clear' when
          // the Clear button is pressed; either way the list from the query that
          // produced it is stale the moment the input empties.
          else if (next === '') setOptions([])
          onInputChange?.(event, next, reason)
        }}
        validate={{
          // Consumer entries first: a built-in key must not be silently replaced.
          ...(validate === undefined
            ? {}
            : typeof validate === 'function'
              ? { validate }
              : validate),
          emails: (v: unknown) =>
            !(Array.isArray(v) ? (v as string[]) : []).some((e) => !isAccepted(e)) ||
            (invalidMessage as Message),
        }}
        onChange={(event, next, reason, details) => {
          // The single place a change is normalized, whatever produced it — an
          // option click, Enter on typed text (MUI's `createOption`), a chip
          // delete, or the Clear button. `Autocomplete` has already written
          // MUI's raw proposal to the form by the time this runs; `applyChange`
          // rewrites it to the folded list, so a duplicate never survives and a
          // multi-address entry is split even when MUI appended it whole.
          const proposed = (next as (EmailOption | string)[]).map((v) =>
            typeof v === 'string' ? v : v.value,
          )
          const removing = reason === 'removeOption' || reason === 'clear'
          // A removal is already exactly what it should be; only additions need folding.
          applyChange(value, removing ? proposed : fold(value, proposed.slice(value.length)))
          onChange?.(event, next, reason, details)
        }}
        renderValue={(items, getItemProps) =>
          items.map((item, index) => {
            const email = typeof item === 'string' ? item : item.value
            const { key, ...itemProps } = getItemProps({ index })
            const chipProps = slotProps?.chip
            return (
              <EmailListFieldChip
                key={key}
                label={labelFor(email)}
                // An address that fails the field's rules is flagged on the chip
                // itself, so a long list says *which* entry is wrong rather than
                // only that one of them is.
                color={isAccepted(email) ? chipProps?.color : 'error'}
                // Chip clones this element with its own onClick; the default icon
                // has no accessible name, and SvgIcon defaults aria-hidden to true
                // unless overridden here. Without a name the only way to drop a
                // chip by keyboard is Backspace, and a screen reader announces
                // nothing about what the icon would remove.
                deleteIcon={
                  <EmailListFieldDeleteIcon
                    role="button"
                    aria-label={`Remove ${labelFor(email)}`}
                    aria-hidden={undefined}
                    className={emailListFieldClasses.deleteIcon}
                  />
                }
                {...itemProps}
                {...chipProps}
                className={cx(emailListFieldClasses.chip, chipProps?.className)}
              />
            )
          })
        }
        textFieldProps={textFieldProps}
        // These have to reach the `<input>` itself, not the TextField root:
        // MUI rebuilds the input's props from `getInputProps()` on every render,
        // so a handler on the wrapper would only ever see what bubbled.
        inputProps={{
          autoComplete: 'email',
          onKeyDown: handleKeyDown,
          onPaste: handlePaste,
          onBlur: handleBlur,
        }}
      />
      <EmailListFieldStatus
        {...slotProps?.status}
        message={status.text}
        announcementKey={status.seq}
        className={cx(emailListFieldClasses.status, slotProps?.status?.className)}
      />
    </>
  )
}
