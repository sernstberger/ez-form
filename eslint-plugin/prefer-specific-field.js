/**
 * `prefer-specific-field`: flags `<TextField type="email" | "tel" | "password" | "number">`
 * in consumer code and names the dedicated field instead.
 *
 * ## Why this is a lint rule and not a type
 *
 * The obvious fix — narrow `TextFieldProps['type']` so it cannot be `'email'` — is not
 * available. `EmailField`, `PhoneField`, `SsnField` and `PasswordField` are all built *on*
 * `TextField` and pass `type` to it themselves, so a type that forbids `type="email"` breaks
 * the very components the consumer is being steered towards. The distinction the rule needs
 * is "who wrote this JSX", which no type can see and a linter can.
 *
 * A JSDoc `@deprecated` on the prop cannot express it either: deprecation is per-symbol, and
 * this is only discouraged when `type` holds one of four specific values.
 *
 * ## Why AST-only
 *
 * Type information would tell us the component's declared type, not which package it came
 * from — and `TextFieldProps` is structurally identical to MUI's. Following the import
 * declaration is both cheaper and more precise: it answers exactly the question asked, which
 * is whether this `TextField` is ez-form's. Consumers pay no type-aware lint cost.
 *
 * ## Why the message differs per type
 *
 * The four cases are not equally strong, and a rule that overstates the weak ones trains
 * people to disable it. `TextField` already derives `inputMode` and `autoComplete` from
 * `type="email"`/`type="tel"`, so those two messages name only what is genuinely still
 * missing (the format rule, the display formatting). `password` and `number` name behaviour
 * a raw input cannot have at all.
 *
 * `type="url"` and `type="search"` are deliberately absent: no dedicated field exists, and
 * `TextField` handles both correctly on its own. A rule that fires with no destination to
 * offer is noise.
 */

/** The package whose `TextField` this rule is about. */
const PACKAGE_NAME = 'ez-form'

/** The component whose `type` prop is inspected. */
const COMPONENT_NAME = 'TextField'

/**
 * `type` value → the field to use instead, and what that field adds over a bare
 * `<input>` of the same type. Each `adds` clause is read off the target field's own
 * source, so the message says what is actually gained rather than asserting a preference.
 *
 * Only these four. `url` and `search` have no dedicated field and must not report.
 */
const REPLACEMENTS = {
  password: {
    field: 'PasswordField',
    adds: 'a show/hide reveal toggle that keeps the caret, the right autoComplete token for sign-in vs. new-password, and an optional strength meter',
  },
  number: {
    field: 'NumberField',
    adds: 'a real numeric value instead of a string, min/max as both stepper bound and validation rule, and paste handling — a raw <input type="number"> silently reads \'1,5\' as 15 and discards a U+2212 minus or Arabic-Indic digits',
  },
  email: {
    field: 'EmailField',
    adds: 'a built-in format rule with its own message, and trim/lower-case normalization on blur (TextField already gives you inputMode and autoComplete from type="email")',
  },
  tel: {
    field: 'PhoneField',
    adds: 'display formatting over a digits-only stored value, caret restoration while editing, and a completeness rule (TextField already gives you inputMode and autoComplete from type="tel")',
  },
}

/**
 * The `type` attribute's value when it is a literal this rule can judge, otherwise
 * `undefined`. Covers `type="email"` and `type={'email'}`; a computed value
 * (`type={props.kind}`) is deliberately not guessed at.
 *
 * @param {import('estree-jsx').JSXAttribute} attribute
 * @returns {string | undefined}
 */
function literalTypeValue(attribute) {
  const { value } = attribute
  if (value === null || value === undefined) return undefined
  if (value.type === 'Literal') {
    return typeof value.value === 'string' ? value.value : undefined
  }
  if (value.type === 'JSXExpressionContainer') {
    const { expression } = value
    if (expression.type === 'Literal' && typeof expression.value === 'string') {
      return expression.value
    }
  }
  return undefined
}

