import { delay, loginApi, LOGIN_BAD_PASSWORD, verifyCodeApi, SIGNUP_GOOD_CODE } from './fakeApi'

describe('fakeApi', () => {
  it('delay resolves after roughly the given ms', async () => {
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
})
