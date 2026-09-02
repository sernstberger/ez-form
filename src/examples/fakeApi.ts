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

export interface ProfileValues {
  displayName: string
  bio: string
  birthday: Date | null
  country: string
  marketingEmails: boolean
  language: string
  avatar: File | null
}

/** The one display name `loadProfileApi` treats as a server failure, so stories/tests can trigger the error path on demand. */
export const PROFILE_LOAD_FAILS_FOR = 'network-error'

/**
 * Fake "load the signed-in user's profile" endpoint for the Profile example
 * (#54): a short delay (simulates a real fetch), then resolves with a saved
 * profile. `seed` lets a story/test control what comes back (for the
 * `values`-re-sync story); pass `seed.displayName === PROFILE_LOAD_FAILS_FOR`
 * to make it reject instead, exercising `onDefaultValuesError`.
 */
export async function loadProfileApi(seed?: Partial<ProfileValues>): Promise<ProfileValues> {
  await delay(300)
  if (seed?.displayName === PROFILE_LOAD_FAILS_FOR) {
    throw new Error('Could not load your profile. Check your connection and try again.')
  }
  return {
    displayName: 'Ada Lovelace',
    bio: 'Mathematician and writer, first to publish an algorithm for a computing machine.',
    birthday: new Date(1985, 11, 10),
    country: 'gb',
    marketingEmails: false,
    language: 'en',
    avatar: null,
    ...seed,
  }
}

/**
 * Fake "save the profile" endpoint: a short delay, then resolves with the
 * values it was given (a real backend would echo the persisted record).
 */
export async function saveProfileApi(values: ProfileValues): Promise<ProfileValues> {
  await delay(300)
  return values
}
