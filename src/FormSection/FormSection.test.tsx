import { createTheme, ThemeProvider } from '@mui/material/styles'
import { render, screen, within } from '@testing-library/react'
import { z } from 'zod'
import { Form } from '../Form'
import { TextField } from '../fields/TextField'
import { expectNoA11yViolations } from '../test/axe'
import { FormSection, formSectionClasses } from './FormSection'

const schema = z.object({ street: z.string(), city: z.string() })
const wrap = (ui: React.ReactNode) =>
  render(
    <Form schema={schema} defaultValues={{ street: '', city: '' }} onSubmit={() => {}}>
      {ui}
    </Form>,
  )

describe('FormSection', () => {
  it('is a named group containing its fields, with a heading legend', () => {
    wrap(
      <FormSection title="Address" description="Where we ship">
        <TextField name="street" label="Street" />
      </FormSection>,
    )
    const group = screen.getByRole('group', { name: 'Address' })
    expect(group.tagName).toBe('FIELDSET')
    expect(group).toHaveAccessibleDescription('Where we ship')
    expect(within(group).getByRole('textbox', { name: 'Street' })).toBeInTheDocument()
    const heading = screen.getByRole('heading', { level: 3, name: 'Address' })
    expect(heading.closest('legend')).not.toBeNull()
  })

  it('disabled disables every control inside (native fieldset)', () => {
    wrap(
      <FormSection title="Address" disabled>
        <TextField name="street" label="Street" />
      </FormSection>,
    )
    expect(screen.getByRole('textbox', { name: 'Street' })).toBeDisabled()
  })

  it('aria-labelledby without a title names the group externally and renders no legend', () => {
    wrap(
      <>
        <span id="ext">External</span>
        <FormSection aria-labelledby="ext">
          <TextField name="city" label="City" />
        </FormSection>
      </>,
    )
    const group = screen.getByRole('group', { name: 'External' })
    expect(group).toBeInTheDocument()
    // Scoped to the section itself: MUI's outlined TextField renders its own
    // `<legend>` internally (NotchedOutline), unrelated to FormSection's legend.
    expect(group.querySelector(`.${formSectionClasses.legend}`)).toBeNull()
    expect(screen.queryByRole('heading')).toBeNull()
  })

  it('theme defaultProps and styleOverrides reach every slot', () => {
    const theme = createTheme({
      components: {
        EzFormSection: {
          defaultProps: { slotProps: { legend: { component: 'h4' } } },
          styleOverrides: {
            root: { letterSpacing: '1px' },
            legend: { letterSpacing: '2px' },
            description: { letterSpacing: '3px' },
            content: { letterSpacing: '4px' },
          },
        },
      },
    })
    render(
      <ThemeProvider theme={theme}>
        <Form schema={schema} onSubmit={() => {}}>
          <FormSection title="A" description="D">
            <TextField name="city" label="City" />
          </FormSection>
        </Form>
      </ThemeProvider>,
    )
    const root = screen.getByRole('group', { name: 'A' })
    expect(getComputedStyle(root).letterSpacing).toBe('1px')
    expect(screen.getByRole('heading', { level: 4, name: 'A' })).toBeInTheDocument()
    expect(
      getComputedStyle(root.querySelector(`.${formSectionClasses.legend}`)!).letterSpacing,
    ).toBe('2px')
    expect(
      getComputedStyle(root.querySelector(`.${formSectionClasses.description}`)!).letterSpacing,
    ).toBe('3px')
    expect(
      getComputedStyle(root.querySelector(`.${formSectionClasses.content}`)!).letterSpacing,
    ).toBe('4px')
  })

  it('has no a11y violations', async () => {
    const { container } = wrap(
      <FormSection title="Address" description="Where we ship">
        <TextField name="street" label="Street" />
        <TextField name="city" label="City" />
      </FormSection>,
    )
    await expectNoA11yViolations(container)
  })

  it('a slotProps.description id cannot clobber the generated id aria-describedby points at', () => {
    wrap(
      <FormSection
        title="Address"
        description="Where we ship"
        slotProps={{ description: { id: 'custom' } }}
      >
        <TextField name="street" label="Street" />
      </FormSection>,
    )
    const group = screen.getByRole('group', { name: 'Address' })
    expect(group).toHaveAccessibleDescription('Where we ship')
  })

  describe('nested legend heading depth', () => {
    it('defaults to h3 at the top level', () => {
      wrap(
        <FormSection title="Address">
          <TextField name="street" label="Street" />
        </FormSection>,
      )
      expect(screen.getByRole('heading', { level: 3, name: 'Address' })).toBeInTheDocument()
    })

    it('a section nested one level in gets h4, and one nested inside that gets h5', () => {
      wrap(
        <FormSection title="Outer">
          <FormSection title="Inner">
            <FormSection title="Innermost">
              <TextField name="street" label="Street" />
            </FormSection>
          </FormSection>
        </FormSection>,
      )
      expect(screen.getByRole('heading', { level: 3, name: 'Outer' })).toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 4, name: 'Inner' })).toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 5, name: 'Innermost' })).toBeInTheDocument()
    })

    it('caps at h6 for deeply nested sections', () => {
      wrap(
        <FormSection title="L3">
          <FormSection title="L4">
            <FormSection title="L5">
              <FormSection title="L6">
                <FormSection title="L6-too">
                  <TextField name="street" label="Street" />
                </FormSection>
              </FormSection>
            </FormSection>
          </FormSection>
        </FormSection>,
      )
      expect(screen.getByRole('heading', { level: 6, name: 'L6' })).toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 6, name: 'L6-too' })).toBeInTheDocument()
    })

    it('an explicit slotProps.legend.component overrides the depth default', () => {
      wrap(
        <FormSection title="Outer">
          <FormSection title="Inner" slotProps={{ legend: { component: 'h2' } }}>
            <TextField name="street" label="Street" />
          </FormSection>
        </FormSection>,
      )
      expect(screen.getByRole('heading', { level: 3, name: 'Outer' })).toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 2, name: 'Inner' })).toBeInTheDocument()
    })

    it('a theme default for slotProps.legend.component wins over the depth default', () => {
      const theme = createTheme({
        components: {
          EzFormSection: {
            defaultProps: { slotProps: { legend: { component: 'h2' } } },
          },
        },
      })
      render(
        <ThemeProvider theme={theme}>
          <Form schema={schema} onSubmit={() => {}}>
            <FormSection title="Outer">
              <FormSection title="Inner">
                <TextField name="city" label="City" />
              </FormSection>
            </FormSection>
          </Form>
        </ThemeProvider>,
      )
      expect(screen.getByRole('heading', { level: 2, name: 'Outer' })).toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 2, name: 'Inner' })).toBeInTheDocument()
    })
  })
})
