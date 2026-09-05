/**
 * `prefer-specific-field` under ESLint's own `RuleTester`.
 *
 * Uses the `RuleTester` from `eslint` rather than `@typescript-eslint/rule-tester`: the rule
 * is AST-only and reads nothing TypeScript-specific, so the extra package would buy nothing
 * here — and the rule has to work under a plain `espree` parse anyway, because a consumer
 * linting `.jsx` never loads a TS parser.
 *
 * Note on `data` assertions: ESLint 10's RuleTester hydrates the message template with
 * exactly the `data` a case supplies and requires the result to equal the real message. So
 * asserting `data` is asserting the full rendered text — there is no way to assert half of it
 * — which is why the four `EXPECTED` entries below carry the whole `adds` clause. That makes
 * them the place the message wording is pinned, and the reason it is worth pinning is that the
 * wording is the rule's entire product: `password`/`number` name behaviour that is impossible
 * without the field, while `email`/`tel` concede out loud that `TextField` already covers the
 * keyboard-and-autofill half. A future edit that flattens all four into one generic sentence
 * should have to change this table to do it.
 */

import { RuleTester } from 'eslint'
import { describe, it } from 'vitest'
import rule from './prefer-specific-field.js'

// ESLint's RuleTester looks for these on `globalThis`; Vitest only puts them there when
// `globals: true` is set, which it is for this repo — but wiring them explicitly means this
// file does not silently fall back to RuleTester's own single-throw mode if that changes.
RuleTester.describe = describe
RuleTester.it = it

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
})

/** Every case imports `TextField` from somewhere; this is the ez-form one. */
const IMPORT = "import { TextField } from 'ez-form'\n"

/**
 * The full `data` payload the rule reports for each of the four types — which, per the note
 * above, is the same thing as the message text it renders.
 */
const EXPECTED = {
  password: {
    type: 'password',
    field: 'PasswordField',
    adds: 'a show/hide reveal toggle that keeps the caret, the right autoComplete token for sign-in vs. new-password, and an optional strength meter',
  },
  number: {
    type: 'number',
    field: 'NumberField',
    adds: 'a real numeric value instead of a string, min/max as both stepper bound and validation rule, and paste handling — a raw <input type="number"> silently reads \'1,5\' as 15 and discards a U+2212 minus or Arabic-Indic digits',
  },
  email: {
    type: 'email',
    field: 'EmailField',
    adds: 'a built-in format rule with its own message, and trim/lower-case normalization on blur (TextField already gives you inputMode and autoComplete from type="email")',
  },
  tel: {
    type: 'tel',
    field: 'PhoneField',
    adds: 'display formatting over a digits-only stored value, caret restoration while editing, and a completeness rule (TextField already gives you inputMode and autoComplete from type="tel")',
  },
}

/** One expected error for `type`, with the whole message pinned. */
const reports = (type, extra) => ({
  messageId: 'preferSpecificField',
  data: EXPECTED[type],
  ...extra,
})

