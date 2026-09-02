import { getSeparators, groupWhileTyping } from './groupWhileTyping'

describe('getSeparators', () => {
  it('en-US', () => {
    expect(getSeparators('en-US')).toEqual({ group: ',', decimal: '.' })
  })

  it('de-DE', () => {
    expect(getSeparators('de-DE')).toEqual({ group: '.', decimal: ',' })
  })
})

describe('groupWhileTyping', () => {
  const separators = getSeparators('en-US')

  it.each([
    ['1000', 4, '1,000', 5],
    ['1234567', 7, '1,234,567', 9],
    ['1234.50', 7, '1,234.50', 8],
    ['1234.', 5, '1,234.', 6],
    ['-1000', 5, '-1,000', 6],
    ['1,000', 5, '1,000', 5],
    ['1,000', 2, '1,000', 2],
    ['12345', 2, '12,345', 2],
    ['$1000', 5, '$1000', 5],
    ['', 0, '', 0],
  ])(
    'groupWhileTyping(%j, %j) -> { text: %j, caret: %j }',
    (text, caret, expectedText, expectedCaret) => {
      expect(groupWhileTyping(text, caret, separators)).toEqual({
        text: expectedText,
        caret: expectedCaret,
      })
    },
  )
})
