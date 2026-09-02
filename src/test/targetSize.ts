const MIN = 24

function px(value: string): number | null {
  if (!value || value === 'auto' || value === 'none' || value === 'normal') return null
  const n = Number.parseFloat(value)
  return Number.isNaN(n) ? null : n
}

function sum(...values: (number | null)[]): number | null {
  const nums = values.filter((v): v is number => v !== null)
  return nums.length === 0 ? null : nums.reduce((a, b) => a + b, 0)
}

/**
 * WCAG 2.5.8 Target Size (Minimum): every icon-only control this library
 * renders (an `IconButton`, or a bare `SvgIcon` given a click handler and a
 * role, like `FileField`'s chip delete icon) declares CSS that guarantees at
 * least a 24×24 CSS px target.
 *
 * jsdom never runs layout, so there is no rendered box to measure — this
 * reconstructs a *lower-bound* box from declared CSS alone, in order:
 *   1. an explicit `min-width`/`min-height` (the functional-minimum pattern
 *      this library uses on its own styled slots), or
 *   2. an explicit `width`/`height` (e.g. `OtpField`'s slot inputs), or
 *   3. for icon-only content, `padding` on both sides of the axis plus the
 *      icon's `font-size` (how `IconButton` sizes its icon: MUI never sets
 *      an explicit width/height there, so the icon's `font-size` is the only
 *      declared proxy for its rendered box).
 * If none of these resolve to a pixel value, this fails loudly rather than
 * passing silently — that means the element's size (if any) comes from
 * something jsdom cannot see, not that it is compliant.
 *
 * This deliberately does not attempt a text `Button`: MUI sizes those with
 * `padding` plus `theme.typography.button`'s unitless `line-height`
 * multiplier, which needs real font metrics to resolve to pixels — jsdom has
 * none. A plain `Button`'s compliance (its padding and typography guarantee
 * ≥24px even at `size="small"`) is verified by reasoning in the audit
 * report, not by this helper; call it only on icon-only controls.
 */
export function expectTargetSize(el: HTMLElement): void {
  const style = getComputedStyle(el)
  const width =
    px(style.minWidth) ??
    px(style.width) ??
    sum(px(style.paddingLeft), px(style.paddingRight), px(style.fontSize))
  const height =
    px(style.minHeight) ??
    px(style.height) ??
    sum(px(style.paddingTop), px(style.paddingBottom), px(style.fontSize))
  expect(
    width,
    `${describe(el)}: could not determine a width from minWidth/width/padding+fontSize`,
  ).not.toBeNull()
  expect(
    height,
    `${describe(el)}: could not determine a height from minHeight/height/padding+fontSize`,
  ).not.toBeNull()
  expect(width!, `${describe(el)}: width ${width}px < ${MIN}px`).toBeGreaterThanOrEqual(MIN)
  expect(height!, `${describe(el)}: height ${height}px < ${MIN}px`).toBeGreaterThanOrEqual(MIN)
}

function describe(el: HTMLElement): string {
  const name = el.getAttribute('aria-label') ?? el.textContent?.trim() ?? el.tagName
  return `<${el.tagName.toLowerCase()}> "${name}"`
}
