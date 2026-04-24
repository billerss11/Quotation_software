# Customer Library Design

## Goal

Add a standalone customer library that users can manage and exchange as JSON, while keeping quotation header fields freely editable after a customer is selected.

## Recommended Approach

Introduce a separate customer library stored independently from quotation drafts. The library becomes the reusable source for customer records, but quotations continue to store copied header values instead of live references.

## Why This Approach

- It supports manual sharing across team members with a single JSON file.
- It removes the current dependence on saved quotation history as the only customer source.
- It avoids coupling quotations to later customer-library edits.
- It preserves the current workflow where selecting a customer fills the quotation header quickly.

## Current State

Today the app derives customer records from saved quotations in `src/features/customers/utils/customerRecords.ts`. `CustomerPicker.vue` and `CustomersPanel.vue` both show that derived history. This is convenient, but it is not a real address book and it is not a clean object for import/export.

## Data Model

Add a standalone customer record type with first-class storage.

- `id`: stable local identifier
- `customerCompany`
- `customerName`
- `contactPerson`
- `contactDetails`
- `updatedAt`

The quotation header keeps its existing fields:

- `customerCompany`
- `customerName`
- `contactPerson`
- `contactDetails`

Selecting a customer copies those fields into the quotation header. The quotation does not keep a live link to the customer library after copy-in.

## Storage Model

Store the customer library separately from quotation drafts in local storage.

- Quotation drafts remain under their existing storage flow.
- Customer library records get their own storage key and load/save service.
- On first load after this feature ships, the app should seed the customer library from existing saved quotations so current users keep their customer history.

## Import and Export

Support JSON only.

Export:

- Export the full customer library as a JSON envelope with schema metadata.
- The file should contain all customer records in a stable, app-owned structure.

Import:

- Import a customer-library JSON file into the local customer library.
- Fully identical records should be deduplicated and stored once.
- Records that differ in any customer field should be kept as separate records, even if they look like the same customer.
- Import should append new records instead of clearing the existing library.

## Deduplication Rule

Deduplication should be based on normalized full-content equality, not only a display key.

Normalization should trim whitespace, collapse repeated spaces, and compare text case-insensitively for customer identity fields. If every normalized customer field matches, the record is identical and only one copy should remain.

If any normalized customer field differs, keep both records as separate entries.

## User Experience

The customer workflow should have two surfaces.

### Customer Picker

`CustomerPicker.vue` should read from the standalone customer library instead of quotation history.

- Show reusable customer records for quick selection.
- Selecting a customer copies the record into the current quotation header.
- The picker should still work even if the quotation is later edited manually.

### Customer Management

`CustomersPanel.vue` should become a real management screen.

- List customer library records.
- Allow add, edit, and delete.
- Allow import JSON.
- Allow export JSON.
- Show clear messaging that quotation edits do not update the library automatically.

## File Format

Use an app-owned JSON envelope similar to quotation export.

- `schemaVersion`
- `app`
- `exportedAt`
- `customers`

This keeps the file portable and leaves room for schema migrations later.

## Error Handling

- Reject invalid JSON with a customer-library-specific error message.
- Reject valid JSON that does not contain the expected customer-library envelope.
- Ignore exact duplicates during import instead of throwing.
- Keep import additive so a bad record does not force destructive merge behavior.

## Testing

Add tests for:

- customer-library serialization and parsing
- deduplication of fully identical records
- preservation of distinct but similar records
- seeding the new library from saved quotation history
- customer picker applying a library record into the quotation header

## Constraints

- No live sync between team members
- No CSV support
- No hard link between quotations and library records
- No git commits by the agent
