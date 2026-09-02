#!/usr/bin/env node
// CI guardrail: fail on `sx=` / ripple props / theme-unreachable literal JSX attributes in
// src/, on exported components missing a README "## Components" row, and on the README structural
// damage a union merge leaves behind — a component listed in two Components rows, a `##`/`###`
// heading repeated, or a header row spliced into the middle of a table. See docs/PHILOSOPHY.md
// rule 2 and GitHub issue #44.
//
// Deliberately dependency-free: node:fs/node:path + line-based regexes, not a TS/JSX parser.
// That means it can be fooled by pathological formatting (an attribute split across lines, a
// `sx=` inside a template string, etc.) but it is fast, has zero install cost, and matches how
// these violations actually show up in this codebase today.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const REPO_ROOT = join(__filename, '..', '..')

const SRC_DIR = join(REPO_ROOT, 'src')
const README_PATH = join(REPO_ROOT, 'README.md')
const INDEX_PATH = join(SRC_DIR, 'index.ts')

const EXCLUDED_DIRS = new Set(['examples', 'test'])

const ALLOW_COMMENT_RE = /\/\/\s*guardrail:\s*allow\b.*$/

// JSX attribute regexes. All are line-based: they look at one physical line at a time, which is
// how every current violation (and every current allow-listed one) in this repo is written.
const SX_ATTR_RE = /(?<![\w-])sx\s*=/
// Matches both `disableRipple` (boolean shorthand) and `disableRipple={...}`.
const RIPPLE_ATTR_RE = /(?<![\w-])(disableRipple|focusRipple)\b(?!-)/
// A literal string value: `variant="contained"`. `variant={variant}` (an expression) is fine and
// does not match this regex because it doesn't have a `="` sequence.
const LITERAL_PROP_RE = /(?<![\w-])(variant|size|color)\s*=\s*"[^"]*"/
// Hand-rolled SVG icons: a raw `<path ` element, or `createSvgIcon(...)` building one from path
// data. Icons come from `@mui/icons-material` (see #67) — never inlined in src/.
const INLINE_SVG_RE = /(<path[\s>]|createSvgIcon\()/

/**
 * @param {string} dir
 * @param {string[]} out
 */
function walk(dir, out) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry)) continue
      walk(full, out)
      continue
    }
    if (!entry.endsWith('.tsx')) continue
    if (entry.endsWith('.stories.tsx') || entry.endsWith('.test.tsx')) continue
    out.push(full)
  }
  return out
}

/**
 * @param {string} filePath
 * @param {string} content
 */
function checkFileLiterals(filePath, content) {
  const lines = content.split('\n')
  const violations = []
  let allowCount = 0

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    const lineNo = i + 1
    const isAllowed = ALLOW_COMMENT_RE.test(line)

    /** @type {Array<{re: RegExp, rule: string}>} */
    const checks = [
      { re: SX_ATTR_RE, rule: 'no-sx' },
      { re: RIPPLE_ATTR_RE, rule: 'no-ripple-prop' },
      { re: LITERAL_PROP_RE, rule: 'no-literal-style-prop' },
      { re: INLINE_SVG_RE, rule: 'no-inline-svg' },
    ]

    for (const { re, rule } of checks) {
      const match = line.match(re)
      if (!match) continue
      if (isAllowed) {
        allowCount += 1
        continue
      }
      violations.push({
        path: relative(REPO_ROOT, filePath).split(sep).join('/'),
        line: lineNo,
        rule,
        snippet: line.trim(),
      })
    }
  }

  return { violations, allowCount }
}

