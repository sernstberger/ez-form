import { renderToString } from 'react-dom/server'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { z } from 'zod'
import { Form } from '../../Form'
import { TextField } from '../../fields/TextField'
import { TextareaField } from '../../fields/TextareaField'

const schema = z.object({ name: z.string() })

describe('QA: TextField paste abuse', () => {
  it('round-trips a single-line paste with a literal newline (fireEvent paste)', async () => {
    const onSubmit = vi.fn()
    render(
      <Form schema={schema} defaultValues={{ name: '' }} onSubmit={onSubmit}>
        <TextField name="name" label="Name" />
        <button type="submit">Go</button>
      </Form>,
    )
    const input = screen.getByRole('textbox', { name: 'Name' }) as HTMLInputElement
    input.focus()
    // Simulate a real paste: browsers insert the clipboard text (newline included, since
    // this is a single-line <input> and newlines are not stripped by the browser itself)
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
    setter.call(input, 'line one\nline two')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await userEvent.click(screen.getByRole('button', { name: 'Go' }))
    console.log('newline paste submitted value:', JSON.stringify(onSubmit.mock.calls[0]?.[0]))
  })

  it('round-trips RTL mark + emoji + 10k chars', async () => {
    const onSubmit = vi.fn()
    render(
      <Form schema={schema} defaultValues={{ name: '' }} onSubmit={onSubmit}>
        <TextField name="name" label="Name" />
        <button type="submit">Go</button>
      </Form>,
    )
    const input = screen.getByRole('textbox', { name: 'Name' }) as HTMLInputElement
    const big = '‏' + '🎉'.repeat(50) + 'a'.repeat(9900)
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
    setter.call(input, big)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await userEvent.click(screen.getByRole('button', { name: 'Go' }))
    const got = onSubmit.mock.calls[0]?.[0]?.name as string
    console.log('10k+RTL+emoji length in:', big.length, 'out:', got?.length, 'equal:', got === big)
  })

  it('leading/trailing whitespace is preserved verbatim (no silent trim)', async () => {
    const onSubmit = vi.fn()
    render(
      <Form schema={schema} defaultValues={{ name: '' }} onSubmit={onSubmit}>
        <TextField name="name" label="Name" />
        <button type="submit">Go</button>
      </Form>,
    )
    const input = screen.getByRole('textbox', { name: 'Name' }) as HTMLInputElement
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
    setter.call(input, '  padded  ')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await userEvent.click(screen.getByRole('button', { name: 'Go' }))
    console.log('whitespace submit:', JSON.stringify(onSubmit.mock.calls[0]?.[0]))
  })
})

describe('QA: TextareaField maxLength + counter vs newline abuse', () => {
  it('counter counts a pasted block bigger than maxLength; over-limit reported once, not by color alone', async () => {
    const onSubmit = vi.fn()
    const schema2 = z.object({ bio: z.string().max(10) })
    render(
      <Form schema={schema2} defaultValues={{ bio: '' }} onSubmit={onSubmit}>
        <TextareaField name="bio" label="Bio" maxLength={10} />
        <button type="submit">Go</button>
      </Form>,
    )
    const textarea = screen.getByRole('textbox', { name: 'Bio' }) as HTMLTextAreaElement
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value',
    )!.set!
    setter.call(textarea, 'this is way more than ten characters')
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    await userEvent.click(screen.getByRole('button', { name: 'Go' }))
    console.log(
      'helper text after over-limit paste:',
      document.querySelector('.MuiFormHelperText-root')?.textContent,
    )
  })
})

describe('QA: SSR hygiene', () => {
  it('TextField renders to string inside Form with no throw', () => {
    expect(() =>
      renderToString(
        <Form schema={schema} defaultValues={{ name: '' }} onSubmit={() => {}}>
          <TextField name="name" label="Name" />
        </Form>,
      ),
    ).not.toThrow()
  })
  it('TextareaField renders to string inside Form with no throw', () => {
    const schema2 = z.object({ bio: z.string() })
    expect(() =>
      renderToString(
        <Form schema={schema2} defaultValues={{ bio: '' }} onSubmit={() => {}}>
          <TextareaField name="bio" label="Bio" maxLength={10} />
        </Form>,
      ),
    ).not.toThrow()
  })
})
