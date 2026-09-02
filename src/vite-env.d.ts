/// <reference types="vite/client" />

declare module '*.md?raw' {
  const content: string
  export default content
}

/**
 * `process.env.NODE_ENV` only — the one Node global this browser library reads, and only so
 * `src/devWarn.ts`'s dev-only warnings compile out of a production bundle (every bundler
 * substitutes this exact expression before dead-code elimination).
 *
 * Declared as a global `var` rather than `declare const process`: `var` declarations merge
 * with an existing ambient `process` instead of replacing it, so this is correct both under
 * `tsconfig.json` (where vitest's globals already declare a full `process`, used by
 * `Form.test.tsx`) and under `tsconfig.build.json`, which sets `"types": []` and so has no
 * `process` at all. An interface-merge into `NodeJS.ProcessEnv` only works in the first case
 * and leaves the build emitting TS2591.
 *
 * Pulling in `@types/node` would fix it too, at the cost of putting Node's whole global
 * surface in scope for a package that never runs there.
 */
declare global {
  var process: { env: { NODE_ENV?: string } }
}

export {}