function findComponentExports(indexSource) {
  // Strip whole-file-type-only exports (`export type { ... } from '...'`) — never components.
  const withoutTypeOnlyExports = indexSource.replace(/export\s+type\s*\{[^}]*\}\s*from[^\n]*/g, '')

  const names = []
  const exportBlockRe = /export\s*\{([\s\S]*?)\}\s*from\s*['"][^'"]+['"]/g
  let blockMatch
  while ((blockMatch = exportBlockRe.exec(withoutTypeOnlyExports))) {
    const body = blockMatch[1]
    for (const rawSpecifier of body.split(',')) {
      const specifier = rawSpecifier.trim()
      if (!specifier) continue
      if (specifier.startsWith('type ')) continue // type export within a mixed block
      // Handle `Foo as Bar` re-exports by taking the exported (right-hand) name.
      const exportedName = specifier.includes(' as ')
        ? specifier.split(' as ').pop().trim()
        : specifier
      names.push(exportedName)
    }
  }

  // A component export is a PascalCase identifier that isn't a `*Classes` utility-class export.
  return names.filter((name) => /^[A-Z][A-Za-z0-9]*$/.test(name) && !name.endsWith('Classes'))
}

function findMissingReadmeRows(componentNames, readmeSource) {
  const componentsSectionMatch = readmeSource.match(/## Components\b([\s\S]*?)(?=\n## |\n?$)/)
  const section = componentsSectionMatch ? componentsSectionMatch[1] : ''
  const missing = []
  for (const name of componentNames) {
    const mentioned = new RegExp(`\`${name}\``).test(section)
    if (!mentioned) missing.push(name)
  }
  return missing
}

/**
 * The three README structural checks below all exist because a union merge of two branches that
 * each edited README.md produced a Components table spliced onto itself: a second header row in
 * the middle of the table, every component listed twice, and two `##` sections repeated verbatim.
 * Markdown has no syntax error for any of that — GitHub renders the stray header row as ordinary
 * data — so nothing caught it until a whole-wave review read the file end to end.
 *
 * Returns the rows of the `## Components` table, as `{ line, cells }` where `line` is 1-based in
 * the whole README and `cells` are the trimmed pipe-delimited cells.
 *
 * @param {string} readmeSource
 */
function findComponentsTableRows(readmeSource) {
  const lines = readmeSource.split('\n')
  const startIdx = lines.findIndex((line) => /^## Components\b/.test(line))
  if (startIdx === -1) return []

  const rows = []
  for (let i = startIdx + 1; i < lines.length; i += 1) {
    const line = lines[i]
    if (/^## /.test(line)) break
    if (!line.trimStart().startsWith('|')) continue
    rows.push({
      line: i + 1,
      raw: line,
      cells: line
        .trim()
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map((cell) => cell.trim()),
    })
  }
  return rows
}

/** A markdown separator row: every cell is dashes (with optional alignment colons). */
function isSeparatorRow(row) {
  return row.cells.length > 0 && row.cells.every((cell) => /^:?-{3,}:?$/.test(cell))
}

/**
 * (a) A component name appearing in more than one Components-table row.
 *
 * The key is the row's first cell, so `Form` and `Form (v4 additions)` are legitimately distinct
 * rows, while two `PhoneField` rows are not.
 *
 * @param {string} readmeSource
 */
function findDuplicateComponentRows(readmeSource) {
  const rows = findComponentsTableRows(readmeSource).filter((row) => !isSeparatorRow(row))
  /** @type {Map<string, number[]>} */
  const seen = new Map()
  for (const row of rows) {
    const key = row.cells[0]
    if (!key) continue
    const lines = seen.get(key) ?? []
    lines.push(row.line)
    seen.set(key, lines)
  }

  const duplicates = []
  for (const [key, lines] of seen) {
    if (lines.length > 1) duplicates.push({ name: key, lines })
  }
  return duplicates
}

/**
 * (b) Any `##` / `###` heading text appearing more than once in the README.
 *
 * Compared by the heading's own level plus text, so a `### ZipField` under `## US fields` does not
 * collide with a hypothetical `## ZipField`.
 *
 * @param {string} readmeSource
 */
function findDuplicateHeadings(readmeSource) {
  const lines = readmeSource.split('\n')
  /** @type {Map<string, number[]>} */
  const seen = new Map()
  let inFence = false
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    if (/^\s*```/.test(line)) {
      inFence = !inFence
      continue
    }
    if (inFence) continue
    const match = line.match(/^(#{2,3})\s+(.*?)\s*$/)
    if (!match) continue
    const key = `${match[1]} ${match[2]}`
    const found = seen.get(key) ?? []
    found.push(i + 1)
    seen.set(key, found)
  }

  const duplicates = []
  for (const [key, found] of seen) {
    if (found.length > 1) duplicates.push({ heading: key, lines: found })
  }
  return duplicates
}

/**
 * (c) A table header row appearing mid-table.
 *
 * A header row is legitimate only at the very start of a table, immediately followed by a
 * separator row. So: find every separator row, and flag the row above it if that row is not the
 * table's first row (i.e. the line above it is itself a table row).
 *
 * @param {string} readmeSource
 */
function findMidTableHeaderRows(readmeSource) {
  const lines = readmeSource.split('\n')
  const isTableLine = (line) => typeof line === 'string' && line.trimStart().startsWith('|')

  const offenders = []
  let inFence = false
  for (let i = 0; i < lines.length; i += 1) {
    if (/^\s*```/.test(lines[i])) {
      inFence = !inFence
      continue
    }
    if (inFence) continue
    if (!isTableLine(lines[i])) continue
    const cells = lines[i]
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((cell) => cell.trim())
    const separator = cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell))
    if (!separator) continue
    // lines[i] is a separator; lines[i - 1] is its header row. That header is mid-table if the
    // line above *it* is also a table row.
    if (i >= 2 && isTableLine(lines[i - 1]) && isTableLine(lines[i - 2])) {
      offenders.push({ line: i, snippet: lines[i - 1].trim() })
    }
  }
  return offenders
}

