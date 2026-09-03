/**
 * Shared "a build warning fails the build" handler for both Vite builds in this repo: the
 * library build (`vite.config.ts`) and the Storybook build (`.storybook/main.ts`, via
 * `viteFinal`). Both need the same rule, and Storybook owns its own Vite config, so it lives
 * here rather than being written twice.
 *
 * Rollup reports real problems — a circular import, an unresolved id, a `"use client"`
 * directive it had to drop — as *warnings*, and a warning in a library build is a bug someone
 * ships. Throwing turns each into a build failure with the original message attached.
 *
 * The allow-list below is deliberately tiny and each entry carries its reason: the moment it
 * becomes a habit, the next real warning gets added to it instead of fixed.
 *
 * Vite's own reporter is the one exception that is forwarded rather than thrown. Its
 * "(!) Some chunks are larger than 500 kB" advisory does arrive here (no `code`,
 * `plugin: 'builtin:vite-reporter'`), but it is emitted after the bundle is written and a
 * throw from that path is swallowed: the build exits 0 and the advisory disappears with it.
 * It is also one aggregated message with no chunk names, so it cannot be allow-listed per
 * chunk. Passing it to Vite's default handler keeps it visible; the Storybook build sets
 * `build.chunkSizeWarningLimit` for the chunks it cannot shrink — see `.storybook/main.ts`.
 */

/**
 * Warning codes that are not warnings about the build's correctness.
 *
 * `PLUGIN_TIMINGS` is Rolldown's performance *report* — "your build spent 98% of 8.6s inside
 * plugin hooks", listing the dts plugin's two slow calls. It is emitted on a completely
 * successful build, says nothing about the output, and cannot be "fixed" short of dropping
 * type generation. Everything else, including every correctness warning Rollup reports
 * (circular imports, unresolved ids, dropped directives), still fails the build.
 */
const ALLOWED_CODES = new Set(['PLUGIN_TIMINGS'])

/** The shape of a rollup warning, structural rather than imported: Vite, Rollup and Rolldown
 *  each export their own near-identical type, and this only reads two fields. */
interface RollupWarning {
  code?: string
  plugin?: string
  message?: string
  loc?: { file?: string; line?: number; column?: number }
}

/**
 * Vite's reporter plugin: its advisories are printed, not thrown — a throw on them cannot
 * fail the build (see above), it can only hide them.
 */
const VITE_REPORTER = 'builtin:vite-reporter'

// Generic so the default handler is typed with the bundler's own warning type: Vite's
// `OnwarnFunction` hands over a handler that takes a `RolldownLog`, and a handler declared
// against the looser structural type above would not be assignable to it.
export function failOnWarning<W extends RollupWarning>(
  warning: W,
  defaultHandler: (warning: W) => void,
): void {
  if (warning.code && ALLOWED_CODES.has(warning.code)) return
  if (warning.plugin === VITE_REPORTER) {
    defaultHandler(warning)
    return
  }
  const where = warning.loc?.file
    ? ` (${warning.loc.file}:${String(warning.loc.line ?? 0)}:${String(warning.loc.column ?? 0)})`
    : ''
  const code = warning.code ? `[${warning.code}] ` : ''
  throw new Error(
    `Build warning treated as an error: ${code}${warning.message ?? 'unknown warning'}${where}\n\n` +
      'Fix the cause. If a warning genuinely has to be tolerated, add its code to ' +
      'ALLOWED_CODES in rollupWarnings.ts with a comment explaining why.',
  )
}
