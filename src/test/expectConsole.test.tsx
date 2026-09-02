import { useEffect } from 'react'
import { render } from '@testing-library/react'
import { assertNoUnexpectedOutput, expectConsole } from './expectConsole'

/**
 * Tests for the console guard itself.
 *
 * The guard's whole job is to *fail* the test that logged, which a test cannot demonstrate by
 * letting it happen — it would just fail. So these drive `assertNoUnexpectedOutput()` (the
 * step the `afterEach` calls) by hand and assert on whether it throws. Each test leaves the
 * buffers empty, because that function clears them however it exits, so the real `afterEach`
 * that follows sees nothing and passes.
 */
describe('console guard', () => {
  it('fails on an unexpected console.error', () => {
    console.error('ez-form test: a component logged something nobody expected')
    expect(() => assertNoUnexpectedOutput()).toThrow(/Unexpected console output/)
  })

  it('fails on an unexpected console.warn', () => {
    console.warn('ez-form test: a stray warning')
    expect(() => assertNoUnexpectedOutput()).toThrow(/Unexpected console output/)
  })

  it('passes when the message was opted in with expectConsole', () => {
    expectConsole('warn', /a stray warning/)
    console.warn('ez-form test: a stray warning')
    expect(() => assertNoUnexpectedOutput()).not.toThrow()
  })

  it('still fails a different message when one was opted in', () => {
    expectConsole('warn', /the expected one/)
    console.warn('ez-form test: the expected one')
    console.warn('ez-form test: a completely different warning')
    expect(() => assertNoUnexpectedOutput()).toThrow(/a completely different warning/)
  })

  it('allows any number of matching messages, and an allowance that never fires', () => {
    // React logs the same warning once per render pass and StrictMode doubles that, so an
    // allowance is deliberately not a count. One that matches nothing says "this may log".
    expectConsole('error', 'repeated')
    expectConsole('error', 'never actually logged')
    console.error('ez-form test: repeated')
    console.error('ez-form test: repeated')
    console.error('ez-form test: repeated')
    expect(() => assertNoUnexpectedOutput()).not.toThrow()
  })

  it('matches an allowance against the formatted message, not the raw arguments', () => {
    // React's warnings arrive as a format string plus substitutions; the guard has to
    // substitute before matching or a matcher on the real text would never hit.
    expectConsole('error', 'An update to Widget inside a test')
    console.error('An update to %s inside a test was not wrapped in act(...).', 'Widget')
    expect(() => assertNoUnexpectedOutput()).not.toThrow()
  })

  /**
   * The reason `cleanup()` runs inside the guard's own `afterEach`, before the console is
   * restored: unmounting runs effect cleanups (twice, under StrictMode), and anything they log
   * has to be caught. Unmounting by hand here proves the output is recorded; in a real test
   * the guard's `cleanup()` is what triggers it.
   */
  it('catches a console.error fired from an effect cleanup on unmount', () => {
    function LogsOnUnmount() {
      useEffect(() => () => console.error('ez-form test: torn down badly'), [])
      return <div>widget</div>
    }

    const { unmount } = render(<LogsOnUnmount />)
    unmount()

    expect(() => assertNoUnexpectedOutput()).toThrow(/torn down badly/)
  })

  it('lets a test opt in to output from an effect cleanup', () => {
    function LogsOnUnmount() {
      useEffect(() => () => console.warn('ez-form test: expected teardown notice'), [])
      return <div>widget</div>
    }

    expectConsole('warn', /expected teardown notice/)
    const { unmount } = render(<LogsOnUnmount />)
    unmount()

    expect(() => assertNoUnexpectedOutput()).not.toThrow()
  })
})
