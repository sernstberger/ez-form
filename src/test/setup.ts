import '@testing-library/jest-dom/vitest'
import { configure } from '@testing-library/react'
import { toHaveNoViolations } from 'jest-axe'
import { fakeApiTiming } from '../examples/fakeApi'
import { installConsoleGuard } from './expectConsole'

expect.extend(toHaveNoViolations)

// Vitest 4 hides console output from passing tests, so a React `act()` warning or a stray
// `devWarn` would never be seen in a green run. This makes any unexpected `console.error` /
// `console.warn` fail the test that produced it; a test that means to log opts in with
// `expectConsole`. See src/test/expectConsole.ts.
installConsoleGuard()

// Every `render` wraps in `<StrictMode>`, so effects, refs and state updaters double-invoke
// exactly as they do in a consumer's own StrictMode app (and as they will in a future React
// that reuses state). A component that queues focus, starts a timer or writes through a ref
// in an effect has to be idempotent to survive this; that is the point.
configure({ reactStrictMode: true })

// The example forms' fake backend (src/examples/fakeApi.ts) uses a realistic
// 300-600ms delay for stories; zero it here so example tests resolve on the
// next macrotask instead of paying that in real time. A `setTimeout(fn, 0)`
// still needs a task-queue turn, so "pending state" assertions that check
// synchronously (before any await) still see the disabled/loading state.
fakeApiTiming.scale = 0
