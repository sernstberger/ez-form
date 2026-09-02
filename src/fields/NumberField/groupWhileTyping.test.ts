import { getSeparators, groupWhileTyping } from './groupWhileTyping'

// The separators these locales actually use, spelled out so the tests fail loudly if an
// ICU build disagrees rather than silently asserting whatever `getSeparators` returned.
const NNBSP = '\u202f' // fr-FR group: NARROW NO-BREAK SPACE
const RSQUO = '\u2019' // de-CH group: RIGHT SINGLE QUOTATION MARK

describe('getSeparators', () => {
  it('en-US', () => {
    expect(getSeparators('en-US')).toEqual({ group: ',', decimal: '.' })
  })

  it('de-DE', () => {
    expect(getSeparators('de-DE')).toEqual({ group: '.', decimal: ',' })
  })

  it('fr-FR groups with a narrow no-break space', () => {
    expect(getSeparators('fr-FR')).toEqual({ group: NNBSP, decimal: ',' })
  })

  it('de-CH groups with a right single quotation mark', () => {
    expect(getSeparators('de-CH')).toEqual({ group: RSQUO, decimal: '.' })
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

  describe('leading minus', () => {
    it('keeps a lone minus untouched', () => {
      expect(groupWhileTyping('-', 1, separators)).toEqual({ text: '-', caret: 1 })
    })

    it('groups the digits typed after a minus', () => {
      expect(groupWhileTyping('-1234', 5, separators)).toEqual({ text: '-1,234', caret: 6 })
    })

    it('keeps the minus when the digits are deleted back to it', () => {
      expect(groupWhileTyping('-', 1, separators)).toEqual({ text: '-', caret: 1 })
    })
  })

  describe('fr-FR (narrow no-break space group)', () => {
    const fr = getSeparators('fr-FR')

    it('inserts the locale separator', () => {
      expect(groupWhileTyping('1234567', 7, fr)).toEqual({
        text: `1${NNBSP}234${NNBSP}567`,
        caret: 9,
      })
    })

    it('leaves already-grouped text alone', () => {
      expect(groupWhileTyping(`1${NNBSP}234${NNBSP}567`, 9, fr)).toEqual({
        text: `1${NNBSP}234${NNBSP}567`,
        caret: 9,
      })
    })

    it('regroups text grouped with plain ASCII spaces', () => {
      // What a paste from a spreadsheet or another locale's rendering looks like: the
      // separator is a space, but not the exact one this locale formats with.
      expect(groupWhileTyping('1 234 5678', 10, fr)).toEqual({
        text: `12${NNBSP}345${NNBSP}678`,
        caret: 10,
      })
    })

    it('keeps the comma decimal and the minus', () => {
      expect(groupWhileTyping('-1234,5', 7, fr)).toEqual({ text: `-1${NNBSP}234,5`, caret: 8 })
    })
  })

  describe('de-CH (apostrophe group)', () => {
    const ch = getSeparators('de-CH')

    it('inserts the locale separator', () => {
      expect(groupWhileTyping('1234567', 7, ch)).toEqual({
        text: `1${RSQUO}234${RSQUO}567`,
        caret: 9,
      })
    })

    it('leaves already-grouped text alone', () => {
      expect(groupWhileTyping(`1${RSQUO}234${RSQUO}567`, 9, ch)).toEqual({
        text: `1${RSQUO}234${RSQUO}567`,
        caret: 9,
      })
    })

    it('regroups text grouped with the ASCII apostrophe', () => {
      // Base UI's parser accepts both `'` and `’` as the Swiss group separator, so the
      // grouper must too — otherwise a pasted `1'234'567` is left as an unrecognised
      // string and every later keystroke is dropped from the display.
      expect(groupWhileTyping("1'234'5678", 10, ch)).toEqual({
        text: `12${RSQUO}345${RSQUO}678`,
        caret: 10,
      })
    })

    it('keeps the dot decimal and the minus', () => {
      expect(groupWhileTyping('-1234.5', 7, ch)).toEqual({ text: `-1${RSQUO}234.5`, caret: 8 })
    })
  })
})
