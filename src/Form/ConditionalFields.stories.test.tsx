import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { composeStories } from '@storybook/react-vite'
import { runStoryPlay } from '../test/runStoryPlay'
import { expectNoA11yViolations } from '../test/axe'
import * as stories from './ConditionalFields.stories'

const { Default } = composeStories(stories)

describe('ConditionalFields story (#82)', () => {
  it('runs the story to completion (composeStories/play smoke test)', async () => {
    await runStoryPlay(Default)
  })

  describe('pattern 1: checkbox reveals fields', () => {
    it('hides contact name/phone until the checkbox is checked, and submits fine while hidden', async () => {
      const user = userEvent.setup()
      render(<Default />)
      const section = screen.getByRole('group', { name: /1\. checkbox reveals fields/i })
      expect(within(section).queryByLabelText(/contact name/i)).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: /submit/i }))
      await waitFor(() => expect(screen.queryByText(/^name is required$/i)).not.toBeInTheDocument())
    })

    it('reveals the fields once checked and requires them empty on submit', async () => {
      const user = userEvent.setup()
      render(<Default />)
      const section = screen.getByRole('group', { name: /1\. checkbox reveals fields/i })
      await user.click(within(section).getByRole('checkbox', { name: /different contact/i }))
      expect(within(section).getByLabelText(/contact name/i)).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: /submit/i }))
      await screen.findByText(/^name is required$/i)
      await screen.findByText(/^phone is required$/i)
    })
  })

  describe('pattern 2: select reveals a field', () => {
    it('shows "Please specify" only once "Other" is chosen, required only then', async () => {
      const user = userEvent.setup()
      render(<Default />)
      const section = screen.getByRole('group', { name: /2\. select value reveals a field/i })
      expect(within(section).queryByLabelText(/please specify/i)).not.toBeInTheDocument()

      await user.click(within(section).getByRole('combobox', { name: /how did you hear/i }))
      await user.click(await screen.findByRole('option', { name: 'Other' }))
      expect(within(section).getByLabelText(/please specify/i)).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: /submit/i }))
      await within(section).findByRole('alert')
    })

    it('submits fine when a non-Other source is chosen and the field stays hidden', async () => {
      const user = userEvent.setup()
      render(<Default />)
      const section = screen.getByRole('group', { name: /2\. select value reveals a field/i })
      await user.click(within(section).getByRole('combobox', { name: /how did you hear/i }))
      await user.click(await screen.findByRole('option', { name: 'Search engine' }))
      expect(within(section).queryByLabelText(/please specify/i)).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: /submit/i }))
      await waitFor(() => expect(within(section).queryByRole('alert')).not.toBeInTheDocument())
    })
  })

  describe('pattern 3: switch toggles a section', () => {
    it('reveals co-signer fields on toggle and requires them only while on', async () => {
      const user = userEvent.setup()
      render(<Default />)
      const section = screen.getByRole('group', { name: /3\. switch toggles a whole section/i })
      expect(within(section).queryByLabelText(/co-signer name/i)).not.toBeInTheDocument()

      await user.click(within(section).getByRole('switch', { name: /add a co-signer/i }))
      expect(within(section).getByLabelText(/co-signer name/i)).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: /submit/i }))
      await screen.findByText(/co-signer name is required/i)
      await screen.findByText(/co-signer email is required/i)
    })
  })

  describe('pattern 4: threshold reveals a note + field', () => {
    it('reveals the note and field once income drops below the threshold', async () => {
      const user = userEvent.setup()
      render(<Default />)
      const section = screen.getByRole('group', { name: /4\. threshold reveals/i })
      expect(within(section).queryByLabelText(/co-signer note/i)).not.toBeInTheDocument()

      const income = within(section).getByLabelText(/monthly income/i)
      await user.clear(income)
      await user.type(income, '1000')
      await user.tab()
      expect(within(section).getByLabelText(/co-signer note/i)).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: /submit/i }))
      await screen.findByText(/co-signer note is required/i)
    })

    it('submits fine with income at or above the threshold, note hidden', async () => {
      const user = userEvent.setup()
      render(<Default />)
      const section = screen.getByRole('group', { name: /4\. threshold reveals/i })
      expect(within(section).queryByLabelText(/co-signer note/i)).not.toBeInTheDocument()

      // Default monthlyIncome (5000) is already at/above the threshold: submitting
      // must not raise the co-signer-note error, proving "submits fine" for real.
      await user.click(screen.getByRole('button', { name: /submit/i }))
      await waitFor(() => expect(within(section).queryByRole('alert')).not.toBeInTheDocument())
    })
  })

  describe('pattern 5: cascading selects', () => {
    it('shows US states for the US, resets on country change, and shows a text field for a country with no list', async () => {
      const user = userEvent.setup()
      render(<Default />)
      const section = screen.getByRole('group', { name: /5\. cascading selects/i })

      await user.click(within(section).getByRole('combobox', { name: /state \/ province/i }))
      await user.click(await screen.findByRole('option', { name: 'California' }))
      expect(
        within(section).getByRole('combobox', { name: /state \/ province/i }),
      ).toHaveTextContent('California')

      // Switch country to Canada: region resets and now lists provinces.
      await user.click(within(section).getByRole('combobox', { name: /^country/i }))
      await user.click(await screen.findByRole('option', { name: 'Canada' }))
      const region = within(section).getByRole('combobox', { name: /state \/ province/i })
      expect(region).not.toHaveTextContent('California')

      // Switch to France: no province list, falls back to a free-text region field.
      await user.click(within(section).getByRole('combobox', { name: /^country/i }))
      await user.click(await screen.findByRole('option', { name: 'France' }))
      expect(within(section).getByLabelText(/^region$/i)).toBeInTheDocument()
      expect(
        within(section).queryByRole('combobox', { name: /state \/ province/i }),
      ).not.toBeInTheDocument()
    })

    it('requires the region field only when the country has a region list (US/CA)', async () => {
      const user = userEvent.setup()
      render(<Default />)
      const section = screen.getByRole('group', { name: /5\. cascading selects/i })
      // Default country is US (see defaultValues), so an empty region blocks submit.
      expect(within(section).getByRole('combobox', { name: /^country/i })).toHaveTextContent(
        'United States',
      )
      await user.click(screen.getByRole('button', { name: /submit/i }))
      await screen.findByText(/region is required/i)
    })

    it('does not require the region field for a country with no region list', async () => {
      const user = userEvent.setup()
      render(<Default />)
      const section = screen.getByRole('group', { name: /5\. cascading selects/i })
      await user.click(within(section).getByRole('combobox', { name: /^country/i }))
      await user.click(await screen.findByRole('option', { name: 'France' }))
      // Region is now a free-text field, left empty on purpose.
      expect(within(section).getByLabelText(/^region$/i)).toHaveValue('')

      await user.click(screen.getByRole('button', { name: /submit/i }))
      await waitFor(() => expect(screen.queryByText(/region is required/i)).not.toBeInTheDocument())
    })
  })

  describe('pattern 6: mutually exclusive fields', () => {
    it('shows the email field by default (default contactBy is email) and the phone field once "Phone" is picked', async () => {
      const user = userEvent.setup()
      render(<Default />)
      const section = screen.getByRole('group', { name: /6\. mutually exclusive fields/i })
      expect(within(section).getByRole('textbox', { name: /^email$/i })).toBeInTheDocument()
      expect(within(section).queryByRole('textbox', { name: /^phone$/i })).not.toBeInTheDocument()

      await user.click(within(section).getByRole('radio', { name: 'Phone' }))
      expect(within(section).getByRole('textbox', { name: /^phone$/i })).toBeInTheDocument()
      expect(within(section).queryByRole('textbox', { name: /^email$/i })).not.toBeInTheDocument()
    })

    it("requires the shown branch's field and reports its own message", async () => {
      const user = userEvent.setup()
      render(<Default />)
      const section = screen.getByRole('group', { name: /6\. mutually exclusive fields/i })
      await user.click(within(section).getByRole('radio', { name: 'Phone' }))
      await user.click(screen.getByRole('button', { name: /submit/i }))
      await screen.findByText(/phone number is required/i)
    })
  })

  it('is accessible with every section in its default (hidden) state', async () => {
    const { container } = render(<Default />)
    await expectNoA11yViolations(container)
  })

  it('is accessible with every revealable section expanded', async () => {
    const user = userEvent.setup()
    const { container } = render(<Default />)

    await user.click(screen.getByRole('checkbox', { name: /different contact/i }))
    await user.click(screen.getByRole('switch', { name: /add a co-signer/i }))

    const referralSection = screen.getByRole('group', { name: /2\. select value reveals a field/i })
    await user.click(within(referralSection).getByRole('combobox', { name: /how did you hear/i }))
    await user.click(await screen.findByRole('option', { name: 'Other' }))

    const incomeSection = screen.getByRole('group', { name: /4\. threshold reveals/i })
    const income = within(incomeSection).getByLabelText(/monthly income/i)
    await user.clear(income)
    await user.type(income, '1000')
    await user.tab()

    await user.click(screen.getByRole('radio', { name: 'Phone' }))

    await expectNoA11yViolations(container)
  })
})
