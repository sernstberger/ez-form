import { useCallback, useRef, useState, type ReactNode } from 'react'
import { ConfirmDialog, type ConfirmOptions } from './ConfirmDialog'

export interface UseConfirmReturn {
  /** Opens the dialog; resolves `true` on Confirm, `false` on Cancel / Escape / backdrop. */
  confirm: (options: ConfirmOptions) => Promise<boolean>
  /** Render this once, anywhere in the tree. */
  dialog: ReactNode
}

/**
 * Promise-style confirmation. One pending request at a time; a second
 * `confirm()` while one is open resolves the first as `false`.
 */
export function useConfirm(): UseConfirmReturn {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const [open, setOpen] = useState(false)
  const resolveRef = useRef<((ok: boolean) => void) | null>(null)

  const settle = useCallback((ok: boolean) => {
    resolveRef.current?.(ok)
    resolveRef.current = null
    setOpen(false)
  }, [])

  const confirm = useCallback(
    (next: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        resolveRef.current?.(false)
        resolveRef.current = resolve
        setOptions(next)
        setOpen(true)
      }),
    [],
  )

  // Options stay mounted while the dialog closes so the exit transition keeps its text.
  const dialog = options ? (
    <ConfirmDialog
      {...options}
      open={open}
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
  ) : null

  return { confirm, dialog }
}
