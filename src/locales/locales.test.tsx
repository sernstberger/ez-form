import { useState, type ReactElement } from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expectTypeOf } from 'vitest'
import { createTheme, ThemeProvider } from '@mui/material/styles'
import { z } from 'zod'
import { enUS, esES, type EzLocalization } from './index'
import { Form, formClasses } from '../Form'
import { FormErrorSummary } from '../Form/FormErrorSummary'
import { SubmitButton } from '../SubmitButton'
import { ClearButton } from '../ClearButton'
import { FormDialog } from '../FormDialog'
import { Wizard, wizardClasses, WizardStep, WizardNav } from '../Wizard'
import { FieldArray, fieldArrayClasses } from '../FieldArray'
import { TextField } from '../fields/TextField'
import { NumberField } from '../fields/NumberField'
import { OtpField } from '../fields/OtpField'
import { ResendCodeButton, resendCodeButtonClasses } from '../fields/OtpField/ResendCodeButton'
import { DateField } from '../fields/DateField'
import { AddressField } from '../fields/AddressField'
import { PasswordField } from '../fields/PasswordField'
import { PasswordStrength } from '../fields/PasswordStrength'
import { SsnField } from '../fields/SsnField'
import { FileField } from '../fields/FileField'
import { EmailField } from '../fields/EmailField'
import { EmailListField, emailListFieldClasses } from '../fields/EmailListField'
import { FeinField } from '../fields/FeinField'
import { PhoneField } from '../fields/PhoneField'
import { ZipField } from '../fields/ZipField'
import { ChipDeleteIcon } from '../fields/ChipDeleteIcon'
import { ReadOnlyField } from '../fields/ReadOnlyField'
import { expectNoA11yViolations } from '../test/axe'
import { withPickers } from '../test/pickers'

/**
 * The shape of a locale object with every leaf replaced by its type name, so
 * two locales compare by *keys* alone: a string added to one and not the other
 * is a failing diff, a translation is not.
 */
const shape = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(shape)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, shape((value as Record<string, unknown>)[key])]),
    )
  }
  return typeof value
}

/**
 * `shape` at the type level: every leaf becomes `'leaf'`, every function
 * `'fn'`, so two locale types compare by keys alone (a translated ternary
 * infers a different literal-union return type, which is not a key change).
 */
type Shape<T> = T extends (...args: never[]) => unknown
  ? 'fn'
  : T extends object
    ? { [K in keyof T]-?: Shape<T[K]> }
    : 'leaf'

describe('locale objects', () => {
  it('enUS and esES have identical key sets, at every level', () => {
    // Type level (`pnpm typecheck` runs the test files): a key present in one
    // `satisfies` literal and not the other is a compile error here.
    expectTypeOf<Shape<typeof enUS>>().toEqualTypeOf<Shape<typeof esES>>()
    // Runtime, for the same fact in a readable diff.
    expect(shape(esES)).toEqual(shape(enUS))
  })

  it('are shaped like MUI locale objects: only `components.<Ez*>.defaultProps`', () => {
    for (const locale of [enUS, esES]) {
      expect(Object.keys(locale)).toEqual(['components'])
      for (const [name, entry] of Object.entries(locale.components)) {
        expect(name).toMatch(/^Ez[A-Z]/)
        expect(Object.keys(entry)).toEqual(['defaultProps'])
      }
    }
  })
})

/** Every test below runs twice: unthemed (so `enUS` must equal the shipped defaults) and under `createTheme(esES)`. */
const cases = [
  ['unthemed: enUS equals the defaults', undefined, enUS.components],
  ['createTheme(esES)', esES, esES.components],
] as const

type Locale = EzLocalization | undefined

const themed = (locale: Locale, ui: ReactElement) =>
  locale ? <ThemeProvider theme={createTheme(locale)}>{ui}</ThemeProvider> : ui

const nameSchema = z.object({ name: z.string() })

