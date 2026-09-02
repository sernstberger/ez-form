import { createTheme, ThemeProvider } from '@mui/material/styles'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { z } from 'zod'
import { Form } from '../../Form'
import { FileField, fileFieldClasses } from './FileField'
import { describeFieldContract } from '../../test/describeFieldContract'
import { expectTargetSize } from '../../test/targetSize'
import { expectNoA11yViolations } from '../../test/axe'

const schema = z.object({ resume: z.instanceof(File).nullable() })
const multiSchema = z.object({ photos: z.array(z.instanceof(File)) })
const pdf = new File(['%PDF'], 'resume.pdf', { type: 'application/pdf' })
const png = new File(['png'], 'a.png', { type: 'image/png' })
const jpg = new File(['jpg'], 'b.jpg', { type: 'image/jpeg' })

// The button's accessible name includes the required asterisk span
// ("Resume *"), so match a label that only starts with the given text.
const fileInput = (label: string) => screen.getByLabelText(new RegExp(`^${label}`))

describeFieldContract({
  componentName: 'FileField',
  label: 'Resume',
  schema,
  defaultValues: { resume: null },
  render: (props) => <FileField name="resume" label="Resume" {...props} />,
  getControl: () => fileInput('Resume'),
  interact: (user) => user.upload(fileInput('Resume'), pdf),
})

