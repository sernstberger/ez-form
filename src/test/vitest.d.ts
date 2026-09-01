import 'vitest'

// jest-axe registers `toHaveNoViolations` at runtime (src/test/setup.ts); this
// teaches vitest's `expect` about it.
declare module 'vitest' {
  interface Assertion {
    toHaveNoViolations(): void
  }
  interface AsymmetricMatchersContaining {
    toHaveNoViolations(): void
  }
}
