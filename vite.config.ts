import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import dts from 'vite-plugin-dts'

// Never bundle a dependency: anything that is not a relative or absolute
// path (or a Vite virtual module) is a peer/runtime dep and stays external.
// (Inline absolute-path test instead of node:path so the config needs no @types/node.)
const isAbsolute = (id: string) => /^(?:\/|[A-Za-z]:[\\/])/.test(id)
const external = (id: string) => !id.startsWith('.') && !id.startsWith('\0') && !isAbsolute(id)

export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === 'lib' ? [dts({ tsconfigPath: './tsconfig.build.json' })] : [])],
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