describe('FileField', () => {
  it('submits the chosen File and lists it', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <Form schema={schema} defaultValues={{ resume: null }} onSubmit={onSubmit}>
        <FileField name="resume" label="Resume" accept=".pdf" />
        <button type="submit">Go</button>
      </Form>,
    )
    expect(fileInput('Resume')).toHaveAttribute('accept', '.pdf')
    await user.upload(fileInput('Resume'), pdf)
    expect(screen.getByText('resume.pdf')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ resume: pdf }, expect.anything())
  })

  it('meets 24×24 target size: the chip delete icon', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={{ resume: null }} onSubmit={() => {}}>
        <FileField name="resume" label="Resume" />
      </Form>,
    )
    // The picker button itself is a text Button with a startIcon — its compliance
    // is documented by reasoning in the audit report, not asserted here (see
    // expectTargetSize's doc comment). Only the icon-only delete icon is checked.
    await user.upload(fileInput('Resume'), pdf)
    expectTargetSize(screen.getByRole('button', { name: 'Remove resume.pdf' }))
  })

  it('keeps the previous file when the dialog is cancelled', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <Form schema={schema} defaultValues={{ resume: null }} onSubmit={onSubmit}>
        <FileField name="resume" label="Resume" />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.upload(fileInput('Resume'), pdf)
    // A cancelled dialog fires change with no files.
    fireEvent.change(fileInput('Resume'), { target: { files: [] } })
    expect(screen.getByText('resume.pdf')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ resume: pdf }, expect.anything())
  })

  it('removes a file with its chip and clears to null', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <Form schema={schema} defaultValues={{ resume: pdf }} onSubmit={onSubmit}>
        <FileField name="resume" label="Resume" />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.click(screen.getByRole('button', { name: 'Remove resume.pdf' }))
    expect(screen.queryByText('resume.pdf')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ resume: null }, expect.anything())
  })

  it('multiple: submits an array, and chip delete removes one', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    const onChange = vi.fn()
    render(
      <Form schema={multiSchema} defaultValues={{ photos: [] }} onSubmit={onSubmit}>
        <FileField name="photos" label="Photos" multiple onChange={onChange} />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.upload(fileInput('Photos'), [png, jpg])
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenLastCalledWith({ photos: [png, jpg] }, expect.anything())
    await user.click(screen.getByRole('button', { name: 'Remove a.png' }))
    // The consumer hears the delete too, with the reduced array.
    expect(onChange).toHaveBeenLastCalledWith(expect.anything(), [jpg])
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenLastCalledWith({ photos: [jpg] }, expect.anything())
  })

  it('multiple: a second pick appends rather than replacing', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <Form schema={multiSchema} defaultValues={{ photos: [] }} onSubmit={onSubmit}>
        <FileField name="photos" label="Photos" multiple />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.upload(fileInput('Photos'), [png])
    await user.upload(fileInput('Photos'), [jpg])
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ photos: [png, jpg] }, expect.anything())
  })

  it('single: a second pick still replaces the one file', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <Form schema={schema} defaultValues={{ resume: null }} onSubmit={onSubmit}>
        <FileField name="resume" label="Resume" />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.upload(fileInput('Resume'), pdf)
    await user.upload(fileInput('Resume'), png)
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ resume: png }, expect.anything())
  })

  it('required fails on null / [] with the label message', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={multiSchema} defaultValues={{ photos: [] }} onSubmit={() => {}}>
        <FileField name="photos" label="Photos" multiple required />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Photos is required.')
  })

  it('fires change again when the same file is picked twice', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <Form schema={schema} defaultValues={{ resume: null }} onSubmit={() => {}}>
        <FileField name="resume" label="Resume" onChange={onChange} />
      </Form>,
    )
    await user.upload(fileInput('Resume'), pdf)
    await user.upload(fileInput('Resume'), pdf)
    expect(onChange).toHaveBeenCalledTimes(2)
  })

  it('is themeable: defaultProps.slotProps.button applies to the picker Button', () => {
    const theme = createTheme({
      components: {
        EzFileField: {
          defaultProps: { slotProps: { button: { variant: 'contained' } } },
        },
      },
    })
    render(
      <ThemeProvider theme={theme}>
        <Form schema={schema} defaultValues={{ resume: null }} onSubmit={() => {}}>
          <FileField name="resume" label="Resume" />
        </Form>
      </ThemeProvider>,
    )
    // The picker renders as a native <label> (see FileField's `role={undefined}`
    // comment), which testing-library gives no accessible role — query by the
    // Button's own class instead of screen.getByRole.
    const button = screen.getByText('Resume').closest('label') as HTMLElement
    expect(button).toHaveClass('MuiButton-contained')
  })

  it('defaults the picker Button to outlined when no theme is provided', () => {
    render(
      <Form schema={schema} defaultValues={{ resume: null }} onSubmit={() => {}}>
        <FileField name="resume" label="Resume" />
      </Form>,
    )
    const button = screen.getByText('Resume').closest('label') as HTMLElement
    expect(button).toHaveClass('MuiButton-outlined')
  })

  it('a per-instance slotProps.button still wins over the theme default', () => {
    const theme = createTheme({
      components: {
        EzFileField: {
          defaultProps: { slotProps: { button: { variant: 'contained' } } },
        },
      },
    })
    render(
      <ThemeProvider theme={theme}>
        <Form schema={schema} defaultValues={{ resume: null }} onSubmit={() => {}}>
          <FileField name="resume" label="Resume" slotProps={{ button: { variant: 'text' } }} />
        </Form>
      </ThemeProvider>,
    )
    const button = screen.getByText('Resume').closest('label') as HTMLElement
    expect(button).toHaveClass('MuiButton-text')
  })

  it('is themeable: styleOverrides.fileList applies', async () => {
    const user = userEvent.setup()
    const theme = createTheme({
      components: {
        EzFileField: {
          styleOverrides: {
            fileList: { marginTop: '9px' },
          },
        },
      },
    })
    render(
      <ThemeProvider theme={theme}>
        <Form schema={schema} defaultValues={{ resume: null }} onSubmit={() => {}}>
          <FileField name="resume" label="Resume" />
        </Form>
      </ThemeProvider>,
    )
    await user.upload(fileInput('Resume'), pdf)
    const chip = screen.getByText('resume.pdf')
    const fileList = chip.closest(`.${fileFieldClasses.fileList}`)
    expect(fileList).not.toBeNull()
    expect(getComputedStyle(fileList!).marginTop).toBe('9px')
  })

  it('Form requiredIndicator="optional": required stays required with no asterisk in the label', () => {
    render(
      <Form
        schema={schema}
        defaultValues={{ resume: null }}
        onSubmit={() => {}}
        requiredIndicator="optional"
      >
        <FileField name="resume" label="Resume" required />
      </Form>,
    )
    const input = screen.getByLabelText('Resume')
    expect(input).toBeRequired()
  })

  it('Form requiredIndicator="optional": not-required gets the optional suffix in its label', () => {
    render(
      <Form
        schema={schema}
        defaultValues={{ resume: null }}
        onSubmit={() => {}}
        requiredIndicator="optional"
      >
        <FileField name="resume" label="Resume" />
      </Form>,
    )
    expect(screen.getByLabelText('Resume (optional)')).toBeInTheDocument()
  })
})

