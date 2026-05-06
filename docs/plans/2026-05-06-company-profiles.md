# Company Profiles Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a reusable company-profile library, let each quotation select one profile, and persist a snapshot on the quotation for stable historical output.

**Architecture:** Replace the old singleton company-profile storage with a library service that mirrors the customer-library pattern. Extend the quotation draft with `companyProfileId` and `companyProfileSnapshot`, then route preview/export through the snapshot. Consolidate general settings, company profiles, and customers into one Settings area with separate tabs.

**Tech Stack:** Vue 3, TypeScript, PrimeVue, Vitest, Electron/Vite local-first storage

---

### Task 1: Add company-profile library storage

**Files:**
- Create: `src/features/company-profiles/utils/companyProfileRecords.ts`
- Create: `src/features/company-profiles/composables/useCompanyProfileLibrary.ts`
- Create: `src/features/company-profiles/components/CompanyProfileLibraryEditor.vue`
- Create: `src/features/company-profiles/components/CompanyProfilesPanel.vue`
- Modify: `src/shared/services/localCompanyProfileStorage.ts`
- Test: `src/shared/services/localCompanyProfileStorage.test.ts`

**Steps:**
1. Write failing storage tests for loading, saving, deleting, and migrating from the old single-profile key.
2. Run the focused storage test file and verify the new expectations fail for the missing library behavior.
3. Replace singleton storage with library-based helpers and migration support.
4. Add a small company-profile record utility module and composable for list/edit/save/delete behavior.
5. Re-run focused storage tests until green.

### Task 2: Extend quotation data with selected company profile snapshot

**Files:**
- Modify: `src/features/quotations/types.ts`
- Modify: `src/features/quotations/utils/quotationDraft.ts`
- Modify: `src/features/quotations/utils/quotationFile.ts`
- Modify: `src/features/quotations/composables/useQuotationEditor.ts`
- Test: `src/features/quotations/utils/quotationDraft.test.ts`
- Test: `src/features/quotations/composables/useQuotationEditor.test.ts`

**Steps:**
1. Write failing tests for new quotation defaults, normalization of legacy quotations, and selecting a company profile into snapshot fields.
2. Run the focused quotation tests and verify failure is tied to missing company-profile fields.
3. Extend the quotation types and normalization logic.
4. Add quotation-editor actions to select a company profile and update the snapshot.
5. Re-run focused quotation tests until green.

### Task 3: Use the quotation snapshot in preview and export

**Files:**
- Modify: `src/features/quotations/components/QuotationEditor.vue`
- Modify: `src/features/quotations/components/QuotationPreview.vue`
- Modify: `src/features/quotations/composables/useQuotationFileActions.ts`
- Test: existing quotation editor / file action tests as needed

**Steps:**
1. Write failing tests for export or editor logic where the quotation snapshot should be used instead of a global profile.
2. Run the focused tests and verify the failure.
3. Update editor wiring so preview/export receive the quotation snapshot.
4. Re-run the focused tests until green.

### Task 4: Build the shared Settings management area

**Files:**
- Modify: `src/App.vue`
- Modify: `src/features/settings/components/SettingsPanel.vue`
- Reuse/Modify: `src/features/customers/components/CustomersPanel.vue`
- Add/Modify: relevant company-profile UI files
- Modify: `src/shared/i18n/messages.ts`

**Steps:**
1. Write or update focused component tests only where practical for view logic.
2. Update Settings to use tabs for `General`, `Company Profiles`, and `Customers`.
3. Embed the company-profile panel and customer panel in that area.
4. Remove or simplify the separate Customers navigation path if it becomes redundant.
5. Add both English and Simplified Chinese copy for new labels and statuses.

### Task 5: Verify migration and integration

**Files:**
- Modify: any touched files above
- Test: focused Vitest files for storage, quotation draft, and quotation editor

**Steps:**
1. Run focused Vitest commands for touched storage and quotation files.
2. Run `npm run typecheck`.
3. Fix any regressions found by tests or typecheck.
4. Summarize what changed, what was verified, and any remaining gaps.