describe.each(cases)('%s', (_, locale, c) => {
  describe('Form', () => {
    it('optionalText and requiredIndicatorText in both modes', () => {
      const { unmount } = render(
        themed(
          locale,
          <Form schema={nameSchema} defaultValues={{ name: '' }} onSubmit={() => {}}>
            <TextField name="name" label="Name" />
          </Form>,
        ),
      )
      expect(screen.getByText(c.EzForm.defaultProps.requiredIndicatorText('asterisk'))).toHaveClass(
        formClasses.description,
      )
      unmount()
      render(
        themed(
          locale,
          <Form
            schema={nameSchema}
            defaultValues={{ name: '' }}
            requiredIndicator="optional"
            onSubmit={() => {}}
          >
            <TextField name="name" label="Name" />
          </Form>,
        ),
      )
      expect(
        screen.getByText(c.EzForm.defaultProps.requiredIndicatorText('optional')),
      ).toBeInTheDocument()
      expect(
        screen.getByRole('textbox', { name: `Name ${c.EzForm.defaultProps.optionalText}` }),
      ).toBeInTheDocument()
    })

    it('announces submitSuccessText after a submit', async () => {
      const user = userEvent.setup()
      render(
        themed(
          locale,
          <Form schema={nameSchema} defaultValues={{ name: 'Ada' }} onSubmit={() => {}}>
            <TextField name="name" label="Name" />
            <SubmitButton />
          </Form>,
        ),
      )
      await user.click(screen.getByRole('button', { name: c.EzSubmitButton.defaultProps.children }))
      await waitFor(() =>
        expect(document.querySelector(`.${formClasses.status}`)).toHaveTextContent(
          c.EzForm.defaultProps.submitSuccessText,
        ),
      )
    })

    it('confirm={true} opens a dialog titled confirmTitle with ConfirmDialog labels', async () => {
      const user = userEvent.setup()
      render(
        themed(
          locale,
          <Form schema={nameSchema} defaultValues={{ name: 'Ada' }} confirm onSubmit={() => {}}>
            <TextField name="name" label="Name" />
            <SubmitButton />
          </Form>,
        ),
      )
      await user.click(screen.getByRole('button', { name: c.EzSubmitButton.defaultProps.children }))
      const dialog = await screen.findByRole('alertdialog', {
        name: c.EzForm.defaultProps.confirmTitle,
      })
      expect(
        within(dialog).getByRole('button', { name: c.EzConfirmDialog.defaultProps.confirmLabel }),
      ).toBeInTheDocument()
      expect(
        within(dialog).getByRole('button', { name: c.EzConfirmDialog.defaultProps.cancelLabel }),
      ).toBeInTheDocument()
    })

    it('messages: required, fallbackLabel, min, exactLength and the picker codes; FormErrorSummary title', async () => {
      const user = userEvent.setup()
      const schema = z.object({
        name: z.string(),
        nick: z.string(),
        age: z.number().nullable(),
        code: z.string(),
        birthday: z.date().nullable(),
      })
      const { container } = render(
        withPickers(
          themed(
            locale,
            <Form
              schema={schema}
              defaultValues={{ name: '', nick: '', age: null, code: '12', birthday: null }}
              onSubmit={() => {}}
            >
              <FormErrorSummary />
              <TextField name="name" label="Name" required />
              {/* A non-string label: the message falls back to `fallbackLabel`. */}
              <TextField name="nick" label={<em>Nick</em>} required />
              <NumberField name="age" label="Age" min={18} />
              <OtpField name="code" label="Code" length={4} />
              <DateField name="birthday" label="Birthday" minDate={new Date(1900, 0, 1)} />
              <SubmitButton />
            </Form>,
          ),
        ),
      )
      fireEvent.change(document.querySelector<HTMLInputElement>('input[name="birthday"]')!, {
        target: { value: '01/01/1899' },
      })
      await user.type(screen.getByRole('textbox', { name: 'Age' }), '17')
      await user.click(screen.getByRole('button', { name: c.EzSubmitButton.defaultProps.children }))
      const m = c.EzForm.defaultProps.messages
      expect(
        await screen.findByRole('heading', { name: c.EzFormErrorSummary.defaultProps.title }),
      ).toBeInTheDocument()
      const summary = screen.getByRole('heading', {
        name: c.EzFormErrorSummary.defaultProps.title,
      }).parentElement!
      // By text, not `role: 'link'`: an item's `<a>` only gets an `href` when
      // the field's `name` element has an id, which the Base UI-backed fields'
      // hidden inputs do not — see the #23 report's follow-up on the summary.
      for (const text of [
        m.required('Name'),
        m.required(m.fallbackLabel),
        m.min('Age', 18),
        m.exactLength('Code', 4),
        m.tooEarly('Birthday'),
      ]) {
        expect(within(summary).getByText(text)).toBeInTheDocument()
      }
      await expectNoA11yViolations(container)
    })
  })

  it('ClearButton: label, and confirm={true} asks with confirmTitle', async () => {
    const user = userEvent.setup()
    render(
      themed(
        locale,
        <Form schema={nameSchema} defaultValues={{ name: '' }} onSubmit={() => {}}>
          <TextField name="name" label="Name" />
          <ClearButton confirm />
        </Form>,
      ),
    )
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'x')
    await user.click(screen.getByRole('button', { name: c.EzClearButton.defaultProps.children }))
    expect(
      await screen.findByRole('alertdialog', { name: c.EzClearButton.defaultProps.confirmTitle }),
    ).toBeInTheDocument()
  })

  it('FormDialog: cancelLabel, and the exit prompt copy', async () => {
    const user = userEvent.setup()
    function Harness() {
      const [open, setOpen] = useState(true)
      return (
        <FormDialog
          open={open}
          onClose={() => setOpen(false)}
          title="Edit"
          schema={nameSchema}
          defaultValues={{ name: '' }}
          onSubmit={() => {}}
        >
          <TextField name="name" label="Name" />
        </FormDialog>
      )
    }
    render(themed(locale, <Harness />))
    const dialog = await screen.findByRole('dialog')
    expect(
      within(dialog).getByRole('button', { name: c.EzFormDialog.defaultProps.cancelLabel }),
    ).toBeInTheDocument()
    await user.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'x')
    await user.keyboard('{Escape}')
    const exit = c.EzFormDialog.defaultProps.exitConfirm
    const prompt = await screen.findByRole('alertdialog', { name: exit.title })
    expect(within(prompt).getByRole('button', { name: exit.confirmLabel })).toBeInTheDocument()
    expect(within(prompt).getByRole('button', { name: exit.cancelLabel })).toBeInTheDocument()
  })

  it('Wizard: stepAnnouncement; WizardNav: prevLabel, nextLabel', async () => {
    const user = userEvent.setup()
    const schema = z.object({ a: z.string(), b: z.string() })
    const steps = [
      { id: 'a', label: 'A', fields: ['a' as const] },
      { id: 'b', label: 'B', fields: ['b' as const] },
    ]
    render(
      themed(
        locale,
        <Form schema={schema} defaultValues={{ a: 'x', b: 'y' }} onSubmit={() => {}}>
          <Wizard steps={steps}>
            <WizardStep id="a">
              <TextField name="a" label="A" />
            </WizardStep>
            <WizardStep id="b">
              <TextField name="b" label="B" />
            </WizardStep>
            <WizardNav />
          </Wizard>
        </Form>,
      ),
    )
    const nav = c.EzWizardNav.defaultProps
    expect(screen.getByRole('button', { name: nav.prevLabel })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: nav.nextLabel }))
    const expected = c.EzWizard.defaultProps.stepAnnouncement({
      index: 1,
      count: 2,
      label: 'B',
      step: steps[1]!,
    })
    await waitFor(() =>
      expect(document.querySelector(`.${wizardClasses.status}`)).toHaveTextContent(expected),
    )
  })

  it('FieldArray: labels, row naming, the three announcements and the button names', async () => {
    const user = userEvent.setup()
    const schema = z.object({ people: z.array(z.object({ name: z.string() })) })
    const a = c.EzFieldArray.defaultProps
    const singular = a.singularize('Applicants')
    const { container } = render(
      themed(
        locale,
        <Form
          schema={schema}
          defaultValues={{ people: [{ name: 'Ada' }, { name: 'Grace' }] }}
          onSubmit={() => {}}
        >
          <FieldArray name="people" label="Applicants" emptyRow={{ name: '' }} reorder>
            {(row) => <TextField name={row.name('name')} label="Name" />}
          </FieldArray>
        </Form>,
      ),
    )
    const status = () => container.querySelector(`.${fieldArrayClasses.status}`)
    expect(screen.getByRole('group', { name: `${singular} 1` })).toBeInTheDocument()
    expect(
      screen.getAllByRole('button', { name: a.removeRowLabel(`${singular} 1`) })[0],
    ).toHaveTextContent(a.removeLabel)
    expect(screen.getByRole('button', { name: a.moveUpLabel(`${singular} 2`) })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: a.moveDownLabel(`${singular} 1`) }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: a.addLabel }))
    await waitFor(() => expect(status()).toHaveTextContent(a.addedMessage(3)))
    await user.click(screen.getByRole('button', { name: a.moveUpLabel(`${singular} 2`) }))
    await waitFor(() => expect(status()).toHaveTextContent(a.movedMessage(1, 'up')))
    await user.click(screen.getByRole('button', { name: a.removeRowLabel(`${singular} 3`) }))
    await waitFor(() => expect(status()).toHaveTextContent(a.removedMessage(3)))
    await expectNoA11yViolations(container)
  })

  it('FieldArray: rowText names the rows of a non-string label', () => {
    const schema = z.object({ people: z.array(z.object({ name: z.string() })) })
    render(
      themed(
        locale,
        <Form schema={schema} defaultValues={{ people: [{ name: 'Ada' }] }} onSubmit={() => {}}>
          <FieldArray name="people" label={<em>People</em>} emptyRow={{ name: '' }}>
            {(row) => <TextField name={row.name('name')} label="Name" />}
          </FieldArray>
        </Form>,
      ),
    )
    expect(
      screen.getByRole('group', { name: `${c.EzFieldArray.defaultProps.rowText} 1` }),
    ).toBeInTheDocument()
  })

  it('AddressField: the five part labels', () => {
    const schema = z.object({
      address: z.object({
        street: z.string(),
        street2: z.string().optional(),
        city: z.string(),
        state: z.string(),
        zip: z.string(),
      }),
    })
    render(
      themed(
        locale,
        <Form
          schema={schema}
          defaultValues={{ address: { street: '', street2: '', city: '', state: '', zip: '' } }}
          onSubmit={() => {}}
        >
          <AddressField name="address" />
        </Form>,
      ),
    )
    const p = c.EzAddressField.defaultProps
    expect(screen.getByRole('textbox', { name: p.streetLabel })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: p.street2Label })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: p.cityLabel })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: p.stateLabel })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: p.zipLabel })).toBeInTheDocument()
    expect(p.lookupFilledText).toEqual(expect.any(String))
  })

  it('PasswordField: showLabel / hideLabel; PasswordStrength: labels and the meter name', async () => {
    const user = userEvent.setup()
    const schema = z.object({ password: z.string() })
    render(
      themed(
        locale,
        <Form schema={schema} defaultValues={{ password: '' }} onSubmit={() => {}}>
          <PasswordField name="password" label="Password" />
          <PasswordStrength name="password" />
        </Form>,
      ),
    )
    const p = c.EzPasswordField.defaultProps
    const s = c.EzPasswordStrength.defaultProps
    await user.click(screen.getByRole('button', { name: p.showLabel }))
    expect(screen.getByRole('button', { name: p.hideLabel })).toBeInTheDocument()
    const meter = screen.getByRole('meter', { name: s.slotProps.bar['aria-label'] })
    await user.type(screen.getByLabelText('Password'), 'a')
    await waitFor(() => expect(meter).toHaveAttribute('aria-valuetext', s.labels[0]))
    expect(screen.getByText(s.labels[0])).toBeInTheDocument()
  })

  it('SsnField: showLabel / hideLabel and invalidMessage', async () => {
    const user = userEvent.setup()
    const schema = z.object({ ssn: z.string() })
    render(
      themed(
        locale,
        <Form schema={schema} defaultValues={{ ssn: '' }} onSubmit={() => {}}>
          <SsnField name="ssn" label="SSN" />
          <SubmitButton />
        </Form>,
      ),
    )
    const p = c.EzSsnField.defaultProps
    await user.click(screen.getByRole('button', { name: p.showLabel }))
    expect(screen.getByRole('button', { name: p.hideLabel })).toBeInTheDocument()
    await user.type(screen.getByLabelText(/^SSN/), '123')
    await user.click(screen.getByRole('button', { name: c.EzSubmitButton.defaultProps.children }))
    expect(await screen.findByRole('alert')).toHaveTextContent(p.invalidMessage)
  })

  it('OtpField: characterLabel names every slot after the first', () => {
    const schema = z.object({ code: z.string() })
    render(
      themed(
        locale,
        <Form schema={schema} defaultValues={{ code: '' }} onSubmit={() => {}}>
          <OtpField name="code" label="Code" length={4} />
        </Form>,
      ),
    )
    const cl = c.EzOtpField.defaultProps.characterLabel
    expect(screen.getByRole('textbox', { name: cl(2, 4) })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: cl(4, 4) })).toBeInTheDocument()
  })

  it('ResendCodeButton: label and sentText', async () => {
    const user = userEvent.setup()
    const { container } = render(
      themed(
        locale,
        <Form schema={nameSchema} defaultValues={{ name: '' }} onSubmit={() => {}}>
          <ResendCodeButton onResend={() => {}} cooldown={0} />
        </Form>,
      ),
    )
    const p = c.EzResendCodeButton.defaultProps
    await user.click(screen.getByRole('button', { name: p.children }))
    await waitFor(() =>
      expect(container.querySelector(`.${resendCodeButtonClasses.status}`)).toHaveTextContent(
        p.sentText,
      ),
    )
  })

  it('FileField: dropText and acceptMessage', async () => {
    // `applyAccept: false`: user-event would otherwise filter the PNG out itself.
    const user = userEvent.setup({ applyAccept: false })
    const schema = z.object({ doc: z.instanceof(File).nullable() })
    render(
      themed(
        locale,
        <Form schema={schema} defaultValues={{ doc: null }} onSubmit={() => {}}>
          <FileField name="doc" label="Document" accept=".pdf" dropzone />
        </Form>,
      ),
    )
    const p = c.EzFileField.defaultProps
    expect(screen.getByText(p.dropText)).toBeInTheDocument()
    await user.upload(
      screen.getByLabelText(/^Document/),
      new File(['png'], 'a.png', { type: 'image/png' }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(p.acceptMessage)
  })

  it('EmailField, FeinField, PhoneField, ZipField: invalidMessage', async () => {
    const user = userEvent.setup()
    const schema = z.object({
      email: z.string(),
      fein: z.string(),
      phone: z.string(),
      zip: z.string(),
    })
    render(
      themed(
        locale,
        <Form
          schema={schema}
          defaultValues={{ email: 'nope', fein: '12', phone: '555', zip: '12' }}
          onSubmit={() => {}}
        >
          <EmailField name="email" label="Email" />
          <FeinField name="fein" label="FEIN" />
          <PhoneField name="phone" label="Phone" />
          <ZipField name="zip" label="ZIP" />
          <SubmitButton />
        </Form>,
      ),
    )
    await user.click(screen.getByRole('button', { name: c.EzSubmitButton.defaultProps.children }))
    const alerts = await screen.findAllByRole('alert')
    const texts = alerts.map((el) => el.textContent)
    expect(texts).toEqual([
      c.EzEmailField.defaultProps.invalidMessage,
      c.EzFeinField.defaultProps.invalidMessage,
      c.EzPhoneField.defaultProps.invalidMessage(10),
      c.EzZipField.defaultProps.invalidMessage,
    ])
  })

  it('EmailListField: invalidMessage, duplicateMessage, addedMessage; ChipDeleteIcon: removeLabel', async () => {
    const user = userEvent.setup()
    const schema = z.object({ to: z.array(z.string()) })
    const { container } = render(
      themed(
        locale,
        <Form schema={schema} defaultValues={{ to: [] }} onSubmit={() => {}}>
          <EmailListField name="to" label="To" />
        </Form>,
      ),
    )
    const p = c.EzEmailListField.defaultProps
    const status = () => container.querySelector(`.${emailListFieldClasses.status}`)
    const box = screen.getByRole('combobox', { name: 'To' })
    await user.type(box, 'ada@example.com{Enter}')
    await waitFor(() => expect(status()).toHaveTextContent(p.addedMessage('ada@example.com')))
    expect(
      screen.getByRole('button', {
        name: c.EzChipDeleteIcon.defaultProps.removeLabel('ada@example.com'),
      }),
    ).toBeInTheDocument()
    await user.type(box, 'ada@example.com{Enter}')
    await waitFor(() => expect(status()).toHaveTextContent(p.duplicateMessage))
    await user.type(box, 'nope{Enter}')
    expect(await screen.findByRole('alert')).toHaveTextContent(p.invalidMessage)
  })

  it('ChipDeleteIcon on its own: removeLabel', () => {
    render(themed(locale, <ChipDeleteIcon label="Ada" />))
    expect(
      screen.getByRole('button', { name: c.EzChipDeleteIcon.defaultProps.removeLabel('Ada') }),
    ).toBeInTheDocument()
  })

  it('ReadOnlyField: yesText / noText, editLabel and editAriaLabel', () => {
    const schema = z.object({ active: z.boolean(), email: z.string() })
    const steps = [
      { id: 'edit', label: 'Edit', fields: ['email' as const] },
      { id: 'review', label: 'Review' },
    ]
    render(
      themed(
        locale,
        <Form schema={schema} defaultValues={{ active: true, email: 'a@x.io' }} onSubmit={() => {}}>
          <Wizard steps={steps} step="review" visited={['edit', 'review']}>
            <WizardStep id="edit">
              <TextField name="email" label="Email" />
            </WizardStep>
            <WizardStep id="review">
              <ReadOnlyField name="active" label="Active" />
              <ReadOnlyField name="email" label="Email" editStep="edit" />
              <ReadOnlyField value={false} label="Off" />
            </WizardStep>
          </Wizard>
        </Form>,
      ),
    )
    const p = c.EzReadOnlyField.defaultProps
    expect(screen.getByText(p.yesText)).toBeInTheDocument()
    expect(screen.getByText(p.noText)).toBeInTheDocument()
    const edit = screen.getByRole('button', { name: p.editAriaLabel('Email') })
    expect(edit).toHaveTextContent(p.editLabel)
  })
})
