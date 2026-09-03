import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { z } from 'zod'
import { Form } from './Form'
import { Wizard, WizardStep, WizardNav } from './Wizard'
import type { WizardStepDef } from './Wizard'
import { TextField } from './fields/TextField'
import { Select } from './fields/Select'
import { RadioGroup } from './fields/RadioGroup'
import { CheckboxGroup } from './fields/CheckboxGroup'
import { ToggleButtonGroup } from './fields/ToggleButtonGroup'
import { Autocomplete } from './fields/Autocomplete'
import { Checkbox } from './fields/Checkbox'
import { Switch } from './fields/Switch'
import { Rating } from './fields/Rating'
import { PasswordField } from './fields/PasswordField'
import { TextareaField } from './fields/TextareaField'
import { AddressField } from './fields/AddressField'
import { addressSchema } from './fields/AddressField/addressSchema'
import { FieldArray } from './FieldArray'
import { resetDevWarnings } from './devWarn'
import { consoleMessages, expectConsole } from './test/expectConsole'
import { getInnerGroup } from './test/getInnerGroup'

/**
 * `devWarn` deduplicates by key for the life of the module, so every test starts by clearing
 * that set — otherwise the second test to trip the same warning sees nothing and passes for
 * the wrong reason.
 *
 * The warnings themselves are read from the console guard (src/test/expectConsole.ts) rather
 * than from a `vi.spyOn`: a spy would replace the console the guard installed, taking every
 * *other* message in these tests out of its view. `expectConsole` below tells the guard that
 * `ez-form:` warnings are expected here, so they are allowed but still recorded — and any
 * console output that is *not* an ez-form warning still fails these tests.
 */
beforeEach(() => {
  resetDevWarnings()
  expectConsole('warn', 'ez-form:')
})

/** The warning text, so a test asserts on the message rather than on call bookkeeping. */
const messages = () => consoleMessages('warn')
const messagesMatching = (pattern: RegExp) => messages().filter((m) => pattern.test(m))

const schema = z.object({ email: z.string(), role: z.string() })
const defaults = { email: '', role: '' }

const wrap = (children: React.ReactNode) =>
  render(
    <Form schema={schema} defaultValues={defaults} onSubmit={() => {}}>
      {children}
    </Form>,
  )

