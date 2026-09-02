import type { ReactElement } from 'react'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'

/** Pickers need an adapter above them; tests use date-fns, so form values are plain `Date`s. */
export const withPickers = (element: ReactElement) => (
  <LocalizationProvider dateAdapter={AdapterDateFns}>{element}</LocalizationProvider>
)
