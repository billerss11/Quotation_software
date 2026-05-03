# Unified Pricing Basis Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a scalable quick-entry quotation flow by making direct final price a first-class line input while preserving the existing cost-plus workflow, hierarchy, CSV import/export, preview, and analysis behavior.

**Architecture:** Keep one quotation structure and one CSV workflow. Add a line-level pricing basis so each priced leaf can be either manual final-price or cost-plus, then add a quotation-level entry mode that controls the default UX for new rows and the visible editor controls. Keep calculations centralized in quotation utilities and let the Vue layer stay props-down/events-up.

**Tech Stack:** Vue 3, TypeScript, PrimeVue, Vitest, Electron

---

### Task 1: Extend quotation data and pricing calculations

**Files:**
- Modify: `src/features/quotations/types.ts`
- Modify: `src/features/quotations/utils/quotationItems.ts`
- Modify: `src/features/quotations/utils/quotationDraft.ts`
- Modify: `src/features/quotations/utils/quotationCalculations.ts`
- Modify: `src/features/quotations/utils/quotationItemPricing.ts`
- Test: `src/features/quotations/utils/quotationCalculations.test.ts`

**Step 1: Write failing calculation tests**

Add tests that prove:
- manual-price leaf items use entered final unit price as the selling price
- manual-price leaf items do not invent markup from missing cost data
- grouped rollups still work when children mix manual-price and cost-plus rows
- switching back to detailed editing can preserve manual-price rows without data loss

**Step 2: Run the targeted test**

Run: `npm test -- quotationCalculations`

Expected: FAIL because the pricing basis and manual-price math do not exist yet.

**Step 3: Implement the minimal model and calculation changes**

- add a line pricing basis and a stored final-price field for leaf rows
- keep existing cost-plus behavior as the default path
- keep hierarchy and totals in centralized utilities
- normalize missing legacy data so older quotations continue to load as cost-plus rows

**Step 4: Re-run the targeted test**

Run: `npm test -- quotationCalculations`

Expected: PASS

### Task 2: Support one CSV template for both pricing styles

**Files:**
- Modify: `src/features/quotations/utils/lineItemsCsv.ts`
- Test: `src/features/quotations/utils/lineItemsCsv.test.ts`

**Step 1: Write failing CSV tests**

Add tests that prove:
- the template exports one header set that includes direct-price support
- quick-entry rows roundtrip through CSV using final price
- detailed rows still roundtrip through CSV using cost-plus fields
- legacy CSV files without the new direct-price column still import
- mixed quotations can export and import in one file

**Step 2: Run the targeted test**

Run: `npm test -- lineItemsCsv`

Expected: FAIL because the CSV utility cannot yet express manual-price rows.

**Step 3: Implement the minimal CSV changes**

- add direct-price support to the single template
- keep header validation backward compatible for existing legacy files
- infer pricing basis from the populated pricing columns without adding extra template variants

**Step 4: Re-run the targeted test**

Run: `npm test -- lineItemsCsv`

Expected: PASS

### Task 3: Update editor, preview, and analysis for quick entry

**Files:**
- Modify: `src/features/quotations/composables/useQuotationEditor.ts`
- Modify: `src/features/quotations/components/LineItemCard.vue`
- Modify: `src/features/quotations/components/QuotationEditor.vue`
- Modify: `src/features/quotations/components/QuotationPreview.vue`
- Modify: `src/features/quotations/utils/quotationPreviewPricing.ts`
- Modify: `src/features/quotations/utils/quotationPreviewRows.ts` only if needed
- Modify: `src/features/quotations/utils/quotationAnalysis.ts`
- Modify: `src/shared/i18n/messages.ts`
- Test: `src/features/quotations/components/QuotationEditor.analysis.test.ts`
- Test: `src/features/quotations/utils/quotationAnalysis.test.ts`

**Step 1: Write failing UI and analysis tests**

Add tests that prove:
- the quotation can switch between quick and detailed entry modes
- quick entry exposes unit price instead of cost/currency/markup for relevant rows
- preview still shows the correct customer-facing unit price and amount
- analysis remains available and reports partial-cost coverage honestly when some rows have no cost basis

**Step 2: Run the targeted tests**

Run:
- `npm test -- quotationAnalysis`
- `npm test -- QuotationEditor.analysis`

Expected: FAIL because the UI and analysis do not understand the new pricing basis yet.

**Step 3: Implement the minimal UI, i18n, preview, and analysis changes**

- add quotation-level entry mode state for the user workflow
- keep new rows aligned to the active mode while allowing existing rows to keep their pricing basis
- update the line-item editor to show direct-price controls in quick entry and preserve current detailed controls
- keep preview output unchanged from the customer’s perspective
- make analysis degrade by known data instead of pretending every row has cost/markup context

**Step 4: Re-run the targeted tests**

Run:
- `npm test -- quotationAnalysis`
- `npm test -- QuotationEditor.analysis`

Expected: PASS

### Task 4: Final verification

**Files:**
- Modify: any touched quotation tests only if needed for ownership or helper alignment
- Test: focused quotation tests and typecheck

**Step 1: Run focused regression checks**

Run:
- `npm test -- quotationCalculations`
- `npm test -- lineItemsCsv`
- `npm test -- quotationAnalysis`
- `npm test -- QuotationEditor`

Expected: PASS

**Step 2: Run typecheck**

Run: `npm run typecheck`

Expected: PASS

**Step 3: Skip commit**

Per `AGENTS.md`, do not create git commits in this repository.
