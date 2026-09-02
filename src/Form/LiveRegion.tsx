import { type ComponentProps, type ElementType, type ReactNode } from 'react'
import { useDefaultProps } from '@mui/material/DefaultPropsProvider'
import generateUtilityClasses from '@mui/material/generateUtilityClasses'
import { styled } from '@mui/material/styles'

export const liveRegionClasses = generateUtilityClasses('EzLiveRegion', ['root'])

export interface LiveRegionProps extends Omit<ComponentProps<'span'>, 'children' | 'role'> {
  /**
   * What to announce. An empty/absent message renders an empty region, which is
   * the correct resting state: the region must be in the DOM *before* the text
   * arrives or assistive tech has nothing to observe changing.
   */
  message?: ReactNode
  /**
   * Bump to re-announce a message identical to the last one. Assistive tech
   * announces a live region when its *content changes*, so setting the same
   * text twice (a second failed submit, removing row 2 twice) is otherwise
   * silent. This value is the region's React `key`, so a change to it mounts a
   * fresh node and the identical text counts as new content.
   *
   * Callers whose messages are naturally distinct (a strength meter's tier) can
   * ignore it; callers announcing repeatable events should pass a counter they
   * increment per announcement.
   */
  announcementKey?: string | number
  /**
   * `'polite'` (default) waits for a pause in speech; `'assertive'` interrupts.
   * Drives both `aria-live` and the matching implicit role (`status` / `alert`).
   * A directly-passed `aria-live` wins, and the role follows it.
   */
  politeness?: 'polite' | 'assertive'
  /**
   * Hides the region visually while leaving it in the accessibility tree — the
   * default, for an announcement with no visible counterpart. Pass `false`
   * where the text is *also* the visible UI (a strength meter's label, a field
   * array's status line) so a single node serves both readings.
   */
  visuallyHidden?: boolean
  /**
   * What to render as — a tag name, or a component that takes `className` and
   * `children` (MUI's `Typography`, say, so a visible region keeps a typography
   * variant). Defaults to `span`. Extra props for it pass straight through.
   */
  component?: ElementType
}

// The clip-rect visually-hidden recipe lives on the styled slot's default style
// block rather than as `sx`, so `theme.components.EzLiveRegion.styleOverrides.root`
// overrides any part of it. `visuallyHidden={false}` drops the whole block instead
// of fighting it with resets, so a visible caller starts from an unstyled span.
// No custom `shouldForwardProp`: MUI's default already keeps `ownerState` off the
// DOM, and overriding it breaks Emotion's `as` (verified — a custom predicate
// drops the swap silently), which is what `component` relies on.
const LiveRegionRoot = styled('span', {
  name: 'EzLiveRegion',
  slot: 'Root',
})<{ ownerState: { visuallyHidden: boolean } }>(({ ownerState }) =>
  ownerState.visuallyHidden
    ? {
        position: 'absolute',
        width: 1,
        height: 1,
        padding: 0,
        margin: -1,
        overflow: 'hidden',
        clip: 'rect(0 0 0 0)',
        clipPath: 'inset(50%)',
        whiteSpace: 'nowrap',
        borderWidth: 0,
      }
    : {},
)

/**
 * One announcement region — `role="status"` (or `"alert"` when assertive), the
 * visually-hidden recipe by default, and `announcementKey` for the repeat case.
 *
 * It is deliberately dumb: it holds no timers and no state, so *when* to
 * announce stays with the component that knows (a form's submit lifecycle, a
 * wizard's step change), and this owns only how the region is expressed. Render
 * it unconditionally with an empty `message` at rest rather than mounting it
 * alongside the text — a region that appears in the same commit as its content
 * is unreliably announced, since there was no prior content to change from.
 */
export function LiveRegion(inProps: LiveRegionProps) {
  const {
    message,
    announcementKey,
    politeness = 'polite',
    visuallyHidden = true,
    component,
    className,
    'aria-live': ariaLive,
    ...rest
  } = useDefaultProps({ props: inProps, name: 'EzLiveRegion' })

  // A consumer's explicit `aria-live` wins over `politeness` (it would otherwise
  // be silently dropped, since these attributes are set after the spread), and
  // the role follows it so the two never disagree — an `aria-live="assertive"`
  // region labelled `role="status"` is a contradiction assistive tech resolves
  // unpredictably.
  const live = ariaLive ?? politeness

  return (
    <LiveRegionRoot
      key={announcementKey}
      // Emotion's `as` (not MUI's `component`, which only MUI's own components
      // implement) is what swaps the element on a `styled('span')`.
      as={component}
      {...rest}
      ownerState={{ visuallyHidden }}
      role={live === 'assertive' ? 'alert' : 'status'}
      aria-live={live}
      className={`${liveRegionClasses.root}${className ? ` ${className}` : ''}`}
    >
      {message}
    </LiveRegionRoot>
  )
}
