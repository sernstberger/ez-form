import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createTheme, ThemeProvider } from '@mui/material/styles'
import { LiveRegion, liveRegionClasses } from './LiveRegion'
import { expectNoA11yViolations } from '../test/axe'

describe('LiveRegion', () => {
  it('renders an empty polite status region at rest', () => {
    render(<LiveRegion />)
    const region = screen.getByRole('status')
    expect(region).toBeEmptyDOMElement()
    expect(region).toHaveAttribute('aria-live', 'polite')
    expect(region).toHaveClass(liveRegionClasses.root)
  })

  it('renders the message', () => {
    render(<LiveRegion message="Saved." />)
    expect(screen.getByRole('status')).toHaveTextContent('Saved.')
  })

  it('is assertive as an alert when asked', () => {
    render(<LiveRegion message="Boom" politeness="assertive" />)
    const region = screen.getByRole('alert')
    expect(region).toHaveAttribute('aria-live', 'assertive')
  })

  it('is visually hidden by default and visible when told not to be', () => {
    const { unmount } = render(<LiveRegion message="Hidden" />)
    expect(getComputedStyle(screen.getByRole('status')).position).toBe('absolute')
    unmount()

    render(<LiveRegion message="Shown" visuallyHidden={false} />)
    expect(getComputedStyle(screen.getByRole('status')).position).not.toBe('absolute')
  })

  it('replaces the node when announcementKey changes, so an identical message re-announces', async () => {
    const user = userEvent.setup()
    function Host() {
      const [seq, setSeq] = useState(0)
      return (
        <>
          <button type="button" onClick={() => setSeq((n) => n + 1)}>
            again
          </button>
          <LiveRegion message="Submit failed." announcementKey={seq} />
        </>
      )
    }
    render(<Host />)
    const first = screen.getByRole('status')
    expect(first).toHaveTextContent('Submit failed.')

    await user.click(screen.getByRole('button', { name: 'again' }))
    const second = screen.getByRole('status')
    expect(second).toHaveTextContent('Submit failed.')
    // A new node, not the same one re-rendered: assistive tech only announces a
    // content *change*, so re-rendering identical text would be silent.
    expect(second).not.toBe(first)
  })

  it('keeps the same node while the announcementKey holds, so an unrelated re-render does not re-announce', async () => {
    const user = userEvent.setup()
    function Host() {
      const [, setTick] = useState(0)
      return (
        <>
          <button type="button" onClick={() => setTick((n) => n + 1)}>
            rerender
          </button>
          <LiveRegion message="Steady." announcementKey={1} />
        </>
      )
    }
    render(<Host />)
    const first = screen.getByRole('status')
    await user.click(screen.getByRole('button', { name: 'rerender' }))
    expect(screen.getByRole('status')).toBe(first)
  })

  it('forwards arbitrary span props', () => {
    render(<LiveRegion message="x" id="announcer" data-testid="live" />)
    expect(document.getElementById('announcer')).toBe(screen.getByTestId('live'))
  })

  it('is themeable: defaultProps and styleOverrides.root apply', () => {
    const theme = createTheme({
      components: {
        EzLiveRegion: {
          defaultProps: { politeness: 'assertive' },
          styleOverrides: { root: { fontStyle: 'italic' } },
        },
      },
    })
    render(
      <ThemeProvider theme={theme}>
        <LiveRegion message="Themed" />
      </ThemeProvider>,
    )
    const region = screen.getByRole('alert')
    expect(region).toHaveAttribute('aria-live', 'assertive')
    expect(getComputedStyle(region).fontStyle).toBe('italic')
  })

  it("a consumer's own politeness beats the theme default", () => {
    const theme = createTheme({
      components: { EzLiveRegion: { defaultProps: { politeness: 'assertive' } } },
    })
    render(
      <ThemeProvider theme={theme}>
        <LiveRegion message="Polite" politeness="polite" />
      </ThemeProvider>,
    )
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<LiveRegion message="Announced" />)
    await expectNoA11yViolations(container)
  })
})
