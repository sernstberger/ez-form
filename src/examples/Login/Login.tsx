import Container from '@mui/material/Container'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import { z } from 'zod'
import { Form } from '../../Form'
import { FormError } from '../../FormError'
import { SubmitButton } from '../../SubmitButton'
import { TextField } from '../../fields/TextField'
import { Checkbox } from '../../fields/Checkbox'
import { loginApi, type LoginResult } from '../fakeApi'

const schema = z.object({
  email: z.email({ error: (iss) => (iss.input === '' ? 'Email is required' : 'Invalid email') }),
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
            <TextField name="email" label="Email" autoComplete="email" required />
            {/* TODO(#58): swap for PasswordField once it lands (show/hide toggle). */}
            <TextField
              name="password"
              label="Password"
              type="password"
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
