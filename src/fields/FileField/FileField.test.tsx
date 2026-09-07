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
  // Label-less and named by `aria-label` alone, which is the shape row 1 is about — and
  // which only became expressible once #118 made `label` optional. It used to pass a visible
  // `label`, where the name would have been answered by the label element whether or not the
  // ARIA attribute reached the control.
  renderNamed: (name) => <FileField name="resume" aria-label={name} />,
  render: (props) => <FileField name="resume" label="Resume" {...props} />,
  // `<input type="file">` has no role, so the name is read through the label query. Narrowed
  // to the input by `selector`: under an ARIA-only name the picker Button carries the same
  // name (it is the visible affordance and would otherwise be an unnamed control — see
  // `pickerNameA11y`), so an unqualified query matches two elements. The input is the one
  // this line is about.
  findNamed: (name) =>
    screen.getByLabelText(new RegExp(`^${name}`), { selector: 'input[type="file"]' }),
  renderDescribed: (id, props) => (
    <FileField name="resume" label="Resume" aria-describedby={id} {...props} />
  ),
  getControl: () => fileInput('Resume'),
  expectSubmitted: { resume: pdf },
  exempt: {
    enterSubmitsOnce:
      'HTML lists the implicit submission sources and `input[type=file]` is not one of ' +
      'them — Enter opens the file picker instead. Baseline: a bare `<input type="file">` ' +
      'in a plain `<form onSubmit>` in this same jsdom also reports zero submits (#122). ' +
      'The visible affordance is a `button[type=button]`, which has no implicit ' +
      'submission either.',
  },
  themeDefault: {
    name: 'EzFileField',
    defaultProps: { helperText: 'From the theme' },
    expect: () => expect(screen.getByText('From the theme')).toBeInTheDocument(),
  },
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

  // #118. `FileFieldProps` used to be a closed object literal, so none of these compiled at
  // all; it now extends `FormControlProps`, and the naming/describing attributes are routed
  // to the `<input type="file">` rather than left on the `FormControl` wrapper.
  describe('consumer ARIA (#118)', () => {
    it('joins a consumer aria-describedby with the error on the file input', async () => {
      const user = userEvent.setup()
      render(
        <Form schema={schema} defaultValues={{ resume: null }} onSubmit={() => {}}>
          <span id="hint">PDF only, under 5 MB</span>
          <FileField name="resume" label="Resume" aria-describedby="hint" required />
          <button type="submit">Go</button>
        </Form>,
      )
      // Present from the first render, not only after an error.
      expect(fileInput('Resume')).toHaveAccessibleDescription('PDF only, under 5 MB')
      await user.click(screen.getByRole('button', { name: 'Go' }))
      await screen.findByRole('alert')
      // Both, in that order: the consumer wrote theirs first.
      expect(fileInput('Resume')).toHaveAccessibleDescription(
        'PDF only, under 5 MB Resume is required.',
      )
    })

    it('aria-label names the file input with no visible label', () => {
      render(
        <Form schema={schema} defaultValues={{ resume: null }} onSubmit={() => {}}>
          <FileField name="resume" aria-label="Resume" />
        </Form>,
      )
      const input = screen.getByLabelText('Resume', { selector: 'input[type="file"]' })
      expect(input).toHaveAttribute('type', 'file')
      // The picker is the visible affordance and the input's <label>; with no text of its
      // own it would be an unnamed control, so it carries the name too.
      expect(screen.getByLabelText('Resume', { selector: 'label' })).toBeInTheDocument()
    })

    it('aria-labelledby names the file input with no visible label', () => {
      render(
        <Form schema={schema} defaultValues={{ resume: null }} onSubmit={() => {}}>
          <span id="cv-label">Curriculum vitae</span>
          <FileField name="resume" aria-labelledby="cv-label" />
        </Form>,
      )
      expect(
        screen.getByLabelText('Curriculum vitae', { selector: 'input[type="file"]' }),
      ).toBeInTheDocument()
    })

    it('has no axe violations named by ARIA alone', async () => {
      const { container } = render(
        <Form schema={schema} defaultValues={{ resume: null }} onSubmit={() => {}}>
          <FileField name="resume" aria-label="Resume" dropzone />
        </Form>,
      )
      await expectNoA11yViolations(container)
    })

    // The widened type is `FormControlProps`, so the root now takes the FormControl props it
    // always rendered but could never be given — and a consumer `className` composes with
    // the slot class rather than replacing it.
    it('forwards FormControl props and a className to the root', () => {
      const { container } = render(
        <Form schema={schema} defaultValues={{ resume: null }} onSubmit={() => {}}>
          <FileField name="resume" label="Resume" fullWidth className="mine" id="resume-field" />
        </Form>,
      )
      const root = container.querySelector(`.${fileFieldClasses.root}`)!
      expect(root).toHaveClass('mine')
      expect(root).toHaveClass('MuiFormControl-fullWidth')
      expect(root).toHaveAttribute('id', 'resume-field')
    })
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

  // The root renders through `styled(FormControl, { name: 'EzFileField', slot: 'Root' })`,
  // not a bare `FormControl` carrying the class — a class name alone generates no
  // `styleOverrides` CSS at all, so `getComputedStyle` is the assertion that matters (#121).
  it('is themeable: styleOverrides.root applies to the field root', () => {
    const theme = createTheme({
      components: { EzFileField: { styleOverrides: { root: { letterSpacing: '5px' } } } },
    })
    const { container } = render(
      <ThemeProvider theme={theme}>
        <Form schema={schema} defaultValues={{ resume: null }} onSubmit={() => {}}>
          <FileField name="resume" label="Resume" />
        </Form>
      </ThemeProvider>,
    )
    const root = container.querySelector(`.${fileFieldClasses.root}`)!
    expect(root).toBeInTheDocument()
    expect(getComputedStyle(root).letterSpacing).toBe('5px')
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

  // `paddingTop`, deliberately not `letterSpacing`: the drop text sits inside the drop zone,
  // so an *inheriting* property set anywhere above it shows up here whether or not this slot
  // generates any CSS of its own — which is how the inert slot passed as working before #121.
  // A non-inheriting property can only arrive from this element's own rule.
  it('is themeable: styleOverrides.dropText applies to the drop-zone instruction', () => {
    const theme = createTheme({
      components: { EzFileField: { styleOverrides: { dropText: { paddingTop: '7px' } } } },
    })
    render(
      <ThemeProvider theme={theme}>
        <Form schema={schema} defaultValues={{ resume: null }} onSubmit={() => {}}>
          <FileField name="resume" label="Resume" dropzone />
        </Form>
      </ThemeProvider>,
    )
    const text = screen.getByText('Drag files here, or')
    expect(text).toHaveClass(fileFieldClasses.dropText)
    expect(getComputedStyle(text).paddingTop).toBe('7px')
  })

  // `dragActive` is the one `EzFileField` key with no `styled()` slot of its own: it names a
  // *state* of the drop zone, not a second element, so it rides `DropZone`'s
  // `overridesResolver` instead. #121's audit listed it as a pass, but that was measured with
  // `borderColor`/`backgroundColor` — the two properties `DropZone`'s own hard-coded
  // `&.dragActive` nesting already sets, so the measurement could not tell a theme override
  // from the component's own default. Measured with a property the component never sets, it
  // produced no CSS at all until the resolver was added. Hence `letterSpacing` here.
  it('is themeable: styleOverrides.dragActive applies while a drag is over the zone', () => {
    const theme = createTheme({
      components: { EzFileField: { styleOverrides: { dragActive: { letterSpacing: '3px' } } } },
    })
    render(
      <ThemeProvider theme={theme}>
        <Form schema={schema} defaultValues={{ resume: null }} onSubmit={() => {}}>
          <FileField name="resume" label="Resume" dropzone />
        </Form>
      </ThemeProvider>,
    )
    expect(getComputedStyle(dropZone()).letterSpacing).not.toBe('3px')
    fireEvent.dragOver(dropZone())
    expect(getComputedStyle(dropZone()).letterSpacing).toBe('3px')
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
