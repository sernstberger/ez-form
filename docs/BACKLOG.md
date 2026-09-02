# ez-form backlog

Ideas Steve has raised, not yet scheduled. Each becomes its own spec → plan → version when picked up. Order here is not priority.

## Inputs and fields

- **Stacked label variant, made the default.** A plain input with the label rendered above it: no floating label, no label motion, no JS. Touches every TextField-based field (TextField, Select, Autocomplete, NumberField, MoneyField, pickers) and `FieldFrame`. The variant default flows through theme `defaultProps`, so outlined stays one line away.
- **Table / grid cell inputs.** A compact version of each input for use inside a table, "almost an Excel type workflow": keyboard navigation between cells, Enter/Tab commit, arrow keys, paste. Pairs with field arrays and needs the error summary (errors across many rows). Open questions: MUI X DataGrid editing vs a plain MUI Table with our fields in a `cell` variant; commit-on-blur vs explicit save; how errors map to rows.
- **`useFieldArray` wrapper** with add / remove / reorder.
- **Drag-and-drop file uploader** extending `FileField`: size limits, file-type restrictions, multiple, progress hooks.
- **PhoneField, SsnField** with masking, correct `inputMode` / `autoComplete`.
- **AddressField (US only)**: address 1 / 2, city, state, zip; plus standalone **StateSelect** and **ZipField** (5-digit restriction).
- **Google Places autocomplete** feeding AddressField.
- **Mobile keyboards**: `inputMode` per field type (`numeric`, `tel`, `email`, `decimal`).

## Form-level

- **Form in a modal** (`Dialog`) with exit confirmation while dirty; composes `Form guard` + `ConfirmDialog`.
- **i18n**: default rule messages, `Yes` / `No`, `Back` / `Next` / `Submit` / `Clear` / `Cancel` / `Confirm`, date formatting.
- **Optional `ezFormTheme`** preset that sets the `Ez*` theme keys the way Steve likes; components ship with no styling (see v4 spec Section 5).

## Accessibility (all "worth at least exploring")

| Item | WCAG / APG | Notes |
|---|---|---|
| Error summary on failed submit | 3.3.1, 2.4.3 | Focused list above the form; each item a link that focuses its field (GOV.UK pattern). Important for the grid work. |
| Focus + announcement on wizard step change | 2.4.3, APG | Move focus to the step heading or first field; `aria-live` "Step 2 of 4, Plan". |
| Async status announcements | 4.1.3 | Submit pending / done / failed through a polite live region, not only a spinner. |
| `autoComplete` tokens by default | 1.3.5 | Phone, address, zip, email, name fields set the right token. |
| Required indication beyond `*` | 3.3.2 | Visually hidden "required" or a form-level legend. |
| `actionsOrder` for WizardNav / ConfirmDialog | 2.4.3, 3.2.3 | Material `Cancel \| Confirm` vs Windows/GOV.UK `Confirm \| Cancel`. Must reorder the DOM, never CSS. Theme-level default. |
| Reduced motion | 2.3.3 | Stepper `Collapse` and Dialog transitions respect `prefers-reduced-motion` (theme `transitions`). |
| Target size | 2.5.8 | Small buttons and the ReadOnlyField Edit link ≥ 24×24 px. |
| Timeouts | 2.2.1 | OTP / session expiry warnings; document for consumers. |
| Dev-mode warnings | — | Field without a label, duplicate option values. |

## Older follow-ups (v2–v3, still open)

- Paste into NumberField groups only on blur; `groupWhileTyping` leading-minus / space-group hardening + IME guard test.
- Storybook `FormParameters` per-story `docs` overrides.
- NumberFieldControl on MuiTextField spike.
- Async `defaultValues` rejection leaves the form disabled.
- Generic `useEzField` / `BoundField`.
- Autocomplete object-equality for server defaults.
- OtpField `Incomplete` story play function unverified in a browser.
- Publish / version bump (package is 0.1.0); delete the retired `feat/v1` remote branch; subpath exports if the x-date-pickers peer annoys consumers.
