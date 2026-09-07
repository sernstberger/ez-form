import type { ComponentType } from 'react'
import { render, cleanup } from '@testing-library/react'
import { composeStories } from '@storybook/react-vite'
import preview from '../../.storybook/preview'

/**
 * Repo-wide guard: **no story may render a `<form>` inside a `<form>`** (#128, #120).
 *
 * The preview decorator wraps a story in its own `<Form>` whenever `parameters.form` survives
 * Storybook's project → meta → story merge. A story that renders its own `<Form>` therefore has
 * to opt the decorator out, and the only value that does so is `parameters: { form: false }` —
 * Storybook's merge skips `undefined`, so the intuitive `{ form: undefined }` is a silent no-op
 * that leaves the meta's `form` in place. That no-op shipped twice before this test existed: once
 * as #120's bug, then again in #120's own fix, which copied the already-broken idiom from
 * `Switch.stories.tsx` because reading it could not reveal that it did nothing.
 *
 * Reading a story cannot tell you whether its opt-out worked. Rendering it can, and that is the
 * whole design of this file: sweep every `*.stories.tsx` under `src/`, render every export through
 * the real project annotations, and count `<form>` elements. A future story that copies the wrong
 * idiom fails here rather than in a browser console nobody has open.
 *
 * `<= 1`, not `=== 1`: plenty of stories legitimately render no form at all (a `ConfirmDialog`
 * on its own, a docs-only example). The invariant under test is only that no story renders two.
 *
 * `play` is deliberately not invoked. Nesting is structural — a decorator wraps the story before
 * any interaction can happen — so the initial tree answers the question, and running 30-odd
 * interaction scripts would turn a fast structural sweep into a multi-minute suite. Rendering also
 * exercises the console guard in `src/test/setup.ts`, so React's own "In HTML, <form> cannot be a
 * descendant of <form>" error fails the test on its own even before the count assertion.
 */

// Eager so the modules resolve at collection time and each file gets its own `describe`; a lazy
// glob would make every story a promise inside one opaque test.
const storyModules = import.meta.glob<Record<string, unknown>>('../**/*.stories.tsx', {
  eager: true,
})

const paths = Object.keys(storyModules).sort()

describe('every story renders at most one <form> (#128)', () => {
  it('finds the repo’s story files (guards against a glob that silently matches nothing)', () => {
    expect(paths.length).toBeGreaterThan(40)
  })

  it.each(paths)('%s', (path) => {
    // The glob is untyped by construction (50 unrelated modules), so `composeStories`'s
    // per-export inference has nothing to work from and yields `unknown`. Every composed export
    // is a renderable component that needs no props — that is `composeStories`'s contract — so
    // the entries are asserted to exactly that, once, here.
    const composed = composeStories(
      storyModules[path] as Parameters<typeof composeStories>[0],
      preview,
    ) as unknown as Record<string, ComponentType>
    for (const [name, Story] of Object.entries(composed)) {
      const { container } = render(<Story />)
      const forms = container.querySelectorAll('form')
      // Named in the message because `it.each` reports the file, not which export broke.
      expect(
        forms.length,
        `${path} → ${name} rendered ${forms.length} <form> elements. A story that renders its own <Form> must set \`parameters: { form: false }\` to opt the preview decorator out; \`{ form: undefined }\` does not work (see .storybook/preview.tsx).`,
      ).toBeLessThanOrEqual(1)
      cleanup()
    }
  })
})
