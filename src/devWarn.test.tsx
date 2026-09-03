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

    expect(messages()).toHaveLength(4)
  })
})
