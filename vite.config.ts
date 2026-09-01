import { createRequire } from 'node:module'
import { dirname } from 'node:path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import dts from 'vite-plugin-dts'

// api-extractor's own analyzer depends on the classic TypeScript compiler API
// (`require('typescript').createProgram`, etc.), which the project's pinned
// `typescript@^7.0.2` (the native/Go preview) no longer exports — its package
// ships only a `tsc` CLI binary, no requirable API and no `lib/*.d.ts` files.
// api-extractor itself has its own direct (non-peer) dependency on a classic
// TypeScript release it can analyze with, so point the rollup step at that
// package's folder instead of letting it default to the project's TS 7.
const require = createRequire(import.meta.url)
const apiExtractorTypescriptFolder = dirname(
  dirname(require.resolve('typescript', { paths: [require.resolve('@microsoft/api-extractor/package.json')] })),
)

// Never bundle a dependency: anything that is not a relative or absolute
// path (or a Vite virtual module) is a peer/runtime dep and stays external.
// (Inline absolute-path test instead of node:path so the config needs no @types/node.)
const isAbsolute = (id: string) => /^(?:\/|[A-Za-z]:[\\/])/.test(id)
const external = (id: string) => !id.startsWith('.') && !id.startsWith('\0') && !isAbsolute(id)

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    ...(mode === 'lib'
      ? [
          dts({
            tsconfigPath: './tsconfig.build.json',
            bundleTypes: {
              invokeOptions: { typescriptCompilerFolder: apiExtractorTypescriptFolder },
            },
          }),
        ]
      : []),
  ],
  build: {
    lib: { entry: 'src/index.ts', formats: ['es'], fileName: 'index' },
    rollupOptions: { external },
    sourcemap: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    restoreMocks: true,
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
}))
