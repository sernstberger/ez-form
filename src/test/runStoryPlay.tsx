import type { ComponentType } from 'react'
import { render, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

/**
 * Minimal stand-in for Storybook's own play context (`{ canvasElement, canvas, userEvent }`),
 * built from `@testing-library/react` + `@testing-library/user-event` directly. This project
 * doesn't wire up `@storybook/addon-vitest`'s browser-mode runner, so a composed story's own
 * `.play` isn't otherwise invokable from a plain jsdom `vitest` run — this gives it the same
 * shape the real Storybook test-runner would, just enough to prove the function runs to
 * completion without throwing (see #77).
 */
export async function runStoryPlay(Story: ComponentType & { play?: (...a: never[]) => unknown }) {
  const { container } = render(<Story />)
  const canvas = within(container)
  const user = userEvent.setup()
  await Story.play?.({ canvasElement: container, canvas, userEvent: user } as never)
  return { container, canvas }
}