// `fireEvent.drop` needs a DataTransfer; jsdom has no constructor for one, and
// only `files` is read here.
const dataTransfer = (files: File[]) => ({ files, items: [], types: ['Files'] })

// A widening cast (Element -> HTMLElement), not a non-null one.
// eslint-disable-next-line @typescript-eslint/non-nullable-type-assertion-style
const dropZone = () => document.querySelector(`.${fileFieldClasses.dropZone}`) as HTMLElement

describe('FileField dropzone', () => {
  it('is off by default: no drop zone, just the button', () => {
    render(
      <Form schema={schema} defaultValues={{ resume: null }} onSubmit={() => {}}>
        <FileField name="resume" label="Resume" />
      </Form>,
    )
    expect(dropZone()).toBeNull()
  })

  it('drop adds the file and submits it', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <Form schema={schema} defaultValues={{ resume: null }} onSubmit={onSubmit}>
        <FileField name="resume" label="Resume" dropzone />
        <button type="submit">Go</button>
      </Form>,
    )
    fireEvent.drop(dropZone(), { dataTransfer: dataTransfer([pdf]) })
    expect(await screen.findByText('resume.pdf')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ resume: pdf }, expect.anything())
  })

  it('multiple: a drop appends to what is already there', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <Form schema={multiSchema} defaultValues={{ photos: [] }} onSubmit={onSubmit}>
        <FileField name="photos" label="Photos" multiple dropzone />
        <button type="submit">Go</button>
      </Form>,
    )
    fireEvent.drop(dropZone(), { dataTransfer: dataTransfer([png]) })
    fireEvent.drop(dropZone(), { dataTransfer: dataTransfer([jpg]) })
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ photos: [png, jpg] }, expect.anything())
  })

  it('single: a multi-file drop keeps only the first', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <Form schema={schema} defaultValues={{ resume: null }} onSubmit={onSubmit}>
        <FileField name="resume" label="Resume" dropzone />
        <button type="submit">Go</button>
      </Form>,
    )
    fireEvent.drop(dropZone(), { dataTransfer: dataTransfer([pdf, png]) })
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ resume: pdf }, expect.anything())
  })

  it('dragover toggles the dragActive class, dragleave removes it', () => {
    render(
      <Form schema={schema} defaultValues={{ resume: null }} onSubmit={() => {}}>
        <FileField name="resume" label="Resume" dropzone />
      </Form>,
    )
    expect(dropZone()).not.toHaveClass(fileFieldClasses.dragActive)
    fireEvent.dragOver(dropZone())
    expect(dropZone()).toHaveClass(fileFieldClasses.dragActive)
    fireEvent.dragLeave(dropZone())
    expect(dropZone()).not.toHaveClass(fileFieldClasses.dragActive)
  })

  it('a drop while disabled changes nothing', () => {
    render(
      <Form schema={schema} defaultValues={{ resume: null }} onSubmit={() => {}}>
        <FileField name="resume" label="Resume" dropzone disabled />
      </Form>,
    )
    fireEvent.dragOver(dropZone())
    expect(dropZone()).not.toHaveClass(fileFieldClasses.dragActive)
    fireEvent.drop(dropZone(), { dataTransfer: dataTransfer([pdf]) })
    expect(screen.queryByText('resume.pdf')).not.toBeInTheDocument()
  })

  it('adds no tab stop and no role: the button is still the keyboard path', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={{ resume: null }} onSubmit={() => {}}>
        <FileField name="resume" label="Resume" dropzone />
      </Form>,
    )
    expect(dropZone()).not.toHaveAttribute('tabindex')
    expect(dropZone()).not.toHaveAttribute('role')
    // Tabbing through the field reaches only what the button path already had
    // (MUI's Button-as-label, then its hidden input) — the zone never takes focus.
    const zone = dropZone()
    const picker = screen.getByText('Resume').closest('label') as HTMLElement
    await user.tab()
    expect(picker).toHaveFocus()
    await user.tab()
    expect(fileInput('Resume')).toHaveFocus()
    await user.tab()
    expect(zone).not.toHaveFocus()
  })

  it('shows dropText as visible text, overridable by prop', () => {
    const { rerender } = render(
      <Form schema={schema} defaultValues={{ resume: null }} onSubmit={() => {}}>
        <FileField name="resume" label="Resume" dropzone />
      </Form>,
    )
    expect(screen.getByText('Drag files here, or')).toBeInTheDocument()
    rerender(
      <Form schema={schema} defaultValues={{ resume: null }} onSubmit={() => {}}>
        <FileField name="resume" label="Resume" dropzone dropText="Arrastra archivos aquí, o" />
      </Form>,
    )
    expect(screen.getByText('Arrastra archivos aquí, o')).toBeInTheDocument()
  })

  it('is themeable: styleOverrides.dropZone applies', () => {
    const theme = createTheme({
      components: { EzFileField: { styleOverrides: { dropZone: { padding: '7px' } } } },
    })
    render(
      <ThemeProvider theme={theme}>
        <Form schema={schema} defaultValues={{ resume: null }} onSubmit={() => {}}>
          <FileField name="resume" label="Resume" dropzone />
        </Form>
      </ThemeProvider>,
    )
    expect(getComputedStyle(dropZone()).padding).toBe('7px')
  })

  it('has no axe violations with the zone rendered', async () => {
    const { container } = render(
      <Form schema={schema} defaultValues={{ resume: null }} onSubmit={() => {}}>
        <FileField name="resume" label="Resume" dropzone required helperText="PDF only" />
      </Form>,
    )
    fireEvent.drop(dropZone(), { dataTransfer: dataTransfer([pdf]) })
    expect(await screen.findByText('resume.pdf')).toBeInTheDocument()
    await expectNoA11yViolations(container)
  })
})

