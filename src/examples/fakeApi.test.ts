import {
  delay,
  fakeApiTiming,
  loginApi,
  LOGIN_BAD_PASSWORD,
  verifyCodeApi,
  SIGNUP_GOOD_CODE,
  placeOrderApi,
  DECLINED_CARD_NUMBER,
  loadProfileApi,
  saveProfileApi,
  PROFILE_LOAD_FAILS_FOR,
  type ProfileValues,
  submitLoanApi,
  LOAN_MAX_DTI,
} from './fakeApi'

describe('fakeApi', () => {
  it('delay resolves after roughly the given ms', async () => {
    // The global test setup zeroes fakeApiTiming.scale so example tests don't pay
    // real time; this test is about `delay()`'s own scaling behavior, so it restores
    // the real (story) scale for its duration.
    fakeApiTiming.scale = 1
    vi.useFakeTimers()
    const promise = delay(500)
    let resolved = false
    void promise.then(() => {
      resolved = true
    })
    await vi.advanceTimersByTimeAsync(499)
    expect(resolved).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(resolved).toBe(true)
    vi.useRealTimers()
    fakeApiTiming.scale = 0
  })

  it('loginApi resolves for any password other than the known-bad one', async () => {
    vi.useFakeTimers()
    const promise = loginApi({ email: 'a@b.co', password: 'correct-horse', rememberMe: false })
    await vi.runAllTimersAsync()
    await expect(promise).resolves.toEqual({ email: 'a@b.co' })
    vi.useRealTimers()
  })

  it('loginApi rejects for the known-bad password with a message', async () => {
    vi.useFakeTimers()
    const promise = loginApi({
      email: 'a@b.co',
      password: LOGIN_BAD_PASSWORD,
      rememberMe: false,
    })
    const assertion = expect(promise).rejects.toThrow('Invalid email or password')
    await vi.runAllTimersAsync()
    await assertion
    vi.useRealTimers()
  })

  it('verifyCodeApi resolves for the known-good code', async () => {
    vi.useFakeTimers()
    const promise = verifyCodeApi(SIGNUP_GOOD_CODE)
    await vi.runAllTimersAsync()
    await expect(promise).resolves.toEqual({ verified: true })
    vi.useRealTimers()
  })

  it('verifyCodeApi rejects for any other code with a message', async () => {
    vi.useFakeTimers()
    const promise = verifyCodeApi('000000')
    const assertion = expect(promise).rejects.toThrow('That code is incorrect')
    await vi.runAllTimersAsync()
    await assertion
    vi.useRealTimers()
  })

  it('placeOrderApi resolves with an order id for any card other than the known-declined one', async () => {
    vi.useFakeTimers()
    const promise = placeOrderApi({ cardNumber: '4111111111111111', total: 42.5 })
    await vi.runAllTimersAsync()
    const result = await promise
    expect(result.orderId).toMatch(/^ORD-/)
    vi.useRealTimers()
  })

  it('placeOrderApi rejects for the known-declined card number with a message', async () => {
    vi.useFakeTimers()
    const promise = placeOrderApi({ cardNumber: DECLINED_CARD_NUMBER, total: 42.5 })
    const assertion = expect(promise).rejects.toThrow('declined')
    await vi.runAllTimersAsync()
    await assertion
    vi.useRealTimers()
  })

  it('loadProfileApi resolves with a saved profile by default', async () => {
    vi.useFakeTimers()
    const promise = loadProfileApi()
    await vi.runAllTimersAsync()
    const profile = await promise
    expect(profile.displayName).toBe('Ada Lovelace')
    expect(profile.birthday).toBeInstanceOf(Date)
    vi.useRealTimers()
  })

  it('loadProfileApi merges a seed over the defaults', async () => {
    vi.useFakeTimers()
    const promise = loadProfileApi({ displayName: 'Grace Hopper' })
    await vi.runAllTimersAsync()
    const profile = await promise
    expect(profile.displayName).toBe('Grace Hopper')
    expect(profile.country).toBe('gb') // untouched default
    vi.useRealTimers()
  })

  it('loadProfileApi rejects when the seed requests the failure path', async () => {
    vi.useFakeTimers()
    const promise = loadProfileApi({ displayName: PROFILE_LOAD_FAILS_FOR })
    const assertion = expect(promise).rejects.toThrow('Could not load your profile')
    await vi.runAllTimersAsync()
    await assertion
    vi.useRealTimers()
  })

  it('saveProfileApi resolves with the values it was given', async () => {
    vi.useFakeTimers()
    const values: ProfileValues = {
      displayName: 'Ada Lovelace',
      bio: '',
      birthday: null,
      country: 'us',
      marketingEmails: true,
      language: 'en',
      avatar: null,
    }
    const promise = saveProfileApi(values)
    await vi.runAllTimersAsync()
    await expect(promise).resolves.toEqual(values)
    vi.useRealTimers()
  })

  it('submitLoanApi resolves with an application id when DTI is at or below the max', async () => {
    vi.useFakeTimers()
    const promise = submitLoanApi({ totalMonthlyIncome: 10000, totalMonthlyDebt: 4500 })
    await vi.runAllTimersAsync()
    const result = await promise
    expect(result.applicationId).toMatch(/^LOAN-/)
    vi.useRealTimers()
  })

  it('submitLoanApi rejects with a decline message when DTI exceeds the max', async () => {
    vi.useFakeTimers()
    const promise = submitLoanApi({ totalMonthlyIncome: 10000, totalMonthlyDebt: 4501 })
    const assertion = expect(promise).rejects.toThrow(/debt-to-income ratio is too high/i)
    await vi.runAllTimersAsync()
    await assertion
    vi.useRealTimers()
  })

  it('submitLoanApi rejects when income is zero (DTI treated as maximal)', async () => {
    vi.useFakeTimers()
    const promise = submitLoanApi({ totalMonthlyIncome: 0, totalMonthlyDebt: 0 })
    const assertion = expect(promise).rejects.toThrow(/debt-to-income ratio is too high/i)
    await vi.runAllTimersAsync()
    await assertion
    vi.useRealTimers()
  })

  it('LOAN_MAX_DTI is 0.45', () => {
    expect(LOAN_MAX_DTI).toBe(0.45)
  })
})
