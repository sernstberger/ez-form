/**
 * Types for the `ez-form/eslint-plugin` subpath.
 *
 * Hand-written rather than generated: the plugin is plain JavaScript with no build step (see
 * `index.js`), and these three shapes are stable enough that generating them would add a
 * build for no gain.
 *
 * `ESLint.Plugin` and `Linter.Config` come from `eslint`'s own bundled types, so the plugin
 * object and the preset typecheck against whatever ESLint version the consumer has installed
 * rather than a copy of its API pinned here. `eslint` is a peer of anyone using this subpath
 * by definition — they are configuring ESLint — so it is not an added dependency.
 */

import type { ESLint, Linter, Rule } from 'eslint'

/**
 * `prefer-specific-field`: reports `<TextField type="email" | "tel" | "password" | "number">`
 * imported from `ez-form`, naming the dedicated field and what it adds.
 *
 * AST-only — it needs no `parserOptions.project` and adds no type-aware lint cost. It fires
 * only on a string-literal `type` whose value has a dedicated field, so `type="url"`,
 * `type="search"`, `type={someVariable}` and a spread `{...props}` are all left alone, as is
 * any `TextField` that did not come from `ez-form`.
 */
export declare const rules: {
  'prefer-specific-field': Rule.RuleModule
}

/**
 * Flat-config preset enabling every rule in this plugin as an error. An array, so it works
 * both spread into a config array and passed to `extends`.
 */
export declare const recommended: Linter.Config[]

declare const plugin: ESLint.Plugin & {
  rules: typeof rules
  configs: { recommended: typeof recommended }
}

export default plugin
