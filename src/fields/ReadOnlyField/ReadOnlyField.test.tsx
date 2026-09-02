import { useState } from 'react'
import { createTheme, ThemeProvider } from '@mui/material/styles'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { z } from 'zod'
import { Form } from '../../Form'
import { TextField } from '../TextField'
import { Wizard, WizardStep } from '../../Wizard'
import { ReadOnlyField, readOnlyFieldClasses } from './ReadOnlyField'
import { expectNoA11yViolations } from '../../test/axe'

const schema = z.object({
  email: z.string(),
  role: z.string(),
  tags: z.array(z.string()),
  tos: z.boolean(),
  when: z.date().nullable(),
  cardNumber: z.string(),
  letters: z.array(z.string()),
  lettersUnknown: z.array(z.string()),
})
const values = {
  email: 'ada@x.io',
  role: 'admin',
  tags: ['a', 'b'],
  tos: true,
  when: null,
  cardNumber: '',
  letters: ['a', 'b'],
  lettersUnknown: ['a', 'zzz'],
}
const roles = [
  { value: 'admin', label: 'Administrator' },
  { value: 'user', label: 'User' },
]
const letterOptions = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
]

const wrap = (ui: React.ReactNode) =>
  render(
    <Form schema={schema} defaultValues={values} onSubmit={() => {}}>
      {ui}
    </Form>,
  )

const steps = [
  { id: 'account', label: 'Account', fields: ['email'] },
  { id: 'review', label: 'Review' },
] as const

describe('ReadOnlyField', () => {
  it('shows the label above the value', () => {
    wrap(<ReadOnlyField name="email" label="Email" />)
    expect(screen.getByText('Email')).toBeInTheDocument()
    expect(screen.getByText('ada@x.io')).toBeInTheDocument()
  })

  it('root has an accessible name equal to the label, via aria-labelledby', () => {
    wrap(<ReadOnlyField name="email" label="Email" />)
    expect(screen.getByText('ada@x.io').closest('[aria-labelledby]')).toHaveAccessibleName('Email')
  })

  it('humanizes the name when there is no label', () => {
    wrap(<ReadOnlyField name="cardNumber" />)
    expect(screen.getByText('Card number')).toBeInTheDocument()
  })

  it('looks up option labels, joins arrays, renders booleans as Yes/No, and empties as —', () => {
    wrap(
      <>
        <ReadOnlyField name="role" options={roles} />
        <ReadOnlyField name="tags" />
        <ReadOnlyField name="tos" />
        <ReadOnlyField name="when" />
        <ReadOnlyField name="cardNumber" empty="none" />
      </>,
    )
    expect(screen.getByText('Administrator')).toBeInTheDocument()
    expect(screen.getByText('a, b')).toBeInTheDocument()
    expect(screen.getByText('Yes')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.getByText('none')).toBeInTheDocument()
  })

  it('array + options: joins the matching option labels', () => {
    wrap(<ReadOnlyField name="letters" options={letterOptions} />)
    expect(screen.getByText('Alpha, Beta')).toBeInTheDocument()
  })

  it('array + options: an unmatched value falls back to its raw string', () => {
    wrap(<ReadOnlyField name="lettersUnknown" options={letterOptions} />)
    expect(screen.getByText('Alpha, zzz')).toBeInTheDocument()
  })

  it('format wins over every default', () => {
    wrap(<ReadOnlyField name="tags" format={(v) => `${(v as string[]).length} tags`} />)
    expect(screen.getByText('2 tags')).toBeInTheDocument()
  })

  it('is live: reflects edits to the field', async () => {
    const user = userEvent.setup()
    wrap(
      <>
        <TextField name="email" label="Edit email" />
        <ReadOnlyField name="email" label="Email" />
      </>,
    )
    await user.type(screen.getByRole('textbox', { name: 'Edit email' }), 'x')
    expect(await screen.findByText('ada@x.iox')).toBeInTheDocument()
  })

  it('editStep shows an Edit button inside a Wizard that goes to that step, and nothing outside', async () => {
    const user = userEvent.setup()
    wrap(<ReadOnlyField name="email" editStep="account" />)
    expect(screen.queryByRole('button', { name: /Edit/ })).not.toBeInTheDocument()

    function ReviewFirst() {
      const [step, setStep] = useState('review')
      return (
        <Wizard
          steps={steps}
          step={step}
          onStepChange={(s) => setStep(s.id)}
          visited={['account', 'review']}
        >
          <WizardStep id="account">
            <TextField name="email" label="Edit email" />
          </WizardStep>
          <WizardStep id="review">
            <ReadOnlyField name="email" label="Email" editStep="account" />
          </WizardStep>
        </Wizard>
      )
    }
    wrap(<ReviewFirst />)
    await user.click(screen.getByRole('button', { name: 'Edit Email' }))
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Edit email' })).toBeInTheDocument(),
    )
  })

  it('editStep renders no Edit button in a page-layout Wizard: go() there is a no-op', () => {
    wrap(
      <Wizard steps={steps} layout="page">
        <WizardStep id="account">
          <TextField name="email" label="Edit email" />
        </WizardStep>
        <WizardStep id="review">
          <ReadOnlyField name="email" label="Email" editStep="account" />
        </WizardStep>
      </Wizard>,
    )
    expect(screen.queryByRole('button', { name: /Edit/ })).not.toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    const { container } = wrap(<ReadOnlyField name="email" label="Email" />)
    await expectNoA11yViolations(container)
  })

  it('throws outside <Form>', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<ReadOnlyField name="email" />)).toThrow(
      'ez-form: <ReadOnlyField> must be rendered inside <Form>',
    )
  })

  it('is themeable: defaultProps.slotProps.label.variant and styleOverrides.value apply', () => {
    const theme = createTheme({
      components: {
        EzReadOnlyField: {
          defaultProps: {
            slotProps: { label: { variant: 'overline' } },
          },
          styleOverrides: {
            value: { textTransform: 'uppercase' },
          },
        },
      },
    })
    render(
      <ThemeProvider theme={theme}>
        <Form schema={schema} defaultValues={values} onSubmit={() => {}}>
          <ReadOnlyField name="email" label="Email" />
        </Form>
      </ThemeProvider>,
    )
    const label = screen.getByText('Email')
    expect(label).toHaveClass('MuiTypography-overline')
    const value = screen.getByText('ada@x.io')
    expect(value).toHaveClass(readOnlyFieldClasses.value)
    expect(getComputedStyle(value).textTransform).toBe('uppercase')
  })
})
