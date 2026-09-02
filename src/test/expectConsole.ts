/**
 * Makes `console.error` and `console.warn` fail the test that produced them.
 *
 * ## Why this is needed at all
 *
 * Vitest 4 hides console output from tests that pass, so React's "an update was not wrapped in
 * act(...)", "cannot update a component while rendering a different one", every key warning and
 * every one of this library's own `devWarn` messages would scroll past invisibly in a green
 * run. PHILOSOPHY rule 3 asks for pristine test output; without a guard there is no way to
 * know whether the output is pristine.
 *
 * ## How it fails
 *
 * The patched console **records** rather than throwing at the call site. Throwing there would
 * unwind whatever the component was doing and surface as a confusing error inside React's
 * internals, hiding the assertion that was the test's real point. Instead the recorded output
 * is checked in an `afterEach`, so a test that fails an assertion *and* logs a warning reports
 * the assertion first, and the console failure only ever fires on a test that would otherwise
 * have passed.
 *
 * ## Opting in
 *
 * A test that means to produce console output calls `expectConsole(level, matcher)` before the
 * code that logs. It allows *any number* of matching messages — React logs the same warning
 * once per render pass, and StrictMode doubles that, so a count would only encode how many
 * times React happens to re-render today. Unmatched output still fails, so an opt-in for one
 * warning does not silence a different, unexpected one. An allowance that matches nothing is
 * not an error either: it says "this may log", not "this must".
 *
 * `expectConsole` is deliberately not a blanket mute: there is no "silence this whole file"
 * switch, because the point is that a new warning in an existing test is a regression someone
 * has to look at.
 */

type Level = 'error' | 'warn'

/** A recorded console call, kept with its level so the failure message can name it. */
interface Recorded {
  level: Level
  text: string
}

/** One registered allowance: any number of matching messages are permitted. */
interface Expectation {
  level: Level
  matcher: string | RegExp
}

let recorded: Recorded[] = []
let expectations: Expectation[] = []
const original: Partial<Record<Level, typeof console.error>> = {}

/**
 * Renders a console call the way the developer would see it, so the failure message shows the
 * real text. Only the first argument is formatted through `%s`-style substitution because that
 * is what React's warnings use; anything else is appended.
 */
function formatCall(args: unknown[]): string {
  const [first, ...rest] = args
  if (typeof first !== 'string') return args.map((a) => String(a)).join(' ')
  let index = 0
  const substituted = first.replace(/%[sdifoOc]/g, () =>
    index < rest.length ? String(rest[index++]) : '%s',
  )
  const trailing = rest.slice(index)
  return trailing.length > 0
    ? `${substituted} ${trailing.map((a) => String(a)).join(' ')}`
    : substituted
}

function matches(expectation: Expectation, call: Recorded): boolean {
  if (expectation.level !== call.level) return false
  return typeof expectation.matcher === 'string'
    ? call.text.includes(expectation.matcher)
    : expectation.matcher.test(call.text)
}

/**
 * The one always-allowed message, and the only entry that may ever be added here.
 *
 * MUI's `ButtonBase` mounts a `TouchRipple` that starts its ripple as a *timed* state update:
 * focusing or clicking any MUI button schedules a `setState` that lands after the surrounding
 * `act()` scope has closed, and React reports it as an un-acted update naming
 * `ForwardRef(TouchRipple)`. It comes from inside MUI with no ez-form code involved at all —
 * a bare `render(<Button autoFocus>Cancel</Button>)` reproduces it in five lines.
 *
 * There is no fix available from this side. Silencing it per component would mean
 * `disableRipple` in `src/`, which PHILOSOPHY rule 2 forbids and `check-guardrails` rejects,
 * and the tests that hit it render without a shared `ThemeProvider` to carry a `defaultProps`.
 * Matching only the TouchRipple text keeps every *other* act warning — including one from a
 * genuinely un-acted update in this library — failing as it should.
 */
const ALWAYS_ALLOWED: readonly Expectation[] = [
  { level: 'error', matcher: /An update to ForwardRef\(TouchRipple\) inside a test/ },
]

/**
 * Allow `console[level]` calls matching `matcher` in the current test.
 *
 * Call it before the code that logs. A string matcher is a substring test, a RegExp is tested
 * against the formatted message. Any number of matching calls are then permitted; anything
 * that does not match still fails the test.
 */
export function expectConsole(level: Level, matcher: string | RegExp): void {
  expectations.push({ level, matcher })
}

/** Installs the patched console. Called once from `setup.ts`. */
export function installConsoleGuard(): void {
  beforeEach(() => {
    recorded = []
    expectations = []
    for (const level of ['error', 'warn'] as const) {
      // Bound to `console` so the saved original can be called as a plain function when it is
      // restored (and so a future implementation that reads `this` still works).
      original[level] = console[level].bind(console)
      console[level] = (...args: unknown[]) => {
        recorded.push({ level, text: formatCall(args) })
      }
    }
  })

  afterEach(() => {
    for (const level of ['error', 'warn'] as const) {
      const restore = original[level]
      if (restore) console[level] = restore
    }

    const allowed = [...ALWAYS_ALLOWED, ...expectations]
    const unexpected = recorded.filter(
      (call) => !allowed.some((expectation) => matches(expectation, call)),
    )
    recorded = []
    expectations = []

    if (unexpected.length > 0) {
      // De-duplicated: React logs the same warning once per render pass, and StrictMode
      // doubles that, so the raw list is the same line several times over.
      const lines = [...new Set(unexpected.map((c) => `  console.${c.level}: ${c.text}`))].join(
        '\n',
      )
      throw new Error(
        `Unexpected console output during this test:\n${lines}\n\n` +
          'Fix the component, or — if the message is the point of the test — opt in with ' +
          "`expectConsole('warn', /…/)` from src/test/expectConsole.ts.",
      )
    }
  })
}
