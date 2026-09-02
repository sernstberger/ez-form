import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import LinearProgress from '@mui/material/LinearProgress'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { z } from 'zod'
import type { FormParameters } from '../../../.storybook/preview'
import { FileField, type FileFieldProps } from './FileField'

const schema = z.object({ resume: z.instanceof(File).nullable() })

const meta = {
  title: 'Fields/FileField',
  component: FileField,
  args: { name: 'resume', label: 'Upload resume', accept: '.pdf' },
  parameters: { form: { schema, defaultValues: { resume: null } } } satisfies FormParameters,
} satisfies Meta<typeof FileField>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Required: Story = { args: { required: true, helperText: 'PDF only' } }
export const Multiple: Story = {
  args: { name: 'photos', label: 'Add photos', accept: 'image/*', multiple: true },
  parameters: {
    form: {
      schema: z.object({ photos: z.array(z.instanceof(File)) }),
      defaultValues: { photos: [] },
    },
  } satisfies FormParameters,
}
export const Contained: Story = { args: { slotProps: { button: { variant: 'contained' } } } }
export const Disabled: Story = { args: { disabled: true } }
export const Error: Story = {
  args: { required: true },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Submit' }))
    await canvas.findByText('Upload resume is required.')
  },
}

export const DropZone: Story = {
  args: { label: 'Choose file', dropzone: true },
}

export const WithLimits: Story = {
  args: {
    name: 'photos',
    label: 'Choose photos',
    accept: 'image/*',
    multiple: true,
    dropzone: true,
    maxFiles: 3,
    maxSize: 2_000_000,
    helperText: 'Up to 3 images, 2 MB each',
  },
  parameters: {
    form: {
      schema: z.object({ photos: z.array(z.instanceof(File)) }),
      defaultValues: { photos: [] },
    },
  } satisfies FormParameters,
}

/**
 * `renderFile` replaces the default chip, so a consumer can show whatever
 * per-file upload UI it wants — here a `LinearProgress` driven by fake
 * progress that `onFilesAdded` starts. The library uploads nothing itself.
 */
export const WithProgress: Story = {
  args: {
    name: 'photos',
    label: 'Choose photos',
    accept: 'image/*',
    multiple: true,
    dropzone: true,
  },
  parameters: {
    form: {
      schema: z.object({ photos: z.array(z.instanceof(File)) }),
      defaultValues: { photos: [] },
    },
  } satisfies FormParameters,
  render: (args) => <UploadingFileField {...args} />,
}

/**
 * Story-only host for `WithProgress`: keeps a per-file percentage and ticks it
 * up, standing in for a real upload. Stories may style; `src/` may not.
 */
function UploadingFileField(args: FileFieldProps) {
  const [progress, setProgress] = useState<Record<string, number>>({})
  const key = (file: File) => `${file.name}-${file.size}-${file.lastModified}`

  const startUpload = (files: File[]) => {
    for (const file of files) {
      const k = key(file)
      setProgress((p) => ({ ...p, [k]: 0 }))
      const timer = setInterval(() => {
        setProgress((p) => {
          const next = Math.min(100, (p[k] ?? 0) + 10)
          if (next === 100) clearInterval(timer)
          return { ...p, [k]: next }
        })
      }, 200)
    }
  }

  return (
    <FileField
      {...args}
      onFilesAdded={startUpload}
      renderFile={(file) => {
        const percent = progress[key(file)] ?? 0
        return (
          <Stack sx={{ width: 240 }}>
            <Typography variant="body2">{file.name}</Typography>
            <LinearProgress variant="determinate" value={percent} />
            <Typography variant="caption">
              {percent === 100 ? 'Uploaded' : `Uploading… ${percent}%`}
            </Typography>
          </Stack>
        )
      }}
    />
  )
}