describe('FileField limits', () => {
  it('maxSize: rejects, shows the humanized message, leaves the value alone', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    const big = new File(['x'.repeat(2000)], 'big.pdf', { type: 'application/pdf' })
    render(
      <Form schema={schema} defaultValues={{ resume: null }} onSubmit={onSubmit}>
        <FileField name="resume" label="Resume" maxSize={1500} />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.upload(fileInput('Resume'), big)
    expect(await screen.findByRole('alert')).toHaveTextContent('File is larger than 1.5 kB')
    expect(screen.queryByText('big.pdf')).not.toBeInTheDocument()
    // The same rule fails the submit, so a rejected pick cannot slip through.
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('maxSizeMessage is a prop', async () => {
    const user = userEvent.setup()
    const big = new File(['x'.repeat(2000)], 'big.pdf', { type: 'application/pdf' })
    render(
      <Form schema={schema} defaultValues={{ resume: null }} onSubmit={() => {}}>
        <FileField name="resume" label="Resume" maxSize={1000} maxSizeMessage="Máximo {size}" />
      </Form>,
    )
    await user.upload(fileInput('Resume'), big)
    expect(await screen.findByRole('alert')).toHaveTextContent('Máximo 1 kB')
  })

  it('accept: rejects a file whose type is outside the list', async () => {
    // `applyAccept: false` makes user-event skip its own `accept` filtering, so
    // the file reaches the component the way an overridden dialog filter (or a
    // drop, which is never filtered) delivers it.
    const user = userEvent.setup({ applyAccept: false })
    render(
      <Form schema={schema} defaultValues={{ resume: null }} onSubmit={() => {}}>
        <FileField name="resume" label="Resume" accept="application/pdf" />
      </Form>,
    )
    await user.upload(fileInput('Resume'), png)
    expect(await screen.findByRole('alert')).toHaveTextContent('File type not accepted')
    expect(screen.queryByText('a.png')).not.toBeInTheDocument()
  })

  it('accept: an extension token matches by suffix and a wildcard by prefix', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={multiSchema} defaultValues={{ photos: [] }} onSubmit={() => {}}>
        <FileField name="photos" label="Photos" multiple accept=".pdf,image/*" />
      </Form>,
    )
    await user.upload(fileInput('Photos'), [pdf, png])
    expect(await screen.findByText('resume.pdf')).toBeInTheDocument()
    expect(screen.getByText('a.png')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('acceptMessage is a prop', async () => {
    const user = userEvent.setup({ applyAccept: false })
    render(
      <Form schema={schema} defaultValues={{ resume: null }} onSubmit={() => {}}>
        <FileField name="resume" label="Resume" accept=".pdf" acceptMessage="Solo PDF" />
      </Form>,
    )
    await user.upload(fileInput('Resume'), png)
    expect(await screen.findByRole('alert')).toHaveTextContent('Solo PDF')
  })

  it('maxFiles: counts what is already stored and rejects the whole drop', async () => {
    render(
      <Form schema={multiSchema} defaultValues={{ photos: [png] }} onSubmit={() => {}}>
        <FileField name="photos" label="Photos" multiple dropzone maxFiles={1} />
      </Form>,
    )
    fireEvent.drop(dropZone(), { dataTransfer: dataTransfer([jpg]) })
    expect(await screen.findByRole('alert')).toHaveTextContent('Choose at most 1 files')
    expect(screen.queryByText('b.jpg')).not.toBeInTheDocument()
    expect(screen.getByText('a.png')).toBeInTheDocument()
  })

  it('maxFilesMessage is a prop', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={multiSchema} defaultValues={{ photos: [] }} onSubmit={() => {}}>
        <FileField
          name="photos"
          label="Photos"
          multiple
          maxFiles={1}
          maxFilesMessage="Como máximo {count}"
        />
      </Form>,
    )
    await user.upload(fileInput('Photos'), [png, jpg])
    expect(await screen.findByRole('alert')).toHaveTextContent('Como máximo 1')
  })

  it('a later accepted pick clears the rejection', async () => {
    const user = userEvent.setup({ applyAccept: false })
    const onSubmit = vi.fn()
    render(
      <Form schema={schema} defaultValues={{ resume: null }} onSubmit={onSubmit}>
        <FileField name="resume" label="Resume" accept=".pdf" />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.upload(fileInput('Resume'), png)
    expect(await screen.findByRole('alert')).toHaveTextContent('File type not accepted')
    await user.upload(fileInput('Resume'), pdf)
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ resume: pdf }, expect.anything())
  })

  it('a chip delete back under maxFiles clears the alert and unblocks submit', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <Form schema={multiSchema} defaultValues={{ photos: [png] }} onSubmit={onSubmit}>
        <FileField name="photos" label="Photos" multiple dropzone maxFiles={1} />
        <button type="submit">Go</button>
      </Form>,
    )
    fireEvent.drop(dropZone(), { dataTransfer: dataTransfer([jpg]) })
    expect(await screen.findByRole('alert')).toHaveTextContent('Choose at most 1 files')
    // Removing a file is exactly how a user answers a maxFiles rejection: the
    // error must go with it, not strand the field permanently unsubmittable.
    await user.click(screen.getByRole('button', { name: 'Remove a.png' }))
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ photos: [] }, expect.anything())
  })

  it('an accepted pick after a rejection removes the alert from the DOM', async () => {
    const user = userEvent.setup({ applyAccept: false })
    render(
      <Form schema={schema} defaultValues={{ resume: null }} onSubmit={() => {}}>
        <FileField name="resume" label="Resume" accept=".pdf" />
      </Form>,
    )
    await user.upload(fileInput('Resume'), png)
    expect(await screen.findByRole('alert')).toHaveTextContent('File type not accepted')
    await user.upload(fileInput('Resume'), pdf)
    // The chip appears *and* the stale message goes — not one without the other.
    expect(await screen.findByText('resume.pdf')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  })

  it('an accepted drop after a rejection removes the alert from the DOM', async () => {
    render(
      <Form schema={multiSchema} defaultValues={{ photos: [] }} onSubmit={() => {}}>
        <FileField name="photos" label="Photos" multiple dropzone maxSize={10} />
      </Form>,
    )
    const big = new File(['x'.repeat(50)], 'big.png', { type: 'image/png' })
    fireEvent.drop(dropZone(), { dataTransfer: dataTransfer([big]) })
    expect(await screen.findByRole('alert')).toHaveTextContent('File is larger than 10 B')
    fireEvent.drop(dropZone(), { dataTransfer: dataTransfer([png]) })
    expect(await screen.findByText('a.png')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  })

  it('rejected, accepted, rejected again: the alert tracks the latest pick', async () => {
    const user = userEvent.setup({ applyAccept: false })
    const onSubmit = vi.fn()
    render(
      <Form schema={multiSchema} defaultValues={{ photos: [] }} onSubmit={onSubmit}>
        <FileField name="photos" label="Photos" multiple accept="image/*" />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.upload(fileInput('Photos'), pdf)
    expect(await screen.findByRole('alert')).toHaveTextContent('File type not accepted')
    await user.upload(fileInput('Photos'), png)
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
    await user.upload(fileInput('Photos'), pdf)
    expect(await screen.findByRole('alert')).toHaveTextContent('File type not accepted')
    // Still blocked, and the accepted file from the middle step survived.
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText('a.png')).toBeInTheDocument()
  })

  it('a consumer validate still runs alongside the built-in rule', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={schema} defaultValues={{ resume: null }} onSubmit={() => {}}>
        <FileField
          name="resume"
          label="Resume"
          validate={(v) => (v instanceof File && v.name.startsWith('resume')) || 'Name it resume.*'}
        />
        <button type="submit">Go</button>
      </Form>,
    )
    await user.upload(fileInput('Resume'), png)
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Name it resume.*')
  })
})

