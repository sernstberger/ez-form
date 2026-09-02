/** `address.zipCode` → `Zip code`: last path segment, camelCase / snake_case split, first letter upper. */
export function humanize(path: string): string {
  const last = path.split('.').at(-1) ?? path
  const words = last
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}
