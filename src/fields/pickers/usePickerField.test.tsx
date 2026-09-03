import type { ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { z } from 'zod'
import { Form, type FormMethods } from '../../Form'
import type { RuleMessages } from '../../rules'
import { usePickerField } from './usePickerField'

/**
 * Direct tests for the hook the four pickers share (#106). The pickers' own
 * suites drive it through MUI X — this file drives it through its own
 * signature instead, so the branches MUI X only reaches in particular
 * combinations (an unparsable paste that never produces an `onChange`, the
 * clear-on-an-already-null-value path, consumer-handler ordering) are each
 * asserted once, in isolation, without a picker in between.
 *
 * The value type is `Date | null` and the error type MUI X's date codes,
 * matching `DateField`/`DatePicker`; nothing here needs a `LocalizationProvider`
 * because no MUI X component is rendered — the hook itself never touches the
 * adapter.
 */

type Value = Date | null
type ErrorCode =
  | 'invalidDate'
  | 'minDate'
  | 'maxDate'
  | 'minTime'
  | 'maxTime'
  | 'disablePast'
  | 'disableFuture'
  | 'shouldDisableDate'
  | 'minutesStep'
  | null

interface SlotProps {
  textField?: object
  field?: object
}

const schema = z.object({ when: z.date().nullable() })

/** The shape `usePickerField` returns, as this file uses it. */
type Bound = ReturnType<typeof usePickerField<Value, ErrorCode, SlotProps>>

/** The bits of the returned `slotProps.textField` these tests read. */
interface BoundTextField {
  required: boolean
  error: boolean
  helperText: ReactNode
  onBlur: (event: unknown) => void
  onPaste: (event: unknown) => void
  onClear: (event: unknown) => void
  'aria-label'?: string
  slotProps: {
    formHelperText: { role?: string }
    inputLabel: { required?: boolean }
  }
}

const textFieldOf = (bound: Bound) => bound.slotProps.textField as unknown as BoundTextField

type HookProps = Parameters<typeof usePickerField<Value, ErrorCode, SlotProps>>[1]

type Methods = FormMethods<{ when: Value }, { when: Value }>

interface WrapperOptions {
  defaultValue?: Value
  disabled?: boolean
  messages?: Partial<RuleMessages>
  onSubmit?: (values: { when: Value }) => void
}

/**
 * Renders the hook inside a real `<Form>` — `useEzField` needs one, and the
 * rule the hook registers only runs through hookform's resolver, so a real
 * form is what makes `trigger()` below meaningful.
 */
function renderPicker(props: Partial<HookProps> = {}, options: WrapperOptions = {}) {
  const { defaultValue = null, disabled, messages, onSubmit = () => {} } = options
  const formRef: { current: Methods | null } = { current: null }
  const utils = renderHook(
    (hookProps: Partial<HookProps>) =>
      usePickerField<Value, ErrorCode, SlotProps>('DatePicker', {
        name: 'when',
        label: 'When',
        ...props,
        ...hookProps,
      }),
    {
      initialProps: props,
      wrapper: ({ children }) => (
        <Form
          schema={schema}
          defaultValues={{ when: defaultValue }}
          onSubmit={onSubmit}
          disabled={disabled}
          messages={messages}
          ref={(methods) => {
            formRef.current = methods
          }}
        >
          {children}
        </Form>
      ),
    },
  )
  return { ...utils, formRef }
}

/** A `paste` event object carrying `text`, as React hands it to `onPaste`. */
const pasteEvent = (text: string) => ({ clipboardData: { getData: () => text } })

/**
 * Runs the field's registered rules (the `picker` `validate` entry included) and
 * returns whether the field came back valid. The helper text is read from the
 * returned `slotProps.textField` afterwards.
 */
async function validateField(formRef: { current: Methods | null }) {
  let valid = true
  await act(async () => {
    valid = await formRef.current!.trigger('when')
  })
  return valid
}

describe('usePickerField', () => {
  describe('binding', () => {
    it('returns the field name, label and a null value for an empty field', () => {
      const { result } = renderPicker()
      expect(result.current.name).toBe('when')
      expect(result.current.label).toBe('When')
      expect(result.current.value).toBeNull()
    })

    it('normalises an undefined stored value to null', () => {
      const { result } = renderPicker({}, { defaultValue: undefined as unknown as Value })
      expect(result.current.value).toBeNull()
    })

    /**
     * `toEqual`, not `toBe`, throughout: hookform deep-clones `defaultValues`
     * (and clones again on each `setValue`), so the stored `Date` is an equal
     * instance rather than the identical one. The value is still adapter-native
     * — a `Date` under date-fns — which is what the hook's contract promises.
     */
    it('reads the stored value back out as an equal Date', () => {
      const date = new Date(1990, 5, 1)
      const { result } = renderPicker({}, { defaultValue: date })
      expect(result.current.value).toBeInstanceOf(Date)
      expect(result.current.value).toEqual(date)
    })

    it('writes the value through onChange', () => {
      const { result } = renderPicker()
      const date = new Date(2020, 0, 2)
      act(() => {
        result.current.onChange(date, { validationError: null, source: 'field' })
      })
      expect(result.current.value).toEqual(date)
    })

    it('marks the text field required from the required rule', () => {
      const { result } = renderPicker({ required: true })
      expect(textFieldOf(result.current).required).toBe(true)
    })

    it('is not required without the rule', () => {
      const { result } = renderPicker()
      expect(textFieldOf(result.current).required).toBe(false)
    })
  })

  describe('disabled', () => {
    it('is enabled by default', () => {
      const { result } = renderPicker()
      expect(result.current.disabled).toBe(false)
    })

    it('is disabled by the consumer prop', () => {
      const { result } = renderPicker({ disabled: true })
      expect(result.current.disabled).toBe(true)
    })

    it("the form's lock wins over a consumer disabled={false}", () => {
      const { result } = renderPicker({ disabled: false }, { disabled: true })
      expect(result.current.disabled).toBe(true)
    })
  })

  describe('picker error codes', () => {
    it.each([
      ['invalidDate', 'When is invalid.'],
      ['minDate', 'When is too early.'],
      ['minTime', 'When is too early.'],
      ['minutesStep', 'When is too early.'],
      ['maxDate', 'When is too late.'],
      ['maxTime', 'When is too late.'],
      ['disablePast', 'When must be in the future.'],
      ['disableFuture', 'When must be in the past.'],
      ['shouldDisableDate', 'When is not available.'],
    ] as const)('onError(%s) becomes the field error "%s"', async (code, message) => {
      const { result, formRef } = renderPicker()
      act(() => {
        result.current.onError(code, null)
      })
      expect(await validateField(formRef)).toBe(false)
      await waitFor(() => expect(textFieldOf(result.current).helperText).toBe(message))
      expect(textFieldOf(result.current).error).toBe(true)
    })

    it('takes the code from the onChange context too', async () => {
      const { result, formRef } = renderPicker()
      act(() => {
        result.current.onChange(new Date(1900, 0, 1), {
          validationError: 'minDate',
          source: 'field',
        })
      })
      expect(await validateField(formRef)).toBe(false)
      await waitFor(() => expect(textFieldOf(result.current).helperText).toBe('When is too early.'))
    })

    it('clears the error when a later change reports no code', async () => {
      const { result, formRef } = renderPicker()
      act(() => {
        result.current.onError('minDate', null)
      })
      expect(await validateField(formRef)).toBe(false)
      act(() => {
        result.current.onChange(new Date(2020, 0, 2), { validationError: null, source: 'field' })
      })
      expect(await validateField(formRef)).toBe(true)
      await waitFor(() => expect(textFieldOf(result.current).error).toBe(false))
    })

    it('prefers a consumer errorMessages override for the code', async () => {
      const { result, formRef } = renderPicker({
        errorMessages: { minDate: 'Pick a later day' },
      })
      act(() => {
        result.current.onError('minDate', null)
      })
      expect(await validateField(formRef)).toBe(false)
      await waitFor(() => expect(textFieldOf(result.current).helperText).toBe('Pick a later day'))
    })

    it("reads its wording from the form's messages, so a locale translates it", async () => {
      const { result, formRef } = renderPicker(
        {},
        { messages: { tooEarly: (label) => `${label} es demasiado temprano.` } },
      )
      act(() => {
        result.current.onError('minDate', null)
      })
      expect(await validateField(formRef)).toBe(false)
      await waitFor(() =>
        expect(textFieldOf(result.current).helperText).toBe('When es demasiado temprano.'),
      )
    })

    it('falls back to the generic label when the label is not a string', async () => {
      const { result, formRef } = renderPicker({ label: <em>When</em> })
      act(() => {
        result.current.onError('invalidDate', null)
      })
      expect(await validateField(formRef)).toBe(false)
      await waitFor(() =>
        expect(textFieldOf(result.current).helperText).toBe('This field is invalid.'),
      )
    })

    it('composes with the required rule — required speaks for an empty field', async () => {
      const { result, formRef } = renderPicker({ required: true })
      expect(await validateField(formRef)).toBe(false)
      await waitFor(() => expect(textFieldOf(result.current).helperText).toBe('When is required.'))
    })

    it('composes with a consumer validate function', async () => {
      const { result, formRef } = renderPicker({
        validate: (value: Value) => (value === null ? 'Choose a day' : true),
      })
      expect(await validateField(formRef)).toBe(false)
      await waitFor(() => expect(textFieldOf(result.current).helperText).toBe('Choose a day'))
    })

    it('composes with a record of validate functions', async () => {
      const { result, formRef } = renderPicker({
        validate: { weekday: (value: Value) => value !== null || 'Choose a weekday' },
      })
      expect(await validateField(formRef)).toBe(false)
      await waitFor(() => expect(textFieldOf(result.current).helperText).toBe('Choose a weekday'))
    })
  })

  describe('unparsable paste', () => {
    it('flags invalidDate when no onChange follows the paste', async () => {
      const { result, formRef } = renderPicker()
      act(() => {
        textFieldOf(result.current).onPaste(pasteEvent('not a date'))
      })
      // The microtask queued by handlePaste is what claims the text.
      await act(async () => {
        await Promise.resolve()
      })
      expect(await validateField(formRef)).toBe(false)
      await waitFor(() => expect(textFieldOf(result.current).helperText).toBe('When is invalid.'))
    })

    it('leaves an empty paste alone', async () => {
      const { result, formRef } = renderPicker()
      act(() => {
        textFieldOf(result.current).onPaste(pasteEvent(''))
      })
      await act(async () => {
        await Promise.resolve()
      })
      expect(await validateField(formRef)).toBe(true)
    })

    it('does not overwrite a code the picker already reported', async () => {
      const { result, formRef } = renderPicker()
      act(() => {
        result.current.onError('maxDate', null)
      })
      act(() => {
        textFieldOf(result.current).onPaste(pasteEvent('01/01/2999'))
      })
      await act(async () => {
        await Promise.resolve()
      })
      expect(await validateField(formRef)).toBe(false)
      await waitFor(() => expect(textFieldOf(result.current).helperText).toBe('When is too late.'))
    })

    it('lets a synchronous onChange claim the paste — an unparsable one is invalidDate', async () => {
      const { result, formRef } = renderPicker()
      act(() => {
        textFieldOf(result.current).onPaste(pasteEvent('gibberish'))
        result.current.onChange(null, { validationError: null, source: 'field' })
      })
      await act(async () => {
        await Promise.resolve()
      })
      expect(await validateField(formRef)).toBe(false)
      await waitFor(() => expect(textFieldOf(result.current).helperText).toBe('When is invalid.'))
    })

    it('a paste that produces a real value is not invalidDate', async () => {
      const { result, formRef } = renderPicker()
      act(() => {
        textFieldOf(result.current).onPaste(pasteEvent('01/02/2020'))
        result.current.onChange(new Date(2020, 0, 2), { validationError: null, source: 'field' })
      })
      await act(async () => {
        await Promise.resolve()
      })
      expect(await validateField(formRef)).toBe(true)
    })

    it("a paste MUI X rejected for range keeps MUI X's own code, not invalidDate", async () => {
      const { result, formRef } = renderPicker()
      act(() => {
        textFieldOf(result.current).onPaste(pasteEvent('01/01/1900'))
        result.current.onChange(new Date(1900, 0, 1), {
          validationError: 'minDate',
          source: 'field',
        })
      })
      await act(async () => {
        await Promise.resolve()
      })
      expect(await validateField(formRef)).toBe(false)
      await waitFor(() => expect(textFieldOf(result.current).helperText).toBe('When is too early.'))
    })

    it('runs the consumer onPaste after its own', async () => {
      const calls: string[] = []
      const { result } = renderPicker({
        slotProps: { textField: { onPaste: () => calls.push('consumer') } },
      })
      act(() => {
        textFieldOf(result.current).onPaste(pasteEvent('x'))
      })
      expect(calls).toEqual(['consumer'])
      // Flush handlePaste's microtask inside act(): it flags invalidDate and
      // writes through the field, which is a state update React must see acted.
      await act(async () => {
        await Promise.resolve()
      })
    })
  })

  describe('clear', () => {
    it('resets a stuck invalidDate on an already-empty field (#83)', async () => {
      const { result, formRef } = renderPicker()
      act(() => {
        textFieldOf(result.current).onPaste(pasteEvent('not a date'))
      })
      await act(async () => {
        await Promise.resolve()
      })
      expect(await validateField(formRef)).toBe(false)
      act(() => {
        textFieldOf(result.current).onClear({})
      })
      expect(await validateField(formRef)).toBe(true)
      await waitFor(() => expect(textFieldOf(result.current).error).toBe(false))
    })

    it('fires the consumer onChange for the empty-field clear', () => {
      const onChange = vi.fn()
      const { result } = renderPicker({ onChange })
      act(() => {
        textFieldOf(result.current).onClear({})
      })
      expect(onChange).toHaveBeenCalledWith(null, { validationError: null })
    })

    it('does not fire onChange when the field still holds a value (MUI X publishes that one)', () => {
      const onChange = vi.fn()
      const { result } = renderPicker({ onChange }, { defaultValue: new Date(2020, 0, 2) })
      act(() => {
        textFieldOf(result.current).onClear({})
      })
      expect(onChange).not.toHaveBeenCalled()
    })

    it('still resets the error code when the field holds a value', async () => {
      const { result, formRef } = renderPicker({}, { defaultValue: new Date(1900, 0, 1) })
      act(() => {
        result.current.onError('minDate', null)
      })
      expect(await validateField(formRef)).toBe(false)
      act(() => {
        textFieldOf(result.current).onClear({})
      })
      // The value is untouched here (MUI X clears it); only the code is reset.
      act(() => {
        result.current.onChange(null, { validationError: null, source: 'field' })
      })
      expect(await validateField(formRef)).toBe(true)
    })

    it('calls a flat consumer onClear', () => {
      const onClear = vi.fn()
      const { result } = renderPicker({ onClear })
      const event = {}
      act(() => {
        textFieldOf(result.current).onClear(event)
      })
      expect(onClear).toHaveBeenCalledWith(event)
    })

    it('calls a consumer onClear from slotProps.field', () => {
      const onClear = vi.fn()
      const { result } = renderPicker({ slotProps: { field: { onClear } } })
      act(() => {
        textFieldOf(result.current).onClear({})
      })
      expect(onClear).toHaveBeenCalled()
    })

    it('calls a consumer onClear from slotProps.textField as the last fallback', () => {
      const onClear = vi.fn()
      const { result } = renderPicker({ slotProps: { textField: { onClear } } })
      act(() => {
        textFieldOf(result.current).onClear({})
      })
      expect(onClear).toHaveBeenCalled()
    })

    it('prefers the flat onClear over the slot ones', () => {
      const flat = vi.fn()
      const slot = vi.fn()
      const { result } = renderPicker({
        onClear: flat,
        slotProps: { field: { onClear: slot }, textField: { onClear: slot } },
      })
      act(() => {
        textFieldOf(result.current).onClear({})
      })
      expect(flat).toHaveBeenCalled()
      expect(slot).not.toHaveBeenCalled()
    })

    it('drops a pending paste so its microtask cannot re-flag the cleared field', async () => {
      const { result, formRef } = renderPicker()
      act(() => {
        textFieldOf(result.current).onPaste(pasteEvent('not a date'))
        textFieldOf(result.current).onClear({})
      })
      await act(async () => {
        await Promise.resolve()
      })
      expect(await validateField(formRef)).toBe(true)
    })
  })

  describe('consumer handlers', () => {
    it('calls the consumer onChange after binding the value', () => {
      const onChange = vi.fn()
      const { result } = renderPicker({ onChange })
      const date = new Date(2020, 0, 2)
      const context = { validationError: null, source: 'field' } as const
      act(() => {
        result.current.onChange(date, context)
      })
      expect(onChange).toHaveBeenCalledWith(date, context)
      expect(result.current.value).toEqual(date)
    })

    it('calls the consumer onError with the code and value', () => {
      const onError = vi.fn()
      const { result } = renderPicker({ onError })
      const date = new Date(1900, 0, 1)
      act(() => {
        result.current.onError('minDate', date)
      })
      expect(onError).toHaveBeenCalledWith('minDate', date)
    })

    it('runs the consumer onBlur after the form’s own', async () => {
      const onBlur = vi.fn()
      const { result, formRef } = renderPicker({
        required: true,
        slotProps: { textField: { onBlur } },
      })
      const event = {}
      act(() => {
        textFieldOf(result.current).onBlur(event)
      })
      expect(onBlur).toHaveBeenCalledWith(event)
      // The form's own onBlur marked the field touched, so validation can speak.
      expect(await validateField(formRef)).toBe(false)
    })
  })

  describe('slotProps', () => {
    it('keeps other consumer slots untouched', () => {
      const { result } = renderPicker({
        slotProps: { field: { onClear: () => {} }, textField: { 'aria-label': 'Pick a day' } },
      })
      expect(result.current.slotProps.field).toBeDefined()
      expect(textFieldOf(result.current)['aria-label']).toBe('Pick a day')
    })

    it('gives the helper text role="alert" only while it shows an error', async () => {
      const { result, formRef } = renderPicker({ required: true })
      expect(textFieldOf(result.current).slotProps.formHelperText.role).toBeUndefined()
      expect(await validateField(formRef)).toBe(false)
      await waitFor(() =>
        expect(textFieldOf(result.current).slotProps.formHelperText.role).toBe('alert'),
      )
    })

    it("merges a consumer's own formHelperText slot rather than replacing it", () => {
      const { result } = renderPicker({
        slotProps: { textField: { slotProps: { formHelperText: { id: 'mine' } } } },
      })
      const helper = textFieldOf(result.current).slotProps.formHelperText as {
        id?: string
        role?: string
      }
      expect(helper.id).toBe('mine')
    })

    it('leaves inputLabel.required undefined in asterisk mode', () => {
      const { result } = renderPicker({ required: true })
      expect(textFieldOf(result.current).slotProps.inputLabel.required).toBeUndefined()
    })

    it('shows the consumer helper text when there is no error', () => {
      const { result } = renderPicker({ helperText: 'Any weekday' })
      expect(textFieldOf(result.current).helperText).toBe('Any weekday')
      expect(textFieldOf(result.current).error).toBe(false)
    })

    it('replaces the helper text with the error message', async () => {
      const { result, formRef } = renderPicker({ helperText: 'Any weekday', required: true })
      expect(await validateField(formRef)).toBe(false)
      await waitFor(() => expect(textFieldOf(result.current).helperText).toBe('When is required.'))
    })
  })
})
