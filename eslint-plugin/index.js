/**
 * ez-form's ESLint plugin, exposed as the `ez-form/eslint-plugin` subpath.
 *
 * One rule, deliberately. Four other candidates were investigated for #107 and each had a
 * cheaper fix that covers more ground than a linter can: `Form`'s own re-entrancy guard
 * protects every submit path rather than only linted ones, and `devWarn`'s runtime warnings
 * see the computed values (a duplicated option value in an array built at runtime) that a
 * static rule never will. `prefer-specific-field` survives because it is the only one whose
 * question — "is there a better component for what you just wrote?" — can only be answered
 * across sibling components at authoring time.
 *
 * A subpath of the main package rather than a separate `eslint-plugin-ez-form`: one rule does
 * not justify a second package to version, publish and keep in step, and the rule's whole
 * subject is this package's own components, so they release together by construction.
 *
 * Ships as plain JavaScript with hand-written types and no build step. The rule imports
 * nothing at runtime, so adding it costs a consumer no dependency — not even
 * `@typescript-eslint/utils`, which `ESLintUtils.RuleCreator` would have pulled into the
 * library's own dependency list for the sake of inferring two message ids.
 */

import preferSpecificField from './prefer-specific-field.js'

const rules = {
  'prefer-specific-field': preferSpecificField,
}

/**
 * The plugin object. `meta` is what ESLint prints in `--print-config` output and uses to
 * name the plugin in cache keys, so it is worth setting even for one rule.
 */
const plugin = {
  meta: {
    name: 'ez-form',
    version: '0.2.0',
  },
  rules,
}

/**
 * Flat-config preset. An array, so `extends: [ezFormPlugin.configs.recommended]` and a plain
 * spread into the config array both work.
 *
 * `error` rather than `warn`: the rule only fires on a literal `type` value it has a concrete
 * replacement for, so it has no false-positive mode to soften — and a warning in a repo that
 * runs `--max-warnings 0` is an error anyway.
 */
const recommended = [
  {
    name: 'ez-form/recommended',
    plugins: { 'ez-form': plugin },
    rules: {
      'ez-form/prefer-specific-field': 'error',
    },
  },
]

plugin.configs = { recommended }

export default plugin
export { rules, recommended }
