import { useId, type FieldsetHTMLAttributes, type ReactNode } from 'react'
import { useDefaultProps } from '@mui/material/DefaultPropsProvider'
import generateUtilityClasses from '@mui/material/generateUtilityClasses'
import { styled } from '@mui/material/styles'
import Typography from '@mui/material/Typography'
import type { FormTextSlotProps } from '../Form'

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
  slotProps?: {
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

/** A named group of fields: `<fieldset>` + `<legend>` with MUI theming hooks. */
export function FormSection(inProps: FormSectionProps) {
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
  const legendProps = { component: 'h3', variant: 'h6', ...slotProps?.legend } as const
  const descriptionProps = { component: 'p', variant: 'body2', ...slotProps?.description } as const
  return (
    <FormSectionRoot
      {...rest}
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
          id={descriptionId}
          {...descriptionProps}
          className={`${formSectionClasses.description}${descriptionProps.className ? ` ${descriptionProps.className}` : ''}`}
        >
          {description}
        </FormSectionDescription>
      )}
      <FormSectionContent
        {...slotProps?.content}
        className={`${formSectionClasses.content}${slotProps?.content?.className ? ` ${slotProps.content.className}` : ''}`}
      >
        {children}
      </FormSectionContent>
    </FormSectionRoot>
  )
}