describe('dev warning: a field with no accessible name', () => {
  it('fires once, naming the component and the field', () => {
    wrap(<TextField name="email" />)
    const hits = messagesMatching(/no accessible name/)
    expect(hits).toHaveLength(1)
    expect(hits[0]).toContain('<TextField name="email">')
  })

  it('does not fire when the field has a label', () => {
    wrap(<TextField name="email" label="Email" />)
    expect(messagesMatching(/no accessible name/)).toHaveLength(0)
  })

  it('does not fire when the field is named by aria-label', () => {
    wrap(<TextField name="email" aria-label="Email" />)
    expect(messagesMatching(/no accessible name/)).toHaveLength(0)
  })

  it('does not fire when the field is named by aria-labelledby', () => {
    wrap(
      <>
        <span id="email-heading">Email</span>
        <TextField name="email" aria-labelledby="email-heading" />
      </>,
    )
    expect(messagesMatching(/no accessible name/)).toHaveLength(0)
  })

  it('treats an empty-string label as no label', () => {
    wrap(<TextField name="email" label="" />)
    expect(messagesMatching(/no accessible name/)).toHaveLength(1)
  })

  // The dedupe key carries the field name, so one mistake per field is still reported.
  it('warns once per field, not once per render', async () => {
    const user = userEvent.setup()
    wrap(
      <>
        <TextField name="email" />
        <TextField name="role" />
      </>,
    )
    // Re-render both fields by typing into one of them.
    await user.type(screen.getAllByRole('textbox')[0]!, 'abc')
    const hits = messagesMatching(/no accessible name/)
    expect(hits).toHaveLength(2)
    expect(hits.map((m) => /name="(\w+)"/.exec(m)?.[1])).toEqual(['email', 'role'])
  })

  /**
   * `Select`, `PasswordField` and `TextareaField` all render *through* `TextField`. Without
   * the internal `componentName`, each would warn about a `<TextField>` the consumer never
   * wrote — the wrong component to go looking at.
   */
  it.each([
    ['Select', <Select name="role" options={[{ value: 'a', label: 'A' }]} />],
    ['PasswordField', <PasswordField name="role" />],
    ['TextareaField', <TextareaField name="role" />],
  ])('names %s rather than the TextField it delegates to', (name, element) => {
    wrap(element)
    const hits = messagesMatching(/no accessible name/)
    expect(hits).toHaveLength(1)
    expect(hits[0]).toContain(`<${name} name="role">`)
  })

  /**
   * A `labelAs="legend"` group with no label renders no legend, so a consumer's
   * `aria-labelledby` is the name and the warning must stay quiet.
   *
   * This block used to assert the opposite — that these four "never render" a consumer's
   * `aria-labelledby`, because the frame set its own `aria-labelledby={labelId}` after
   * spreading `rest`. That was #100: the frame emitted that attribute even with an empty
   * legend, which outranks `aria-label` in the accname algorithm and left the control with
   * no name at all. The warning firing here was correct *about that build*, and the test
   * pinned the bug in place. The name is asserted alongside the silence so this cannot
   * regress back into accepting a name nothing renders.
   */
  it.each([
    [
      'RadioGroup',
      'radiogroup',
      <RadioGroup
        name="role"
        label=""
        aria-labelledby="x"
        options={[{ value: 'a', label: 'A' }]}
      />,
    ],
    [
      'CheckboxGroup',
      'group',
      <CheckboxGroup
        name="role"
        label=""
        aria-labelledby="x"
        options={[{ value: 'a', label: 'A' }]}
      />,
    ],
    [
      'ToggleButtonGroup',
      'group',
      <ToggleButtonGroup
        name="role"
        label=""
        aria-labelledby="x"
        options={[{ value: 'a', label: 'A' }]}
      />,
    ],
    ['Rating', 'radiogroup', <Rating name="role" label="" aria-labelledby="x" />],
  ])('%s accepts aria-labelledby, which now really names the group', (_name, role, element) => {
    wrap(
      <>
        <span id="x">External name</span>
        {element}
      </>,
    )
    expect(messagesMatching(/no accessible name/)).toHaveLength(0)
    // The silence is only correct because the name is real; assert it, not the attribute.
    const named =
      role === 'group'
        ? getInnerGroup('External name')
        : screen.getByRole(role, { name: 'External name' })
    expect(named).toBeInTheDocument()
  })

  // Checkbox/Switch are `labelAs="control"`: `{...rest}` really does reach the input, so a
  // consumer's aria attribute lands in the DOM and legitimately silences the warning.
  it.each([
    ['Checkbox', <Checkbox name="terms" label="" aria-label="Accept terms" />],
    ['Switch', <Switch name="terms" label="" aria-label="Accept terms" />],
  ])('%s accepts aria-label, which does reach its input', (_name, element) => {
    wrap(element)
    expect(messagesMatching(/no accessible name/)).toHaveLength(0)
  })

  it('fires for a group field named only through its legend', () => {
    wrap(<RadioGroup name="role" label="" options={[{ value: 'a', label: 'A' }]} />)
    const hits = messagesMatching(/no accessible name/)
    expect(hits).toHaveLength(1)
    expect(hits[0]).toContain('<RadioGroup name="role">')
  })
})

