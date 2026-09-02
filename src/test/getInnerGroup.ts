import { screen } from '@testing-library/react'

/**
 * The group element itself, not the `<fieldset>` wrapper around it: a
 * legend-labelled fieldset also has `role="group"` and the same accessible
 * name, so `getByRole('group', { name })` is ambiguous for these fields.
 */
export const getInnerGroup = (name: string): HTMLElement =>
  screen.getAllByRole('group', { name }).find((el) => el.tagName !== 'FIELDSET')!
