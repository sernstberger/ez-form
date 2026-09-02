import { useFormState } from 'react-hook-form'
import { useEzFormContext } from './useEzFormContext'

/** The shape react-router's `useBlocker` returns; any router can provide it. */
export interface FormGuardBlocker {
  state: 'unblocked' | 'blocked' | 'proceeding'
  proceed?: () => void
  reset?: () => void
}

export interface UseFormGuardReturn {
  /** Render a `ConfirmDialog` with `open={blocked}` when true. */
  blocked: boolean
  /** Leave anyway. */
  proceed: () => void
  /** Stay. */
  cancel: () => void
  /** `isDirty && !isSubmitting && !isSubmitSuccessful` — what was handed to the blocker. */
  shouldBlock: boolean
}

/**
 * Unsaved-changes guard for in-app navigation. Pass your router's blocker
 * hook (react-router: `useBlocker`); it is called with `shouldBlock` every
 * render, so it must be a stable hook, not a conditional one.
 *
 * ```tsx
 * const guard = useFormGuard(useBlocker)
 * <ConfirmDialog open={guard.blocked} title="Discard changes?" onConfirm={guard.proceed} onCancel={guard.cancel} />
 * ```
 */
export function useFormGuard(
  useBlocker: (shouldBlock: boolean) => FormGuardBlocker,
): UseFormGuardReturn {
  useEzFormContext('useFormGuard')
  const { isDirty, isSubmitting, isSubmitSuccessful } = useFormState()
  const shouldBlock = isDirty && !isSubmitting && !isSubmitSuccessful
  const blocker = useBlocker(shouldBlock)
  return {
    blocked: blocker.state === 'blocked',
    proceed: () => blocker.proceed?.(),
    cancel: () => blocker.reset?.(),
    shouldBlock,
  }
}