describe('dev warning: duplicate option values', () => {
  const dupes = [
    { value: 'a', label: 'First' },
    { value: 'a', label: 'Second' },
  ]
  const unique = [
    { value: 'a', label: 'First' },
    { value: 'b', label: 'Second' },
  ]

  // Each of the five option-consuming fields calls the one shared helper.
  it.each([
    ['Select', (o: typeof dupes) => <Select name="role" label="Role" options={o} />],
    ['RadioGroup', (o: typeof dupes) => <RadioGroup name="role" label="Role" options={o} />],
    ['CheckboxGroup', (o: typeof dupes) => <CheckboxGroup name="role" label="Role" options={o} />],
    [
      'ToggleButtonGroup',
      (o: typeof dupes) => <ToggleButtonGroup name="role" label="Role" options={o} />,
    ],
    ['Autocomplete', (o: typeof dupes) => <Autocomplete name="role" label="Role" options={o} />],
  ])('%s warns once, naming the field and the duplicated value', (name, renderField) => {
    // These options collide on purpose, which is exactly the situation React's duplicate-key
    // error describes: the fields that map options to keyed children (RadioGroup,
    // CheckboxGroup) legitimately log it here.
    expectConsole('error', 'two children with the same key')
    wrap(renderField(dupes))
    const hits = messagesMatching(/duplicate option values/)
    expect(hits).toHaveLength(1)
    expect(hits[0]).toContain(`<${name} name="role">`)
    expect(hits[0]).toContain('a')
  })

  it.each([
    ['Select', (o: typeof unique) => <Select name="role" label="Role" options={o} />],
    ['RadioGroup', (o: typeof unique) => <RadioGroup name="role" label="Role" options={o} />],
    ['CheckboxGroup', (o: typeof unique) => <CheckboxGroup name="role" label="Role" options={o} />],
    [
      'ToggleButtonGroup',
      (o: typeof unique) => <ToggleButtonGroup name="role" label="Role" options={o} />,
    ],
    ['Autocomplete', (o: typeof unique) => <Autocomplete name="role" label="Role" options={o} />],
  ])('%s does not warn for unique values', (_name, renderField) => {
    wrap(renderField(unique))
    expect(messagesMatching(/duplicate option values/)).toHaveLength(0)
  })

  /**
   * `getOptionValue` decides what Autocomplete stores, so it decides what collides. These
   * options have distinct `value`s and would look unique to a check reading `option.value`.
   */
  it('Autocomplete compares the value getOptionValue actually stores', () => {
    wrap(
      <Autocomplete
        name="role"
        label="Role"
        options={[
          { value: 'a', label: 'First', group: 'shared' },
          { value: 'b', label: 'Second', group: 'shared' },
        ]}
        getOptionValue={(o) => o.group}
      />,
    )
    const hits = messagesMatching(/duplicate option values/)
    expect(hits).toHaveLength(1)
    expect(hits[0]).toContain('shared')
  })

  it('Autocomplete does not warn when getOptionValue keeps them distinct', () => {
    wrap(
      <Autocomplete
        name="role"
        label="Role"
        options={[
          { value: 'same', label: 'First', id: 1 },
          { value: 'same', label: 'Second', id: 2 },
        ]}
        getOptionValue={(o) => o.id}
      />,
    )
    expect(messagesMatching(/duplicate option values/)).toHaveLength(0)
  })

  // `1` and `'1'` are the same option to these fields (they compare through `String`),
  // so the check has to see them as a duplicate too.
  it('treats a number and its string form as duplicates', () => {
    wrap(
      <Select
        name="role"
        label="Role"
        options={[
          { value: 1, label: 'One' },
          { value: '1', label: 'Also one' },
        ]}
      />,
    )
    expect(messagesMatching(/duplicate option values/)).toHaveLength(1)
  })
})

