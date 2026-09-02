import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const SCRIPT_PATH = fileURLToPath(new URL('./check-guardrails.mjs', import.meta.url))
const SCRIPT_SOURCE = readFileSync(SCRIPT_PATH, 'utf8')

/**
 * Sets up a throwaway repo root with a src/ dir, an index.ts, and a README.md, runs the
 * guardrail script against it, and returns { status, stdout, stderr }.
 *
 * @param {{files?: Record<string, string>, indexTs?: string, readme?: string}} opts
 */
function runGuardrails({ files = {}, indexTs, readme }) {
  const root = mkdtempSync(join(tmpdir(), 'guardrail-test-'))
  try {
    mkdirSync(join(root, 'src'), { recursive: true })
    writeFileSync(join(root, 'src', 'index.ts'), indexTs ?? `export { Widget } from './Widget'\n`)
    writeFileSync(
      join(root, 'README.md'),
      readme ??
        '## Components\n\n| Component | Wraps |\n| --- | --- |\n| `Widget` | MUI Button |\n',
    )
    for (const [relPath, content] of Object.entries(files)) {
      const full = join(root, relPath)
      mkdirSync(join(full, '..'), { recursive: true })
      writeFileSync(full, content)
    }

    // The script resolves REPO_ROOT relative to its own location (../ from scripts/), so copy
    // it into the fixture root's scripts/ dir and run it from there.
    const scriptsDir = join(root, 'scripts')
    mkdirSync(scriptsDir, { recursive: true })
    const scriptCopy = join(scriptsDir, 'check-guardrails.mjs')
    writeFileSync(scriptCopy, SCRIPT_SOURCE)

    try {
      const stdout = execFileSync('node', [scriptCopy], { encoding: 'utf8' })
      return { status: 0, stdout, stderr: '' }
    } catch (err) {
      return {
        status: err.status,
        stdout: err.stdout?.toString() ?? '',
        stderr: err.stderr?.toString() ?? '',
      }
    }
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

test('passes on a clean fixture with no violations', () => {
  const result = runGuardrails({
    files: {
      'src/Widget.tsx': `export function Widget() {\n  return <button>ok</button>\n}\n`,
    },
  })
  assert.equal(result.status, 0)
  assert.match(result.stdout, /0 violations/)
})

test('catches sx= JSX attribute', () => {
  const result = runGuardrails({
    files: {
      'src/Widget.tsx': `export function Widget() {\n  return <div sx={{ m: 1 }}>ok</div>\n}\n`,
    },
  })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /no-sx/)
  assert.match(result.stderr, /Widget\.tsx:2/)
})

test('catches literal variant="x" JSX attribute', () => {
  const result = runGuardrails({
    files: {
      'src/Widget.tsx': `export function Widget() {\n  return <Button variant="contained">ok</Button>\n}\n`,
    },
  })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /no-literal-style-prop/)
})

test('allows variant={variable} JSX expression', () => {
  const result = runGuardrails({
    files: {
      'src/Widget.tsx': `export function Widget({ variant }) {\n  return <Button variant={variant}>ok</Button>\n}\n`,
    },
  })
  assert.equal(result.status, 0)
  assert.match(result.stdout, /0 violations/)
})

test('honours the guardrail allow-list trailing comment', () => {
  const result = runGuardrails({
    files: {
      'src/Widget.tsx':
        `export function Widget() {\n` +
        `  return (\n` +
        `    <div\n` +
        `      sx={{ m: 1 }} // guardrail: allow #1 (tracked)\n` +
        `    >\n` +
        `      ok\n` +
        `    </div>\n` +
        `  )\n` +
        `}\n`,
    },
  })
  assert.equal(result.status, 0)
  assert.match(result.stdout, /0 violations/)
  assert.match(result.stdout, /1 allow-listed line/)
})

test('catches ripple props disableRipple / focusRipple', () => {
  const result = runGuardrails({
    files: {
      'src/Widget.tsx': `export function Widget() {\n  return <Button disableRipple>ok</Button>\n}\n`,
    },
  })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /no-ripple-prop/)
})

test('catches a hand-rolled inline SVG path', () => {
  const result = runGuardrails({
    files: {
      'src/Widget.tsx':
        `import SvgIcon from '@mui/material/SvgIcon'\n` +
        `export function Widget() {\n` +
        `  return <SvgIcon><path d="M1 1h1v1z" /></SvgIcon>\n` +
        `}\n`,
    },
  })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /no-inline-svg/)
})

test('catches createSvgIcon(...)', () => {
  const result = runGuardrails({
    files: {
      'src/Widget.tsx':
        `import createSvgIcon from '@mui/material/utils/createSvgIcon'\n` +
        `const Icon = createSvgIcon(<path d="M1 1h1v1z" />, 'Icon')\n` +
        `export function Widget() {\n  return <Icon />\n}\n`,
    },
  })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /no-inline-svg/)
})

test('allows importing icons from @mui/icons-material', () => {
  const result = runGuardrails({
    files: {
      'src/Widget.tsx':
        `import UploadFile from '@mui/icons-material/UploadFile'\n` +
        `export function Widget() {\n  return <UploadFile />\n}\n`,
    },
  })
  assert.equal(result.status, 0)
  assert.match(result.stdout, /0 violations/)
})

test('catches an exported component missing a README Components row', () => {
  const result = runGuardrails({
    indexTs: `export { Widget } from './Widget'\nexport { Gadget } from './Gadget'\n`,
    readme: '## Components\n\n| Component | Wraps |\n| --- | --- |\n| `Widget` | MUI Button |\n',
    files: {
      'src/Widget.tsx': `export function Widget() {\n  return <button>ok</button>\n}\n`,
      'src/Gadget.tsx': `export function Gadget() {\n  return <button>ok</button>\n}\n`,
    },
  })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /missing-readme-row/)
  assert.match(result.stderr, /Gadget/)
})

