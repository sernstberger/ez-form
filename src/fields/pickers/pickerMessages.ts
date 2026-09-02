import { FALLBACK_LABEL } from '../../rules'

/** Per-code overrides for the picker's own validation errors. */
export type PickerErrorMessages<TError extends string | null> = Partial<
  Record<NonNullable<TError>, string>
>

/**
 * Label-derived defaults for MUI X's validation codes, in the voice of
 * `rules.ts`. Codes are `invalidDate`, `min*`, `max*`, `minutesStep`,
 * `disablePast`, `disableFuture`, and `shouldDisable*`.
 */
export function pickerMessage(
  code: string,
  label: string | undefined,
  messages: Record<string, string | undefined> | undefined,
): string {
  const override = messages?.[code]
  if (override) return override
  const l = label ?? FALLBACK_LABEL
  if (code === 'invalidDate') return `${l} is invalid.`
  if (code.startsWith('min')) return `${l} is too early.`
  if (code.startsWith('max')) return `${l} is too late.`
  if (code === 'disablePast') return `${l} must be in the future.`
  if (code === 'disableFuture') return `${l} must be in the past.`
  return `${l} is not available.`
}
