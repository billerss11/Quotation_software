# Quotation App MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Scaffold an Electron + Vue 3 quotation app and implement the first quotation editor with hierarchical pricing and preview.

**Architecture:** Electron provides the Windows desktop shell, preload exposes a small app API, and Vue 3 renders the feature UI. Quotation calculations are pure TypeScript utilities tested with Vitest; Vue components are thin composition and presentation layers.

**Tech Stack:** Electron, Vite, Vue 3, TypeScript, PrimeVue, Vitest, vue-tsc.

---

Project rule override: do not create git commits. Each task ends with verification only.

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `electron/main.ts`
- Create: `electron/preload.ts`
- Create: `src/main.ts`
- Create: `src/App.vue`
- Create: `src/assets/main.css`

**Steps:**
1. Create package metadata and scripts for `dev`, `build`, `typecheck`, and `test`.
2. Configure Vite for Vue and the `@` alias.
3. Add Electron main and preload files.
4. Add minimal Vue entry files.
5. Run `npm install`.

### Task 2: Quotation Domain Tests

**Files:**
- Create: `src/features/quotations/types.ts`
- Create: `src/features/quotations/utils/quotationCalculations.test.ts`
- Create: `src/features/quotations/utils/quotationNumbering.test.ts`

**Steps:**
1. Write failing tests for sub-item rollups, markup, discounts, tax, and grand total.
2. Write failing tests for year-based quotation numbering.
3. Run `npm test -- --run` and confirm failures are due to missing implementation.

### Task 3: Quotation Domain Implementation

**Files:**
- Create: `src/features/quotations/utils/quotationCalculations.ts`
- Create: `src/features/quotations/utils/quotationNumbering.ts`

**Steps:**
1. Implement calculation helpers to satisfy the tests.
2. Implement quotation numbering helper.
3. Run `npm test -- --run`.

### Task 4: Quotation Editor UI

**Files:**
- Create: `src/features/quotations/composables/useQuotationEditor.ts`
- Create: `src/features/quotations/components/QuotationEditor.vue`
- Create: `src/features/quotations/components/QuotationHeaderForm.vue`
- Create: `src/features/quotations/components/LineItemsTable.vue`
- Create: `src/features/quotations/components/TotalsPanel.vue`
- Create: `src/features/quotations/components/QuotationPreview.vue`

**Steps:**
1. Build editor state around the tested domain utilities.
2. Add header, item entry, totals, and preview components using PrimeVue.
3. Keep item actions in the composable and emit intent from child components.
4. Run `npm run typecheck`.

### Task 5: Supporting Features and Verification

**Files:**
- Create: `src/features/settings/components/SettingsPanel.vue`
- Create: `src/features/customers/components/CustomersPanel.vue`
- Create: `src/shared/services/localQuotationStorage.ts`
- Modify: `src/App.vue`

**Steps:**
1. Add settings and customer placeholders with clear extension points.
2. Add local save/load service and wire save/load buttons.
3. Run `npm run build`.
4. Start the dev server and verify Electron launches.
