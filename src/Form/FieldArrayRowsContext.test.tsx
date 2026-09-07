import { useRef } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { z } from 'zod'
import { Form } from './Form'
import { TextField } from '../fields/TextField'
import { FieldArray, type FieldArrayRow } from '../FieldArray'
import { Wizard, type WizardStepDef } from '../Wizard'
import { WizardStep } from '../Wizard/WizardStep'
import { WizardNav } from '../Wizard/WizardNav'
import { useFieldArrayRows } from './FieldArrayRowsContext'
import { expectNoA11yViolations } from '../test/axe'
import { expectConsole } from '../test/expectConsole'
import { resetDevWarnings } from '../devWarn'

const schema = z.object({
  applicants: z.array(z.object({ name: z.string(), note: z.string() })),
})
type Values = z.infer<typeof schema>

const twoRows: Values = {
  applicants: [
    { name: 'Ada', note: '' },
    { name: 'Grace', note: '' },
  ],
}

/**
 * A second reader of the array, rendering one field per row from the registry rather than
 * from its own `useFieldArray` — the pattern the hook exists for. Each row is labelled by its
 * `id` so a test can assert *which* row a field belongs to across a mutation, which is the
 * whole question index-keying gets wrong.
 */
function Notes({ name = 'applicants' }: { name?: string }) {
  const rows = useFieldArrayRows(name)
  return (
    <div>
      <div data-testid="ids">{rows.map((row) => row.id).join(',')}</div>
      <div data-testid="paths">{rows.map((row) => row.name('note')).join(',')}</div>
      {rows.map((row) => (
        <Note key={row.id} row={row} />
      ))}
    </div>
  )
}

/**
 * One row's field, stamped with the row it was *first* mounted for. `useRef` survives
 * re-renders but not a remount, so `data-instance` diverging from the row's own id is exactly
 * the "React reused another row's component for this one" failure that index keying causes.
 */
function Note({ row }: { row: FieldArrayRow }) {
  const mountedFor = useRef(row.id)
  return (
    <TextField
      name={row.name('note')}
      label={`Note for ${row.id}`}
      slotProps={{ htmlInput: { 'data-instance': mountedFor.current } }}
    />
  )
}

function Applicants({
  defaultValues = twoRows,
  notesName,
}: {
  defaultValues?: Values
  notesName?: string
}) {
  return (
    <Form schema={schema} defaultValues={defaultValues} onSubmit={() => {}}>
      <FieldArray
        name="applicants"
        label="Applicants"
        emptyRow={() => ({ name: '', note: '' })}
        reorder
      >
        {(row) => <TextField name={row.name('name')} label={`Name ${row.index + 1}`} />}
      </FieldArray>
      <Notes name={notesName} />
    </Form>
  )
}

const ids = () => screen.getByTestId('ids').textContent.split(',').filter(Boolean)
const paths = () => screen.getByTestId('paths').textContent.split(',').filter(Boolean)

/** The ids the owning `<FieldArray>` itself keys its rows by, read off the reader's fields. */
const readerRowLabels = () =>
  screen.getAllByRole('textbox', { name: /^Note for / }).map((el) => el.getAttribute('name'))

