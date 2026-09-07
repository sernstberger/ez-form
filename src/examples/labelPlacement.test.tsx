import { render, screen, waitFor } from '@testing-library/react'
import { createTheme, ThemeProvider } from '@mui/material/styles'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import type { ReactElement } from 'react'
import { Checkout } from './Checkout/Checkout'
import { Loan } from './Loan/Loan'
import { Login } from './Login/Login'
import { Profile } from './Profile/Profile'
import { SignUp } from './SignUp/SignUp'
import { Insurance } from './Insurance/Insurance'
import { fieldLayoutClasses, type LabelPlacement } from '../fields/LabelPlacementContext'
import { expectNoA11yViolations } from '../test/axe'

/**
 * #66's headline acceptance line, against the six real forms: a single
 * `theme.components.EzForm.defaultProps.labelPlacement` flips a whole app, with
 * no per-form and no per-field props — and every field in every example still
 * renders, still names its control, and is still axe-clean afterwards.
 *
 * The examples own their own `<Form>`, so the theme is the only way in from
 * outside, which is exactly what makes this the honest test of that line rather
 * than a restatement of the unit tests.
 */

/**
 * `settle` is for the one example that loads its defaults asynchronously
 * (`Profile`): rendering it and asserting immediately leaves the resolve landing
 * outside `act`, which the console guard in `src/test/setup.ts` fails — correctly,
 * since a placement assertion taken mid-load is an assertion about a disabled,
 * empty form. Every other example is synchronous and needs nothing.
 */
const examples: [name: string, element: ReactElement, settle?: () => Promise<void>][] = [
  ['Login', <Login />],
  ['SignUp', <SignUp />],
  ['Checkout', <Checkout />],
  [
    'Profile',
    <Profile />,
    async () => {
      await waitFor(() => expect(screen.getByLabelText(/display name/i)).toBeEnabled())
    },
  ],
  ['Loan', <Loan />],
  ['Insurance', <Insurance />],
]

const themed = (placement: LabelPlacement) =>
  createTheme({ components: { EzForm: { defaultProps: { labelPlacement: placement } } } })

describe.each(['floating', 'stacked', 'start'] as const)(
  'examples under a theme labelPlacement=%s',
  (placement) => {
    it.each(examples)(
      '%s renders every field box under the placement',
      async (_name, element, settle) => {
        const { container } = render(
          <ThemeProvider theme={themed(placement)}>
            {/* Profile and Insurance carry their own provider (#125); a second one
                nested is harmless, and the others need this one. */}
            <LocalizationProvider dateAdapter={AdapterDateFns}>{element}</LocalizationProvider>
          </ThemeProvider>,
        )
        await settle?.()
        const boxes = container.querySelectorAll(`.${fieldLayoutClasses[placement]}`)
        // Every example has fields; a form that rendered none would pass every other
        // assertion here vacuously.
        expect(boxes.length).toBeGreaterThan(0)
        // No field is left un-placed: a family that missed the wiring would show up
        // as a `root` with no placement class.
        expect(container.querySelectorAll(`.${fieldLayoutClasses.root}`)).toHaveLength(boxes.length)
        // The form's own submit is still there — the layout did not swallow anything.
        expect(screen.getAllByRole('button').length).toBeGreaterThan(0)
        await expectNoA11yViolations(container)
      },
    )
  },
)
