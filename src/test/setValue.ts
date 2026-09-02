import { fireEvent } from '@testing-library/react'

/**
 * Sets a text/number input's value in a single change event, for the *setup* a test does on
 * its way to the behaviour it actually asserts on.
 *
 * `userEvent.type` replays one keystroke at a time, and each keystroke re-runs hookform
 * validation — plus, on the money fields, a full reformat, and on Sign-up, the password
 * strength meter. The example forms' wizard tests pay that once per character, per field,
 * per step, on walks whose only purpose is to reach a later step. `fireEvent.change` sets
 * the value the way a paste or an autofill does: one event, one validation pass.
 *
 * Use it only for fill-and-move-on setup. A test whose subject *is* the typing — an error
 * that appears mid-word, a caret-aware reformat, a strength meter climbing, a conditional
 * field revealed by what was typed — must keep `userEvent.type`, because the per-keystroke
 * behaviour is exactly what it is checking.
 *
 * The `DateField` equivalent is a `fireEvent.change` on its hidden `input[name=…]`; the
 * example suites keep a local `typeDate` helper for that, since finding the hidden input is
 * specific to how that field renders.
 */
export const setValue = (input: HTMLElement, value: string): void => {
  fireEvent.change(input, { target: { value } })
}
