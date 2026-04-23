# Line Item Workbench Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rearrange the quotation editor UI so fast line-item entry is the primary workflow.

**Architecture:** Keep `QuotationEditor.vue` as the state container. Add a command bar and inspector shell, reuse existing form/preview/totals/rates panels, and restyle `LineItemsTable.vue` into a dense workbench.

**Tech Stack:** Vue 3 `<script setup lang="ts">`, PrimeVue, TypeScript, Vitest.

---

Project rule override: do not create git commits. Verify with tests, typecheck, and build.

### Task 1: Workbench Structure

**Files:**
- Create: `src/features/quotations/components/QuotationCommandBar.vue`
- Create: `src/features/quotations/components/QuotationInspector.vue`
- Modify: `src/features/quotations/components/QuotationEditor.vue`

**Steps:**
1. Add command bar props/events for quotation header, totals, actions, logo upload, and status.
2. Add inspector tabs using PrimeVue `Tabs`.
3. Move header, rates, totals, and preview panels into inspector tabs.
4. Change editor layout to command bar + workbench grid.

### Task 2: Line Item Entry Layout

**Files:**
- Modify: `src/features/quotations/components/LineItemsTable.vue`

**Steps:**
1. Replace card-like spacing with dense workbench rows.
2. Add column labels for sub-item rows.
3. Keep major item actions near the section title.
4. Keep parent subtotal rows visually attached to the section.

### Task 3: App Shell Fit

**Files:**
- Modify: `src/App.vue`
- Modify: `src/assets/main.css`

**Steps:**
1. Reduce top chrome so the workbench gets more vertical space.
2. Keep module navigation readable.
3. Avoid nested cards and unnecessary decorative containers.

### Task 4: Verification

**Commands:**
- `npm test -- --run`
- `npm run typecheck`
- `npm run build`

**Expected:** all pass.
