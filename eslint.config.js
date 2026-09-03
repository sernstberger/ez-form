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
    //
    // `.worktrees` holds the parallel lane checkouts the project workflow creates (see
    // CLAUDE.md). Each is a complete copy of the repo with its own `node_modules`, so
    // without this `eslint .` type-lints the whole tree N+1 times over and dies with
    // "JavaScript heap out of memory" at Node's 4 GB default — a confusing failure that
    // looks like a code problem and is really just the lanes being visible from the root.
    ignores: ['dist', 'storybook-static', 'coverage', 'src/__qa__', '.worktrees'],
  },

  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  tseslint.configs.stylisticTypeChecked,

  {
    files: ['**/*.{ts,tsx,mts,cts,js,mjs,cjs}'],
    languageOptions: {
      // `projectService` lets typescript-eslint find the right tsconfig per file instead of
      // hard-coding a project list that drifts. This config file is the one thing no tsconfig
      // includes — tsconfig.json is `noEmit` TS-only and adding `allowJs` for it would pull
      // JS handling into the library build — so it gets a default project of its own.
      parserOptions: {
        projectService: { allowDefaultProject: ['eslint.config.js'] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      /*
       * An `async` DOM event handler is the normal way to await something on click or submit,
       * and React supports it: it calls the handler and ignores the promise. The rule's
       * concern is an unobserved rejection, so each of the four handlers here (ClearButton's
       * confirm, Form's confirm-gated submit, ResendCodeButton's resend, and one story) either
       * try/catches internally or deliberately lets the error propagate to the same place a
       * sync throw would. `checksVoidReturn.attributes` is the option provided for exactly
       * this; every other `no-misused-promises` check stays on.
       */
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],
      /*
       * A leading underscore marks a binding that exists to be discarded — `ref: _ref` in
       * Form's destructure keeps a stray `ref` off the DOM `<form>`, and an unused catch
       * binding or leading parameter has no other way to be written. This is the convention
       * TypeScript's own `noUnusedLocals` uses, so tsc and ESLint agree on what "unused"
       * means rather than pulling in opposite directions.
       */
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
    },
  },

  /*
   * react-hook-form types a field's value as `any` wherever the control is not generic in the
   * form's shape: `useWatch({ name })`, `field.value`, `get(fields, name)`, and the
   * `useFormContext()` a test grabs. Binding those untyped values to typed MUI props is the
   * one thing this library exists to do, so `any` crossing that boundary is the subject
   * matter, not a lapse — and the `no-unsafe-*` family reports it at every crossing.
   *
   * Turned off only where the values come from: field components, the resolver, and the
   * tests/stories that reach into a form's methods. Every value is narrowed at its use site
   * (`typeof value === 'string'`, `Array.isArray`, an explicit `: unknown` where the target
   * accepts one). `no-explicit-any` stays on everywhere, so this cannot become a licence to
   * write `any` by hand — it only stops the rules reporting `any` that upstream produced.
   */
  {
    files: [
      'src/fields/**/*.{ts,tsx}',
      'src/Form/**/*.{ts,tsx}',
      'src/FormError/**/*.{ts,tsx}',
      'src/examples/**/*.{ts,tsx}',
      'src/**/*.{test,stories}.{ts,tsx}',
    ],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
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
      /*
       * Disabled: this rule (new in eslint-plugin-react-hooks 7) cannot tell a React ref
       * from an ordinary object that merely *contains* one, and this library's field hooks
       * return exactly that — `useEzField` hands back `{ field: { ref, name, … }, invalid,
       * displayLabel, … }`, react-hook-form's own shape. Reduced to nine lines:
       *
       *   function useThing() {
       *     const ref = useRef<HTMLInputElement>(null)
       *     return { field: { ref, name: 'x' }, invalid: false }
       *   }
       *   const f = useThing()
       *   return <input ref={f.field.ref} name={f.field.name} aria-invalid={f.invalid} />
       *
       * every one of those three reads is reported as "Cannot access ref value during
       * render" — including `ref={f.field.ref}`, which is the one correct way to use a ref,
       * and `f.field.name`, which is a string. The rule is looking for `.current` reads
       * during render; none of the 10 findings here was one. Re-enable when the rule can
       * distinguish a ref object from its container.
       */
      'react-hooks/refs': 'off',
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

  /*
   * This config file only. `eslint-plugin-jsx-a11y` ships no type declarations at all, so
   * `jsxA11y.flatConfigs.recommended` is `any` and spreading it trips the `no-unsafe-*`
   * family; the same goes for the `error`-typed import of `eslint-config-prettier/flat`.
   * There is nothing to narrow — the values are plugin configs handed straight back to ESLint.
   */
  {
    files: ['eslint.config.js'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
    },
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
      /*
       * `async` in a test signature is frequently required by something other than an `await`
       * in that particular body: `describeFieldContract`'s `interact` is typed
       * `(user) => Promise<void>` and some fields' implementations are synchronous, `it.each`
       * rows share one callback signature, and `act(async () => …)` must be async to get the
       * async act semantics even when its body is sync. All 15 are that shape.
       */
      '@typescript-eslint/require-await': 'off',
    },
  },

  // Must stay last: turns off every rule that would fight `prettier --write .`.
  prettier,
)