function main() {
  const files = walk(SRC_DIR, [])
  files.sort()

  /** @type {Array<{path: string, line: number, rule: string, snippet: string}>} */
  const allViolations = []
  let totalAllows = 0

  for (const file of files) {
    const content = readFileSync(file, 'utf8')
    const { violations, allowCount } = checkFileLiterals(file, content)
    allViolations.push(...violations)
    totalAllows += allowCount
  }

  const indexSource = readFileSync(INDEX_PATH, 'utf8')
  const readmeSource = readFileSync(README_PATH, 'utf8')
  const componentNames = findComponentExports(indexSource)
  const missingReadmeRows = findMissingReadmeRows(componentNames, readmeSource)

  for (const name of missingReadmeRows) {
    allViolations.push({
      path: relative(REPO_ROOT, INDEX_PATH).split(sep).join('/'),
      line: 0,
      rule: 'missing-readme-row',
      snippet: name,
    })
  }

  const readmeRelPath = relative(REPO_ROOT, README_PATH).split(sep).join('/')

  for (const { name, lines } of findDuplicateComponentRows(readmeSource)) {
    allViolations.push({
      path: readmeRelPath,
      line: lines[1],
      rule: 'duplicate-readme-row',
      snippet: `${name} appears in ${lines.length} Components rows (lines ${lines.join(', ')})`,
    })
  }

  for (const { heading, lines } of findDuplicateHeadings(readmeSource)) {
    allViolations.push({
      path: readmeRelPath,
      line: lines[1],
      rule: 'duplicate-readme-heading',
      snippet: `"${heading}" appears ${lines.length} times (lines ${lines.join(', ')})`,
    })
  }

  for (const { line, snippet } of findMidTableHeaderRows(readmeSource)) {
    allViolations.push({
      path: readmeRelPath,
      line,
      rule: 'mid-table-header-row',
      snippet: `header row spliced into a table: ${snippet}`,
    })
  }

  if (allViolations.length > 0) {
    for (const v of allViolations) {
      const location = v.line > 0 ? `${v.path}:${v.line}` : v.path
      console.error(`${location}: ${v.rule}: ${v.snippet}`)
    }
    console.error(
      `\n${allViolations.length} guardrail violation(s), ${totalAllows} allow-listed line(s) skipped.`,
    )
    process.exitCode = 1
    return
  }

  console.log(
    `check-guardrails: ${files.length} file(s) scanned, 0 violations, ${totalAllows} allow-listed line(s), ${componentNames.length} exported component(s) all documented.`,
  )
}

main()
