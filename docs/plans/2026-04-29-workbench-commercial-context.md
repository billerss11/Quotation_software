# Workbench Commercial Context Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move quotation currency and total from the command bar into the line-items header and rebalance both layouts cleanly.

**Architecture:** Keep state ownership in `QuotationEditor.vue`. Remove pricing-context props from `QuotationCommandBar.vue`, add them to `LineItemsTable.vue`, and use typed emits to keep currency updates explicit.

**Tech Stack:** Vue 3 `<script setup lang="ts">`, PrimeVue, TypeScript.

---

### Task 1: Simplify Command Bar

**Files:**
- Modify: `src/features/quotations/components/QuotationCommandBar.vue`

**Steps:**
1. Remove the currency selector and total block.
2. Remove now-unused props, emits, and imports.
3. Rebalance command-bar spacing after the removal.

### Task 2: Add Workbench Summary Cluster

**Files:**
- Modify: `src/features/quotations/components/LineItemsTable.vue`
- Modify: `src/features/quotations/components/QuotationEditor.vue`

**Steps:**
1. Pass quotation currency options and grand total into `LineItemsTable.vue`.
2. Add the summary cluster next to collapse/add actions.
3. Wire currency changes back to `QuotationEditor.vue`.

### Task 3: Verification

**Commands:**
- `npm run typecheck`
- `npm run build`

**Expected:** both commands pass.
