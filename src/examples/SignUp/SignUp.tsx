import { useState } from 'react'
import Container from '@mui/material/Container'
import Paper from '@mui/material/Paper'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import { z } from 'zod'
import { Form } from '../../Form'
import { FormError } from '../../FormError'
import { FormSection } from '../../FormSection'
import { SubmitButton } from '../../SubmitButton'
import { TextField } from '../../fields/TextField'
import { PasswordField } from '../../fields/PasswordField'
import { Checkbox } from '../../fields/Checkbox'
import { OtpField } from '../../fields/OtpField'
import { Wizard, type WizardStepDef } from '../../Wizard'
import { WizardStep } from '../../Wizard/WizardStep'
import { WizardNav } from '../../Wizard/WizardNav'
// TODO(#59): swap this raw PasswordField for a PasswordStrength meter once it lands.
import { verifyCodeApi } from '../fakeApi'

const schema = z
  .object({
    email: z.email({ error: (iss) => (iss.input === '' ? 'Email is required' : 'Invalid email') }),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
    displayName: z.string().min(1, 'Display name is required'),
    terms: z.literal(true, { error: 'You must accept the terms to continue' }),
    code: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: 'Passwords do not match',
    path: ['confirmPassword'],
  })

type Input = z.input<typeof schema>

const defaultValues: Input = {
  email: '',
  password: '',
  confirmPassword: '',
  displayName: '',
  // z.literal(true) types `terms` as `true`, but the field starts unchecked; the
  // Checkbox works from `Boolean(field.value)` either way, so `false` is the real
  // runtime default while satisfying the input type would require `as true` — this
  // cast documents that mismatch rather than hiding it.
  terms: false as unknown as true,
  code: '',
}

const steps = [
  {
    id: 'details',
    label: 'Details',
    fields: ['email', 'password', 'confirmPassword', 'displayName', 'terms'],
  },
  { id: 'verification', label: 'Verification', fields: ['code'] },
] as const satisfies WizardStepDef<Input>[]

export interface SignUpProps {
  /** Called once the verification code is accepted by the fake API. */
  onSuccess?: () => void
}

/**
 * Second rung of the example ladder (#53): account + profile details behind
 * zod `refine`/`literal` rules, then a verification-code step. Documentation
 * only — not exported from the package (see `tsconfig.build.json`'s
 * `src/examples` exclusion).
 */
export function SignUp({ onSuccess }: SignUpProps) {
  const [resendCount, setResendCount] = useState(0)

  return (
    <Container maxWidth="xs" sx={{ py: 6 }}>
      <Paper variant="outlined" sx={{ p: 4 }}>
        <Form
          schema={schema}
          defaultValues={defaultValues}
          title="Create your account"
          description="Fields marked with * are required; everything else is optional."
          guard
          onSubmit={async ({ code }, form) => {
            try {
              await verifyCodeApi(code)
              form.clearErrors('root.server')
              onSuccess?.()
            } catch (error) {
              form.setError('root.server', {
                message: error instanceof Error ? error.message : 'Verification failed',
              })
            }
          }}
        >
          <Stack spacing={2}>
            <FormError />
            <Wizard steps={steps}>
              <WizardStep id="details" title={null}>
                <Stack spacing={3}>
                  <FormSection title="Account">
                    <Stack spacing={2}>
                      <TextField name="email" label="Email" autoComplete="email" required />
                      <PasswordField
                        name="password"
                        label="Password"
                        autoComplete="new-password"
                        required
                      />
                      <PasswordField
                        name="confirmPassword"
                        label="Confirm password"
                        autoComplete="new-password"
                        required
                      />
                    </Stack>
                  </FormSection>
                  <FormSection title="Profile">
                    <Stack spacing={2}>
                      <TextField
                        name="displayName"
                        label="Display name"
                        autoComplete="nickname"
                        required
                      />
                      <Checkbox name="terms" label="I accept the terms of service" />
                    </Stack>
                  </FormSection>
                </Stack>
              </WizardStep>
              <WizardStep id="verification">
                <Stack spacing={2}>
                  <OtpField name="code" label="Verification code" length={6} required />
                  <Button type="button" variant="text" onClick={() => setResendCount((n) => n + 1)}>
                    Resend code
                  </Button>
                  {resendCount > 0 && (
                    <span role="status">
                      Code resent{resendCount > 1 ? ` (${resendCount} times)` : ''}.
                    </span>
                  )}
                </Stack>
              </WizardStep>
              <WizardNav />
            </Wizard>
          </Stack>
        </Form>
      </Paper>
    </Container>
  )
}
