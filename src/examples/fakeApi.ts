/**
 * A tiny fake backend, shared by the example forms under `src/examples`, so a
 * story or test can show a real pending state and a real async rejection
 * without a network. Not part of the published package (see the tsconfig.build.json
 * exclusion for `src/examples`).
 */

/**
 * Scales every `delay()` call below. Stories keep the realistic `scale: 1`
 * (the default); the test setup (`src/test/setup.ts`) sets this to `0` so
 * example tests still exercise a real pending state (a `setTimeout(fn, 0)`
 * still needs a macrotask turn) without paying the realistic 300-600ms in
 * real time.
 */
export const fakeApiTiming = { scale: 1 }

/** Resolves after `ms * fakeApiTiming.scale` milliseconds. */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms * fakeApiTiming.scale))
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

export interface PlaceOrderValues {
  cardNumber: string
  total: number
}

export interface PlaceOrderResult {
  orderId: string
}

/** The one card number `placeOrderApi` declines, so stories/tests can trigger the error path on demand. */
export const DECLINED_CARD_NUMBER = '4000000000000002'

/**
 * Fake checkout endpoint for the Checkout example (#55): a short delay, then
 * resolves with an order id for any card other than `DECLINED_CARD_NUMBER`,
 * or rejects with a generic decline message (never say why a real processor
 * declined a card).
 */
export async function placeOrderApi(values: PlaceOrderValues): Promise<PlaceOrderResult> {
  await delay(600)
  if (values.cardNumber === DECLINED_CARD_NUMBER) {
    throw new Error('Your card was declined. Try a different payment method.')
  }
  return { orderId: `ORD-${Math.random().toString(36).slice(2, 10).toUpperCase()}` }
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

export interface SubmitLoanValues {
  /** Total monthly income across the primary applicant, co-applicants, and employment rows. */
  totalMonthlyIncome: number
  /** Total monthly payment across all debt rows. */
  totalMonthlyDebt: number
}

export interface SubmitLoanResult {
  applicationId: string
}

/** DTI above this ratio (debt / income) is a decline, same threshold the Review step computes. */
export const LOAN_MAX_DTI = 0.45

/**
 * Fake loan-application endpoint for the Loan example (#57): a short delay,
 * then resolves with an application id, or rejects with a generic decline
 * message when the debt-to-income ratio is too high — the one server-side
 * check the example needs, surfaced through `FormError` (root.server).
 */
export async function submitLoanApi(values: SubmitLoanValues): Promise<SubmitLoanResult> {
  await delay(600)
  const dti =
    values.totalMonthlyIncome > 0 ? values.totalMonthlyDebt / values.totalMonthlyIncome : 1
  if (dti > LOAN_MAX_DTI) {
    throw new Error('Your debt-to-income ratio is too high for this loan. Try a smaller amount.')
  }
  return { applicationId: `LOAN-${Math.random().toString(36).slice(2, 10).toUpperCase()}` }
}

export interface SubmitApplicationResult {
  applicationId: string
}

/** The one first name `submitApplicationApi` treats as a server failure, so stories/tests can trigger the error path on demand. */
export const APPLICATION_DECLINED_FOR = 'Declined'

/**
 * Fake "submit an insurance application" endpoint for the Insurance example
 * (#56): a short delay, then resolves with an application id, or rejects
 * with a generic message when the applicant's first name is
 * `APPLICATION_DECLINED_FOR` (a deliberate, easy-to-trigger hook for
 * stories/tests — never a real underwriting signal).
 */
export async function submitApplicationApi(values: {
  firstName: string
}): Promise<SubmitApplicationResult> {
  await delay(300)
  if (values.firstName === APPLICATION_DECLINED_FOR) {
    throw new Error('We could not process your application. Try again later.')
  }
  return { applicationId: `APP-${Math.random().toString(36).slice(2, 10).toUpperCase()}` }
}
