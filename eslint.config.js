import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import storybook from 'eslint-plugin-storybook'
import prettier from 'eslint-config-prettier/flat'

/**
 * Flat config for the whole repo. `pnpm lint` runs `eslint . --max-warnings 0`, so every rule
 * below is an error in practice: a warning fails the command just as an error does.
 *
 * ## Which TypeScript compiles what
 *
 * The project's own compiler is TypeScript 7 (the native/Go build), aliased in package.json as
 * `@typescript/native` so `node_modules/.bin/tsc` — and therefore `pnpm typecheck` and the
 * Vite `dts` step — still run 7.x. typescript-eslint cannot use that package at all: TS 7 ships
 * a CLI binary and no requirable compiler API, and typescript-eslint 8.x throws on sight of it
 * ("typescript-eslint does not support TS 7.0"). Its own repo's answer, which this mirrors, is
 * to leave the bare `typescript` specifier pointing at the TS 6 API package
 * (`@typescript/typescript6`) that the linter resolves. So: `tsc` is 7, typed linting is 6.
 * The two read the same tsconfig, so a rule that needs types sees the same program shape.
 */
export default tseslint.config(
  {
    // Build outputs and vendored trees. `src/__qa__` is the gitignored scratch area for QA
    // probes, excluded from tsconfig too, so typed linting has no program for it.
    ignores: ['dist', 'storybook-static', 'coverage', 'src/__qa__'],
  },

  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  tseslint.configs.stylisticTypeChecked,

  {
    files: ['**/*.{ts,tsx,mts,cts,js,mjs,cjs}'],
    languageOptions: {
      // `projectService` lets typescript-eslint find the right tsconfig per file (including
      // the files tsconfig.json lists but does not `include`, like this config itself)
      // instead of hard-coding a project list that drifts.
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },

  // Everything that runs in a browser: src/ and the Storybook config.
  {
    files: ['src/**/*.{ts,tsx}', '.storybook/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },

  // jsx-a11y on the JSX we author. The library's own accessibility guarantees are verified by
  // jest-axe in every component test (PHILOSOPHY rule 3); this catches the static mistakes
  // axe cannot see at build time.
  {
    files: ['src/**/*.tsx', '.storybook/**/*.tsx'],
    ...jsxA11y.flatConfigs.recommended,
  },

  // Node-side tooling: build config, guardrail scripts, this file.
  {
    files: ['*.{js,mjs,ts}', 'scripts/**/*.mjs'],
    languageOptions: { globals: globals.node },
  },

  // The guardrail scripts are plain JS with JSDoc types; they are not in any tsconfig, so
  // typed rules have no program for them.
  {
    files: ['scripts/**/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
  },

  storybook.configs['flat/recommended'],

  // Tests, stories, and shared test helpers.
  {
    files: ['src/**/*.{test,stories}.{ts,tsx}', 'src/test/**/*.{ts,tsx}'],
    rules: {
      /*
       * `<Form>` requires `onSubmit`, and most tests render a form to exercise a *field*
       * without ever submitting it — `onSubmit={() => {}}` is the honest way to say "this
       * test does not care". Same for `mockImplementation(() => {})`, whose entire purpose
       * is to do nothing. 378 of these exist; naming each one `noop` would be churn that
       * makes no test better. In `src/` the rule stays on, where an empty function really
       * does signal a missing implementation.
       */
      '@typescript-eslint/no-empty-function': 'off',
    },
  },

  // Must stay last: turns off every rule that would fight `prettier --write .`.
  prettier,
)
