import type { ReactElement } from 'react'
import { render, screen } from '@testing-library/react'
import { z } from 'zod'
import { Form } from '../Form'
import { resetDevWarnings } from '../devWarn'
import { expectConsole } from '../test/expectConsole'
import { expectNoA11yViolations } from '../test/axe'
import { Autocomplete } from './Autocomplete'
import { EmailField } from './EmailField'
import { FeinField } from './FeinField'
import { NumberField } from './NumberField'
import { OtpField } from './OtpField'
import { PasswordField } from './PasswordField'
import { PercentField } from './PercentField'
import { PhoneField } from './PhoneField'
import { Select } from './Select'
import { StateSelect } from './StateSelect'
import { TextField } from './TextField'
import { TextareaField } from './TextareaField'
import { ZipField } from './ZipField'

/**
 * `aria-label` / `aria-labelledby` must name the **control**, not the wrapper.
 *
 * The whole lesson of QA sweep #47 is that "the prop is forwarded" is not the test —
 * `getByRole(role, { name })` is. A source audit cleared 15 fields that a name query
 * fails, because MUI drops a root `aria-label` on the `FormControl` wrapper while the
 * `<input>` stays unnamed, and axe reports clean (the wrapper *is* named). So every
 * assertion here queries by accessible name and never by attribute presence.
 *
 * Fields rendered through `FieldFrame` have a second, different mechanism (an empty
 * legend's `aria-labelledby` outranking `aria-label`) and are covered by #100.
 */

const anySchema = z.object({ f: z.any() })

/** Label-less, named only through ARIA — the case the dev warning tells consumers to use. */
function renderNamed(child: ReactElement) {
  return render(
    <Form schema={anySchema} defaultValues={{ f: undefined }} onSubmit={() => {}}>
      {child}
    </Form>,
  )
}

const options = [
  { value: 'a', label: 'Ay' },
  { value: 'b', label: 'Bee' },
]

/**
 * One row per field: the role its control exposes, the tag that role must land on,
 * and how to render it ARIA-named.
 *
 * `tag` is the half that catches the bug. `getByRole(role, { name })` alone would
 * also pass if the name landed on the `FormControl` wrapper and MUI happened to give
 * that wrapper the role — pinning the tag says the name is on the element the user
 * actually operates.
 */
const cases: {
  name: string
  role: string
  tag: string
  /**
   * Skips the axe pass for a field whose label-less ARIA-named form has a violation
   * that is **not** this issue's and cannot be fixed at this altitude. Only
   * `OtpField` sets it; the reason is on that row.
   */
  axeBlockedUpstream?: true
  ariaLabel: (props: { 'aria-label': string }) => ReactElement
  ariaLabelledBy: (props: { 'aria-labelledby': string }) => ReactElement
}[] = [
  {
    name: 'TextField',
    tag: 'INPUT',
    role: 'textbox',
    ariaLabel: (p) => <TextField name="f" {...p} />,
    ariaLabelledBy: (p) => <TextField name="f" {...p} />,
  },
  {
    name: 'TextareaField',
    tag: 'TEXTAREA',
    role: 'textbox',
    ariaLabel: (p) => <TextareaField name="f" {...p} />,
    ariaLabelledBy: (p) => <TextareaField name="f" {...p} />,
  },
  {
    name: 'EmailField',
    tag: 'INPUT',
    role: 'textbox',
    ariaLabel: (p) => <EmailField name="f" {...p} />,
    ariaLabelledBy: (p) => <EmailField name="f" {...p} />,
  },
  {
    name: 'PasswordField',
    tag: 'INPUT',
    role: 'password',
    ariaLabel: (p) => <PasswordField name="f" {...p} />,
    ariaLabelledBy: (p) => <PasswordField name="f" {...p} />,
  },
  {
    name: 'PhoneField',
    tag: 'INPUT',
    role: 'textbox',
    ariaLabel: (p) => <PhoneField name="f" {...p} />,
    ariaLabelledBy: (p) => <PhoneField name="f" {...p} />,
  },
  {
    name: 'ZipField',
    tag: 'INPUT',
    role: 'textbox',
    ariaLabel: (p) => <ZipField name="f" {...p} />,
    ariaLabelledBy: (p) => <ZipField name="f" {...p} />,
  },
  {
    name: 'FeinField',
    tag: 'INPUT',
    role: 'textbox',
    ariaLabel: (p) => <FeinField name="f" {...p} />,
    ariaLabelledBy: (p) => <FeinField name="f" {...p} />,
  },
  {
    name: 'PercentField',
    tag: 'INPUT',
    role: 'textbox',
    ariaLabel: (p) => <PercentField name="f" {...p} />,
    ariaLabelledBy: (p) => <PercentField name="f" {...p} />,
  },
  {
    name: 'NumberField',
    tag: 'INPUT',
    role: 'textbox',
    ariaLabel: (p) => <NumberField name="f" {...p} />,
    ariaLabelledBy: (p) => <NumberField name="f" {...p} />,
  },
  {
    name: 'Select',
    tag: 'DIV',
    role: 'combobox',
    ariaLabel: (p) => <Select name="f" options={options} {...p} />,
    ariaLabelledBy: (p) => <Select name="f" options={options} {...p} />,
  },
  {
    name: 'StateSelect',
    tag: 'DIV',
    role: 'combobox',
    ariaLabel: (p) => <StateSelect name="f" {...p} />,
    ariaLabelledBy: (p) => <StateSelect name="f" {...p} />,
  },
  {
    name: 'Autocomplete',
    tag: 'INPUT',
    role: 'combobox',
    ariaLabel: (p) => <Autocomplete name="f" options={options} {...p} />,
    ariaLabelledBy: (p) => <Autocomplete name="f" options={options} {...p} />,
  },
  {
    name: 'OtpField',
    // A composite: slots 2..n carry their own position name, and the group around
    // them is what the field as a whole is called. Already correct before #99 —
    // asserted so the fix does not quietly move the name.
    tag: 'DIV',
    role: 'group',
    // Slot 1 is deliberately left to inherit the visible `<label>` through
    // `htmlFor`, so with no label it is the one input in the row without a name and
    // axe's "form elements must have labels" fires. Naming it here is not possible:
    // Base UI's `OTPField.Input` *ignores* `aria-label` on the first input by design
    // and dev-warns when one is passed. Fixing it means rendering a real element for
    // slot 1 to point `aria-labelledby` at — OtpField's own change, not #99's, whose
    // scope is routing the consumer's name to the control (which the group already
    // does correctly, as the two tests above assert).
    axeBlockedUpstream: true,
    ariaLabel: (p) => <OtpField name="f" {...p} />,
    ariaLabelledBy: (p) => <OtpField name="f" {...p} />,
  },
]