ruleTester.run('prefer-specific-field', rule, {
  valid: [
    // The four types the rule is about, but on a `TextField` that is not ez-form's. This is
    // the case that justifies tracking the import at all.
    'import { TextField } from \'@mui/material\'\nconst a = <TextField type="email" />',
    'import { TextField } from \'@mui/material/TextField\'\nconst a = <TextField type="password" />',
    // A locally defined component that happens to share the name.
    'function TextField() {}\nconst a = <TextField type="number" />',
    // No import at all — nothing says this is ez-form's.
    'const a = <TextField type="tel" />',

    // `url` and `search`: ez-form has no dedicated field for either, and `TextField` already
    // derives `inputMode`/`autoComplete` from both. A rule that fired here would be telling
    // the consumer to switch to a component that does not exist.
    `${IMPORT}const a = <TextField type="url" />`,
    `${IMPORT}const a = <TextField type="search" />`,

    // Types with no dedicated field and no special handling either.
    `${IMPORT}const a = <TextField type="text" />`,
    `${IMPORT}const a = <TextField type="date" />`,

    // No `type` at all — the ordinary case, and by far the most common.
    `${IMPORT}const a = <TextField name="firstName" />`,
    `${IMPORT}const a = <TextField name="firstName" label="First name" />`,

    // A computed `type`. The rule will not guess at a value it cannot see; reporting on a
    // maybe is how a rule gets disabled.
    `${IMPORT}const a = <TextField type={kind} />`,
    `${IMPORT}const a = <TextField type={cond ? 'email' : 'text'} />`,

    // A spread that may or may not carry `type`. Same reasoning.
    `${IMPORT}const a = <TextField {...props} />`,

    // A *namespaced* element. `<Ez.TextField>` comes from a namespace import, which this
    // rule does not follow, so it is not claimed to be ez-form's.
    `import * as Ez from 'ez-form'\nconst a = <Ez.TextField type="email" />`,

    // Only the named import `TextField` is tracked — a different ez-form export aliased to
    // the name `TextField` would be a different component.
    'import { Select as TextField } from \'ez-form\'\nconst a = <TextField type="email" />',

    /*
     * The acceptance case that motivated the whole design: ez-form's own wrapper fields pass
     * `type` down to `TextField` internally. They import it by *relative* path, never from
     * the package name, so the rule cannot fire on them. These four lines mirror the real
     * imports in src/fields/{EmailField,PhoneField,SsnField,PasswordField}.
     */
    'import { TextField } from \'../TextField\'\nconst a = <TextField type="email" />',
    'import { TextField } from \'../TextField\'\nconst a = <TextField type="tel" />',
    'import { TextField } from \'../TextField\'\nconst a = <TextField type="password" />',
    'import { TextField } from \'./TextField\'\nconst a = <TextField type="number" />',
  ],

  invalid: [
    // The two strong cases. Both name behaviour a raw input of that type cannot have.
    {
      code: `${IMPORT}const a = <TextField name="password" type="password" />`,
      errors: [reports('password')],
    },
    {
      code: `${IMPORT}const a = <TextField name="qty" type="number" />`,
      errors: [reports('number')],
    },

    /*
     * The two weaker cases. They still report, but the message concedes what TextField
     * already does. The report is also asserted positionally here: it lands on the `type`
     * attribute itself, not the whole element, so the squiggle sits on the prop the consumer
     * has to change. (Line 2 because `IMPORT` occupies line 1.)
     */
    {
      code: `${IMPORT}const a = <TextField name="email" type="email" />`,
      errors: [reports('email', { line: 2, column: 35, endColumn: 47 })],
    },
    {
      code: `${IMPORT}const a = <TextField name="phone" type="tel" />`,
      errors: [reports('tel', { line: 2, column: 35, endColumn: 45 })],
    },

    // `type={'email'}` — an expression container holding a literal is still a value the rule
    // can read, so it reports exactly as the attribute-string form does.
    {
      code: `${IMPORT}const a = <TextField type={'email'} />`,
      errors: [reports('email')],
    },

    /*
     * The import written *below* the JSX that uses it. Legal — imports hoist — and the shape
     * that catches a rule reporting during the AST walk instead of at `Program:exit`: the
     * element is visited before the import that identifies it, so a walk-order rule sees an
     * empty name set and stays silent. Regression test; this rule reported nothing here until
     * the check moved to `Program:exit`.
     */
    {
      code: 'export const A = () => <TextField type="email" />\n' + IMPORT,
      errors: [reports('email', { line: 1 })],
    },

    // An aliased import. The rule tracks the local name, not the imported one.
    {
      code: 'import { TextField as EzText } from \'ez-form\'\nconst a = <EzText type="password" />',
      errors: [reports('password')],
    },

    // Both a MUI and an ez-form TextField in one file: only the ez-form one reports, which
    // is the sharpest statement of what the import tracking buys.
    {
      code:
        "import { TextField } from '@mui/material'\n" +
        "import { TextField as EzTextField } from 'ez-form'\n" +
        'const a = <TextField type="email" />\n' +
        'const b = <EzTextField type="email" />',
      errors: [reports('email', { line: 4 })],
    },

    // Several fields in one file each report once, and a `type` with no dedicated field is
    // passed over in between.
    {
      code:
        IMPORT +
        'const form = <div><TextField type="email" /><TextField type="tel" /><TextField type="text" /></div>',
      errors: [reports('email'), reports('tel')],
    },
  ],
})
