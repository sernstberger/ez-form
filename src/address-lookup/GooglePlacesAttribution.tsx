import type { HTMLAttributes, ReactNode } from 'react'
import { styled } from '@mui/material/styles'
import { useDefaultProps } from '@mui/material/DefaultPropsProvider'
import generateUtilityClasses from '@mui/material/generateUtilityClasses'
import { cx } from '../cx'

export const googlePlacesAttributionClasses = generateUtilityClasses('EzGooglePlacesAttribution', [
  'root',
])

export interface GooglePlacesAttributionProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * What to show. The library default is the text "Powered by Google"; Google's Places policy
   * asks for its logo when results are shown without a Google map, and the logo asset is not
   * something this package can ship, so pass the official image here (or set it once for the
   * whole app via `theme.components.EzGooglePlacesAttribution.defaultProps.children`).
   */
  children?: ReactNode
}

const GooglePlacesAttributionRoot = styled('div', {
  name: 'EzGooglePlacesAttribution',
  slot: 'Root',
})({})

/**
 * The attribution line `googlePlaces()` renders under the suggestion list. It is a plain block
 * with a class and a theme slot; a theme decides how it looks and, through `defaultProps`, what
 * it shows.
 */
export function GooglePlacesAttribution(inProps: GooglePlacesAttributionProps) {
  const {
    children = 'Powered by Google',
    className,
    ...rest
  } = useDefaultProps({ props: inProps, name: 'EzGooglePlacesAttribution' })
  return (
    <GooglePlacesAttributionRoot
      className={cx(googlePlacesAttributionClasses.root, className)}
      {...rest}
    >
      {children}
    </GooglePlacesAttributionRoot>
  )
}
