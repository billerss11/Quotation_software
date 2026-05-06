# Company Profiles Design

**Date:** 2026-05-06

## Goal

Add reusable company profiles so each quotation can choose a sender profile, while preserving historical quotation output by storing a snapshot of the selected company on the quotation itself.

## Decisions

### Separate libraries, shared management area

- Company profiles and customers remain separate record types and separate storage.
- The UI management area lives under `Settings`.
- `Settings` becomes the shared place for:
  - general app settings
  - company profile library
  - customer library

### Quotation ownership

- Each quotation stores:
  - `companyProfileId`
  - `companyProfileSnapshot`
- The id is for traceability and reselection.
- The snapshot is the source of truth for preview, print, PDF export, and saved quotation JSON.

### Historical stability

- Editing a company profile later must not silently rewrite old quotations.
- Quotations render from their saved snapshot, not from the current company-profile library.
- A quotation may still keep the selected profile id even if the library record later changes or is deleted.

## Data model

### Company profile library record

The company profile library uses its own record type with:

- `id`
- `updatedAt`
- `companyName`
- `email`
- `phone`

This mirrors the current customer-library pattern and stays small on purpose.

### Quotation draft

`QuotationDraft` gains a company section:

- `companyProfileId: string | null`
- `companyProfileSnapshot: CompanyProfile`

New quotations should initialize these values from a default or first available company profile.

## UI behavior

### Settings

`Settings` exposes three tabs:

- `General`
- `Company Profiles`
- `Customers`

Company Profiles uses the same list-plus-editor pattern already used by the customer library:

- add
- select
- edit
- save
- delete

### Quotation editor

The quotation editor gets a company-profile selector for the active quotation.

When the user chooses a profile:

- `companyProfileId` updates
- `companyProfileSnapshot` is replaced with a copy of that library record

Subsequent edits to the library do not update the quotation snapshot automatically.

## File and export behavior

- Saved quotation JSON must include `companyProfileId` and `companyProfileSnapshot`.
- Imported quotations must normalize these fields safely.
- Preview and PDF export must use the quotation snapshot.

## Migration strategy

- Existing single-profile local data should be migrated into the new company-profile library shape.
- Existing quotations that do not yet have company profile fields should normalize to:
  - no selected id
  - a default snapshot derived from the current locale
- If the old single-profile storage exists, it should seed the first library record during migration.

## Testing

Add or update focused coverage for:

- company profile library storage and migration from single-profile storage
- quotation draft normalization for new company-profile fields
- quotation editor selection behavior and snapshot updates
- any UI logic that depends on the selected quotation company profile

Run at minimum:

- focused Vitest commands for new and changed utility/composable/storage tests
- `npm run typecheck`
