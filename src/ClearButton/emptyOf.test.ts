import { emptyOf } from './emptyOf'

describe('emptyOf', () => {
  it('maps leaves by type and recurses into plain objects', () => {
    const file = new File(['x'], 'x.txt')
    expect(
      emptyOf({
        name: 'Ada',
        seats: 3,
        tos: true,
        tags: ['a'],
        when: new Date(2026, 0, 1),
        doc: file,
        nothing: null,
        missing: undefined,
        address: { city: 'Oslo', zip: 1234 },
      }),
    ).toEqual({
      name: '',
      seats: null,
      tos: false,
      tags: [],
      when: null,
      doc: null,
      nothing: null,
      missing: undefined,
      address: { city: '', zip: null },
    })
  })
})
