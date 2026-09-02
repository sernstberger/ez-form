import type { Meta, StoryObj } from '@storybook/react-vite'
import { screen, within, fireEvent } from 'storybook/test'
import { Loan } from './Loan'

const meta = {
  title: 'Examples/Loan',
  component: Loan,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Loan>

export default meta
type Story = StoryObj<typeof meta>

type PlayContext = Parameters<NonNullable<Story['play']>>[0]

/** `DateField` renders its own hidden text input, found by `name` (see the Loan/DateField tests). */
const typeDate = (name: string, text: string) => {
  const input = document.querySelector<HTMLInputElement>(`input[name="${name}"]`)!
  fireEvent.change(input, { target: { value: text } })
}

async function fillLoanStep({ canvas, userEvent }: PlayContext) {
  const amount = canvas.getByLabelText(/loan amount/i)
  await userEvent.clear(amount)
  await userEvent.type(amount, '25,000')
  await userEvent.click(canvas.getByRole('combobox', { name: /purpose/i }))
  // The Select's option list, like the confirm dialog, portals to `document.body`.
  await userEvent.click(await screen.findByRole('option', { name: 'Home purchase' }))
}

async function fillApplicantStep({ canvas, userEvent }: PlayContext, income = '8000') {
  await userEvent.type(canvas.getByLabelText(/full name/i), 'Ada Lovelace')
  await userEvent.type(canvas.getByLabelText(/^email/i), 'ada@example.com')
  typeDate('applicantBirthday', '12/10/1985')
  const incomeInput = canvas.getByLabelText(/monthly income/i)
  await userEvent.clear(incomeInput)
  await userEvent.type(incomeInput, income)
}

async function fillEmploymentStep({ canvas, userEvent }: PlayContext, income = '8000') {
  const group = canvas.getByRole('group', { name: 'Employer 1' })
  await userEvent.type(within(group).getByLabelText(/^employer/i), 'Acme Corp')
  typeDate('employment.0.from', '01/01/2018')
  const incomeInput = within(group).getByLabelText(/monthly income/i)
  await userEvent.clear(incomeInput)
  await userEvent.type(incomeInput, income)
}

async function next({ canvas, userEvent }: PlayContext) {
  await userEvent.click(canvas.getByRole('button', { name: /^next$/i }))
}

export const Default: Story = {}

export const WithCoApplicants: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Adds a co-applicant on the Co-applicants step: FieldArray moves focus into the new row and the Review step lists it.',
      },
    },
  },
  play: async (ctx) => {
    await fillLoanStep(ctx)
    await next(ctx)
    await fillApplicantStep(ctx)
    await next(ctx)
    const { canvas, userEvent } = ctx
    await userEvent.click(canvas.getByRole('button', { name: 'Add' }))
    const row = await canvas.findByRole('group', { name: 'Co-applicant 1' })
    await userEvent.type(within(row).getByLabelText(/^name/i), 'Grace Hopper')
    await userEvent.click(within(row).getByRole('combobox', { name: /relationship/i }))
    await userEvent.click(await screen.findByRole('option', { name: 'Spouse' }))
    const rowIncome = within(row).getByLabelText(/monthly income/i)
    await userEvent.clear(rowIncome)
    await userEvent.type(rowIncome, '2000')
  },
}

export const HighDti: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'A debt whose monthly payment is disproportionate to income pushes the DTI ratio over 45%: the fake API declines and the message shows through FormError.',
      },
    },
  },
  play: async (ctx) => {
    const { canvas, userEvent } = ctx
    await fillLoanStep(ctx)
    await next(ctx)
    await fillApplicantStep(ctx, '1000')
    await next(ctx)
    await next(ctx) // co-applicants: skip
    await fillEmploymentStep(ctx, '0')
    await next(ctx)
    await userEvent.click(canvas.getByRole('button', { name: 'Add' }))
    const debtRow = await canvas.findByRole('group', { name: 'Debt 1' })
    await userEvent.type(within(debtRow).getByLabelText(/creditor/i), 'Big Bank')
    const balance = within(debtRow).getByLabelText(/^balance/i)
    await userEvent.clear(balance)
    await userEvent.type(balance, '50000')
    const payment = within(debtRow).getByLabelText(/monthly payment/i)
    await userEvent.clear(payment)
    await userEvent.type(payment, '900')
    await next(ctx) // documents
    await next(ctx) // review

    await userEvent.click(canvas.getByRole('button', { name: /submit application/i }))
    const dialog = await screen.findByRole('alertdialog', { name: /submit application\?/i })
    await userEvent.click(within(dialog).getByRole('button', { name: /^confirm$/i }))
    await canvas.findByRole('alert')
  },
}