describe('dev warning: a wizard step listing a field the form does not know', () => {
  const wizardSchema = z.object({
    email: z.string().min(1, 'Required'),
    nickname: z.string(),
  })
  const wizardDefaults = { email: 'a@b.c', nickname: '' }

  const renderWizard = (steps: readonly WizardStepDef<z.input<typeof wizardSchema>>[]) =>
    render(
      <Form schema={wizardSchema} defaultValues={wizardDefaults} onSubmit={() => {}}>
        <Wizard steps={steps}>
          <WizardStep id="one">
            <TextField name="email" label="Email" />
          </WizardStep>
          <WizardStep id="two">
            <TextField name="nickname" label="Nickname" />
          </WizardStep>
          <WizardNav />
        </Wizard>
      </Form>,
    )

  const next = async () => {
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Next' }))
  }

  it('fires once on Next, naming the step and the unknown field', async () => {
    renderWizard([
      // The typo this whole check exists to catch. `fields` is typed to the schema's
      // paths, so writing one deliberately needs the cast a real consumer would not.
      { id: 'one', label: 'One', fields: ['email', 'emial' as 'email'] },
      { id: 'two', label: 'Two' },
    ])
    await next()
    const hits = messagesMatching(/does not know/)
    expect(hits).toHaveLength(1)
    expect(hits[0]).toContain('step "one"')
    expect(hits[0]).toContain('emial')
  })

  it('does not fire when every listed field is real', async () => {
    renderWizard([
      { id: 'one', label: 'One', fields: ['email'] },
      { id: 'two', label: 'Two' },
    ])
    await next()
    expect(messagesMatching(/does not know/)).toHaveLength(0)
  })

  /**
   * `nickname` is on step two and so is not mounted while step one validates, but the form
   * knows it (it has a default). Listing an unmounted-but-known field is how this library's
   * own conditional-field pattern works — see `warnUnmountedStepFields`.
   */
  it('does not fire for a field the form knows but has not mounted', async () => {
    renderWizard([
      { id: 'one', label: 'One', fields: ['email', 'nickname'] },
      { id: 'two', label: 'Two' },
    ])
    await next()
    expect(messagesMatching(/does not know/)).toHaveLength(0)
  })

  /**
   * A row-level path into a field array that has no rows yet. The array exists, so the path
   * is well-formed and only the rows are missing — warning here would be the empty-array
   * false positive one level deeper.
   */
  it('does not fire for a row path into an empty field array', async () => {
    const arraySchema = z.object({ email: z.string(), debts: z.array(z.object({ x: z.string() })) })
    render(
      <Form schema={arraySchema} defaultValues={{ email: 'a@b.c', debts: [] }} onSubmit={() => {}}>
        <Wizard
          steps={[
            { id: 'one', label: 'One', fields: ['debts.0.x'] },
            { id: 'two', label: 'Two' },
          ]}
        >
          <WizardStep id="one">
            <TextField name="email" label="Email" />
          </WizardStep>
          <WizardStep id="two">
            <TextField name="email" label="Email again" />
          </WizardStep>
          <WizardNav />
        </Wizard>
      </Form>,
    )
    await next()
    expect(messagesMatching(/does not know/)).toHaveLength(0)
  })

  it('still fires for a typo in the array name itself', async () => {
    const arraySchema = z.object({ email: z.string(), debts: z.array(z.object({ x: z.string() })) })
    render(
      <Form schema={arraySchema} defaultValues={{ email: 'a@b.c', debts: [] }} onSubmit={() => {}}>
        <Wizard
          steps={[
            { id: 'one', label: 'One', fields: ['dbets.0.x' as 'debts'] },
            { id: 'two', label: 'Two' },
          ]}
        >
          <WizardStep id="one">
            <TextField name="email" label="Email" />
          </WizardStep>
          <WizardStep id="two">
            <TextField name="email" label="Email again" />
          </WizardStep>
          <WizardNav />
        </Wizard>
      </Form>,
    )
    await next()
    const hits = messagesMatching(/does not know/)
    expect(hits).toHaveLength(1)
    expect(hits[0]).toContain('dbets.0.x')
  })

  it('does not fire for an empty field array named at the array level', async () => {
    const arraySchema = z.object({ email: z.string(), debts: z.array(z.object({ x: z.string() })) })
    render(
      <Form schema={arraySchema} defaultValues={{ email: 'a@b.c', debts: [] }} onSubmit={() => {}}>
        <Wizard
          steps={[
            { id: 'one', label: 'One', fields: ['debts'] },
            { id: 'two', label: 'Two' },
          ]}
        >
          <WizardStep id="one">
            <TextField name="email" label="Email" />
          </WizardStep>
          <WizardStep id="two">
            <TextField name="email" label="Email again" />
          </WizardStep>
          <WizardNav />
        </Wizard>
      </Form>,
    )
    await next()
    expect(messagesMatching(/does not know/)).toHaveLength(0)
  })
})