describe('field accessible name from ARIA alone', () => {
  beforeEach(() => resetDevWarnings())

  describe.each(cases)('$name', ({ role, tag, axeBlockedUpstream, ariaLabel, ariaLabelledBy }) => {
    // `role: 'password'` is not a role: a `type="password"` input has none, so the
    // name is read through the label query — the same accname computation, a
    // different entry point. Everything else is queried by role and name.
    const find = (name: string) =>
      role === 'password' ? screen.getByLabelText(name) : screen.getByRole(role, { name })

    it('is named by `aria-label` on the control itself', () => {
      renderNamed(ariaLabel({ 'aria-label': 'Aye' }))
      const control = find('Aye')
      expect(control).toBeInTheDocument()
      // Never `toHaveAttribute`: a named wrapper around an unnamed input passes that
      // and is exactly the bug. The tag pins the name onto the real control.
      expect(control.tagName).toBe(tag)
    })

    it('is named by `aria-labelledby` on the control itself', () => {
      renderNamed(
        <>
          <span id="ext">External</span>
          {ariaLabelledBy({ 'aria-labelledby': 'ext' })}
        </>,
      )
      const control = find('External')
      expect(control).toBeInTheDocument()
      expect(control.tagName).toBe(tag)
    })

    // axe cannot catch the bug this file exists for — a named wrapper satisfies it
    // while the control stays anonymous — but it does catch the fix going wrong the
    // other way: a dangling `aria-labelledby`, or a name on the wrong element type.
    it.skipIf(axeBlockedUpstream)(
      'has no accessibility violations when named through ARIA alone',
      async () => {
        const { container } = renderNamed(ariaLabel({ 'aria-label': 'Aye' }))
        await expectNoA11yViolations(container)
      },
    )
  })

  it('still warns when a field has no name at all', () => {
    expectConsole('warn', 'has no accessible name')
    renderNamed(<TextField name="f" />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('does not warn when the name comes from `aria-label`', () => {
    renderNamed(<TextField name="f" aria-label="Aye" />)
    expect(screen.getByRole('textbox', { name: 'Aye' })).toBeInTheDocument()
  })

  // A visible label is the normal case and must be untouched by the ARIA routing:
  // MUI's own `<label for>` wiring still names the control, with no stray attribute
  // from `nameA11y` (whose keys are absent, not `undefined`, when unset).
  it('leaves a labelled field named by its own <label>', () => {
    renderNamed(<TextField name="f" label="Visible" />)
    const control = screen.getByRole('textbox', { name: 'Visible' })
    expect(control).not.toHaveAttribute('aria-label')
    expect(control).not.toHaveAttribute('aria-labelledby')
  })

  // Autocomplete's second naming channel: `textFieldProps` lands on the rendered
  // TextField root, another wrapper. It has to reach the input the same way.
  it('names Autocomplete through `textFieldProps` too', () => {
    renderNamed(
      <Autocomplete name="f" options={options} textFieldProps={{ 'aria-label': 'Via TF' }} />,
    )
    expect(screen.getByRole('combobox', { name: 'Via TF' }).tagName).toBe('INPUT')
  })
})
