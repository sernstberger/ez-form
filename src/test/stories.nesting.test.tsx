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
 * The assertion is on **nesting**, not on a count. Most stories render zero or one `<form>`, but a
 * comparison story legitimately renders several *side by side* — `LabelPlacement.stories.tsx`'s
 * `AllThree` puts one form per placement next to each other, which is the entire point of it.
 * A flat `<= 1` count called that a failure while the thing it exists to catch — a `<form>` with a
 * `<form>` ancestor — is exactly what `.closest('form')` answers, for any number of forms.
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
      // A `<form>` with a `<form>` ancestor. `parentElement` first so a form is never
      // found by `closest` as its own ancestor.
      const nested = [...container.querySelectorAll('form')].filter((form) =>
        form.parentElement?.closest('form'),
      )
      // Named in the message because `it.each` reports the file, not which export broke.
      expect(
        nested.length,
        `${path} → ${name} rendered a <form> inside a <form>. A story that renders its own <Form> must set \`parameters: { form: false }\` to opt the preview decorator out; \`{ form: undefined }\` does not work (see .storybook/preview.tsx).`,
      ).toBe(0)
      cleanup()
    }
  })
})
