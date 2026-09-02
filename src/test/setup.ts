import '@testing-library/jest-dom/vitest'
import { toHaveNoViolations } from 'jest-axe'
import { fakeApiTiming } from '../examples/fakeApi'

expect.extend(toHaveNoViolations)

// The example forms' fake backend (src/examples/fakeApi.ts) uses a realistic
// 300-600ms delay for stories; zero it here so example tests resolve on the
// next macrotask instead of paying that in real time. A `setTimeout(fn, 0)`
// still needs a task-queue turn, so "pending state" assertions that check
// synchronously (before any await) still see the disabled/loading state.
fakeApiTiming.scale = 0
