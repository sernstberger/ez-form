import type { Meta, StoryObj } from '@storybook/react-vite'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { z } from 'zod'
import { Link, Outlet, RouterProvider, createMemoryRouter, useBlocker } from 'react-router'
import { Form } from './Form'
import { SubmitButton } from '../SubmitButton'
import { TextField } from '../fields/TextField'
import { useFormGuard } from '../useFormGuard'
import { ConfirmDialog } from '../ConfirmDialog'

const schema = z.object({ title: z.string().min(1, 'Title is required') })

function Guard() {
  const guard = useFormGuard(useBlocker)
  return (
    <ConfirmDialog
      open={guard.blocked}
      title="Discard changes?"
      confirmLabel="Discard"
      confirmColor="error"
      onConfirm={guard.proceed}
      onCancel={guard.cancel}
    />
  )
}

function EditPage() {
  return (
    <Form schema={schema} defaultValues={{ title: '' }} onSubmit={() => {}}>
      <Stack spacing={2} sx={{ width: 360 }}>
        <TextField name="title" label="Title" />
        <SubmitButton>Save</SubmitButton>
        <Button component={Link} to="/other">
          Go to another page
        </Button>
      </Stack>
      <Guard />
    </Form>
  )
}

function OtherPage() {
  return (
    <Stack spacing={2}>
      <Typography>Another page.</Typography>
      <Button component={Link} to="/">
        Back to the form
      </Button>
    </Stack>
  )
}

const router = createMemoryRouter([
  {
    path: '/',
    element: <Outlet />,
    children: [
      { index: true, element: <EditPage /> },
      { path: 'other', element: <OtherPage /> },
    ],
  },
])

const meta = {
  title: 'Form/useFormGuard',
  parameters: { layout: 'centered' },
  render: () => <RouterProvider router={router} />,
} satisfies Meta
export default meta

export const ReactRouter: StoryObj<typeof meta> = {}
