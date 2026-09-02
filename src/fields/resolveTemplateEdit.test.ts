import { formatTemplate } from './formatTemplate'
import { resolveTemplateEdit, toEditKind, type TemplateEditKind } from './resolveTemplateEdit'

const PHONE = '###-###-####'
const PAREN = '(###) ###-####'

/**
 * Builds the edit the browser would report, so each case reads as "this was on
 * screen, this was selected, the user did this" rather than as hand-built
 * state. `nextText` is what the input holds after the browser's own edit —
 * exactly what the component reads off `event.target.value`.
 */
function edit(
  previousDigits: string,
  template: string,
  selectionStart: number,
  selectionEnd: number,
  kind: TemplateEditKind,
  nextText: string,
) {
  return resolveTemplateEdit({
    previousDigits,
    previousDisplay: formatTemplate(previousDigits, template),
    selectionStart,
    selectionEnd,
    kind,
    nextText,
  })
}

/** What the browser leaves in the input after a collapsed backward delete. */
function afterBackspace(display: string, caret: number) {
  return display.slice(0, Math.max(0, caret - 1)) + display.slice(caret)
}

/** What the browser leaves in the input after a collapsed forward delete. */
function afterDelete(display: string, caret: number) {
  return display.slice(0, caret) + display.slice(caret + 1)
}

describe('toEditKind', () => {
  it.each([
    ['deleteContentBackward', 'deleteContentBackward'],
    ['deleteContentForward', 'deleteContentForward'],
    ['insertFromPaste', 'insertFromPaste'],
    ['insertText', 'insertText'],
    ['insertFromDrop', 'other'],
    ['historyUndo', 'other'],
    [undefined, 'other'],
  ])('%s -> %s', (input, expected) => {
    expect(toEditKind(input)).toBe(expected)
  })
})

describe('resolveTemplateEdit: collapsed backward delete (Backspace)', () => {
  it('deletes the digit before the caret in the middle of a group', () => {
    // "555-123-4567", caret 6 is after the "2".
    const display = formatTemplate('5551234567', PHONE)
    expect(
      edit('5551234567', PHONE, 6, 6, 'deleteContentBackward', afterBackspace(display, 6)),
    ).toEqual({ digits: '555134567', digitCaret: 4 })
  })

  it('caret just after a separator deletes the digit that separator follows (#16 C2)', () => {
    // "555-123-4567", caret 4 sits just after the first "-". The browser
    // deletes only the separator, leaving the digits untouched; the key must
    // still remove the third "5".
    const display = formatTemplate('5551234567', PHONE)
    expect(
      edit('5551234567', PHONE, 4, 4, 'deleteContentBackward', afterBackspace(display, 4)),
    ).toEqual({ digits: '551234567', digitCaret: 2 })
  })

  it('caret at offset 6 of "(###) ###-####" deletes the digit before it, not two before', () => {
    // "(555) 123-4567", offset 6 is just after the ")" — the digit before it
    // is the third "5". The old length heuristic produced "(551) 234-567".
    const display = formatTemplate('5551234567', PAREN)
    expect(
      edit('5551234567', PAREN, 6, 6, 'deleteContentBackward', afterBackspace(display, 6)),
    ).toEqual({ digits: '551234567', digitCaret: 2 })
  })

  it('is a no-op at the very start', () => {
    const display = formatTemplate('5551234567', PHONE)
    expect(
      edit('5551234567', PHONE, 0, 0, 'deleteContentBackward', afterBackspace(display, 0)),
    ).toEqual({ digits: '5551234567', digitCaret: 0 })
  })

  it('deletes the last digit from the end', () => {
    const display = formatTemplate('5551234567', PHONE)
    expect(
      edit(
        '5551234567',
        PHONE,
        display.length,
        display.length,
        'deleteContentBackward',
        afterBackspace(display, display.length),
      ),
    ).toEqual({ digits: '555123456', digitCaret: 9 })
  })
})

describe('resolveTemplateEdit: collapsed forward delete (Delete)', () => {
  it('deletes the digit at the caret (#16 C2)', () => {
    // "555-123-4567", caret 3 sits just before the first "-". Delete must take
    // the digit on the far side of it — the "1" — not the "5" behind it.
    const display = formatTemplate('5551234567', PHONE)
    expect(
      edit('5551234567', PHONE, 3, 3, 'deleteContentForward', afterDelete(display, 3)),
    ).toEqual({ digits: '555234567', digitCaret: 3 })
  })

  it('deletes the first digit from the start', () => {
    const display = formatTemplate('5551234567', PHONE)
    expect(
      edit('5551234567', PHONE, 0, 0, 'deleteContentForward', afterDelete(display, 0)),
    ).toEqual({ digits: '551234567', digitCaret: 0 })
  })

  it('mid-group Delete takes the digit in front of the caret', () => {
    const display = formatTemplate('5551234567', PHONE)
    expect(
      edit('5551234567', PHONE, 5, 5, 'deleteContentForward', afterDelete(display, 5)),
    ).toEqual({ digits: '555134567', digitCaret: 4 })
  })

  it('is a no-op at the very end', () => {
    const display = formatTemplate('5551234567', PHONE)
    expect(
      edit(
        '5551234567',
        PHONE,
        display.length,
        display.length,
        'deleteContentForward',
        afterDelete(display, display.length),
      ),
    ).toEqual({ digits: '5551234567', digitCaret: 10 })
  })
})

