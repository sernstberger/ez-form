#!/usr/bin/env node
// CI guardrail: fail on `sx=` / ripple props / theme-unreachable literal JSX attributes in
// src/, and on exported components missing a README "## Components" row. See docs/PHILOSOPHY.md
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
