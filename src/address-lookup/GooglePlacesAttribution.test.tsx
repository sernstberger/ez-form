import { render, screen } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { googlePlaces } from './googlePlaces'
import { GooglePlacesAttribution, googlePlacesAttributionClasses } from './GooglePlacesAttribution'
import { expectNoA11yViolations } from '../test/axe'

describe('GooglePlacesAttribution', () => {
  it('renders "Powered by Google" by default with its utility class', async () => {
    const { container } = render(<GooglePlacesAttribution className="mine" />)
    const root = screen.getByText('Powered by Google')
    expect(root).toHaveClass(googlePlacesAttributionClasses.root)
    expect(root).toHaveClass('mine')
    await expectNoA11yViolations(container)
  })

  it('is what googlePlaces() hands the field as attribution', () => {
    render(<>{googlePlaces({ apiKey: 'k' }).attribution}</>)
    expect(screen.getByText('Powered by Google')).toBeInTheDocument()
  })

  it('takes its content from theme defaultProps so an app can show the Google logo once', () => {
    const theme = createTheme({
      components: {
        EzGooglePlacesAttribution: {
          defaultProps: { children: <img alt="Google" src="data:," /> },
        },
      },
    })
    render(<ThemeProvider theme={theme}>{googlePlaces({ apiKey: 'k' }).attribution}</ThemeProvider>)
    expect(screen.getByRole('img', { name: 'Google' })).toBeInTheDocument()
    expect(screen.queryByText('Powered by Google')).not.toBeInTheDocument()
  })
})
