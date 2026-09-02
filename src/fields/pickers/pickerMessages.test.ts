import { pickerMessage } from './pickerMessages'

describe('pickerMessage', () => {
  it.each([
    ['invalidDate', 'Start is invalid.'],
    ['minDate', 'Start is too early.'],
    ['minTime', 'Start is too early.'],
    ['minutesStep', 'Start is too early.'],
    ['maxDate', 'Start is too late.'],
    ['maxTime', 'Start is too late.'],
    ['disablePast', 'Start must be in the future.'],
    ['disableFuture', 'Start must be in the past.'],
    ['shouldDisableDate', 'Start is not available.'],
    ['shouldDisableTime-hours', 'Start is not available.'],
  ])('%s → %s', (code, message) => {
    expect(pickerMessage(code, 'Start', undefined)).toBe(message)
  })

  it('prefers a consumer message for the code', () => {
    expect(pickerMessage('minDate', 'Start', { minDate: 'Pick a later day' })).toBe(
      'Pick a later day',
    )
  })

  it('uses the fallback label when the label is not a string', () => {
    expect(pickerMessage('invalidDate', undefined, undefined)).toBe('This field is invalid.')
  })
})