test('ignores .stories.tsx and .test.tsx files', () => {
  const result = runGuardrails({
    files: {
      'src/Widget.tsx': `export function Widget() {\n  return <button>ok</button>\n}\n`,
      'src/Widget.stories.tsx': `export const Story = () => <div sx={{ m: 1 }} />\n`,
      'src/Widget.test.tsx': `test('x', () => { const el = <div sx={{ m: 1 }} /> })\n`,
    },
  })
  assert.equal(result.status, 0)
})

test('ignores src/examples/** and src/test/**', () => {
  const result = runGuardrails({
    files: {
      'src/Widget.tsx': `export function Widget() {\n  return <button>ok</button>\n}\n`,
      'src/examples/Demo.tsx': `export const Demo = () => <div sx={{ m: 1 }} />\n`,
      'src/test/helpers.tsx': `export const Helper = () => <div sx={{ m: 1 }} />\n`,
    },
  })
  assert.equal(result.status, 0)
})

test('does not flag type-only or *Classes exports as components needing a README row', () => {
  const result = runGuardrails({
    indexTs:
      `export { Widget, widgetClasses, type WidgetProps } from './Widget'\n` +
      `export type { SomeType } from './types'\n` +
      `export { useWidget } from './useWidget'\n`,
    readme: '## Components\n\n| Component | Wraps |\n| --- | --- |\n| `Widget` | MUI Button |\n',
    files: {
      'src/Widget.tsx': `export function Widget() {\n  return <button>ok</button>\n}\n`,
    },
  })
  assert.equal(result.status, 0)
})

// --- README structural checks (the union-merge damage class) ------------------------------------

const CLEAN_SRC = {
  'src/Widget.tsx': `export function Widget() {\n  return <button>ok</button>\n}\n`,
}

test('catches a component listed in two Components-table rows', () => {
  const result = runGuardrails({
    readme:
      '## Components\n\n| Component | Wraps |\n| --- | --- |\n' +
      '| `Widget` | MUI Button |\n| `Widget` | MUI Button (again) |\n',
    files: CLEAN_SRC,
  })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /duplicate-readme-row/)
  assert.match(result.stderr, /`Widget` appears in 2 Components rows \(lines 5, 6\)/)
})

test('allows distinct Components rows that share a component name in prose', () => {
  const result = runGuardrails({
    readme:
      '## Components\n\n| Component | Wraps |\n| --- | --- |\n' +
      '| `Widget` | MUI Button |\n| `Widget` (v4 additions) | see `Widget` above |\n',
    files: CLEAN_SRC,
  })
  assert.equal(result.status, 0)
})

test('catches a duplicated ## heading', () => {
  const result = runGuardrails({
    readme:
      '## Components\n\n| Component | Wraps |\n| --- | --- |\n| `Widget` | MUI Button |\n\n' +
      '## Theming\n\nfirst copy\n\n## Theming\n\nsecond copy\n',
    files: CLEAN_SRC,
  })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /duplicate-readme-heading/)
  assert.match(result.stderr, /"## Theming" appears 2 times/)
})

test('catches a duplicated ### heading', () => {
  const result = runGuardrails({
    readme:
      '## Components\n\n| Component | Wraps |\n| --- | --- |\n| `Widget` | MUI Button |\n\n' +
      '## Theming\n\n### Slots\n\nfirst\n\n### Slots\n\nsecond\n',
    files: CLEAN_SRC,
  })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /duplicate-readme-heading/)
  assert.match(result.stderr, /"### Slots" appears 2 times/)
})

test('does not confuse a ### heading with a same-named ## heading', () => {
  const result = runGuardrails({
    readme:
      '## Components\n\n| Component | Wraps |\n| --- | --- |\n| `Widget` | MUI Button |\n\n' +
      '## Slots\n\ntop level\n\n### Slots\n\nsub level\n',
    files: CLEAN_SRC,
  })
  assert.equal(result.status, 0)
})

test('ignores headings inside fenced code blocks', () => {
  const result = runGuardrails({
    readme:
      '## Components\n\n| Component | Wraps |\n| --- | --- |\n| `Widget` | MUI Button |\n\n' +
      '## Theming\n\n```md\n## Theming\n## Theming\n```\n',
    files: CLEAN_SRC,
  })
  assert.equal(result.status, 0)
})

test('catches a header row spliced into the middle of a table', () => {
  const result = runGuardrails({
    readme:
      '## Components\n\n| Component | Wraps |\n| --- | --- |\n| `Widget` | MUI Button |\n' +
      '| Component | Wraps |\n| --- | --- |\n| `Gadget` | MUI Chip |\n',
    indexTs: `export { Widget } from './Widget'\nexport { Gadget } from './Gadget'\n`,
    files: {
      ...CLEAN_SRC,
      'src/Gadget.tsx': `export function Gadget() {\n  return <button>ok</button>\n}\n`,
    },
  })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /mid-table-header-row/)
})

test('allows two separate tables each with their own header', () => {
  const result = runGuardrails({
    readme:
      '## Components\n\n| Component | Wraps |\n| --- | --- |\n| `Widget` | MUI Button |\n\n' +
      '## Theming\n\n| Key | Slots |\n| --- | --- |\n| `EzWidget` | root |\n',
    files: CLEAN_SRC,
  })
  assert.equal(result.status, 0)
})
