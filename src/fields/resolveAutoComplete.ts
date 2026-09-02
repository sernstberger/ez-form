/**
 * The one place the assisted-mode rule lives (#65): under `<Form assisted>`,
 * every field's `autoComplete` becomes `"off"` instead of its own default —
 * so a browser or password manager never offers the person operating the
 * form their own saved data for someone else's information ("you don't
 * necessarily know who you're filling it for").
 *
 * Ruling: `assisted` forces `"off"` even where a field has no default token
 * of its own to replace (a plain `TextField` with no `type`, say) — not only
 * where `token` is already set. A browser's autofill heuristics key off
 * `name`/`id`, not only `autoComplete`; suppressing only fields that already
 * opted into a default would leave that gap open on every other field. Cost
 * if wrong: a field with no default token gets an `autoComplete="off"` it
 * didn't have before, which is inert everywhere except assisted mode.
 *
 * Call this only where a field is about to fall back to its own default
 * token (`autoComplete = someToken`-style destructuring, evaluated when the
 * consumer passed no `autoComplete` at all) — never on a value the consumer
 * passed explicitly. That default-parameter placement is what makes an
 * explicit per-field `autoComplete` win: this function only ever sees the
 * field's own fallback, so a consumer's own value bypasses it entirely.
 *
 * Chromium ignores `autocomplete="off"` for address-shaped fields (street,
 * city, state, ZIP) and refills them anyway — a documented browser quirk, not
 * a spec violation. `"off"` is still what every field emits here: no test in
 * this codebase has shown it fail for these fields' inputs (all `type="text"`
 * or a `Select`, none of MUI's or Chromium's own autofill-heuristic-triggering
 * input types), and reaching for the `one-time-code` workaround pre-emptively
 * would cost more (a token that reads as "this is a one-time code" on a field
 * that is not one, for browsers where plain `off` already works) than it buys.
 * If a future test proves `off` alone insufficient for a given field, swap
 * that field's `"off"` for a random non-matching token and record why here.
 */
export function resolveAutoComplete(
  token: string | undefined,
  assisted: boolean,
): string | undefined {
  return assisted ? 'off' : token
}
