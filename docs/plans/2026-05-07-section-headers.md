# Section Headers Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add root-level visual section header rows that users can insert and reorder manually, and render them in the line item table, preview, and PDF without affecting pricing.

**Architecture:** Keep nested priced rows as `QuotationItem`, but broaden the root quotation list to a mixed row union that also allows `sectionHeader` rows. Filter section headers out of pricing, validation, analysis, and exchange-rate paths while adding dedicated UI rendering and JSON normalization support.

**Tech Stack:** Vue 3, TypeScript, PrimeVue, Vitest

---

### Task 1: Root Row Model

**Files:**
- Modify: `src/features/quotations/types.ts`
- Modify: `src/features/quotations/utils/quotationItems.ts`
- Test: `src/features/quotations/utils/quotationItems.test.ts`
- Test: `src/features/quotations/utils/quotationDraft.test.ts`

**Step 1:** Write failing tests for normalizing persisted section headers and preserving them in draft normalization.

**Step 2:** Run the focused tests and confirm they fail for the missing row kind behavior.

**Step 3:** Add the section header type, root-row union, type guards, and normalization helpers.

**Step 4:** Re-run the focused tests and confirm they pass.

### Task 2: Editor Root Row Operations

**Files:**
- Modify: `src/features/quotations/composables/useQuotationEditor.ts`
- Modify: `src/features/quotations/composables/useQuotationEditor.test.ts`
- Modify: `src/features/quotations/components/LineItemsTable.vue`
- Modify: `src/features/quotations/components/LineItemCard.vue`
- Create or modify: `src/features/quotations/components/SectionHeaderRow.vue` if extraction becomes cleaner
- Modify: `src/shared/i18n/messages.ts`

**Step 1:** Write failing tests for inserting and reordering a section header at the root level.

**Step 2:** Run the focused editor tests and confirm they fail for the missing actions.

**Step 3:** Add section-header create/remove/move behavior to the editor composable and render a dedicated root header row with lightweight controls.

**Step 4:** Re-run the focused editor tests and confirm they pass.

### Task 3: Preview And PDF Rendering

**Files:**
- Modify: `src/features/quotations/utils/quotationPreviewRows.ts`
- Modify: `src/features/quotations/utils/quotationPreviewRows.test.ts`
- Modify: `src/features/quotations/components/QuotationPreview.vue`
- Modify: `src/features/quotations/components/QuotationPreview.test.ts`

**Step 1:** Write failing tests for preview row generation and rendered output containing a section header band.

**Step 2:** Run the focused preview tests and confirm they fail for the missing section row type.

**Step 3:** Add preview section rows and render them as full-width accent bands in the preview document.

**Step 4:** Re-run the focused preview tests and confirm they pass.

### Task 4: Pricing And Supporting Paths

**Files:**
- Modify: `src/features/quotations/utils/quotationCalculations.ts`
- Modify: `src/features/quotations/utils/quotationAnalysis.ts`
- Modify: `src/features/quotations/utils/quotationPreviewPricing.ts`
- Modify: `src/features/quotations/utils/quotationDraft.ts`
- Modify: `src/features/quotations/utils/quotationFile.ts`
- Modify: any touched tests that assume `majorItems` contains only priced rows

**Step 1:** Add or update focused tests where section headers must be ignored by totals and analysis.

**Step 2:** Run the focused tests and confirm they fail for unfiltered section headers.

**Step 3:** Filter root section headers out of pricing, analysis, preview pricing, and normalization logic.

**Step 4:** Re-run the focused tests and confirm they pass.

### Task 5: Verification

**Files:**
- No new files expected

**Step 1:** Run focused Vitest commands for changed utilities and composables.

**Step 2:** Run `npm run typecheck`.

**Step 3:** Report actual pass/fail status and any remaining gaps.