/**
 * The typo case (#108). Every test here asserts on `/the form has no/`, the phrase unique to
 * this warning, so an unrelated warning firing in the same render cannot make one pass.
 *
 * The non-warning cases are the point of the exercise: this check runs on every field of
 * every form, so one false positive trains consumers to ignore the console and takes the
 * other three warnings down with it. Each `does not warn` test below is a shape this library
 * itself produces.
 */
describe('dev warning: a field name the form does not have', () => {
  const arraySchema = z.object({
    email: z.string(),
    items: z.array(z.object({ qty: z.string() })),
  })

  it('fires once, naming the component, the name, and the unknown root', () => {
    wrap(<TextField name="emial" label="Email" />)
    const hits = messagesMatching(/the form has no/)
    expect(hits).toHaveLength(1)
    expect(hits[0]).toContain('<TextField name="emial">')
    expect(hits[0]).toContain('no "emial"')
  })

  it('does not warn for a name the form has', () => {
    wrap(<TextField name="email" label="Email" />)
    expect(messagesMatching(/the form has no/)).toHaveLength(0)
  })

  /**
   * The whole reason the check reads only the root segment. hookform appends the new row to
   * `_formValues` as `{}` and leaves `_defaultValues` on the seeded row, so both value trees
   * say `items.1.qty` is absent — a full-path check warns on every Add.
   */
  it('does not warn for a FieldArray row, seeded or added', async () => {
    const user = userEvent.setup()
    render(
      <Form
        schema={arraySchema}
        defaultValues={{ email: '', items: [{ qty: '1' }] }}
        onSubmit={() => {}}
      >
        <FieldArray name="items" label="Items" emptyRow={{ qty: '' }}>
          {({ name }) => <TextField name={name('qty')} label="Qty" />}
        </FieldArray>
      </Form>,
    )
    expect(messagesMatching(/the form has no/)).toHaveLength(0)
    await user.click(screen.getByRole('button', { name: 'Add' }))
    expect(await screen.findAllByLabelText('Qty')).toHaveLength(2)
    expect(messagesMatching(/the form has no/)).toHaveLength(0)
  })

  /** A row added to an array that started empty — no `items[0]` in the defaults at all. */
  it('does not warn for the first row of an empty FieldArray', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={arraySchema} defaultValues={{ email: '', items: [] }} onSubmit={() => {}}>
        <FieldArray name="items" label="Items" emptyRow={{ qty: '' }}>
          {({ name }) => <TextField name={name('qty')} label="Qty" />}
        </FieldArray>
      </Form>,
    )
    await user.click(screen.getByRole('button', { name: 'Add' }))
    expect(await screen.findByLabelText('Qty')).toBeInTheDocument()
    expect(messagesMatching(/the form has no/)).toHaveLength(0)
  })

  /** `AddressField` renders five nested names from one `name="address"`. */
  it('does not warn for AddressField’s nested part names', () => {
    render(
      <Form
        schema={z.object({ address: addressSchema })}
        defaultValues={{ address: { street: '', street2: '', city: '', state: '', zip: '' } }}
        onSubmit={() => {}}
      >
        <AddressField name="address" legend="Address" />
      </Form>,
    )
    expect(messagesMatching(/the form has no/)).toHaveLength(0)
  })

  /** The bracket notation hookform also accepts, in case a consumer writes a path by hand. */
  it('does not warn for a bracket-notation row path', () => {
    render(
      <Form
        schema={arraySchema}
        defaultValues={{ email: '', items: [{ qty: '1' }] }}
        onSubmit={() => {}}
      >
        <TextField name="items[0].qty" label="Qty" />
      </Form>,
    )
    expect(messagesMatching(/the form has no/)).toHaveLength(0)
  })

  /**
   * Timing. The check runs during the field's render, when `_names.mount` is still empty —
   * the field asking has not registered, and neither has anything below it. `_defaultValues`
   * is what makes this answerable on the first pass; a `_names`-only check would warn about
   * every field on a form's first paint.
   */
  it('does not warn on first render, before any field has registered', () => {
    wrap(
      <>
        <TextField name="email" label="Email" />
        <TextField name="role" label="Role" />
      </>,
    )
    expect(messagesMatching(/the form has no/)).toHaveLength(0)
  })

  /**
   * A form with no `defaultValues` at all. The schema still answers, so a real field is
   * still silent and a typo is still caught — this is the case that makes the schema, not
   * the value tree, the right authority.
   */
  it('judges by the schema on a form with no defaultValues at all', () => {
    render(
      <Form schema={schema} onSubmit={() => {}}>
        <TextField name="email" label="Email" />
        <TextField name="anything" label="Anything" />
      </Form>,
    )
    const hits = messagesMatching(/the form has no/)
    expect(hits).toHaveLength(1)
    expect(hits[0]).toContain('name="anything"')
  })

  it('does not warn while async defaultValues are still loading, and not after', async () => {
    render(
      <Form
        schema={schema}
        defaultValues={() => Promise.resolve({ email: 'a', role: 'b' })}
        onSubmit={() => {}}
      >
        <TextField name="email" label="Email" />
      </Form>,
    )
    expect(await screen.findByDisplayValue('a')).toBeInTheDocument()
    expect(messagesMatching(/the form has no/)).toHaveLength(0)
  })

  /** `values` lands in `_defaultValues` too, so a `values`-only form is still checkable. */
  it('reads the `values` prop, and still catches a typo against it', () => {
    render(
      <Form schema={schema} values={{ email: 'a', role: 'b' }} onSubmit={() => {}}>
        <TextField name="emial" label="Email" />
      </Form>,
    )
    expect(messagesMatching(/the form has no/)).toHaveLength(1)
  })

  /**
   * The regression that rewrote this check. `role` is in the schema and deliberately absent
   * from `defaultValues` — a partial defaults object is a supported pattern, and this
   * library's own `Wizard.stories.tsx` types its defaults `Partial<Input>`. A
   * defaults-only check warned on five such fields across the existing suite.
   */
  it('does not warn for a schema field left out of defaultValues', () => {
    render(
      <Form schema={schema} defaultValues={{ email: '' }} onSubmit={() => {}}>
        <TextField name="role" label="Role" />
      </Form>,
    )
    expect(messagesMatching(/the form has no/)).toHaveLength(0)
  })

  it('still catches a typo on a form whose defaults are partial', () => {
    render(
      <Form schema={schema} defaultValues={{ email: '' }} onSubmit={() => {}}>
        <TextField name="rol" label="Role" />
      </Form>,
    )
    expect(messagesMatching(/the form has no/)).toHaveLength(1)
  })

  /**
   * A schema this cannot enumerate. `.transform` makes the top level a `pipe`, with no
   * `shape` to read, so the schema abstains and only `defaultValues` is left — which means
   * a name absent from the defaults must NOT be treated as a typo.
   */
  it('stays silent when the schema is not a plain object it can read', () => {
    render(
      <Form
        schema={z.object({ email: z.string(), role: z.string() }).transform((v) => v)}
        defaultValues={{ email: '' }}
        onSubmit={() => {}}
      >
        <TextField name="role" label="Role" />
        <TextField name="rol" label="Typo" />
      </Form>,
    )
    expect(messagesMatching(/the form has no/)).toHaveLength(0)
  })

  /** A `.superRefine` keeps `def.type === 'object'`, so the keys stay readable. */
  it('reads through a refined object schema', () => {
    render(
      <Form
        schema={z.object({ email: z.string(), role: z.string() }).superRefine(() => {})}
        defaultValues={{ email: '' }}
        onSubmit={() => {}}
      >
        <TextField name="role" label="Role" />
        <TextField name="rol" label="Typo" />
      </Form>,
    )
    const hits = messagesMatching(/the form has no/)
    expect(hits).toHaveLength(1)
    expect(hits[0]).toContain('name="rol"')
  })

  /**
   * A root with no default but with registered fields under it. `_defaultValues` cannot
   * answer, so `_names` — which has grown by the second render — does.
   */
  it('does not warn for a sibling of an already-registered nested field', () => {
    render(
      <Form schema={schema} defaultValues={defaults} onSubmit={() => {}}>
        <TextField name="meta.a" label="A" />
        <TextField name="meta.b" label="B" />
      </Form>,
    )
    // `meta` is in neither the schema nor the defaults, so `meta.a` — which renders first,
    // with nothing yet registered — is reported. `meta.b` is then vouched for by the sibling
    // that registered before it: `_names` is the third source, and it grows as fields mount.
    // The check is deliberately not retroactive, so the first of a pair still warns.
    const hits = messagesMatching(/the form has no/)
    expect(hits).toHaveLength(1)
    expect(hits[0]).toContain('name="meta.a"')
  })

  // Same dedupe contract as the other warnings: once per field, not once per render.
  it('warns once per field, not once per render', async () => {
    const user = userEvent.setup()
    wrap(
      <>
        <TextField name="emial" label="Email" />
        <TextField name="rol" label="Role" />
      </>,
    )
    await user.type(screen.getAllByRole('textbox')[0]!, 'abc')
    expect(messagesMatching(/the form has no/)).toHaveLength(2)
  })
})

