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
       * Vite's reporter warns about chunks over 500 kB. The three that exceed it here are
       * Storybook's own — `iframe` (1.2 MB), `axe` (579 kB, the a11y addon's engine) and
       * `components` (567 kB) — none of which this repo controls or ships; ez-form's own
       * largest chunk is `useEzField` at 95 kB. Storybook's preview bundle is a dev tool
       * served locally, not a payload any consumer downloads, so chunk size here measures
       * nothing worth failing a build over. The limit is raised rather than the warning
       * suppressed, so a genuinely unreasonable bundle would still trip it.
       *
       * The library build has no such allowance: `pnpm build` keeps Vite's default limit,
       * and dist/index.js is 84 kB.
       */
      chunkSizeWarningLimit: 1500,
      rollupOptions: { ...config.build?.rollupOptions, onwarn: failOnWarning },
    },
  }),
}

export default config
