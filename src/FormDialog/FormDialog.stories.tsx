import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { z } from 'zod'
import { FormDialog } from './FormDialog'
import { TextField } from '../fields/TextField'
import { TextareaField } from '../fields/TextareaField'
import { Select } from '../fields/Select'
import { Checkbox } from '../fields/Checkbox'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.email('Enter a valid email'),
})
type Values = z.input<typeof schema>

// Every story drives `open` from its own opener button, so these args only
// satisfy the required props; `render` is what actually mounts the dialog.
const meta = {
  title: 'FormDialog',
  component: FormDialog,
  parameters: { layout: 'centered' },
  args: {
    open: false,
    onClose: () => {},
    title: 'Edit contact',
    schema,
    defaultValues: { name: '', email: '' },
    onSubmit: () => {},
    children: null,
  },
} satisfies Meta<typeof FormDialog<Values, z.output<typeof schema>>>
export default meta
type Story = StoryObj<typeof meta>

/**
 * The opener owns `open`; `onClose` is called once the dialog is really
 * closing — after the exit prompt, never before it.
 */
function Opener({
  children,
  label = 'Edit contact',
  ...props
}: Omit<
  React.ComponentProps<typeof FormDialog<Values, z.output<typeof schema>>>,
  'open' | 'onClose' | 'schema' | 'onSubmit' | 'children'
> & { children?: React.ReactNode; label?: string }) {
  const [open, setOpen] = useState(false)
  const [saved, setSaved] = useState<Values | null>(null)
  return (
    <Stack spacing={2} sx={{ alignItems: 'flex-start' }}>
      <Button variant="outlined" onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Typography variant="body2">
        {saved ? `Saved: ${saved.name} <${saved.email}>` : 'Nothing saved yet.'}
      </Typography>
      <FormDialog
        title={label}
        schema={schema}
        defaultValues={{ name: '', email: '' }}
        onSubmit={(values) => setSaved(values)}
        {...props}
        open={open}
        onClose={() => setOpen(false)}
      >
        {children ?? (
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField name="name" label="Name" />
            <TextField name="email" label="Email" />
          </Stack>
        )}
      </FormDialog>
    </Stack>
  )
}

/** Default Cancel / Submit actions; editing then pressing Escape asks first. */
export const Default: Story = {
  render: () => <Opener />,
}

/**
 * `description` states what the dialog is for and becomes the dialog's
 * accessible description; `confirm` adds `Form`'s own ask-before-submit on top
 * of the exit prompt.
 */
export const WithDescriptionAndSubmitConfirm: Story = {
  render: () => (
    <Opener
      description="We only use this to send the receipt."
      confirm={{ title: 'Save this contact?' }}
    />
  ),
}

/** Your own exit copy, for a dialog where "discard" is the wrong word. */
export const CustomExitConfirm: Story = {
  render: () => (
    <Opener
      label="Report a bug"
      exitConfirm={{
        title: 'Leave without reporting?',
        message: 'Your description will not be sent.',
        confirmLabel: 'Leave',
        cancelLabel: 'Keep writing',
      }}
    />
  ),
}

/** `exitConfirm={false}` for a dialog cheap enough to reopen and refill. */
export const NoExitConfirm: Story = {
  render: () => <Opener label="Quick add" exitConfirm={false} />,
}

/**
 * Long content scrolls inside `DialogContent` while the title and actions stay
 * pinned — the `<form>` passes the paper's flex layout through to make that work.
 */
export const LongContentScrolls: Story = {
  render: () => {
    const [open, setOpen] = useState(false)
    const longSchema = z.object({
      name: z.string().min(1, 'Name is required'),
      email: z.email('Enter a valid email'),
      notes: z.string(),
      street: z.string(),
      city: z.string(),
      postcode: z.string(),
      company: z.string(),
      jobTitle: z.string(),
      phone: z.string(),
      website: z.string(),
    })
    return (
      <Stack spacing={2} sx={{ alignItems: 'flex-start' }}>
        <Button variant="outlined" onClick={() => setOpen(true)}>
          Long form
        </Button>
        <FormDialog
          title="Everything about this contact"
          schema={longSchema}
          defaultValues={{
            name: '',
            email: '',
            notes: '',
            street: '',
            city: '',
            postcode: '',
            company: '',
            jobTitle: '',
            phone: '',
            website: '',
          }}
          onSubmit={() => {}}
          open={open}
          onClose={() => setOpen(false)}
        >
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField name="name" label="Name" />
            <TextField name="email" label="Email" />
            <TextField name="phone" label="Phone" />
            <TextField name="website" label="Website" />
            <TextField name="company" label="Company" />
            <TextField name="jobTitle" label="Job title" />
            <TextField name="street" label="Street" />
            <TextField name="city" label="City" />
            <TextField name="postcode" label="Postcode" />
            <TextareaField name="notes" label="Notes" />
          </Stack>
        </FormDialog>
      </Stack>
    )
  },
}

/** `actions` replaces both default buttons — order, extras, and labels are yours. */
export const CustomActions: Story = {
  render: () => {
    const [open, setOpen] = useState(false)
    return (
      <Stack spacing={2} sx={{ alignItems: 'flex-start' }}>
        <Button variant="outlined" onClick={() => setOpen(true)}>
          Invite teammate
        </Button>
        <FormDialog
          title="Invite teammate"
          schema={z.object({ email: z.email('Enter a valid email'), role: z.string() })}
          defaultValues={{ email: '', role: 'member' }}
          onSubmit={() => {}}
          open={open}
          onClose={() => setOpen(false)}
          actions={
            <>
              <Button type="button" onClick={() => setOpen(false)}>
                Not now
              </Button>
              <Button type="submit" variant="contained">
                Send invite
              </Button>
            </>
          }
        >
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField name="email" label="Email" />
            <Select
              name="role"
              label="Role"
              options={[
                { value: 'member', label: 'Member' },
                { value: 'admin', label: 'Admin' },
              ]}
            />
          </Stack>
        </FormDialog>
      </Stack>
    )
  },
}

/** `closeOnSubmit={false}` keeps a "add another" dialog open after each save. */
export const StaysOpenAfterSubmit: Story = {
  render: () => {
    const [open, setOpen] = useState(false)
    const [count, setCount] = useState(0)
    return (
      <Stack spacing={2} sx={{ alignItems: 'flex-start' }}>
        <Button variant="outlined" onClick={() => setOpen(true)}>
          Add tags
        </Button>
        <Typography variant="body2">Added {count}</Typography>
        <FormDialog
          title="Add a tag"
          schema={z.object({ tag: z.string().min(1, 'Tag is required'), another: z.boolean() })}
          defaultValues={{ tag: '', another: true }}
          closeOnSubmit={false}
          onSubmit={(_values, form) => {
            setCount((n) => n + 1)
            form.reset({ tag: '', another: true })
          }}
          open={open}
          onClose={() => setOpen(false)}
        >
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField name="tag" label="Tag" />
            <Checkbox name="another" label="Add another after saving" />
          </Stack>
        </FormDialog>
      </Stack>
    )
  },
}
