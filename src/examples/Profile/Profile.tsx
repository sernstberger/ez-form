import { useRef, useState } from 'react'
import Container from '@mui/material/Container'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Button from '@mui/material/Button'
import { z } from 'zod'
import { Form, type FormMethods } from '../../Form'
import { FormError } from '../../FormError'
import { FormSection } from '../../FormSection'
import { SubmitButton } from '../../SubmitButton'
import { ClearButton } from '../../ClearButton'
import { TextField } from '../../fields/TextField'
import { TextareaField } from '../../fields/TextareaField'
import { DateField } from '../../fields/DateField'
import { Autocomplete } from '../../fields/Autocomplete'
import { Checkbox } from '../../fields/Checkbox'
import { Select } from '../../fields/Select'
import { FileField } from '../../fields/FileField'
import { loadProfileApi, saveProfileApi, type ProfileValues } from '../fakeApi'

const schema = z.object({
  displayName: z.string().min(1, 'Display name is required'),
  bio: z.string().max(280, 'Bio must be 280 characters or fewer'),
  birthday: z.date().nullable(),
  country: z.string().min(1, 'Country is required'),
  marketingEmails: z.boolean(),
  language: z.string().min(1, 'Language is required'),
  avatar: z.instanceof(File).nullable(),
})

type Input = z.input<typeof schema>

/** MUI X's `minDate` for `birthday`: the README-recommended birthday pattern
 * (`disableFuture` + a sane `minDate`) catches typos without a calendar. */
const MIN_BIRTHDAY = new Date(1900, 0, 1)

const countries = [
  { value: 'us', label: 'United States' },
  { value: 'gb', label: 'United Kingdom' },
  { value: 'ca', label: 'Canada' },
  { value: 'de', label: 'Germany' },
  { value: 'fr', label: 'France' },
  { value: 'jp', label: 'Japan' },
]

const languages = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
]

export interface ProfileProps {
  /** Called with the fake API's result once the save resolves. */
  onSuccess?: (result: ProfileValues) => void
  /**
   * Seeds the initial fetch (and, via "Reload from server", every later
   * one). Lets a story or test drive the loading and error paths without
   * reaching into the fake API directly.
   */
  loadSeed?: Partial<ProfileValues>
}

/**
 * Third rung of the example ladder (#54): an edit-existing-data form. The
 * initial values come from an async `defaultValues` function (a simulated
 * fetch, so the form renders disabled until it resolves — or, with
 * `onDefaultValuesError`, shows `FormError` if it rejects). "Reload from
 * server" demonstrates the `values` prop re-syncing a form that may have
 * unsaved edits: `resetOptions={{ keepDirtyValues: true }}` keeps whatever
 * the user has changed and only overwrites pristine fields. Documentation
 * only — not exported from the package (see `tsconfig.build.json`'s
 * `src/examples` exclusion).
 */
export function Profile({ onSuccess, loadSeed }: ProfileProps) {
  // `values` re-sync only fires when this prop changes identity/content; starting
  // `undefined` means the form's own async `defaultValues` supplies the first load,
  // and "Reload from server" is the only thing that ever sets this afterwards.
  const [reloaded, setReloaded] = useState<ProfileValues>()
  // Bumped on every reload and folded into the seed's `bio`, so each click's fetch
  // comes back with a value the initial load didn't have — proof the pristine field
  // actually re-synced from `values`, not that it just happened to match already.
  const reloadCount = useRef(0)
  // `onDefaultValuesError` only hands back the error, not the form methods, so
  // `ref` gets us `setError` — the failure then surfaces through FormError like
  // every other root-level error in this form, instead of a one-off error UI.
  const form = useRef<FormMethods<Input, z.output<typeof schema>>>(null)

  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Paper variant="outlined" sx={{ p: 4 }}>
        <Form
          ref={form}
          schema={schema}
          defaultValues={() => loadProfileApi(loadSeed)}
          values={reloaded}
          resetOptions={{ keepDirtyValues: true }}
          onDefaultValuesError={(error) => {
            // Form guarantees this runs after hookform's post-rejection reset (#70),
            // so a synchronous setError survives for FormError to render.
            form.current?.setError('root.server', {
              message: error instanceof Error ? error.message : 'Could not load your profile',
            })
          }}
          title="Your profile"
          description="Update how you appear to other members."
          onSubmit={async (values, form) => {
            try {
              const result = await saveProfileApi(values)
              form.clearErrors('root.server')
              form.reset(result)
              onSuccess?.(result)
            } catch (error) {
              form.setError('root.server', {
                message: error instanceof Error ? error.message : 'Could not save your profile',
              })
            }
          }}
        >
          <Stack spacing={3}>
            <FormError />
            <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
              <Button
                type="button"
                variant="text"
                onClick={() => {
                  reloadCount.current += 1
                  loadProfileApi({
                    ...loadSeed,
                    bio: `Reloaded from the server (reload #${reloadCount.current}).`,
                  }).then(setReloaded)
                }}
              >
                Reload from server
              </Button>
            </Stack>
            <FormSection title="Identity">
              <Stack spacing={2}>
                <TextField name="displayName" label="Display name" required />
                <TextareaField name="bio" label="Bio" maxLength={280} />
                <DateField name="birthday" label="Birthday" disableFuture minDate={MIN_BIRTHDAY} />
              </Stack>
            </FormSection>
            <FormSection title="Preferences">
              <Stack spacing={2}>
                <Autocomplete name="country" label="Country" options={countries} required />
                <Checkbox name="marketingEmails" label="Marketing emails" />
                <Select name="language" label="Language" options={languages} required />
              </Stack>
            </FormSection>
            <FormSection title="Avatar">
              <FileField name="avatar" label="Upload avatar" accept="image/*" />
            </FormSection>
            <Stack direction="row" spacing={2} sx={{ justifyContent: 'flex-end' }}>
              <ClearButton />
              <SubmitButton>Save profile</SubmitButton>
            </Stack>
          </Stack>
        </Form>
      </Paper>
    </Container>
  )
}
