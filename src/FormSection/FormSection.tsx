import {
  createContext,
  forwardRef,
  useContext,
  useId,
  type FieldsetHTMLAttributes,
  type ReactNode,
  type Ref,
} from 'react'
import { useDefaultProps } from '@mui/material/DefaultPropsProvider'
import generateUtilityClasses from '@mui/material/generateUtilityClasses'
import { styled } from '@mui/material/styles'
import Typography from '@mui/material/Typography'
import type { FormTextSlotProps } from '../Form'

/**
 * How many `FormSection`s deep the current one is nested (0 at the top level).
 * Drives the legend's default heading level (`h${3 + depth}`, capped at `h6`)
 * so nested sections — a step containing sub-sections, or plain nesting
 * outside a wizard — produce a correct heading hierarchy without every call
 * site specifying `slotProps.legend.component` by hand.
 */
export const FormSectionDepthContext = createContext(0)

export interface FormSectionProps extends Omit<
  FieldsetHTMLAttributes<HTMLFieldSetElement>,
  'title'
> {
  /**
   * Group name, rendered as `<legend>` wrapping a heading (`h3` by default;
   * `slotProps.legend.component` changes the level). With no `title`, pass
   * `aria-labelledby` to name the group from an element you render yourself.
   */
  title?: ReactNode
  /** Text after the legend, wired to the fieldset through `aria-describedby`. */
  description?: ReactNode
  /** The `<fieldset>` element, for measuring or moving focus into the group. */
  ref?: Ref<HTMLFieldSetElement>
  slotProps?: {
    /**
     * Props (including `className`) for the heading rendered inside the
     * `<legend>`, not the `<legend>` element itself — target the `<legend>`
     * through `EzFormSection.styleOverrides.legend` / `formSectionClasses.legend`.
     */
    legend?: FormTextSlotProps
    description?: FormTextSlotProps
    content?: React.ComponentProps<'div'>
  }
}

export const formSectionClasses = generateUtilityClasses('EzFormSection', [
  'root',
  'legend',
  'description',
  'content',
])

// A fieldset's UA stylesheet draws a border and inset padding; removing it is
// the minimum for the section to read as a plain block, the same rule as
// `VerticalStepButton`. Overridable via `EzFormSection.styleOverrides.root`.
const FormSectionRoot = styled('fieldset', { name: 'EzFormSection', slot: 'Root' })({
  border: 0,
  margin: 0,
  padding: 0,
  minWidth: 0,
})
const FormSectionLegend = styled('legend', { name: 'EzFormSection', slot: 'Legend' })({
  padding: 0,
})
const FormSectionDescription = styled(Typography, { name: 'EzFormSection', slot: 'Description' })(
  {},
)
const FormSectionContent = styled('div', { name: 'EzFormSection', slot: 'Content' })({})

/**
 * A named group of fields: `<fieldset>` + `<legend>` with MUI theming hooks.
 *
 * Wrapped in `forwardRef` so `ref` reaches the `<fieldset>` on React 18 as well as 19
 * (#71): on 19 a function component receives `ref` as an ordinary prop, but on 18 it does
 * not — a plain function component would silently never populate the consumer's ref
 * there, while the peer range advertises `^18 || ^19`. `FormSectionProps` (including its
 * `ref` field) is unchanged for consumers — `forwardRef`'s own props type omits `ref`, and
 * React never puts it in `props` here on either major, so `...rest` can't leak it onto the
 * DOM `<fieldset>`.
 */
export const FormSection = forwardRef<HTMLFieldSetElement, FormSectionProps>(
  function FormSection(inProps, forwardedRef) {
    const {
      title,
      description,
      slotProps,
      className,
      children,
      'aria-describedby': ariaDescribedBy,
      ...rest
    } = useDefaultProps({ props: inProps, name: 'EzFormSection' })
    const descriptionId = `${useId()}-description`
    const depth = useContext(FormSectionDepthContext)
    // h3 at the top level, one level deeper per nesting, capped at h6 — a plain
    // legend can't outrank the page's own heading structure. `slotProps.legend`
    // (explicit prop, or a theme default already merged in by useDefaultProps
    // above) always wins over this default: it is spread after `component`.
    const depthComponent = `h${Math.min(3 + depth, 6)}` as const
    const legendProps = {
      component: depthComponent,
      variant: 'h6',
      ...slotProps?.legend,
    } as const
    const descriptionProps = {
      component: 'p',
      variant: 'body2',
      ...slotProps?.description,
    } as const
    return (
      <FormSectionRoot
        {...rest}
        ref={forwardedRef}
        aria-describedby={ariaDescribedBy ?? (description != null ? descriptionId : undefined)}
        className={`${formSectionClasses.root}${className ? ` ${className}` : ''}`}
      >
        {title != null && (
          <FormSectionLegend className={formSectionClasses.legend}>
            <Typography {...legendProps}>{title}</Typography>
          </FormSectionLegend>
        )}
        {description != null && (
          <FormSectionDescription
            {...descriptionProps}
            id={descriptionId}
            className={`${formSectionClasses.description}${descriptionProps.className ? ` ${descriptionProps.className}` : ''}`}
          >
            {description}
          </FormSectionDescription>
        )}
        <FormSectionContent
          {...slotProps?.content}
          className={`${formSectionClasses.content}${slotProps?.content?.className ? ` ${slotProps.content.className}` : ''}`}
        >
          {/* A section without a legend renders no heading, so it must not deepen its children:
            otherwise a `title={null}` step would push nested sections from h3 to h4 under the
            form's h2 (axe heading-order). */}
          <FormSectionDepthContext.Provider value={title != null ? depth + 1 : depth}>
            {children}
          </FormSectionDepthContext.Provider>
        </FormSectionContent>
      </FormSectionRoot>
    )
  },
)