describe('useFieldArrayRows', () => {
  beforeEach(resetDevWarnings)

  it('gives a second reader the array rows, with a path per row', () => {
    render(<Applicants />)
    expect(ids()).toHaveLength(2)
    expect(paths()).toEqual(['applicants.0.note', 'applicants.1.note'])
  })

  it('has no a11y violations', async () => {
    const { container } = render(<Applicants />)
    await expectNoA11yViolations(container)
  })

  it('appends a row live while both are mounted, keeping the existing ids', async () => {
    const user = userEvent.setup({ delay: null })
    render(<Applicants />)
    const before = ids()

    await user.click(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() => expect(ids()).toHaveLength(3))
    // The two original rows keep the ids they already had — an append is not a re-key.
    expect(ids().slice(0, 2)).toEqual(before)
    expect(paths()).toEqual(['applicants.0.note', 'applicants.1.note', 'applicants.2.note'])
  })

  it('removing a row drops that row and keeps the survivor identified by its own id', async () => {
    const user = userEvent.setup({ delay: null })
    render(<Applicants />)
    const [first, second] = ids()

    await user.click(screen.getByRole('button', { name: 'Remove Applicant 1' }))

    await waitFor(() => expect(ids()).toEqual([second]))
    expect(ids()).not.toContain(first)
    // The survivor's *path* shifts down, because that is where its value now lives — the id is
    // what tells a reader it is still the same row, which is exactly what index-keying loses.
    expect(paths()).toEqual(['applicants.0.note'])
    expect(readerRowLabels()).toEqual(['applicants.0.note'])
  })

  it('moving a row reorders the ids without minting new ones', async () => {
    const user = userEvent.setup({ delay: null })
    render(<Applicants />)
    const [first, second] = ids()

    await user.click(screen.getByRole('button', { name: 'Move Applicant 1 down' }))

    await waitFor(() => expect(ids()).toEqual([second, first]))
  })

  it('matches the ids the owning FieldArray keys its own rows by', async () => {
    const user = userEvent.setup({ delay: null })
    render(<Applicants />)

    // Typing into a row's own field and into the reader's field for the *same* id must land in
    // one row of the submitted value — the guarantee a second `useFieldArray` cannot make,
    // since it mints its own ids and stops updating after the first mutation.
    await user.type(screen.getByRole('textbox', { name: 'Name 1' }), 'x')
    const [first] = ids()
    await user.type(screen.getByRole('textbox', { name: `Note for ${first}` }), 'y')

    expect(screen.getByRole('textbox', { name: `Note for ${first}` })).toHaveAttribute(
      'name',
      'applicants.0.note',
    )
  })

  it('keeps a surviving row on its own component instance when an earlier row is removed', async () => {
    const user = userEvent.setup({ delay: null })
    render(<Applicants />)
    const [, second] = ids()

    // The concrete cost of keying per-row content by index, and the reason this hook returns
    // ids at all. Every ez-form field is *controlled*, so an index-keyed reader still renders
    // the right values after a removal — React re-uses the first row's instance and re-renders
    // it with the survivor's value, and the screen looks correct. What it silently gets wrong
    // is identity: anything a row's own component holds outside form state (a collapsed panel,
    // a scroll position, an in-flight request, a `useRef`) belongs to the removed row.
    //
    // `data-instance` is written once per mount, so it names the row a component instance was
    // *first* mounted for. Keyed by `row.id`, the survivor's instance is still its own.
    const secondInstanceBefore = screen
      .getByRole('textbox', { name: `Note for ${second}` })
      .getAttribute('data-instance')
    expect(secondInstanceBefore).toBe(second)

    await user.click(screen.getByRole('button', { name: 'Remove Applicant 1' }))

    await waitFor(() => expect(ids()).toEqual([second]))
    expect(
      screen.getByRole('textbox', { name: `Note for ${second}` }).getAttribute('data-instance'),
    ).toBe(second)
  })

  it('warns and renders nothing for a name no FieldArray in this form owns', async () => {
    const warn = vi.spyOn(console, 'warn')
    expectConsole('warn', /useFieldArrayRows\("nope"\)/)
    render(<Applicants notesName="nope" />)
    expect(ids()).toEqual([])
    expect(paths()).toEqual([])
    expect(screen.queryByRole('textbox', { name: /^Note for / })).not.toBeInTheDocument()
    // The warning is deferred past the commit's effects (see the hook), so it has not fired
    // yet at this point — waiting for it is the assertion that it fires at all.
    await waitFor(() =>
      expect(
        warn.mock.calls.some((args) => String(args[0]).includes('useFieldArrayRows("nope")')),
      ).toBe(true),
    )
  })

  it('does not warn for a real array, even reading it above the FieldArray that owns it', async () => {
    render(
      <Form schema={schema} defaultValues={twoRows} onSubmit={() => {}}>
        <Notes />
        <FieldArray name="applicants" label="Applicants" emptyRow={() => ({ name: '', note: '' })}>
          {(row) => <TextField name={row.name('name')} label={`Name ${row.index + 1}`} />}
        </FieldArray>
      </Form>,
    )
    await waitFor(() => expect(ids()).toHaveLength(2))
    // Nothing asserted here beyond the absence of output: `expectConsole`'s afterEach fails
    // the test if the hook warned, which a render-time or effect-time check would have.
  })
})

// --- The cross-step case: the array is unmounted when the reader renders. -------------------

const wizardSteps = [
  { id: 'people', label: 'People', fields: ['applicants'] },
  { id: 'notes', label: 'Notes' },
] as const satisfies WizardStepDef<Values>[]

function WizardApplicants() {
  return (
    <Form schema={schema} defaultValues={twoRows} onSubmit={() => {}}>
      <Wizard steps={wizardSteps}>
        <WizardStep id="people">
          <FieldArray
            name="applicants"
            label="Applicants"
            emptyRow={() => ({ name: '', note: '' })}
          >
            {(row) => <TextField name={row.name('name')} label={`Name ${row.index + 1}`} />}
          </FieldArray>
        </WizardStep>
        <WizardStep id="notes">
          <Notes />
        </WizardStep>
        <WizardNav />
      </Wizard>
    </Form>
  )
}

describe('useFieldArrayRows across wizard steps', () => {
  beforeEach(resetDevWarnings)

  it('latches the rows of an array whose step has unmounted', async () => {
    const user = userEvent.setup({ delay: null })
    render(<WizardApplicants />)
    // Both the array and the reader are on their own steps, so only one is ever mounted; the
    // reader does not exist yet.
    expect(screen.queryByTestId('ids')).not.toBeInTheDocument()

    // <WizardStep> renders null for every step but the current one, so the owning FieldArray
    // is gone by the time the reader on the next step renders. Without the latch this is the
    // one screen the hook exists for and it would answer `[]`.
    await user.click(screen.getByRole('button', { name: 'Next' }))

    await waitFor(() => expect(screen.getByTestId('ids')).toBeInTheDocument())
    expect(screen.queryByRole('group', { name: 'Applicants' })).not.toBeInTheDocument()
    expect(ids()).toHaveLength(2)
    expect(paths()).toEqual(['applicants.0.note', 'applicants.1.note'])
  })

  it('latches a row added on the earlier step, not the rows it first published', async () => {
    const user = userEvent.setup({ delay: null })
    render(<WizardApplicants />)

    await user.click(screen.getByRole('button', { name: 'Add' }))
    await waitFor(() =>
      expect(screen.getAllByRole('group', { name: /^Applicant \d+$/ })).toHaveLength(3),
    )
    await user.click(screen.getByRole('button', { name: 'Next' }))

    // The latch keeps the *last* published rows, not the first — a stale snapshot from mount
    // would show two.
    await waitFor(() => expect(ids()).toHaveLength(3))
  })
})
