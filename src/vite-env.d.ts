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
 * Declared as an interface merged into the ambient `process` rather than `declare const
 * process`, which would *replace* the type vitest's globals already provide (`process.on`,
 * used in `Form.test.tsx`) instead of adding to it. Pulling in `@types/node` for this would
 * put Node's whole global surface in scope for a package that never runs there.
 */
declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV?: string
  }
}
