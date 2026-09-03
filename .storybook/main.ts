import type { StorybookConfig } from '@storybook/react-vite'
import { failOnWarning } from '../rollupWarnings.ts'

const config: StorybookConfig = {
  framework: {
    name: '@storybook/react-vite',
    // Same gate as the test suite (src/test/setup.ts): every story renders under
    // `<StrictMode>`, so a double-invoked effect shows up while developing a component
    // rather than in a consumer's StrictMode app.
    options: { strictMode: true },
  },
  stories: ['./*.mdx', '../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y'],
  /**
   * Build warnings fail the build, matching `vite.config.ts`'s `onwarn` for the library
   * build. Storybook owns its own Vite config, so the same rule has to be installed here
   * too — otherwise a warning that fails `pnpm build` would pass `pnpm build-storybook`.
   */
  viteFinal: (config) => ({
    ...config,
    build: {
      ...config.build,
      /*
       * Vite's reporter prints "(!) Some chunks are larger than 500 kB" for three chunks
       * here, all Storybook-owned: `iframe` (1.2 MB), `axe` (579 kB) and `components`
       * (567 kB). ez-form's own largest chunk is `useEzField` at 95 kB.
       *
       * Two things were checked before raising the limit instead of fixing the chunks (#95):
       *
       * 1. Splitting cannot get under 500 kB. Each oversized chunk is dominated by one
       *    pre-bundled module, and a module is the smallest unit a bundler can place:
       *    `storybook/dist/preview/runtime.js` is 806 kB minified *on its own* (isolated
       *    via `rolldownOptions.output.advancedChunks`), `axe-core/axe.js` is the entire
       *    579 kB `axe` chunk, and `storybook/dist/components/index.js` is the bulk of
       *    `components`. Any chunk map still leaves two chunks over the limit.
       * 2. The message is not a build warning. It comes from Vite's reporter plugin
       *    (`builtin:vite-reporter`, native in Vite 8) through the logger after the bundle is
       *    written; it never reaches `onwarn`, so `failOnWarning` neither fails on it nor can
       *    allow-list it, and with the default limit the build exits 0 and prints the advisory
       *    on every run. A permanent advisory in CI is exactly the "warnings are noise" habit
       *    `failOnWarning` exists to prevent.
       *
       * Storybook's preview bundle is a dev tool served locally, not a payload a consumer
       * downloads, so chunk size here measures nothing worth acting on. The limit is raised
       * rather than the logger filtered, so a genuinely unreasonable bundle would still trip
       * it. The library build has no such allowance: `pnpm build` keeps Vite's default limit
       * (and `build.lib` disables the check anyway), and dist/index.js is ~110 kB.
       */
      chunkSizeWarningLimit: 1500,
      rollupOptions: { ...config.build?.rollupOptions, onwarn: failOnWarning },
    },
  }),
}

export default config
