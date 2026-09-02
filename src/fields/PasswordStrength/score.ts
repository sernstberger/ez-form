/**
 * Deterministic 0–4 password strength heuristic. No dependency, no network,
 * no dictionary lookups — consumers who want zxcvbn-grade scoring pass their
 * own `score` prop to `<PasswordStrength>`; this is only the built-in default.
 *
 * Signals:
 * - length thresholds (8 / 12 / 16)
 * - character class variety (lower, upper, digit, symbol)
 * - a penalty for a long repeated run (`aaaa`) or a monotonic sequence
 *   (`abcd`, `1234`), since those inflate length without adding entropy
 */

const CLASS_PATTERNS = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/]

function countClasses(password: string): number {
  return CLASS_PATTERNS.reduce((count, pattern) => count + (pattern.test(password) ? 1 : 0), 0)
}

/** Longest run of a repeated character or an ascending/descending sequence. */
function longestTrivialRun(password: string): number {
  let longest = 1
  let run = 1
  for (let i = 1; i < password.length; i++) {
    const prev = password.charCodeAt(i - 1)
    const curr = password.charCodeAt(i)
    const isRepeat = curr === prev
    const isSequential = curr === prev + 1 || curr === prev - 1
    if (isRepeat || isSequential) {
      run += 1
    } else {
      run = 1
    }
    longest = Math.max(longest, run)
  }
  return longest
}

export function scorePassword(password: string): 0 | 1 | 2 | 3 | 4 {
  if (password.length === 0) return 0

  let points = 0
  if (password.length >= 8) points += 1
  if (password.length >= 12) points += 1
  if (password.length >= 16) points += 1

  const classes = countClasses(password)
  if (classes >= 2) points += 1
  if (classes >= 3) points += 1
  if (classes >= 4) points += 1

  const trivialRun = longestTrivialRun(password)
  const runRatio = trivialRun / password.length
  // A short repeat/sequence inside an otherwise varied password only costs a
  // little; a password that IS one long repeat or sequence is worthless
  // regardless of its length, so it is floored rather than merely docked.
  if (runRatio >= 0.75) points = Math.min(points, 1)
  else if (trivialRun >= 4) points -= 2
  else if (trivialRun >= 3) points -= 1

  const clamped = Math.max(0, Math.min(4, points))
  return clamped as 0 | 1 | 2 | 3 | 4
}
