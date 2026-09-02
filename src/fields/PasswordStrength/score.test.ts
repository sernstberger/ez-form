import { scorePassword } from './score'

describe('scorePassword', () => {
  it.each<[string, 0 | 1 | 2 | 3 | 4]>([
    ['', 0],
    ['a', 0],
    ['aaaa', 0],
    ['abcd', 0],
    ['password', 1],
    ['passwordlong', 2],
    ['Password1', 3],
    ['Password123', 2],
    ['Tr0ub4dor&3xyz!', 4],
    ['aaaaaaaaaaaaaaaa', 1],
    ['abcdefghijklmnop', 1],
    ['zzzzzzzz', 1],
  ])('scorePassword(%j) === %i', (password, expected) => {
    expect(scorePassword(password)).toBe(expected)
  })

  it('never returns a value outside 0-4', () => {
    const samples = ['', 'x', 'x'.repeat(50), 'Ab1!Ab1!Ab1!Ab1!Ab1!', '💯💯💯💯']
    for (const s of samples) {
      const score = scorePassword(s)
      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(4)
    }
  })

  it('is monotonic-ish: adding character-class variety does not lower the score', () => {
    const base = scorePassword('passwordpassword')
    const withVariety = scorePassword('Passw0rd!passw0rd')
    expect(withVariety).toBeGreaterThanOrEqual(base)
  })
})
