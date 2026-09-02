import Container from '@mui/material/Container'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import { z } from 'zod'
import { Form } from '../../Form'
import { FormError } from '../../FormError'
import { SubmitButton } from '../../SubmitButton'
import { EmailField } from '../../fields/EmailField'
import { PasswordField } from '../../fields/PasswordField'
import { Checkbox } from '../../fields/Checkbox'
import { loginApi, type LoginResult } from '../fakeApi'

const schema = z.object({
  // Plain `z.string()`: <EmailField> owns the format rule (HTML's own e-mail
  // grammar), so a `.email()` here would be a second, differently-worded copy of it.
  email: z.string().min(1, 'Email is required'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean(),
})

const defaultValues = { email: '', password: '', rememberMe: false }

export interface LoginProps {
  /** Called with the fake API's result once sign-in succeeds. */
  onSuccess?: (result: LoginResult) => void
}

/**
 * Simplest rung of the example ladder (#52): email + password + remember-me,
 * a pending submit, and a server-level error surfaced through `FormError`
 * when the fake API rejects. Documentation only — not exported from the
 * package (see `tsconfig.build.json`'s `src/examples` exclusion).
 */
export function Login({ onSuccess }: LoginProps) {
  return (
    <Container maxWidth="xs" sx={{ py: 6 }}>
      <Paper variant="outlined" sx={{ p: 4 }}>
        <Form
          schema={schema}
          defaultValues={defaultValues}
          title="Sign in"
          description="Enter your email and password to access your account."
          onSubmit={async (values, form) => {
            try {
              const result = await loginApi(values)
              form.clearErrors('root.server')
              onSuccess?.(result)
            } catch (error) {
              form.setError('root.server', {
                message: error instanceof Error ? error.message : 'Sign in failed',
              })
            }
          }}
        >
          <Stack spacing={2}>
            <FormError />
            <EmailField name="email" label="Email" required />
            <PasswordField
              name="password"
              label="Password"
              autoComplete="current-password"
              required
            />
            <Checkbox name="rememberMe" label="Remember me" />
            <SubmitButton>Sign in</SubmitButton>
          </Stack>
        </Form>
      </Paper>
    </Container>
  )
}
