# Customer Library Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a standalone customer library with local management and JSON import/export, while keeping quotation customer fields freely overridable per quotation.

**Architecture:** Customer records move out of quotation-history derivation and into a separate local library service. The quotation editor consumes that library for selection only; selecting a customer copies the current customer fields into the quotation header without keeping a live reference.

**Tech Stack:** Vue 3, TypeScript, PrimeVue, Vitest, localStorage-backed services.

---

Project rule override: do not create git commits. End each task with verification only.

### Task 1: Define the customer library model and file format

**Files:**
- Modify: `src/features/customers/utils/customerRecords.ts`
- Create: `src/features/customers/utils/customerLibraryFile.ts`
- Create: `src/features/customers/utils/customerLibraryFile.test.ts`
- Modify: `src/features/customers/utils/customerRecords.test.ts`

**Steps:**
1. Add the standalone customer-record shape and normalization helpers needed for full-record deduplication.
2. Write failing tests for customer-library JSON export and import.
3. Write failing tests for deduplicating fully identical records.
4. Write failing tests for preserving similar-but-different records as separate entries.
5. Run `npm test -- src/features/customers/utils/customerLibraryFile.test.ts src/features/customers/utils/customerRecords.test.ts` and confirm the new tests fail for the expected missing behavior.
6. Implement the minimal serialization, parsing, normalization, and deduplication helpers.
7. Re-run `npm test -- src/features/customers/utils/customerLibraryFile.test.ts src/features/customers/utils/customerRecords.test.ts`.

### Task 2: Add standalone customer-library storage

**Files:**
- Create: `src/shared/services/localCustomerLibraryStorage.ts`
- Create: `src/shared/services/localCustomerLibraryStorage.test.ts`
- Modify: `src/shared/services/localQuotationStorage.ts`

**Steps:**
1. Write failing tests for loading, saving, deleting, and replacing customer-library records in local storage.
2. Write a failing test for seeding the first customer library from saved quotation history without creating duplicates.
3. Run `npm test -- src/shared/services/localCustomerLibraryStorage.test.ts`.
4. Implement the standalone local storage service and quotation-history seed path.
5. Re-run `npm test -- src/shared/services/localCustomerLibraryStorage.test.ts`.

### Task 3: Move quotation editor customer selection to the library

**Files:**
- Modify: `src/features/quotations/composables/useQuotationEditor.ts`
- Create: `src/features/quotations/composables/useQuotationEditor.customer-library.test.ts`
- Modify: `src/features/customers/components/CustomerPicker.vue`

**Steps:**
1. Write a failing composable test that verifies the editor reads customer records from the standalone library rather than deriving them from quotation history.
2. Write a failing test that verifies selecting a customer copies the fields into the quotation header and later quotation edits remain independent.
3. Run `npm test -- src/features/quotations/composables/useQuotationEditor.customer-library.test.ts`.
4. Update the editor composable to load customer-library records and apply them as copied header values.
5. Update `CustomerPicker.vue` wording so it reflects a managed customer library instead of saved quotation history.
6. Re-run `npm test -- src/features/quotations/composables/useQuotationEditor.customer-library.test.ts`.

### Task 4: Turn customer management into a real library screen

**Files:**
- Modify: `src/features/customers/components/CustomersPanel.vue`
- Create: `src/features/customers/components/CustomerLibraryEditor.vue`
- Create: `src/features/customers/components/CustomerLibraryToolbar.vue`
- Create: `src/features/customers/components/CustomersPanel.test.ts`
- Modify: `src/App.vue`

**Steps:**
1. Write failing component tests for listing customer-library records.
2. Write failing component tests for add, edit, and delete actions.
3. Write failing component tests for import and export actions on the customer screen.
4. Run the targeted customer component tests.
5. Build the customer management UI using PrimeVue controls and small focused components.
6. Keep the panel explicit that quotation edits do not update the library automatically.
7. Re-run the targeted customer component tests.

### Task 5: Wire JSON import and export flows for customer-library files

**Files:**
- Modify: `src/features/customers/components/CustomersPanel.vue`
- Modify: `src/env.d.ts`
- Modify one of:
  - `electron/main.ts`
  - `electron/preload-api.ts`
  - `electron/preload.cjs`
  - any existing file-dialog bridge already used by quotation JSON import/export

**Steps:**
1. Reuse the existing quotation import/export pattern as the reference for customer-library file dialogs and download fallback.
2. Write failing tests for importing a valid customer-library JSON file and exporting the current library.
3. Write a failing test for invalid file content producing a clear customer-library error.
4. Run the targeted customer import/export tests.
5. Implement the customer-library file dialog and browser download fallback.
6. Re-run the targeted customer import/export tests.

### Task 6: Final verification and cleanup

**Files:**
- Review all files touched in Tasks 1-5

**Steps:**
1. Run `npm test -- src/features/customers src/features/quotations/composables/useQuotationEditor.customer-library.test.ts src/shared/services/localCustomerLibraryStorage.test.ts`.
2. Run `npm run typecheck`.
3. Remove unused imports, dead copy, and any leftover quotation-history wording that is no longer true.
4. Manually verify this flow in the app:
   - create a customer in the library
   - apply it to a quotation
   - override the quotation fields
   - confirm the library record stays unchanged
   - export the library
   - import the same file and confirm no exact duplicates are created
   - import a similar-but-different record and confirm both remain visible