describe('resolveTemplateEdit: delete over a selection', () => {
  it('removes exactly the selected digits and nothing outside them', () => {
    // "555-123-4567", offsets 4..7 cover "123".
    expect(edit('5551234567', PHONE, 4, 7, 'deleteContentBackward', '555-4567')).toEqual({
      digits: '5554567',
      digitCaret: 3,
    })
  })

  it('a selection spanning a separator still only drops the digits inside it', () => {
    // Offsets 2..9 cover "5-123-4" => digits "51234".
    expect(edit('5551234567', PHONE, 2, 9, 'deleteContentBackward', '55567')).toEqual({
      digits: '55567',
      digitCaret: 2,
    })
  })

  it('select-all + delete empties the field', () => {
    const display = formatTemplate('5551234567', PHONE)
    expect(edit('5551234567', PHONE, 0, display.length, 'deleteContentBackward', '')).toEqual({
      digits: '',
      digitCaret: 0,
    })
  })

  it('forward delete over a selection behaves the same as backward', () => {
    expect(edit('5551234567', PHONE, 4, 7, 'deleteContentForward', '555-4567')).toEqual({
      digits: '5554567',
      digitCaret: 3,
    })
  })
})

describe('resolveTemplateEdit: paste over a selection (#16 C1)', () => {
  it('same-length paste over a full selection keeps every pasted digit', () => {
    // The regression: ten digits pasted over a selected ten-digit value is a
    // same-length edit, which the old length heuristic read as a separator
    // delete and truncated to nine.
    const display = formatTemplate('5551234567', PHONE)
    expect(edit('5551234567', PHONE, 0, display.length, 'insertFromPaste', '5551234567')).toEqual({
      digits: '5551234567',
      digitCaret: 10,
    })
  })

  it('shorter paste over a full selection keeps every pasted digit', () => {
    const display = formatTemplate('5551234567', PHONE)
    expect(edit('5551234567', PHONE, 0, display.length, 'insertFromPaste', '212555000')).toEqual({
      digits: '212555000',
      digitCaret: 9,
    })
  })

  it('longer paste over a full selection keeps every pasted digit', () => {
    const display = formatTemplate('5551234', PHONE)
    expect(edit('5551234', PHONE, 0, display.length, 'insertFromPaste', '2125550000')).toEqual({
      digits: '2125550000',
      digitCaret: 10,
    })
  })

  it('a formatted paste over a full selection is read as its digits', () => {
    const display = formatTemplate('5551234567', PHONE)
    expect(
      edit('5551234567', PHONE, 0, display.length, 'insertFromPaste', '(212) 555-0000'),
    ).toEqual({ digits: '2125550000', digitCaret: 10 })
  })

  it('paste over a partial selection replaces only those digits', () => {
    // Offsets 4..7 cover "123"; pasting "99" leaves "555" + "99" + "4567".
    expect(edit('5551234567', PHONE, 4, 7, 'insertFromPaste', '555-99-4567')).toEqual({
      digits: '555994567',
      digitCaret: 5,
    })
  })

  it('paste into a collapsed caret splices at that point, keeping the tail', () => {
    expect(edit('5554567', PHONE, 3, 3, 'insertFromPaste', '555123-4567')).toEqual({
      digits: '5551234567',
      digitCaret: 6,
    })
  })

  it('paste into an empty field', () => {
    expect(edit('', PHONE, 0, 0, 'insertFromPaste', '(555) 123-4567')).toEqual({
      digits: '5551234567',
      digitCaret: 10,
    })
  })
})

describe('resolveTemplateEdit: typing', () => {
  it('appends at the end', () => {
    expect(edit('555', PHONE, 3, 3, 'insertText', '5551')).toEqual({
      digits: '5551',
      digitCaret: 4,
    })
  })

  it('inserts in the middle and pushes the rest right', () => {
    // "555-123-4567", caret 5 is after the "1"; typing "9" gives "5551 9 23456…".
    expect(edit('5551234567', PHONE, 5, 5, 'insertText', '555-1923-4567')).toEqual({
      digits: '55519234567',
      digitCaret: 5,
    })
  })

  it('typing over a selection replaces exactly those digits', () => {
    expect(edit('5551234567', PHONE, 4, 7, 'insertText', '555-9-4567')).toEqual({
      digits: '55594567',
      digitCaret: 4,
    })
  })

  it('typing a non-digit contributes nothing and leaves the caret put', () => {
    expect(edit('555', PHONE, 3, 3, 'insertText', '555a')).toEqual({ digits: '555', digitCaret: 3 })
  })

  it('typing into an empty field', () => {
    expect(edit('', PHONE, 0, 0, 'insertText', '5')).toEqual({ digits: '5', digitCaret: 1 })
  })
})

describe('resolveTemplateEdit: repeated-digit edges', () => {
  // Head/tail subtraction has to stay honest when the surrounding digits repeat,
  // which is where a naive "strip the common prefix" would over-trim.
  it('inserting a digit identical to its neighbours', () => {
    expect(edit('5555', PHONE, 2, 2, 'insertText', '55555')).toEqual({
      digits: '55555',
      digitCaret: 3,
    })
  })

  it('pasting all-same digits over a selection of the same digit', () => {
    expect(edit('5555555555', PHONE, 4, 7, 'insertFromPaste', '555-55-5555')).toEqual({
      digits: '555555555',
      digitCaret: 5,
    })
  })

  it('backspace among identical digits still removes exactly one', () => {
    const display = formatTemplate('5555555555', PHONE)
    expect(
      edit('5555555555', PHONE, 6, 6, 'deleteContentBackward', afterBackspace(display, 6)),
    ).toEqual({ digits: '555555555', digitCaret: 4 })
  })
})

describe('resolveTemplateEdit: unknown edit kinds', () => {
  it("an autofill-style replacement of the whole field takes the input's digits", () => {
    const display = formatTemplate('5551234567', PHONE)
    expect(edit('5551234567', PHONE, 0, display.length, 'other', '(212) 555-0000')).toEqual({
      digits: '2125550000',
      digitCaret: 10,
    })
  })
})
