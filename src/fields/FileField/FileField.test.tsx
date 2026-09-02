import { createTheme, ThemeProvider } from '@mui/material/styles'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { z } from 'zod'
import { Form } from '../../Form'
import { FileField, fileFieldClasses } from './FileField'
import { describeFieldContract } from '../../test/describeFieldContract'
import { expectTargetSize } from '../../test/targetSize'

const schema = z.object({ resume: z.instanceof(File).nullable() })
const multiSchema = z.object({ photos: z.array(z.instanceof(File)) })
const pdf = new File(['%PDF'], 'resume.pdf', { type: 'application/pdf' })
const png = new File(['png'], 'a.png', { type: 'image/png' })
const jpg = new File(['jpg'], 'b.jpg', { type: 'image/jpeg' })

// The button's accessible name includes the required asterisk span
// ("Resume *"), so match a label that only starts with the given text.
const fileInput = (label: string) =>
  screen.getByLabelText(new RegExp(`^${label}`)) as HTMLInputElement

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
    expect(getComputedStyle(fileList as Element).marginTop).toBe('9px')
  })
})
