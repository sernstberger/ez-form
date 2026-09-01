// jest-axe 11 ships no types, and @types/jest-axe references @types/jest, whose
// global `expect` shadows vitest's and hides the jest-dom matchers. Declare the
// small surface this project uses instead.
declare module 'jest-axe' {
  import type { AxeResults, RunOptions, Spec } from 'axe-core'

  export type JestAxe = (html: Element | string, options?: RunOptions) => Promise<AxeResults>

  export interface JestAxeConfigureOptions extends RunOptions {
    globalOptions?: Spec
  }

  export const axe: JestAxe

  export function configureAxe(options?: JestAxeConfigureOptions): JestAxe

  export const toHaveNoViolations: {
    toHaveNoViolations(results?: Partial<AxeResults>): { pass: boolean; message(): string }
  }
}
