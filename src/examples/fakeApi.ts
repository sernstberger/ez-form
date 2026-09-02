/**
 * A tiny fake backend, shared by the example forms under `src/examples`, so a
 * story or test can show a real pending state and a real async rejection
 * without a network. Not part of the published package (see the tsconfig.build.json
 * exclusion for `src/examples`).
 */

/** Resolves after `ms` milliseconds. */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export interface LoginValues {
  email: string
  password: string
  rememberMe: boolean
}

export interface LoginResult {
  email: string
}

/** The one password `loginApi` treats as wrong, so stories/tests can trigger the error path on demand. */
export const LOGIN_BAD_PASSWORD = 'wrong-password'

/**
 * Fake login endpoint: a short delay, then resolves for any password other
 * than `LOGIN_BAD_PASSWORD`, or rejects with a generic message (never say
 * which of email/password was wrong).
 */
export async function loginApi(values: LoginValues): Promise<LoginResult> {
  await delay(600)
  if (values.password === LOGIN_BAD_PASSWORD) {
    throw new Error('Invalid email or password')
  }
  return { email: values.email }
}

/** The one code `verifyCodeApi` treats as correct, so stories/tests can trigger either path on demand. */
export const SIGNUP_GOOD_CODE = '123456'

export interface VerifyCodeResult {
  verified: true
}

/**
 * Fake verification endpoint for the Sign-up example's second step: a short
 * delay, then resolves only for `SIGNUP_GOOD_CODE`, or rejects with a
 * generic "wrong code" message for anything else.
 */
export async function verifyCodeApi(code: string): Promise<VerifyCodeResult> {
  await delay(600)
  if (code !== SIGNUP_GOOD_CODE) {
    throw new Error('That code is incorrect. Check your email and try again.')
  }
  return { verified: true }
}