/**
 * The production guard. `devWarn.ts` reads `process.env.NODE_ENV` into a module-level
 * `const`, so the value has to be in place *before* the module is first evaluated — hence
 * `vi.resetModules()` and a dynamic `import()` rather than the static one at the top of this
 * file. That module-level read is exactly what makes the check statically strippable: a
 * bundler substitutes the literal and drops every call site along with its message strings.
 */
describe('production build', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('warns about nothing when NODE_ENV is production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.resetModules()
    const prod = await import('./devWarn')

    prod.devWarn('key', 'ez-form: plain warning')
    prod.warnMissingLabel('TextField', 'email', undefined, undefined, undefined)
    prod.warnDuplicateOptions('Select', 'role', [{ value: 'a' }, { value: 'a' }])
    prod.warnUnmountedStepFields(
      'one',
      ['emial'],
      { mount: new Set(['email']), array: new Set() },
      () => ({}),
    )
    prod.warnUnknownFieldName('TextField', 'emial', {
      // The schema key set is what the check judges against; `ezResolver` normally
      // attaches it to the resolver under this symbol.
      _options: {
        resolver: Object.assign(() => ({ values: {}, errors: {} }), {
          [prod.schemaKeys]: new Set(['email']),
        }),
      },
    })

    expect(messages()).toEqual([])
  })

  it('warns in development, proving the production test is not vacuous', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.resetModules()
    const dev = await import('./devWarn')

    dev.devWarn('key', 'ez-form: plain warning')
    dev.warnMissingLabel('TextField', 'email', undefined, undefined, undefined)
    dev.warnDuplicateOptions('Select', 'role', [{ value: 'a' }, { value: 'a' }])
    dev.warnUnmountedStepFields(
      'one',
      ['emial'],
      { mount: new Set(['email']), array: new Set() },
      () => ({}),
    )
    dev.warnUnknownFieldName('TextField', 'emial', {
      // The schema key set is what the check judges against; `ezResolver` normally
      // attaches it to the resolver under this symbol.
      _options: {
        resolver: Object.assign(() => ({ values: {}, errors: {} }), {
          [dev.schemaKeys]: new Set(['email']),
        }),
      },
    })

    expect(messages()).toHaveLength(5)
  })
})
