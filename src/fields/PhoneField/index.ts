export * from './PhoneField'
// Re-exported here as well as from the package root so rendering a stored phone
// (`formatTemplate(digits, PHONE_FORMAT)`) needs only the import the field
// itself came from, rather than reaching into the shared `formatTemplate`
// module that also holds the caret helpers no consumer needs.
export { formatTemplate, type FormatTemplate } from '../formatTemplate'