describe('FileField progress hooks', () => {
  it('renderFile replaces the chip', async () => {
    const user = userEvent.setup()
    render(
      <Form schema={multiSchema} defaultValues={{ photos: [] }} onSubmit={() => {}}>
        <FileField
          name="photos"
          label="Photos"
          multiple
          renderFile={(file, index) => <span>{`${index}: ${file.name}`}</span>}
        />
      </Form>,
    )
    await user.upload(fileInput('Photos'), [png, jpg])
    expect(await screen.findByText('0: a.png')).toBeInTheDocument()
    expect(screen.getByText('1: b.jpg')).toBeInTheDocument()
    // The default chip (and so its delete button) is gone.
    expect(screen.queryByRole('button', { name: 'Remove a.png' })).not.toBeInTheDocument()
  })

  it('onFilesAdded fires once per pick with only the accepted files', async () => {
    const user = userEvent.setup()
    const onFilesAdded = vi.fn()
    render(
      <Form schema={multiSchema} defaultValues={{ photos: [] }} onSubmit={() => {}}>
        <FileField
          name="photos"
          label="Photos"
          multiple
          dropzone
          accept="image/*"
          onFilesAdded={onFilesAdded}
        />
      </Form>,
    )
    await user.upload(fileInput('Photos'), [png])
    expect(onFilesAdded).toHaveBeenCalledTimes(1)
    // Just the new files, not the whole value.
    expect(onFilesAdded).toHaveBeenLastCalledWith([png])
    fireEvent.drop(dropZone(), { dataTransfer: dataTransfer([jpg]) })
    expect(onFilesAdded).toHaveBeenLastCalledWith([jpg])
    // A rejected pick adds nothing and tells no one.
    fireEvent.drop(dropZone(), { dataTransfer: dataTransfer([pdf]) })
    // Awaited because setting the rejection re-runs the field's `accepted` rule, which
    // updates the form asynchronously; the alert appearing is that update landing.
    expect(await screen.findByRole('alert')).toHaveTextContent('File type not accepted')
    expect(onFilesAdded).toHaveBeenCalledTimes(2)
  })
})

describe('FileField limits: opt-in cost', () => {
  it('registers no rejection rule without a limit prop, so nothing blocks a submit', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <Form schema={multiSchema} defaultValues={{ photos: [] }} onSubmit={onSubmit}>
        {/* No accept/maxSize/maxFiles: the built-in `validate` entry is not
            registered at all, so a field with no limits costs exactly what it
            did before limits existed (a regression this locks in). */}
        <FileField name="photos" label="Photos" multiple dropzone />
        <button type="submit">Go</button>
      </Form>,
    )
    fireEvent.drop(dropZone(), { dataTransfer: dataTransfer([pdf, png]) })
    expect(await screen.findByText('resume.pdf')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(onSubmit).toHaveBeenCalledWith({ photos: [pdf, png] }, expect.anything())
  })
})
