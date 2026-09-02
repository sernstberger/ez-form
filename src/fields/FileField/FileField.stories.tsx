import type { Meta, StoryObj } from '@storybook/react-vite'
import { z } from 'zod'
import type { FormParameters } from '../../../.storybook/preview'
import { FileField } from './FileField'

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
