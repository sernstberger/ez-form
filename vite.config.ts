import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import dts from 'vite-plugin-dts'
import pkg from './package.json' with { type: 'json' }

const external = [
  ...Object.keys(pkg.peerDependencies),
  ...Object.keys(pkg.dependencies),
  /^@mui\//,
  /^@emotion\//,
  /^@hookform\//,
  /^react\//,
  /^react-dom\//,
]

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
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.test.tsx'],
  },
}))
