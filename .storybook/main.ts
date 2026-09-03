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
   *
   * It has to go on `rolldownOptions`, not `rollupOptions`: Storybook hands `viteFinal` a
   * `build` that already carries `rolldownOptions`, and Vite 8's config merge drops a
   * `rollupOptions` override whenever `rolldownOptions` is present. Set on `rollupOptions`
   * the handler is silently never installed (#95).
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
       *    via `rolldownOptions.output.codeSplitting`), `axe-core/axe.js` is the entire
       *    579 kB `axe` chunk, and `storybook/dist/components/index.js` is the bulk of
       *    `components`. Any chunk map still leaves two chunks over the limit.
       * 2. The advisory cannot be made fatal or allow-listed per chunk. It does reach
       *    `onwarn`, as one warning `{ plugin: 'builtin:vite-reporter' }` with no `code`,
       *    but Vite's reporter emits it after the bundle is written and swallows a throw
       *    from that path — the build still exits 0, and the message is lost with it. It is
       *    also a single aggregated message that names no chunk, so the issue's "allow-list
       *    of the oversized Storybook-owned chunks" is not expressible. `failOnWarning`
       *    therefore forwards reporter advisories to Vite's default handler so they print.
       *
       * Storybook's preview bundle is a dev tool served locally, not a payload a consumer
       * downloads, so chunk size here measures nothing worth acting on. The limit is raised
       * rather than the advisory left in every CI log, and because the advisory is forwarded
       * rather than swallowed, a bundle that grows past 1.5 MB is still reported. The
       * library build has no such allowance: `pnpm build` keeps Vite's default limit (and
       * `build.lib` disables the check anyway), and dist/index.js is ~110 kB.
       */
      chunkSizeWarningLimit: 1500,
      rolldownOptions: { ...config.build?.rolldownOptions, onwarn: failOnWarning },
    },
  }),
}

export default config