/**
 * The name of a JSX element when it is a plain identifier (`<TextField />`), otherwise
 * `undefined`. A member expression (`<Ez.TextField />`) is not tracked: it comes from a
 * namespace import, which this rule does not follow.
 *
 * @param {import('estree-jsx').JSXOpeningElement['name']} name
 * @returns {string | undefined}
 */
function elementName(name) {
  return name.type === 'JSXIdentifier' ? name.name : undefined
}

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Use the dedicated ez-form field instead of <TextField> with a type that one already covers.',
      // The README's "Lint rule" section, rather than a doc page of its own: one rule does
      // not need a second place to drift from.
      url: 'https://github.com/sernstberger/ez-form#lint-rule',
    },
    schema: [],
    messages: {
      // `{{field}}` and `{{adds}}` come from REPLACEMENTS above; `{{type}}` is the literal
      // the consumer wrote. Phrased as a suggestion with its reason, because for `email`
      // and `tel` the TextField version is defensible — it is just missing something.
      preferSpecificField:
        'Prefer <{{field}} /> over <TextField type="{{type}}" />. {{field}} adds {{adds}}.',
    },
  },

  create(context) {
    /**
     * Local names currently bound to ez-form's `TextField`. A set rather than a single
     * name because `import { TextField, TextField as T }` is legal, and because a file may
     * import from `ez-form` more than once.
     *
     * Only names imported from `ez-form` land here, so a `TextField` from MUI — or a local
     * component of the same name — is never reported. That is the whole reason the rule
     * tracks imports instead of matching on the element name alone.
     */
    const ezFormTextFieldNames = new Set()

    /**
     * Candidate elements, checked on `Program:exit` rather than as they are visited.
     *
     * ESLint walks the AST in source order, but an `import` is hoisted and so may legally be
     * written *below* the JSX that uses it. Reporting during the walk would silently miss
     * that file: the element is visited while `ezFormTextFieldNames` is still empty. Deferring
     * until the whole program has been seen makes the rule independent of where the import
     * sits, which is the only correct reading of the module.
     *
     * @type {{ element: string, attribute: import('estree-jsx').JSXAttribute, type: string }[]}
     */
    const candidates = []

    return {
      ImportDeclaration(node) {
        if (node.source.value !== PACKAGE_NAME) return
        for (const specifier of node.specifiers) {
          // Only named imports. A default or namespace import of `ez-form` does not
          // produce a bare `<TextField>` element, which is the only shape this rule reads.
          if (specifier.type !== 'ImportSpecifier') continue
          const imported = specifier.imported
          // `imported` is an Identifier for `{ TextField }` and a Literal for the string
          // form `{ 'TextField' as T }`; only the former can name this component.
          if (imported.type !== 'Identifier' || imported.name !== COMPONENT_NAME) continue
          ezFormTextFieldNames.add(specifier.local.name)
        }
      },

      JSXOpeningElement(node) {
        const name = elementName(node.name)
        if (name === undefined) return

        for (const attribute of node.attributes) {
          // A spread (`{...props}`) may well carry `type`, but the rule cannot know which
          // value, and reporting on a maybe is how a rule gets turned off. Skipped.
          if (attribute.type !== 'JSXAttribute') continue
          if (attribute.name.type !== 'JSXIdentifier' || attribute.name.name !== 'type') continue

          // `type` found: whatever its value, there is no second `type` to look for.
          const type = literalTypeValue(attribute)
          if (type !== undefined && Object.hasOwn(REPLACEMENTS, type)) {
            candidates.push({ element: name, attribute, type })
          }
          return
        }
      },

      'Program:exit'() {
        for (const { element, attribute, type } of candidates) {
          // Resolved now that every import in the file has been seen.
          if (!ezFormTextFieldNames.has(element)) continue
          const replacement = REPLACEMENTS[type]
          context.report({
            node: attribute,
            messageId: 'preferSpecificField',
            data: { type, field: replacement.field, adds: replacement.adds },
          })
        }
      },
    }
  },
}

export default rule
