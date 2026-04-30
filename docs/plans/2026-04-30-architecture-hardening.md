# Architecture Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce the top quotation-feature architectural hotspots without changing user-visible behavior or scattering code across the repo.

**Architecture:** Keep the existing feature structure, extract only the non-UI orchestration from `QuotationEditor.vue`, split only the repeated row rendering from `LineItemsTable.vue`, and replace duplicated Electron bridge contracts with one shared source of truth. Keep tests near the code they verify and only relocate hotspot-related tests.

**Tech Stack:** Vue 3, TypeScript, Electron, PrimeVue, Vitest

---

### Task 1: Unify quotation app bridge contracts

**Files:**
- Create: `src/shared/contracts/quotationApp.ts`
- Modify: `electron/preload-api.ts`
- Modify: `src/env.d.ts`
- Test: `npm run typecheck`

**Step 1: Add the shared contract file**

Move the Electron bridge payload/result/type definitions from `electron/preload-api.ts` into `src/shared/contracts/quotationApp.ts`.

**Step 2: Update preload typing**

Change `electron/preload-api.ts` to import and re-export types from `src/shared/contracts/quotationApp.ts` instead of defining them inline.

**Step 3: Update renderer global typing**

Point `src/env.d.ts` at `src/shared/contracts/quotationApp.ts` so the renderer uses the shared contract directly.

**Step 4: Run typecheck**

Run: `npm run typecheck`

Expected: PASS

### Task 2: Extract workbench state and side effects from QuotationEditor

**Files:**
- Create: `src/features/quotations/composables/useQuotationWorkbench.ts`
- Create: `src/features/quotations/composables/useQuotationWorkbench.test.ts`
- Modify: `src/features/quotations/components/QuotationEditor.vue`
- Modify: `src/features/quotations/composables/useQuotationWorkspace.ts` only if needed
- Test: `src/features/quotations/composables/useQuotationWorkbench.test.ts`

**Step 1: Write the failing test**

Cover the extracted workbench behavior that can be tested without the full component:
- support-panel collapse persistence defaults
- resize clamping/persistence behavior
- preview open/close state
- focused-item reset timing or its extracted decision logic if timing is wrapped

**Step 2: Run the targeted test**

Run: `npm test -- useQuotationWorkbench`

Expected: FAIL because the composable does not exist yet.

**Step 3: Write minimal implementation**

Create `useQuotationWorkbench.ts` and move these responsibilities out of `QuotationEditor.vue`:
- rail collapse state and persistence
- rail resize state and persistence
- preview window visibility state
- keyboard save registration
- focused-item scroll/reset orchestration

Keep the API small and quotation-specific.

**Step 4: Update QuotationEditor.vue**

Replace the moved inline state/effects with the new composable while keeping `QuotationEditor.vue` as the composition surface.

**Step 5: Re-run the targeted test**

Run: `npm test -- useQuotationWorkbench`

Expected: PASS

### Task 3: Extract quotation file actions from QuotationEditor

**Files:**
- Create: `src/features/quotations/composables/useQuotationFileActions.ts`
- Create: `src/features/quotations/composables/useQuotationFileActions.test.ts`
- Modify: `src/features/quotations/components/QuotationEditor.vue`
- Modify: hotspot-related editor tests only if their scope changes
- Test: `src/features/quotations/composables/useQuotationFileActions.test.ts`

**Step 1: Write the failing test**

Cover the file behavior that currently bloats `QuotationEditor.vue`:
- save/save as result handling
- browser download fallback behavior selection
- JSON import parsing and error mapping
- CSV import/export/template flow selection
- PDF export result handling

Mock the Electron bridge and keep assertions at the composable boundary.

**Step 2: Run the targeted test**

Run: `npm test -- useQuotationFileActions`

Expected: FAIL because the composable does not exist yet.

**Step 3: Write minimal implementation**

Create `useQuotationFileActions.ts` and move the file-operation logic out of `QuotationEditor.vue` without changing the status messages or behavior.

**Step 4: Update QuotationEditor.vue**

Replace the moved action handlers with composable calls. Keep only event wiring and component composition in the Vue file.

**Step 5: Re-run the targeted test**

Run: `npm test -- useQuotationFileActions`

Expected: PASS

### Task 4: Split repeated row rendering from LineItemsTable

**Files:**
- Create: `src/features/quotations/components/QuotationLineItemCard.vue`
- Create: `src/features/quotations/components/QuotationLineItemRow.vue`
- Modify: `src/features/quotations/components/LineItemsTable.vue`
- Modify: existing `LineItemsTable` or editor integration tests if needed
- Test: `npm run typecheck`

**Step 1: Identify repeated row markup**

Extract only the repeated quotation-specific root card and row field rendering. Do not create generic table abstractions.

**Step 2: Implement the small subcomponents**

Move the repeated markup into at most two quotation-local components:
- one root item card component
- one row component for item fields and row-level derived display

Pass explicit props and emits. Keep business calculations in existing utilities.

**Step 3: Trim LineItemsTable.vue**

Leave `LineItemsTable.vue` responsible for:
- root iteration
- table-level collapse state
- shared data preparation
- wiring child emits upward

**Step 4: Re-run typecheck**

Run: `npm run typecheck`

Expected: PASS

### Task 5: Clean up hotspot test placement and verify behavior

**Files:**
- Modify: hotspot-related `.test.ts` files only where ownership changed
- Test: targeted quotation tests plus global typecheck

**Step 1: Move tests to the new ownership boundary**

- Keep composable tests with the new composables
- Keep component integration tests with `QuotationEditor.vue`
- Delete or collapse redundant tests that now assert the same behavior at two layers

**Step 2: Run targeted tests**

Run:
- `npm test -- useQuotationFileActions`
- `npm test -- useQuotationWorkbench`
- `npm test -- QuotationEditor`

Expected: PASS

**Step 3: Run final verification**

Run: `npm run typecheck`

Expected: PASS

**Step 4: Skip commit**

Per `AGENTS.md`, do not create git commits in this repository.
