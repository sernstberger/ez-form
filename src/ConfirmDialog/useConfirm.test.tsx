import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useConfirm } from './useConfirm'

function Harness({ onResult }: { onResult: (ok: boolean) => void }) {
  const { confirm, dialog } = useConfirm()
  return (
    <>
      <button type="button" onClick={() => void confirm({ title: 'Really?' }).then(onResult)}>
        Ask
      </button>
      {dialog}
    </>
  )
}

describe('useConfirm', () => {
  it('opens the dialog on confirm() and resolves true on Confirm', async () => {
    const user = userEvent.setup()
    const onResult = vi.fn()
    render(<Harness onResult={onResult} />)
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ask' }))
    expect(screen.getByRole('alertdialog', { name: 'Really?' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Confirm' }))
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(true))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  })

  it('resolves false on Cancel and on Escape, once each', async () => {
    const user = userEvent.setup()
    const onResult = vi.fn()
    render(<Harness onResult={onResult} />)
    await user.click(screen.getByRole('button', { name: 'Ask' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(false))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Ask' }))
    await user.keyboard('{Escape}')
    await waitFor(() => expect(onResult).toHaveBeenCalledTimes(2))
    expect(onResult).toHaveBeenLastCalledWith(false)
  })
})
