import { defaultMessages, type RuleMessages } from '../../rules'

/** Per-code overrides for the picker's own validation errors. */
export type PickerErrorMessages<TError extends string | null> = Partial<
  Record<NonNullable<TError>, string>
>

/**
 * Label-derived defaults for MUI X's validation codes, in the voice of
 * `rules.ts`. Codes are `invalidDate`, `min*`, `max*`, `minutesStep`,
 * `disablePast`, `disableFuture`, and `shouldDisable*`. The wording comes from
 * the form's `RuleMessages` (`invalidDate`, `tooEarly`, `tooLate`,
 * `mustBeFuture`, `mustBePast`, `unavailable`), so a locale translates it
 * through `EzForm.defaultProps.messages` like every other rule message.
 */
export function pickerMessage(
  code: string,
  label: string | undefined,
  messages: Record<string, string | undefined> | undefined,
  ruleMessages: RuleMessages = defaultMessages,
): string {
  const override = messages?.[code]
  if (override) return override
  const l = label ?? ruleMessages.fallbackLabel
  if (code === 'invalidDate') return ruleMessages.invalidDate(l)
  if (code.startsWith('min')) return ruleMessages.tooEarly(l)
  if (code.startsWith('max')) return ruleMessages.tooLate(l)
  if (code === 'disablePast') return ruleMessages.mustBeFuture(l)
  if (code === 'disableFuture') return ruleMessages.mustBePast(l)
  return ruleMessages.unavailable(l)
}
