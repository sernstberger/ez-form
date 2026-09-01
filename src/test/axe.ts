import { axe } from 'jest-axe'

/**
 * Runs axe-core on a rendered container and fails on any violation.
 * `color-contrast` is skipped automatically in jsdom (no layout); nothing
 * else is disabled. If a real violation appears, fix the component, not the rule.
 */
export async function expectNoA11yViolations(container: Element): Promise<void> {
  expect(await axe(container)).toHaveNoViolations()
}
