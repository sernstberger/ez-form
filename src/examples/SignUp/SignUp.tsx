import { useState } from 'react'
import Container from '@mui/material/Container'
import Paper from '@mui/material/Paper'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import { z } from 'zod'
import { useWatch } from 'react-hook-form'
import { Form } from '../../Form'
import { FormError } from '../../FormError'
import { FormSection } from '../../FormSection'
import { TextField } from '../../fields/TextField'
import { EmailField } from '../../fields/EmailField'
import { Select } from '../../fields/Select'
import { PasswordField } from '../../fields/PasswordField'
import { Checkbox } from '../../fields/Checkbox'
import { OtpField } from '../../fields/OtpField'
import { PasswordStrength } from '../../fields/PasswordStrength'
import { Wizard, type WizardStepDef } from '../../Wizard'
import { WizardStep } from '../../Wizard/WizardStep'
import { WizardNav } from '../../Wizard/WizardNav'
import type { Option } from '../../fields/Option'
import { verifyCodeApi } from '../fakeApi'

const REFERRAL_OPTIONS: readonly Option[] = [
  { value: 'search', label: 'Search engine' },
  { value: 'friend', label: 'Friend or colleague' },
  { value: 'social', label: 'Social media' },
  { value: 'other', label: 'Other' },
]

const schema = z
  .object({
    // Plain `z.string()`: <EmailField> owns the format rule (HTML's own e-mail
    // grammar), so a `.email()` here would be a second, differently-worded copy of it.
    email: z.string().min(1, 'Email is required'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
    displayName: z.string().min(1, 'Display name is required'),
    terms: z.literal(true, { error: 'You must accept the terms to continue' }),
    // "Other" reveals a free-text field on the form (pattern 2, #82); `referralOther`
    // stays optional at the zod level and `superRefine` below requires it only when
    // `referralSource` is `'other'` — a hookform `required` prop on the field itself
    // would win over that message even while the field is hidden (see the README's
    // Validation rules section).
    referralSource: z.string(),
    referralOther: z.string(),
    code: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: 'Passwords do not match',
    path: ['confirmPassword'],
    // Zod skips a `.refine`/`.superRefine` once any other issue in the object is
    // "non-continuable" (an enum's or literal's mismatch, among others) — `terms`
    // (a `z.literal(true)`, starting `false`) would otherwise silently swallow this
    // message until the checkbox is checked. `when: () => true` forces it to run
    // regardless of what else in the object failed.
    when: () => true,
  })
  .superRefine(
    (data, ctx) => {
      if (data.referralSource === 'other' && !data.referralOther) {
        ctx.addIssue({ code: 'custom', message: 'Please specify', path: ['referralOther'] })
      }
    },
    // Zod skips a `superRefine` once any other issue in the object is "non-continuable"
    // (e.g. `z.literal`'s mismatch, among others) — an unfinished email/password/terms
    // elsewhere on this same step would otherwise silently swallow this check. `when:
    // () => true` forces this refinement to always run regardless of what else failed.
    { when: () => true },
  )

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
  referralSource: '',
  referralOther: '',
  code: '',
}

const steps = [
  {
    id: 'details',
    label: 'Details',
    fields: [
      'email',
      'password',
      'confirmPassword',
      'displayName',
      'terms',
      'referralSource',
      'referralOther',
    ],
  },
  { id: 'verification', label: 'Verification', fields: ['code'] },
] as const satisfies WizardStepDef<Input>[]

function ReferralFields() {
  const referralSource = useWatch<Input, 'referralSource'>({ name: 'referralSource' })
  return (
    <>
      <Select name="referralSource" label="How did you hear about us?" options={REFERRAL_OPTIONS} />
      {referralSource === 'other' && <TextField name="referralOther" label="Please specify" />}
    </>
  )
}

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
          requiredIndicator="optional"
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
                      <EmailField name="email" label="Email" required />
                      <PasswordField
                        name="password"
                        label="Password"
                        autoComplete="new-password"
                        required
                      />
                      <PasswordStrength name="password" />
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
                      <Checkbox
                        name="terms"
                        label="I accept the terms of service"
                        required="You must accept the terms to continue"
                      />
                      <ReferralFields />
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
